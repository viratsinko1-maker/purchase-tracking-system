-- =====================================================
-- PO TRACKING DATABASE SCHEMA (SAP B1)
-- เวอร์ชัน: 1.0
-- สร้างโดย: Claude Code
-- วันที่: 2025-10-30
-- =====================================================

-- 📌 SECTION 1: DROP EXISTING OBJECTS
-- ลบของเก่า (ถ้ามี) เพื่อสร้างใหม่
DROP MATERIALIZED VIEW IF EXISTS mv_po_summary CASCADE;
DROP TABLE IF EXISTS po_lines CASCADE;
DROP TABLE IF EXISTS po_master CASCADE;
DROP TABLE IF EXISTS po_sync_log CASCADE;

-- 📌 SECTION 2: TABLE CREATION
-- สร้าง tables ตามลำดับ dependency

-- 🔹 Table 1: po_master (ข้อมูลหลักของ PO)
CREATE TABLE po_master (
    id SERIAL PRIMARY KEY,
    doc_num INTEGER NOT NULL UNIQUE,           -- เลขที่ PO (ต้อง unique)
    doc_date DATE NOT NULL,                    -- วันที่เปิด PO
    doc_due_date DATE,                         -- วันที่ครบกำหนด PO
    doc_status VARCHAR(1) DEFAULT 'O',         -- สถานะเอกสาร (O=Open, C=Close)
    update_date TIMESTAMP,                     -- วันที่อัปเดตล่าสุด (จาก SAP)
    create_date TIMESTAMP,                     -- วันที่สร้างเอกสาร (จาก SAP)
    req_date DATE,                             -- วันที่ต้องการของ
    cancel_date DATE,                          -- วันที่ยกเลิก
    last_sync_date TIMESTAMP DEFAULT NOW(),    -- วันที่ sync ข้อมูลล่าสุด
    created_at TIMESTAMP DEFAULT NOW(),        -- วันที่สร้างใน PostgreSQL
    updated_at TIMESTAMP DEFAULT NOW()         -- วันที่แก้ไขล่าสุดใน PostgreSQL
);

COMMENT ON TABLE po_master IS 'ตารางหลักสำหรับเก็บข้อมูล Purchase Order (PO) แต่ละใบ';
COMMENT ON COLUMN po_master.doc_num IS 'เลขที่ PO (DocNum จาก SAP)';
COMMENT ON COLUMN po_master.doc_status IS 'สถานะ: O=Open (เปิดอยู่), C=Closed (ปิดแล้ว)';
COMMENT ON COLUMN po_master.last_sync_date IS 'วันที่ sync ข้อมูลจาก SAP ครั้งล่าสุด';

-- 🔹 Table 2: po_lines (รายละเอียดแต่ละ line ของ PO)
CREATE TABLE po_lines (
    id SERIAL PRIMARY KEY,
    po_doc_num INTEGER NOT NULL,               -- เลขที่ PO (FK to po_master)
    line_num INTEGER NOT NULL,                 -- เลขบรรทัด (0, 1, 2, ...)
    item_code VARCHAR(255),                    -- รหัสสินค้า
    description TEXT,                          -- ชื่อสินค้า / รายการ
    quantity NUMERIC(19, 6),                   -- จำนวนที่สั่ง
    line_status VARCHAR(1),                    -- สถานะรายการ (O=Open, C=Close)
    base_ref INTEGER,                          -- เลข PR ที่เป็นต้นทาง
    last_sync_date TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Foreign Key
    CONSTRAINT fk_po_master FOREIGN KEY (po_doc_num)
        REFERENCES po_master(doc_num) ON DELETE CASCADE,

    -- Unique Constraint: PO + Line + Description ต้องไม่ซ้ำ
    CONSTRAINT uq_po_line UNIQUE (po_doc_num, line_num, description)
);

COMMENT ON TABLE po_lines IS 'ตารางเก็บรายละเอียดแต่ละ line (item) ของ PO';
COMMENT ON COLUMN po_lines.line_num IS 'เลขบรรทัดใน PO (เริ่มจาก 0)';
COMMENT ON COLUMN po_lines.base_ref IS 'เลข PR ที่เป็นต้นทาง (BaseRef จาก SAP)';

-- 🔹 Table 3: po_sync_log (เก็บประวัติการ sync)
CREATE TABLE po_sync_log (
    id SERIAL PRIMARY KEY,
    sync_date TIMESTAMP DEFAULT NOW(),         -- วันที่ sync
    sync_type VARCHAR(50) DEFAULT 'FULL',      -- ประเภท (FULL, INCREMENTAL)
    records_synced INTEGER DEFAULT 0,          -- จำนวนรายการที่ sync
    duration_seconds NUMERIC(10, 2),           -- เวลาที่ใช้ (วินาที)
    status VARCHAR(20) DEFAULT 'success',      -- สถานะ (success, failed)
    error_message TEXT                         -- ข้อความ error (ถ้ามี)
);

COMMENT ON TABLE po_sync_log IS 'ตารางบันทึกประวัติการ sync ข้อมูล PO จาก SAP';

-- 📌 SECTION 3: INDEXES
-- สร้าง indexes สำหรับเพิ่มประสิทธิภาพการค้นหา

