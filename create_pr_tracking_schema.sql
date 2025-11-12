-- =====================================================
-- PR TRACKING DATABASE SCHEMA (SAP B1)
-- เวอร์ชัน: 2.0
-- สร้างโดย: Claude Code
-- วันที่: 2025-10-23
-- =====================================================

-- 📌 SECTION 1: DROP EXISTING OBJECTS
-- ลบของเก่า (ถ้ามี) เพื่อสร้างใหม่
DROP MATERIALIZED VIEW IF EXISTS mv_pr_summary CASCADE;
DROP VIEW IF EXISTS vw_pr_detail CASCADE;
DROP VIEW IF EXISTS vw_pr_pending CASCADE;
DROP VIEW IF EXISTS vw_po_summary CASCADE;
DROP FUNCTION IF EXISTS upsert_pr_data(JSONB) CASCADE;
DROP FUNCTION IF EXISTS quick_refresh_view() CASCADE;
DROP TRIGGER IF EXISTS update_pr_master_timestamp ON pr_master CASCADE;
DROP TRIGGER IF EXISTS update_pr_lines_timestamp ON pr_lines CASCADE;
DROP TRIGGER IF EXISTS update_pr_po_link_timestamp ON pr_po_link CASCADE;
DROP TABLE IF EXISTS pr_po_link CASCADE;
DROP TABLE IF EXISTS pr_lines CASCADE;
DROP TABLE IF EXISTS pr_master CASCADE;
DROP TABLE IF EXISTS sync_log CASCADE;

-- 📌 SECTION 2: TABLE CREATION
-- สร้าง tables ตามลำดับ dependency

-- 🔹 Table 1: pr_master (ข้อมูลหลักของ PR)
CREATE TABLE pr_master (
    id SERIAL PRIMARY KEY,
    doc_num INTEGER NOT NULL UNIQUE,           -- เลขที่ PR (ต้อง unique)
    req_name VARCHAR(255),                     -- ชื่อผู้เปิด PR
    department_name VARCHAR(255),              -- ชื่อหน่วยงานผู้เปิด PR
    doc_date DATE NOT NULL,                    -- วันที่เปิด PR
    doc_due_date DATE,                         -- วันที่ครบกำหนด PR
    doc_status VARCHAR(1) DEFAULT 'O',         -- สถานะเอกสาร (O=Open, C=Close)
    update_date TIMESTAMP,                     -- วันที่อัปเดตล่าสุด (จาก SAP)
    create_date TIMESTAMP,                     -- วันที่สร้างเอกสาร (จาก SAP)
    req_date DATE,                             -- วันที่ต้องการของ
    series INTEGER,                            -- Series number
    series_name VARCHAR(50),                   -- คำนำหน้าเอกสาร PR (เช่น "PR")
    last_sync_date TIMESTAMP DEFAULT NOW(),    -- วันที่ sync ข้อมูลล่าสุด
    created_at TIMESTAMP DEFAULT NOW(),        -- วันที่สร้างใน PostgreSQL
    updated_at TIMESTAMP DEFAULT NOW()         -- วันที่แก้ไขล่าสุดใน PostgreSQL
);

COMMENT ON TABLE pr_master IS 'ตารางหลักสำหรับเก็บข้อมูล Purchase Request (PR) แต่ละใบ';
COMMENT ON COLUMN pr_master.doc_num IS 'เลขที่ PR (DocNum จาก SAP)';
COMMENT ON COLUMN pr_master.doc_status IS 'สถานะ: O=Open (เปิดอยู่), C=Closed (ปิดแล้ว)';
COMMENT ON COLUMN pr_master.last_sync_date IS 'วันที่ sync ข้อมูลจาก SAP ครั้งล่าสุด';

