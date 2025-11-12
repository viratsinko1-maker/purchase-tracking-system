// Script to update upsert_pr_data function to support job_name and remarks
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function updateUpsertFunction() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Drop existing function
    console.log('Dropping existing upsert_pr_data function...');
    await client.query('DROP FUNCTION IF EXISTS upsert_pr_data(JSONB) CASCADE;');

    // Create updated function with job_name and remarks
    console.log('Creating updated upsert_pr_data function...');
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

          -- 🔒 เริ่ม TRANSACTION
          BEGIN
              -- ✅ STEP 1: UPSERT pr_master (with job_name and remarks)
              FOR v_pr_item IN SELECT * FROM jsonb_array_elements(p_pr_data->'pr_master')
              LOOP
                  INSERT INTO pr_master (
                      doc_num, req_name, department_name, doc_date, doc_due_date,
                      doc_status, update_date, create_date, req_date, series, series_name,
                      job_name, remarks, last_sync_date
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
                      last_sync_date = NOW();

                  v_pr_count := v_pr_count + 1;
              END LOOP;

              -- ✅ STEP 2: UPSERT pr_lines
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

              -- ✅ STEP 3: UPSERT pr_po_link
              FOR v_po_item IN SELECT * FROM jsonb_array_elements(p_pr_data->'pr_po_links')
              LOOP
                  -- Skip ถ้าไม่มี PO
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

              -- ✅ STEP 4: UPDATE flag has_po (อัตโนมัติ)
              UPDATE pr_lines pl
              SET has_po = EXISTS (
                  SELECT 1 FROM pr_po_link po
                  WHERE po.pr_doc_num = pl.pr_doc_num
                  AND po.pr_line_description = pl.description
              );

              -- 🔓 COMMIT TRANSACTION (ทุกอย่างสำเร็จ)
              v_end_time := clock_timestamp();
              v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));

              -- บันทึก log
              INSERT INTO sync_log (
                  sync_type, records_processed, pr_updated, pr_lines_updated, po_links_updated,
                  duration_seconds, status
              ) VALUES (
                  'UPSERT',
                  v_pr_count + v_line_count + v_po_count,
                  v_pr_count,
                  v_line_count,
                  v_po_count,
                  v_duration,
                  'SUCCESS'
              );

          EXCEPTION WHEN OTHERS THEN
              -- 🔙 ROLLBACK ถ้าเกิด error
              v_error := SQLERRM;
              v_status := 'FAILED';

              -- บันทึก error log
              INSERT INTO sync_log (
                  sync_type, status, error_message
              ) VALUES (
                  'UPSERT', 'FAILED', v_error
              );

              RAISE EXCEPTION 'UPSERT failed: %', v_error;
          END;

          -- Return ผลลัพธ์
          RETURN QUERY SELECT v_pr_count, v_line_count, v_po_count, v_status, v_error;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✅ Function updated successfully!');

  } catch (error) {
    console.error('❌ Error updating function:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

updateUpsertFunction()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
