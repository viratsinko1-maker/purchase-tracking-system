import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function addFields() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('📡 เชื่อมต่อ PostgreSQL...\n');

    console.log('🔧 กำลังเพิ่ม fields ใน pr_master...');

    // เพิ่ม columns ใหม่
    await client.query(`
      ALTER TABLE pr_master
      ADD COLUMN IF NOT EXISTS job_name TEXT,
      ADD COLUMN IF NOT EXISTS remarks TEXT,
      ADD COLUMN IF NOT EXISTS machine_code VARCHAR(100);
    `);

    console.log('✓ เพิ่ม fields สำเร็จ!\n');

    console.log('🔄 กำลัง DROP และสร้าง materialized view ใหม่...');

    // DROP materialized view เก่า
    await client.query(`DROP MATERIALIZED VIEW IF EXISTS mv_pr_summary CASCADE;`);

    // สร้าง materialized view ใหม่พร้อม fields ใหม่
    await client.query(`
      CREATE MATERIALIZED VIEW mv_pr_summary AS
      SELECT
          pm.doc_num,
          pm.req_name,
          pm.department_name,
          pm.doc_date,
          pm.doc_due_date,
          pm.doc_status,
          pm.series_name,
          pm.update_date,
          pm.job_name,
          pm.remarks,
          pm.machine_code,
          COUNT(pl.id) AS total_lines,
          SUM(CASE WHEN pl.has_po = TRUE THEN 1 ELSE 0 END) AS lines_with_po,
          COUNT(pl.id) - SUM(CASE WHEN pl.has_po = TRUE THEN 1 ELSE 0 END) AS pending_lines,
          CASE
              WHEN COUNT(pl.id) = 0 THEN FALSE
              WHEN COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) = 0 THEN TRUE
              ELSE FALSE
          END AS is_complete,
          ARRAY_AGG(DISTINCT po.po_doc_num ORDER BY po.po_doc_num) FILTER (WHERE po.po_doc_num IS NOT NULL) AS po_numbers,
          SUM(po.po_quantity) AS total_po_quantity,
          ARRAY_AGG(DISTINCT pl.line_num ORDER BY pl.line_num) FILTER (WHERE pl.has_po = FALSE) AS pending_line_numbers
      FROM
          pr_master pm
          LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
          LEFT JOIN pr_po_link po ON pm.doc_num = po.pr_doc_num
      GROUP BY
          pm.doc_num, pm.req_name, pm.department_name, pm.doc_date, pm.doc_due_date,
          pm.doc_status, pm.series_name, pm.update_date, pm.job_name, pm.remarks, pm.machine_code
      ORDER BY
          pm.doc_date DESC;
    `);

    // สร้าง indexes ใหม่
    await client.query(`CREATE UNIQUE INDEX ON mv_pr_summary (doc_num);`);
    await client.query(`CREATE INDEX idx_mv_pr_summary_doc_date ON mv_pr_summary(doc_date);`);
    await client.query(`CREATE INDEX idx_mv_pr_summary_status ON mv_pr_summary(doc_status);`);
    await client.query(`CREATE INDEX idx_mv_pr_summary_is_complete ON mv_pr_summary(is_complete);`);

    console.log('✓ สร้าง materialized view ใหม่สำเร็จ!\n');

    console.log('🔄 กำลังอัพเดท function upsert_pr_data()...');

    await client.query(`
      CREATE OR REPLACE FUNCTION upsert_pr_data(p_pr_data JSONB)
      RETURNS TABLE(
          pr_master_updated INTEGER,
          pr_lines_updated INTEGER,
          po_links_updated INTEGER,
          status TEXT,
          error_msg TEXT
      ) AS $$
      DECLARE
          v_start_time TIMESTAMP;
          v_end_time TIMESTAMP;
          v_duration NUMERIC;
          v_pr_count INTEGER := 0;
          v_line_count INTEGER := 0;
          v_po_count INTEGER := 0;
          v_error TEXT := NULL;
          v_status TEXT := 'SUCCESS';
          v_pr_item JSONB;
          v_line_item JSONB;
          v_po_item JSONB;
      BEGIN
          v_start_time := clock_timestamp();

          BEGIN
              -- STEP 1: UPSERT pr_master (รวม fields ใหม่)
              FOR v_pr_item IN SELECT * FROM jsonb_array_elements(p_pr_data->'pr_master')
              LOOP
                  INSERT INTO pr_master (
                      doc_num, req_name, department_name, doc_date, doc_due_date,
                      doc_status, update_date, create_date, req_date, series, series_name,
                      job_name, remarks, machine_code, last_sync_date
                  ) VALUES (
                      (v_pr_item->>'doc_num')::INTEGER,
                      v_pr_item->>'req_name',
                      v_pr_item->>'department_name',
                      (v_pr_item->>'doc_date')::DATE,
                      (v_pr_item->>'doc_due_date')::DATE,
                      v_pr_item->>'doc_status',
                      (v_pr_item->>'update_date')::TIMESTAMP,
                      (v_pr_item->>'create_date')::TIMESTAMP,
                      (v_pr_item->>'req_date')::DATE,
                      (v_pr_item->>'series')::INTEGER,
                      v_pr_item->>'series_name',
                      v_pr_item->>'job_name',
                      v_pr_item->>'remarks',
                      v_pr_item->>'machine_code',
                      NOW()
                  )
                  ON CONFLICT (doc_num) DO UPDATE SET
                      req_name = EXCLUDED.req_name,
                      department_name = EXCLUDED.department_name,
                      doc_date = EXCLUDED.doc_date,
                      doc_due_date = EXCLUDED.doc_due_date,
                      doc_status = EXCLUDED.doc_status,
                      update_date = EXCLUDED.update_date,
                      req_date = EXCLUDED.req_date,
                      series = EXCLUDED.series,
                      series_name = EXCLUDED.series_name,
                      job_name = EXCLUDED.job_name,
                      remarks = EXCLUDED.remarks,
                      machine_code = EXCLUDED.machine_code,
                      last_sync_date = NOW();

                  v_pr_count := v_pr_count + 1;
              END LOOP;

              -- STEP 2: UPSERT pr_lines
              FOR v_line_item IN SELECT * FROM jsonb_array_elements(p_pr_data->'pr_lines')
              LOOP
                  INSERT INTO pr_lines (
                      pr_doc_num, line_num, item_code, description, quantity,
                      line_status, line_date, ocr_code, ocr_code2, ocr_code4,
                      project, vendor_num, serial_num, last_sync_date
                  ) VALUES (
                      (v_line_item->>'pr_doc_num')::INTEGER,
                      (v_line_item->>'line_num')::INTEGER,
                      v_line_item->>'item_code',
                      v_line_item->>'description',
                      (v_line_item->>'quantity')::NUMERIC,
                      v_line_item->>'line_status',
                      (v_line_item->>'line_date')::DATE,
                      v_line_item->>'ocr_code',
                      v_line_item->>'ocr_code2',
                      v_line_item->>'ocr_code4',
                      v_line_item->>'project',
                      v_line_item->>'vendor_num',
                      v_line_item->>'serial_num',
                      NOW()
                  )
                  ON CONFLICT (pr_doc_num, line_num, description) DO UPDATE SET
                      item_code = EXCLUDED.item_code,
                      quantity = EXCLUDED.quantity,
                      line_status = EXCLUDED.line_status,
                      line_date = EXCLUDED.line_date,
                      ocr_code = EXCLUDED.ocr_code,
                      ocr_code2 = EXCLUDED.ocr_code2,
                      ocr_code4 = EXCLUDED.ocr_code4,
                      project = EXCLUDED.project,
                      vendor_num = EXCLUDED.vendor_num,
                      serial_num = EXCLUDED.serial_num,
                      last_sync_date = NOW();

                  v_line_count := v_line_count + 1;
              END LOOP;

              -- STEP 3: UPSERT pr_po_link
              FOR v_po_item IN SELECT * FROM jsonb_array_elements(p_pr_data->'pr_po_links')
              LOOP
                  IF v_po_item->>'po_doc_num' IS NOT NULL THEN
                      INSERT INTO pr_po_link (
                          pr_doc_num, pr_line_description, po_doc_num, po_due_date,
                          po_line_description, po_quantity, po_unit, po_line_status, last_sync_date
                      ) VALUES (
                          (v_po_item->>'pr_doc_num')::INTEGER,
                          v_po_item->>'pr_line_description',
                          (v_po_item->>'po_doc_num')::INTEGER,
                          (v_po_item->>'po_due_date')::DATE,
                          v_po_item->>'po_line_description',
                          (v_po_item->>'po_quantity')::NUMERIC,
                          v_po_item->>'po_unit',
                          v_po_item->>'po_line_status',
                          NOW()
                      )
                      ON CONFLICT (pr_doc_num, pr_line_description, po_doc_num) DO UPDATE SET
                          po_due_date = EXCLUDED.po_due_date,
                          po_line_description = EXCLUDED.po_line_description,
                          po_quantity = EXCLUDED.po_quantity,
                          po_unit = EXCLUDED.po_unit,
                          po_line_status = EXCLUDED.po_line_status,
                          last_sync_date = NOW();

                      v_po_count := v_po_count + 1;
                  END IF;
              END LOOP;

              -- STEP 4: UPDATE flag has_po
              UPDATE pr_lines pl
              SET has_po = EXISTS (
                  SELECT 1 FROM pr_po_link po
                  WHERE po.pr_doc_num = pl.pr_doc_num
                  AND po.pr_line_description = pl.description
              );

          EXCEPTION WHEN OTHERS THEN
              v_status := 'FAILED';
              v_error := SQLERRM;
              RAISE NOTICE 'Error in upsert_pr_data: %', v_error;
          END;

          v_end_time := clock_timestamp();
          v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));

          -- STEP 5: บันทึก log
          INSERT INTO sync_log (
              sync_type, records_processed, pr_updated, pr_lines_updated, po_links_updated,
              duration_seconds, status, error_message
          ) VALUES (
              'UPSERT',
              v_pr_count + v_line_count + v_po_count,
              v_pr_count,
              v_line_count,
              v_po_count,
              v_duration,
              v_status,
              v_error
          );

          RETURN QUERY SELECT v_pr_count, v_line_count, v_po_count, v_status, v_error;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✓ อัพเดท function สำเร็จ!\n');

    console.log('🧪 ตรวจสอบ schema...');
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'pr_master'
      AND column_name IN ('job_name', 'remarks', 'machine_code')
      ORDER BY column_name;
    `);

    console.log('\n✓ Fields ที่เพิ่มใหม่:');
    result.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    console.log('\n✅ เพิ่ม fields เสร็จสมบูรณ์!\n');
    console.log('📝 ขั้นตอนต่อไป:');
    console.log('   1. รัน sync ใหม่: node sync-pr-complete.js');
    console.log('   2. ตรวจสอบข้อมูล: node verify-complete.js');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addFields();