-- 🔹 Table 2: pr_lines (รายละเอียดแต่ละ line ของ PR)
CREATE TABLE pr_lines (
    id SERIAL PRIMARY KEY,
    pr_doc_num INTEGER NOT NULL,               -- เลขที่ PR (FK to pr_master)
    line_num INTEGER NOT NULL,                 -- เลขบรรทัด (0, 1, 2, ...)
    item_code VARCHAR(100),                    -- รหัสสินค้า
    description TEXT,                          -- ชื่อสินค้า / รายการ
    quantity NUMERIC(19, 6),                   -- จำนวนที่ขอ
    line_status VARCHAR(1),                    -- สถานะรายการ (O=Open, C=Close)
    line_date DATE,                            -- วันที่รายการ
    ocr_code VARCHAR(50),                      -- Cost Center 1
    ocr_code2 VARCHAR(50),                     -- Cost Center 2
    ocr_code4 VARCHAR(50),                     -- Cost Center 4
    project VARCHAR(100),                      -- รหัสโครงการ
    vendor_num VARCHAR(100),                   -- รหัสผู้ขาย
    serial_num VARCHAR(100),                   -- Serial Number
    has_po BOOLEAN DEFAULT FALSE,              -- Flag: มี PO แล้วหรือยัง
    last_sync_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign Key
    CONSTRAINT fk_pr_master FOREIGN KEY (pr_doc_num)
        REFERENCES pr_master(doc_num) ON DELETE CASCADE,

    -- Unique Constraint: PR + Line + Description ต้องไม่ซ้ำ
    CONSTRAINT uq_pr_line UNIQUE (pr_doc_num, line_num, description)
);

COMMENT ON TABLE pr_lines IS 'ตารางเก็บรายละเอียดแต่ละ line (item) ของ PR';
COMMENT ON COLUMN pr_lines.has_po IS 'Flag บอกว่า line นี้มี PO ออกแล้วหรือยัง (auto update)';
COMMENT ON COLUMN pr_lines.line_num IS 'เลขบรรทัดใน PR (เริ่มจาก 0)';

-- 🔹 Table 3: pr_po_link (ความสัมพันธ์ระหว่าง PR กับ PO)
CREATE TABLE pr_po_link (
    id SERIAL PRIMARY KEY,
    pr_doc_num INTEGER NOT NULL,               -- เลขที่ PR (FK to pr_master)
    pr_line_description TEXT,                  -- รายละเอียดสินค้า (PR)
    po_doc_num INTEGER,                        -- เลขที่ PO
    po_due_date DATE,                          -- วันที่ครบกำหนด PO
    po_line_description TEXT,                  -- รายละเอียดสินค้า (PO)
    po_quantity NUMERIC(19, 6),                -- จำนวนใน PO
    po_unit VARCHAR(50),                       -- หน่วยใน PO
    po_line_status VARCHAR(1),                 -- สถานะรายการ (PO)
    last_sync_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign Key
    CONSTRAINT fk_pr_master_link FOREIGN KEY (pr_doc_num)
        REFERENCES pr_master(doc_num) ON DELETE CASCADE,

    -- Unique Constraint: PR + Description + PO ต้องไม่ซ้ำ
    CONSTRAINT uq_pr_po_link UNIQUE (pr_doc_num, pr_line_description, po_doc_num)
);

COMMENT ON TABLE pr_po_link IS 'ตารางเชื่อม PR กับ PO (1 PR อาจมีหลาย PO, 1 PO อาจเชื่อมหลาย line)';
COMMENT ON COLUMN pr_po_link.pr_line_description IS 'รายละเอียดสินค้าจาก PR (ใช้สำหรับ join กับ pr_lines)';

