-- =============================================
-- Database Setup Script for PR_PO Database
-- Server: TMK-SERVER-002 (192.168.1.3:5432)
-- Database: PR_PO
-- =============================================

-- 1. สร้างตาราง pr_master (ข้อมูลหัว PR)
CREATE TABLE IF NOT EXISTS pr_master (
    id SERIAL PRIMARY KEY,
    doc_num INTEGER NOT NULL,
    req_name VARCHAR(255),
    department_name VARCHAR(255),
    doc_date DATE,
    doc_due_date DATE,
    doc_status VARCHAR(1),
    update_date TIMESTAMP,
    create_date TIMESTAMP,
    req_date DATE,
    job_name VARCHAR(255),           -- ชื่องานที่ขอจัดซื้อ (U_U_PR_FOR)
    machine_code VARCHAR(255),       -- รหัสเครื่องจักร (U_U_PR_MAC)
    remarks TEXT,                    -- หมายเหตุ PR
    series INTEGER,
    series_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doc_num)
);

-- สร้าง index สำหรับ pr_master
CREATE INDEX IF NOT EXISTS idx_pr_master_doc_num ON pr_master(doc_num);
CREATE INDEX IF NOT EXISTS idx_pr_master_doc_date ON pr_master(doc_date);
CREATE INDEX IF NOT EXISTS idx_pr_master_doc_status ON pr_master(doc_status);
CREATE INDEX IF NOT EXISTS idx_pr_master_series_name ON pr_master(series_name);

-- 2. สร้างตาราง pr_lines (รายการใน PR)
CREATE TABLE IF NOT EXISTS pr_lines (
    id SERIAL PRIMARY KEY,
    pr_doc_num INTEGER NOT NULL,
    line_num INTEGER NOT NULL,
    item_code VARCHAR(255),
    description TEXT,
    quantity DECIMAL(19, 6),
    line_status VARCHAR(1),
    line_date DATE,
    ocr_code VARCHAR(50),
    ocr_code2 VARCHAR(50),
    ocr_code4 VARCHAR(50),
    project VARCHAR(255),
    vendor_num VARCHAR(255),
    serial_num VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pr_doc_num, line_num),
    FOREIGN KEY (pr_doc_num) REFERENCES pr_master(doc_num) ON DELETE CASCADE
);

-- สร้าง index สำหรับ pr_lines
CREATE INDEX IF NOT EXISTS idx_pr_lines_pr_doc_num ON pr_lines(pr_doc_num);
CREATE INDEX IF NOT EXISTS idx_pr_lines_item_code ON pr_lines(item_code);
CREATE INDEX IF NOT EXISTS idx_pr_lines_line_status ON pr_lines(line_status);

-- 3. สร้างตาราง pr_po_links (ข้อมูลการเชื่อมโยง PR กับ PO)
CREATE TABLE IF NOT EXISTS pr_po_links (
    id SERIAL PRIMARY KEY,
    pr_doc_num INTEGER NOT NULL,
    pr_line_description TEXT,
    po_doc_num INTEGER NOT NULL,
    po_due_date DATE,
    po_line_description TEXT,
    po_quantity DECIMAL(19, 6),
    po_unit VARCHAR(50),
    po_line_status VARCHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pr_doc_num, pr_line_description, po_doc_num),
    FOREIGN KEY (pr_doc_num) REFERENCES pr_master(doc_num) ON DELETE CASCADE
);

-- สร้าง index สำหรับ pr_po_links
CREATE INDEX IF NOT EXISTS idx_pr_po_links_pr_doc_num ON pr_po_links(pr_doc_num);
CREATE INDEX IF NOT EXISTS idx_pr_po_links_po_doc_num ON pr_po_links(po_doc_num);

-- 4. สร้างตาราง sync_log (บันทึกการ sync)
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    sync_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50),
    records_processed INTEGER,
    duration_seconds DECIMAL(10, 2),
    error_message TEXT
);

-- สร้าง index สำหรับ sync_log
CREATE INDEX IF NOT EXISTS idx_sync_log_sync_date ON sync_log(sync_date);

