import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function updateFunction() {
  console.log('Updating upsert_pr_data function with unit_msr...');

  // Drop existing function first
  await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS upsert_pr_data(jsonb);`);
  console.log('Dropped old function');

  await db.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION upsert_pr_data(json_data JSONB)
    RETURNS TABLE (
        pr_master_updated INTEGER,
        pr_lines_updated INTEGER,
        po_links_updated INTEGER,
        duration_seconds DECIMAL
    ) AS $$
    DECLARE
        start_time TIMESTAMP;
        pr_count INTEGER := 0;
        line_count INTEGER := 0;
        po_count INTEGER := 0;
        pr_record JSONB;
        line_record JSONB;
        po_record JSONB;
    BEGIN
        start_time := clock_timestamp();

        -- 1. Upsert pr_master
        FOR pr_record IN SELECT * FROM jsonb_array_elements(json_data->'pr_master')
        LOOP
            INSERT INTO pr_master (
                doc_num, req_name, department_name, doc_date, doc_due_date,
                doc_status, update_date, create_date, req_date, series, series_name,
                job_name, remarks, updated_at
            ) VALUES (
                (pr_record->>'doc_num')::INTEGER,
                pr_record->>'req_name',
                pr_record->>'department_name',
                (pr_record->>'doc_date')::DATE,
                (pr_record->>'doc_due_date')::DATE,
                pr_record->>'doc_status',
                (pr_record->>'update_date')::TIMESTAMP,
                (pr_record->>'create_date')::TIMESTAMP,
                (pr_record->>'req_date')::DATE,
                (pr_record->>'series')::INTEGER,
                pr_record->>'series_name',
                pr_record->>'job_name',
                pr_record->>'remarks',
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (doc_num) DO UPDATE SET
                req_name = EXCLUDED.req_name,
                department_name = EXCLUDED.department_name,
                doc_date = EXCLUDED.doc_date,
                doc_due_date = EXCLUDED.doc_due_date,
                doc_status = EXCLUDED.doc_status,
                update_date = EXCLUDED.update_date,
                create_date = EXCLUDED.create_date,
                req_date = EXCLUDED.req_date,
                series = EXCLUDED.series,
                series_name = EXCLUDED.series_name,
                job_name = EXCLUDED.job_name,
                remarks = EXCLUDED.remarks,
                updated_at = CURRENT_TIMESTAMP;

            pr_count := pr_count + 1;
        END LOOP;

        -- 2. Upsert pr_lines (with unit_msr)
        FOR line_record IN SELECT * FROM jsonb_array_elements(json_data->'pr_lines')
        LOOP
            INSERT INTO pr_lines (
                pr_doc_num, line_num, item_code, description, quantity, unit_msr,
                line_status, line_date, ocr_code, ocr_code2, ocr_code4,
                project, vendor_num, serial_num, updated_at
            ) VALUES (
                (line_record->>'pr_doc_num')::INTEGER,
                (line_record->>'line_num')::INTEGER,
                line_record->>'item_code',
                line_record->>'description',
                (line_record->>'quantity')::DECIMAL,
                line_record->>'unit_msr',
                line_record->>'line_status',
                (line_record->>'line_date')::DATE,
                line_record->>'ocr_code',
                line_record->>'ocr_code2',
                line_record->>'ocr_code4',
                line_record->>'project',
                line_record->>'vendor_num',
                line_record->>'serial_num',
                CURRENT_TIMESTAMP
            )
            ON CONFLICT (pr_doc_num, line_num) DO UPDATE SET
                item_code = EXCLUDED.item_code,
                description = EXCLUDED.description,
                quantity = EXCLUDED.quantity,
                unit_msr = EXCLUDED.unit_msr,
                line_status = EXCLUDED.line_status,
                line_date = EXCLUDED.line_date,
                ocr_code = EXCLUDED.ocr_code,
                ocr_code2 = EXCLUDED.ocr_code2,
                ocr_code4 = EXCLUDED.ocr_code4,
                project = EXCLUDED.project,
                vendor_num = EXCLUDED.vendor_num,
                serial_num = EXCLUDED.serial_num,
                updated_at = CURRENT_TIMESTAMP;

            line_count := line_count + 1;
        END LOOP;

        -- 3. Delete old po_links before inserting new ones
        DELETE FROM pr_po_link;

        -- 4. Insert pr_po_link
        FOR po_record IN SELECT * FROM jsonb_array_elements(json_data->'pr_po_link')
        LOOP
            INSERT INTO pr_po_link (
                pr_doc_num, pr_line_description, po_doc_num, po_due_date,
                po_line_description, po_quantity, po_unit, po_line_status, updated_at
            ) VALUES (
                (po_record->>'pr_doc_num')::INTEGER,
                po_record->>'pr_line_description',
                (po_record->>'po_doc_num')::INTEGER,
                (po_record->>'po_due_date')::DATE,
                po_record->>'po_line_description',
                (po_record->>'po_quantity')::DECIMAL,
                po_record->>'po_unit',
                po_record->>'po_line_status',
                CURRENT_TIMESTAMP
            );

            po_count := po_count + 1;
        END LOOP;

        -- 5. Update has_po flag
        UPDATE pr_lines SET has_po = TRUE
        WHERE EXISTS (
            SELECT 1 FROM pr_po_link po
            WHERE po.pr_doc_num = pr_lines.pr_doc_num
            AND po.pr_line_description = pr_lines.description
        );

        UPDATE pr_lines SET has_po = FALSE
        WHERE NOT EXISTS (
            SELECT 1 FROM pr_po_link po
            WHERE po.pr_doc_num = pr_lines.pr_doc_num
            AND po.pr_line_description = pr_lines.description
        );

        RETURN QUERY SELECT
            pr_count,
            line_count,
            po_count,
            ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - start_time))::DECIMAL, 2);
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅ Function upsert_pr_data updated successfully!');
  console.log('Now run sync again to get unit_msr data');
  await db.$disconnect();
}

updateFunction().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