-- 🔹 Table 4: sync_log (เก็บประวัติการ sync)
CREATE TABLE sync_log (
    id SERIAL PRIMARY KEY,
    sync_date TIMESTAMP DEFAULT NOW(),         -- วันที่ sync
    sync_type VARCHAR(50) DEFAULT 'UPSERT',    -- ประเภท (UPSERT, FULL_REFRESH, etc.)
    records_processed INTEGER DEFAULT 0,       -- จำนวนรายการทั้งหมดที่ประมวลผล
    pr_updated INTEGER DEFAULT 0,              -- จำนวน PR ที่อัปเดต
    pr_lines_updated INTEGER DEFAULT 0,        -- จำนวน PR lines ที่อัปเดต
    po_links_updated INTEGER DEFAULT 0,        -- จำนวน PO links ที่อัปเดต
    duration_seconds NUMERIC(10, 2),           -- เวลาที่ใช้ (วินาที)
    status VARCHAR(20) DEFAULT 'SUCCESS',      -- สถานะ (SUCCESS, FAILED, PARTIAL)
    error_message TEXT,                        -- ข้อความ error (ถ้ามี)
    last_update_date TIMESTAMP                 -- วันที่อัปเดตล่าสุดจาก SAP (UpdateDate)
);

COMMENT ON TABLE sync_log IS 'ตารางบันทึกประวัติการ sync ข้อมูลจาก SAP';
COMMENT ON COLUMN sync_log.sync_type IS 'ประเภทการ sync: UPSERT (ปกติ), FULL_REFRESH (ลบแล้วสร้างใหม่)';

-- 📌 SECTION 3: INDEXES
-- สร้าง indexes สำหรับเพิ่มประสิทธิภาพการค้นหา

-- Indexes สำหรับ pr_master
CREATE INDEX idx_pr_master_doc_num ON pr_master(doc_num);           -- ใช้สำหรับค้นหา PR
CREATE INDEX idx_pr_master_doc_date ON pr_master(doc_date);         -- ใช้สำหรับ filter ช่วงวันที่
CREATE INDEX idx_pr_master_update_date ON pr_master(update_date);   -- ใช้สำหรับหาข้อมูลที่เปลี่ยนแปลง
CREATE INDEX idx_pr_master_doc_status ON pr_master(doc_status);     -- ใช้สำหรับ filter สถานะ
CREATE INDEX idx_pr_master_series_name ON pr_master(series_name);   -- ใช้สำหรับ filter series

COMMENT ON INDEX idx_pr_master_doc_num IS 'Index สำหรับค้นหา PR ด้วยเลขที่ PR';
COMMENT ON INDEX idx_pr_master_doc_date IS 'Index สำหรับ filter วันที่เปิด PR';

-- Indexes สำหรับ pr_lines
CREATE INDEX idx_pr_lines_pr_doc_num ON pr_lines(pr_doc_num);       -- ใช้สำหรับ join กับ pr_master
CREATE INDEX idx_pr_lines_item_code ON pr_lines(item_code);         -- ใช้สำหรับค้นหา item
CREATE INDEX idx_pr_lines_line_status ON pr_lines(line_status);     -- ใช้สำหรับ filter สถานะ line
CREATE INDEX idx_pr_lines_has_po ON pr_lines(has_po);               -- ใช้สำหรับหา line ที่ยังไม่มี PO
CREATE INDEX idx_pr_lines_project ON pr_lines(project);             -- ใช้สำหรับ filter โครงการ
CREATE INDEX idx_pr_lines_description ON pr_lines USING gin(to_tsvector('simple', description)); -- Full-text search

COMMENT ON INDEX idx_pr_lines_has_po IS 'Index สำหรับหา PR lines ที่ยังไม่มี PO (has_po = false)';
COMMENT ON INDEX idx_pr_lines_description IS 'Full-text index สำหรับค้นหาในรายละเอียดสินค้า';

-- Indexes สำหรับ pr_po_link
CREATE INDEX idx_pr_po_link_pr_doc_num ON pr_po_link(pr_doc_num);   -- ใช้สำหรับ join กับ pr_master
CREATE INDEX idx_pr_po_link_po_doc_num ON pr_po_link(po_doc_num);   -- ใช้สำหรับค้นหา PO
CREATE INDEX idx_pr_po_link_po_line_status ON pr_po_link(po_line_status); -- ใช้สำหรับ filter สถานะ PO