-- Indexes สำหรับ po_master
CREATE INDEX idx_po_master_doc_num ON po_master(doc_num);
CREATE INDEX idx_po_master_doc_date ON po_master(doc_date);
CREATE INDEX idx_po_master_update_date ON po_master(update_date);
CREATE INDEX idx_po_master_doc_status ON po_master(doc_status);

COMMENT ON INDEX idx_po_master_doc_num IS 'Index สำหรับค้นหา PO ด้วยเลขที่ PO';
COMMENT ON INDEX idx_po_master_doc_date IS 'Index สำหรับ filter วันที่เปิด PO';

-- Indexes สำหรับ po_lines
CREATE INDEX idx_po_lines_po_doc_num ON po_lines(po_doc_num);
CREATE INDEX idx_po_lines_item_code ON po_lines(item_code);
CREATE INDEX idx_po_lines_line_status ON po_lines(line_status);
CREATE INDEX idx_po_lines_base_ref ON po_lines(base_ref);
CREATE INDEX idx_po_lines_description ON po_lines USING gin(to_tsvector('simple', description));

COMMENT ON INDEX idx_po_lines_base_ref IS 'Index สำหรับหา PO ที่เชื่อมกับ PR (BaseRef)';
COMMENT ON INDEX idx_po_lines_description IS 'Full-text index สำหรับค้นหาในรายละเอียดสินค้า';

-- Composite Index สำหรับ query ที่ซับซ้อน
CREATE INDEX idx_po_master_composite ON po_master(doc_status, doc_date);
COMMENT ON INDEX idx_po_master_composite IS 'Composite index สำหรับ filter หลายเงื่อนไขพร้อมกัน';

-- 📌 SECTION 4: TRIGGERS
-- Auto update timestamps

-- Function สำหรับ update timestamp
CREATE OR REPLACE FUNCTION update_po_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger สำหรับ po_master
CREATE TRIGGER update_po_master_timestamp
    BEFORE UPDATE ON po_master
    FOR EACH ROW
    EXECUTE FUNCTION update_po_timestamp();

-- Trigger สำหรับ po_lines
CREATE TRIGGER update_po_lines_timestamp
    BEFORE UPDATE ON po_lines
    FOR EACH ROW
    EXECUTE FUNCTION update_po_timestamp();

-- 📌 SECTION 5: MATERIALIZED VIEW
-- Materialized View สำหรับ query ที่เร็วขึ้น

CREATE MATERIALIZED VIEW mv_po_summary AS
SELECT
    pm.doc_num,
    pm.doc_date,
    pm.doc_due_date,
    pm.doc_status,
    pm.update_date,
    pm.create_date,
    pm.req_date,
    pm.cancel_date,
    COUNT(pl.id) AS total_lines,
    SUM(pl.quantity) AS total_quantity,
    ARRAY_AGG(DISTINCT pl.base_ref ORDER BY pl.base_ref) FILTER (WHERE pl.base_ref IS NOT NULL) AS pr_numbers
FROM
    po_master pm
    LEFT JOIN po_lines pl ON pm.doc_num = pl.po_doc_num
GROUP BY
    pm.doc_num, pm.doc_date, pm.doc_due_date, pm.doc_status,
    pm.update_date, pm.create_date, pm.req_date, pm.cancel_date
ORDER BY
    pm.doc_date DESC;

-- สร้าง Unique Index สำหรับ REFRESH CONCURRENTLY
CREATE UNIQUE INDEX ON mv_po_summary (doc_num);

-- สร้าง Indexes เพิ่มเติมสำหรับ Materialized View
CREATE INDEX idx_mv_po_summary_doc_date ON mv_po_summary(doc_date);
CREATE INDEX idx_mv_po_summary_status ON mv_po_summary(doc_status);

COMMENT ON MATERIALIZED VIEW mv_po_summary IS 'Materialized View สรุปข้อมูล PO แต่ละใบ (refresh ด้วย REFRESH MATERIALIZED VIEW CONCURRENTLY)';

-- 📌 SECTION 6: FUNCTIONS
-- Functions สำหรับจัดการข้อมูล

-- 🔹 Function: refresh_po_view (Refresh Materialized View)
CREATE OR REPLACE FUNCTION refresh_po_view()
RETURNS TEXT AS $$
DECLARE
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_duration NUMERIC;
BEGIN
    v_start_time := clock_timestamp();

    -- Refresh Materialized View แบบ CONCURRENTLY (ไม่ lock table)
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_po_summary;

    v_end_time := clock_timestamp();
    v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));

    RETURN format('PO view refreshed successfully in %.2f seconds', v_duration);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_po_view IS 'Function สำหรับ refresh PO Materialized View แบบ CONCURRENTLY';

-- ==========================================
-- ✅ SCHEMA CREATION COMPLETED!
-- ==========================================
--
-- ขั้นตอนต่อไป:
-- 1. Run script นี้ใน PostgreSQL: psql -U user -d database -f create_po_tracking_schema.sql
-- 2. Sync ข้อมูลจาก SAP ผ่าน API
-- 3. Refresh Materialized View: SELECT refresh_po_view();
--
-- Happy Coding! 🚀
-- ==========================================