-- =============================================
-- 5. สร้าง Function: upsert_pr_data
-- ใช้สำหรับ upsert ข้อมูล PR จาก SAP
-- =============================================
CREATE OR REPLACE FUNCTION upsert_pr_data(json_data JSONB)
RETURNS TABLE (
    pr_master_updated INTEGER,
    pr_lines_updated INTEGER,
    po_links_updated INTEGER,
    duration_seconds DECIMAL
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    pr_count INTEGER := 0;
    line_count INTEGER := 0;
    po_count INTEGER := 0;
    pr_record JSONB;
    line_record JSONB;
    po_record JSONB;
BEGIN
    start_time := CLOCK_TIMESTAMP();

    -- 1. Upsert pr_master
    FOR pr_record IN SELECT * FROM jsonb_array_elements(json_data->'pr_master')
    LOOP
        INSERT INTO pr_master (
            doc_num, req_name, department_name, doc_date, doc_due_date,
            doc_status, update_date, create_date, req_date,
            job_name, machine_code, remarks, series, series_name,
            updated_at
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
            pr_record->>'job_name',
            pr_record->>'machine_code',
            pr_record->>'remarks',
            (pr_record->>'series')::INTEGER,
            pr_record->>'series_name',
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
            job_name = EXCLUDED.job_name,
            machine_code = EXCLUDED.machine_code,
            remarks = EXCLUDED.remarks,
            series = EXCLUDED.series,
            series_name = EXCLUDED.series_name,
            updated_at = CURRENT_TIMESTAMP;

        pr_count := pr_count + 1;
    END LOOP;

    -- 2. Upsert pr_lines
    FOR line_record IN SELECT * FROM jsonb_array_elements(json_data->'pr_lines')
    LOOP
        INSERT INTO pr_lines (
            pr_doc_num, line_num, item_code, description, quantity,
            line_status, line_date, ocr_code, ocr_code2, ocr_code4,
            project, vendor_num, serial_num, updated_at
        ) VALUES (
            (line_record->>'pr_doc_num')::INTEGER,
            (line_record->>'line_num')::INTEGER,
            line_record->>'item_code',
            line_record->>'description',
            (line_record->>'quantity')::DECIMAL,
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
    DELETE FROM pr_po_links;

    -- 4. Insert pr_po_links
    FOR po_record IN SELECT * FROM jsonb_array_elements(json_data->'pr_po_links')
    LOOP
        INSERT INTO pr_po_links (
            pr_doc_num, pr_line_description, po_doc_num, po_due_date,
            po_line_description, po_quantity, po_unit, po_line_status,
            updated_at
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
        )
        ON CONFLICT (pr_doc_num, pr_line_description, po_doc_num) DO UPDATE SET
            po_due_date = EXCLUDED.po_due_date,
            po_line_description = EXCLUDED.po_line_description,
            po_quantity = EXCLUDED.po_quantity,
            po_unit = EXCLUDED.po_unit,
            po_line_status = EXCLUDED.po_line_status,
            updated_at = CURRENT_TIMESTAMP;

        po_count := po_count + 1;
    END LOOP;

    end_time := CLOCK_TIMESTAMP();

    -- 5. บันทึก sync log
    INSERT INTO sync_log (sync_date, status, records_processed, duration_seconds)
    VALUES (
        CURRENT_TIMESTAMP,
        'success',
        pr_count + line_count + po_count,
        EXTRACT(EPOCH FROM (end_time - start_time))
    );

    RETURN QUERY SELECT pr_count, line_count, po_count,
                        EXTRACT(EPOCH FROM (end_time - start_time))::DECIMAL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. สร้าง View: vw_pr_detail
-- สำหรับแสดงรายละเอียด PR พร้อม Lines และ PO
-- =============================================
CREATE OR REPLACE VIEW vw_pr_detail AS
SELECT
    m.doc_num AS pr_doc_num,
    m.req_name AS pr_req_name,
    m.department_name AS pr_department,
    m.doc_date AS pr_date,
    m.doc_due_date AS pr_due_date,
    m.doc_status AS pr_status,
    m.series_name AS pr_series,
    m.update_date AS pr_update_date,
    m.req_date AS pr_req_date,
    m.job_name AS pr_job_name,
    m.remarks AS pr_remarks,
    l.id AS pr_line_id,
    l.line_num AS pr_line_num,
    l.item_code AS pr_item_code,
    l.description AS pr_description,
    l.quantity AS pr_quantity,
    l.line_status AS pr_line_status,
    l.project AS pr_project,
    l.vendor_num AS pr_vendor,
    CASE WHEN po.po_doc_num IS NOT NULL THEN TRUE ELSE FALSE END AS has_po,
    po.po_doc_num,
    po.po_due_date,
    po.po_line_description AS po_description,
    po.po_quantity,
    po.po_unit,
    po.po_line_status AS po_status
FROM pr_master m
LEFT JOIN pr_lines l ON m.doc_num = l.pr_doc_num
LEFT JOIN pr_po_links po ON (l.pr_doc_num = po.pr_doc_num AND l.description = po.pr_line_description)
ORDER BY m.doc_num, l.line_num;

-- =============================================
-- 7. สร้าง Materialized View: mv_pr_summary
-- สำหรับแสดงสรุป PR (ใช้ในหน้าหลัก)
-- =============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_pr_summary AS
SELECT
    m.doc_num,
    m.req_name,
    m.department_name,
    m.doc_date,
    m.doc_due_date,
    m.doc_status,
    m.series_name,
    m.update_date,
    m.job_name,
    m.remarks,
    COUNT(DISTINCT l.id) AS total_lines,
    COUNT(DISTINCT CASE WHEN po.po_doc_num IS NOT NULL THEN l.id END) AS lines_with_po,
    COUNT(DISTINCT CASE WHEN po.po_doc_num IS NULL AND l.line_status = 'O' THEN l.id END) AS pending_lines,
    CASE
        WHEN COUNT(DISTINCT l.id) = COUNT(DISTINCT CASE WHEN po.po_doc_num IS NOT NULL THEN l.id END)
        THEN TRUE
        ELSE FALSE
    END AS is_complete,
    ARRAY_AGG(DISTINCT po.po_doc_num) FILTER (WHERE po.po_doc_num IS NOT NULL) AS po_numbers,
    SUM(po.po_quantity) AS total_po_quantity,
    ARRAY_AGG(DISTINCT l.line_num) FILTER (WHERE po.po_doc_num IS NULL AND l.line_status = 'O') AS pending_line_numbers
FROM pr_master m
LEFT JOIN pr_lines l ON m.doc_num = l.pr_doc_num
LEFT JOIN pr_po_links po ON (l.pr_doc_num = po.pr_doc_num AND l.description = po.pr_line_description)
GROUP BY m.doc_num, m.req_name, m.department_name, m.doc_date, m.doc_due_date,
         m.doc_status, m.series_name, m.update_date, m.job_name, m.remarks;

-- สร้าง index สำหรับ materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_pr_summary_doc_num ON mv_pr_summary(doc_num);
CREATE INDEX IF NOT EXISTS idx_mv_pr_summary_doc_date ON mv_pr_summary(doc_date);
CREATE INDEX IF NOT EXISTS idx_mv_pr_summary_doc_status ON mv_pr_summary(doc_status);
CREATE INDEX IF NOT EXISTS idx_mv_pr_summary_series_name ON mv_pr_summary(series_name);
CREATE INDEX IF NOT EXISTS idx_mv_pr_summary_is_complete ON mv_pr_summary(is_complete);

-- =============================================
-- 8. สร้าง Function: quick_refresh_view
-- ใช้สำหรับ refresh materialized view
-- =============================================
CREATE OR REPLACE FUNCTION quick_refresh_view()
RETURNS TEXT AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;
    RETURN 'View refreshed successfully at ' || NOW()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- สิ้นสุด Database Setup Script
-- =============================================