COMMENT ON INDEX idx_pr_po_link_po_doc_num IS 'Index สำหรับค้นหา PO ด้วยเลขที่ PO';

-- Composite Index สำหรับ query ที่ซับซ้อน
CREATE INDEX idx_pr_master_composite ON pr_master(doc_status, doc_date, series_name);
COMMENT ON INDEX idx_pr_master_composite IS 'Composite index สำหรับ filter หลายเงื่อนไขพร้อมกัน';

-- 📌 SECTION 4: TRIGGERS
-- Auto update timestamps

-- Function สำหรับ update timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger สำหรับ pr_master
CREATE TRIGGER update_pr_master_timestamp
    BEFORE UPDATE ON pr_master
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Trigger สำหรับ pr_lines
CREATE TRIGGER update_pr_lines_timestamp
    BEFORE UPDATE ON pr_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- Trigger สำหรับ pr_po_link
CREATE TRIGGER update_pr_po_link_timestamp
    BEFORE UPDATE ON pr_po_link
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();

-- 📌 SECTION 5: VIEWS
-- Views สำหรับแสดงผลข้อมูล

-- 🔹 View 1: vw_pr_detail (รายละเอียด PR พร้อม PO ทั้งหมด)
CREATE OR REPLACE VIEW vw_pr_detail AS
SELECT
    -- ข้อมูล PR Master
    pm.id AS pr_master_id,
    pm.doc_num AS pr_doc_num,
    pm.req_name AS pr_req_name,
    pm.department_name AS pr_department,
    pm.doc_date AS pr_date,
    pm.doc_due_date AS pr_due_date,
    pm.doc_status AS pr_status,
    pm.series_name AS pr_series,
    pm.update_date AS pr_update_date,
    pm.req_date AS pr_req_date,

    -- ข้อมูล PR Lines
    pl.id AS pr_line_id,
    pl.line_num AS pr_line_num,
    pl.item_code AS pr_item_code,
    pl.description AS pr_description,
    pl.quantity AS pr_quantity,
    pl.line_status AS pr_line_status,
    pl.project AS pr_project,
    pl.vendor_num AS pr_vendor,
    pl.has_po AS has_po,

    -- ข้อมูล PO Link
    po.id AS po_link_id,
    po.po_doc_num AS po_doc_num,
    po.po_due_date AS po_due_date,
    po.po_line_description AS po_description,
    po.po_quantity AS po_quantity,
    po.po_unit AS po_unit,
    po.po_line_status AS po_status
FROM
    pr_master pm
    LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
    LEFT JOIN pr_po_link po ON (pm.doc_num = po.pr_doc_num AND pl.description = po.pr_line_description)
ORDER BY
    pm.doc_date DESC, pm.doc_num DESC, pl.line_num ASC;

COMMENT ON VIEW vw_pr_detail IS 'View รายละเอียด PR พร้อม Lines และ PO ทั้งหมด (ใช้สำหรับแสดงข้อมูลละเอียด)';

-- 🔹 View 2: vw_pr_pending (PR ที่ยังไม่ครบทุก line)
CREATE OR REPLACE VIEW vw_pr_pending AS
SELECT
    pm.doc_num,
    pm.req_name,
    pm.department_name,
    pm.doc_date,
    pm.doc_due_date,
    pm.doc_status,
    pm.series_name,
    COUNT(pl.id) AS total_lines,
    COUNT(pl.id) FILTER (WHERE pl.has_po = TRUE) AS lines_with_po,
    COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) AS pending_lines,
    ARRAY_AGG(DISTINCT po.po_doc_num ORDER BY po.po_doc_num) FILTER (WHERE po.po_doc_num IS NOT NULL) AS po_numbers
FROM
    pr_master pm
    LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
    LEFT JOIN pr_po_link po ON pm.doc_num = po.pr_doc_num
WHERE
    pm.doc_status = 'O'  -- เฉพาะ PR ที่ยังเปิดอยู่
GROUP BY
    pm.doc_num, pm.req_name, pm.department_name, pm.doc_date, pm.doc_due_date, pm.doc_status, pm.series_name
HAVING
    COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) > 0  -- มีอย่างน้อย 1 line ที่ยังไม่มี PO
ORDER BY
    pm.doc_date ASC;

COMMENT ON VIEW vw_pr_pending IS 'View แสดง PR ที่ยังไม่ครบทุก line (ยังมี line ที่ไม่มี PO)';

-- 🔹 View 3: vw_po_summary (สรุป PO แต่ละใบว่าผูกกับ PR อะไรบ้าง)
CREATE OR REPLACE VIEW vw_po_summary AS
SELECT
    po.po_doc_num,
    po.po_due_date,
    COUNT(DISTINCT po.pr_doc_num) AS pr_count,
    ARRAY_AGG(DISTINCT po.pr_doc_num ORDER BY po.pr_doc_num) AS pr_numbers,
    COUNT(po.id) AS total_lines,
    SUM(po.po_quantity) AS total_quantity
FROM
    pr_po_link po
WHERE
    po.po_doc_num IS NOT NULL
GROUP BY
    po.po_doc_num, po.po_due_date
ORDER BY
    po.po_doc_num DESC;

COMMENT ON VIEW vw_po_summary IS 'View สรุปข้อมูล PO แต่ละใบ พร้อมรายการ PR ที่ผูก';

-- 📌 SECTION 6: MATERIALIZED VIEW
-- Materialized View สำหรับ query ที่เร็วขึ้น

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
    COUNT(pl.id) AS total_lines,
    COUNT(pl.id) FILTER (WHERE pl.has_po = TRUE) AS lines_with_po,
    COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) AS pending_lines,
    CASE
        WHEN COUNT(pl.id) = 0 THEN FALSE
        WHEN COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) = 0 THEN TRUE
        ELSE FALSE
    END AS is_complete,
    ARRAY_AGG(DISTINCT po.po_doc_num ORDER BY po.po_doc_num) FILTER (WHERE po.po_doc_num IS NOT NULL) AS po_numbers,
    SUM(po.po_quantity) AS total_po_quantity
FROM
    pr_master pm
    LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
    LEFT JOIN pr_po_link po ON pm.doc_num = po.pr_doc_num
GROUP BY
    pm.doc_num, pm.req_name, pm.department_name, pm.doc_date, pm.doc_due_date,
    pm.doc_status, pm.series_name, pm.update_date
ORDER BY
    pm.doc_date DESC;

-- สร้าง Unique Index สำหรับ REFRESH CONCURRENTLY
CREATE UNIQUE INDEX ON mv_pr_summary (doc_num);

-- สร้าง Indexes เพิ่มเติมสำหรับ Materialized View
CREATE INDEX idx_mv_pr_summary_doc_date ON mv_pr_summary(doc_date);
CREATE INDEX idx_mv_pr_summary_status ON mv_pr_summary(doc_status);
CREATE INDEX idx_mv_pr_summary_is_complete ON mv_pr_summary(is_complete);

COMMENT ON MATERIALIZED VIEW mv_pr_summary IS 'Materialized View สรุปข้อมูล PR แต่ละใบ (refresh ด้วย REFRESH MATERIALIZED VIEW CONCURRENTLY)';

-- 📌 SECTION 7: FUNCTIONS
-- Functions สำหรับจัดการข้อมูล

-- 🔹 Function 1: upsert_pr_data (UPSERT ข้อมูลด้วย Transaction)
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
        -- ✅ STEP 1: UPSERT pr_master
        FOR v_pr_item IN SELECT * FROM jsonb_array_elements(p_pr_data->'pr_master')
        LOOP
            INSERT INTO pr_master (
                doc_num, req_name, department_name, doc_date, doc_due_date,
                doc_status, update_date, create_date, req_date, series, series_name, last_sync_date
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

COMMENT ON FUNCTION upsert_pr_data IS 'Function สำหรับ UPSERT ข้อมูล PR-PO แบบ ATOMIC (ใช้ Transaction)';

-- 🔹 Function 2: quick_refresh_view (Refresh Materialized View)
CREATE OR REPLACE FUNCTION quick_refresh_view()
RETURNS TEXT AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_duration NUMERIC;
BEGIN
    v_start_time := clock_timestamp();

    -- Refresh Materialized View แบบ CONCURRENTLY (ไม่ lock table)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;

    v_end_time := clock_timestamp();
    v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));

    RETURN format('Refreshed successfully in %.2f seconds', v_duration);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION quick_refresh_view IS 'Function สำหรับ refresh Materialized View แบบ CONCURRENTLY';

-- 📌 SECTION 8: SAMPLE DATA (COMMENTED)
-- ตัวอย่างการ INSERT ข้อมูล (สำหรับทดสอบ)

/*
-- ตัวอย่างข้อมูล PR
INSERT INTO pr_master (doc_num, req_name, department_name, doc_date, doc_due_date, doc_status, series_name)
VALUES
    (1, 'สมชาย ใจดี', 'แผนกจัดซื้อ', '2025-01-15', '2025-01-30', 'O', 'PR'),
    (2, 'สมหญิง รักษา', 'แผนกคลังสินค้า', '2025-01-16', '2025-01-31', 'O', 'PR');

-- ตัวอย่างข้อมูล PR Lines
INSERT INTO pr_lines (pr_doc_num, line_num, item_code, description, quantity, line_status)
VALUES
    (1, 0, 'ITEM001', 'คอมพิวเตอร์ Notebook', 5, 'O'),
    (1, 1, 'ITEM002', 'เมาส์ไร้สาย', 10, 'O'),
    (2, 0, 'ITEM003', 'เครื่องพิมพ์เลเซอร์', 2, 'O');

-- ตัวอย่างข้อมูล PO Link
INSERT INTO pr_po_link (pr_doc_num, pr_line_description, po_doc_num, po_quantity, po_unit, po_line_status)
VALUES
    (1, 'คอมพิวเตอร์ Notebook', 101, 5, 'EA', 'O'),
    (1, 'เมาส์ไร้สาย', 101, 10, 'EA', 'O');
*/

-- 📌 SECTION 9: USAGE EXAMPLES (COMMENTED)
-- วิธีใช้งาน functions และ query ทดสอบ

/*
-- ==========================================
-- 🔹 ตัวอย่างที่ 1: UPSERT ข้อมูลด้วย JSON
-- ==========================================

SELECT * FROM upsert_pr_data('{
  "pr_master": [
    {
      "doc_num": 1,
      "req_name": "สมชาย ใจดี",
      "department_name": "แผนกจัดซื้อ",
      "doc_date": "2025-01-15",
      "doc_due_date": "2025-01-30",
      "doc_status": "O",
      "update_date": "2025-01-15 10:30:00",
      "create_date": "2025-01-15 09:00:00",
      "req_date": "2025-01-20",
      "series": 1,
      "series_name": "PR"
    }
  ],
  "pr_lines": [
    {
      "pr_doc_num": 1,
      "line_num": 0,
      "item_code": "ITEM001",
      "description": "คอมพิวเตอร์ Notebook",
      "quantity": 5,
      "line_status": "O",
      "line_date": "2025-01-15",
      "project": "PRJ001"
    }
  ],
  "pr_po_links": [
    {
      "pr_doc_num": 1,
      "pr_line_description": "คอมพิวเตอร์ Notebook",
      "po_doc_num": 101,
      "po_due_date": "2025-02-01",
      "po_line_description": "คอมพิวเตอร์ Notebook Dell",
      "po_quantity": 5,
      "po_unit": "EA",
      "po_line_status": "O"
    }
  ]
}'::JSONB);

-- ==========================================
-- 🔹 ตัวอย่างที่ 2: Refresh Materialized View
-- ==========================================

SELECT quick_refresh_view();

-- หรือ refresh แบบ manual
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;

-- ==========================================
-- 🔹 ตัวอย่างที่ 3: Query ข้อมูล
-- ==========================================

-- ดูข้อมูล PR ทั้งหมดพร้อม summary
SELECT * FROM mv_pr_summary
ORDER BY doc_date DESC;

-- ดูข้อมูล PR ที่ยังไม่ครบทุก line
SELECT * FROM vw_pr_pending;

-- ดูรายละเอียด PR เฉพาะเลขที่ PR
SELECT * FROM vw_pr_detail
WHERE pr_doc_num = 1;

-- ดูสรุป PO
SELECT * FROM vw_po_summary;

-- ==========================================
-- 🔹 ตัวอย่างที่ 4: ดู sync log
-- ==========================================

SELECT * FROM sync_log
ORDER BY sync_date DESC
LIMIT 10;

-- ==========================================
-- 🔹 ตัวอย่างที่ 5: ค้นหา PR ที่ยังไม่มี PO
-- ==========================================

SELECT
    pm.doc_num,
    pm.req_name,
    pm.department_name,
    pm.doc_date,
    COUNT(pl.id) AS total_lines,
    COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) AS pending_lines
FROM pr_master pm
LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
WHERE pm.doc_status = 'O'
GROUP BY pm.doc_num, pm.req_name, pm.department_name, pm.doc_date
HAVING COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) > 0
ORDER BY pm.doc_date ASC;

*/

-- 📌 SECTION 10: PERFORMANCE NOTES (COMMENTED)
-- อธิบายเรื่อง transaction และ performance

/*
-- ==========================================
-- ⚡ PERFORMANCE & TRANSACTION NOTES
-- ==========================================

-- 🔒 Transaction Safety:
-- - ทุก table จะอัพเดทพร้อมกันใน transaction เดียว
-- - ถ้าล้มจะ ROLLBACK หมด (ไม่มีข้อมูลครึ่งๆ กลางๆ)
-- - ใช้ UPSERT (INSERT ... ON CONFLICT DO UPDATE) สำหรับประสิทธิภาพ

-- ⚡ Performance Estimation:
-- - 1,000 PRs ~ 1-2 seconds (ประมาณการ)
-- - 10,000 PRs ~ 10-15 seconds
-- - REFRESH Materialized View ~ 2-5 seconds (CONCURRENTLY)

-- 💡 Optimization Tips:
-- 1. ใช้ REFRESH MATERIALIZED VIEW CONCURRENTLY เพื่อไม่ lock table
-- 2. Run sync ในช่วงเวลาที่ user น้อย (เช่น ตี 2-3)
-- 3. ตรวจสอบ EXPLAIN ANALYZE เป็นประจำ
-- 4. Vacuum และ Analyze table เป็นประจำ

-- 🔍 Query Performance Check:
EXPLAIN ANALYZE
SELECT * FROM mv_pr_summary
WHERE doc_status = 'O' AND is_complete = FALSE;

-- 🧹 Maintenance Commands:
VACUUM ANALYZE pr_master;
VACUUM ANALYZE pr_lines;
VACUUM ANALYZE pr_po_link;
REINDEX TABLE pr_master;

-- 📊 Table Size Check:
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

*/

-- ==========================================
-- ✅ SCHEMA CREATION COMPLETED!
-- ==========================================
--
-- ขั้นตอนต่อไป:
-- 1. Run script นี้ใน PostgreSQL: psql -U user -d database -f create_pr_tracking_schema.sql
-- 2. ใช้ upsert_pr_data() สำหรับ sync ข้อมูลจาก SAP
-- 3. Refresh Materialized View หลังจาก sync: SELECT quick_refresh_view();
-- 4. Query ข้อมูลจาก views หรือ materialized view
--
-- Happy Coding! 🚀
-- ==========================================
