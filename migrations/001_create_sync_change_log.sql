-- Migration: Create sync_change_log table
-- Description: เก็บรายละเอียดการเปลี่ยนแปลงของแต่ละ PR/PO ในแต่ละครั้งที่ sync
-- Created: 2025-10-25

-- สร้าง table สำหรับเก็บ detailed sync changes
CREATE TABLE IF NOT EXISTS sync_change_log (
    id SERIAL PRIMARY KEY,
    sync_log_id INTEGER NOT NULL REFERENCES sync_log(id) ON DELETE CASCADE,

    -- ประเภทการเปลี่ยนแปลง
    change_type VARCHAR(50) NOT NULL, -- PR_NEW, PR_UPDATED, PR_STATUS_CHANGED, PO_ADDED, etc.

    -- ข้อมูล PR
    pr_no INTEGER NOT NULL,
    pr_description TEXT,

    -- ข้อมูล PO (ถ้ามี)
    po_no INTEGER,
    po_description TEXT,

    -- การเปลี่ยนสถานะ (ถ้ามี)
    old_status VARCHAR(10),
    new_status VARCHAR(10),

    -- รายละเอียดเพิ่มเติม
    details JSONB, -- เก็บข้อมูลเพิ่มเติมที่อาจต้องการ

    -- Timestamp (UTC)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง indexes เพื่อ performance
CREATE INDEX idx_sync_change_log_sync_log_id ON sync_change_log(sync_log_id);
CREATE INDEX idx_sync_change_log_pr_no ON sync_change_log(pr_no);
CREATE INDEX idx_sync_change_log_change_type ON sync_change_log(change_type);
CREATE INDEX idx_sync_change_log_created_at ON sync_change_log(created_at DESC);

-- Comment
COMMENT ON TABLE sync_change_log IS 'เก็บรายละเอียดการเปลี่ยนแปลงของแต่ละ PR/PO ในแต่ละครั้งที่ sync';
COMMENT ON COLUMN sync_change_log.change_type IS 'ประเภทการเปลี่ยนแปลง: PR_NEW, PR_UPDATED, PR_STATUS_CHANGED, PO_ADDED, PO_UPDATED';
COMMENT ON COLUMN sync_change_log.details IS 'ข้อมูลเพิ่มเติมในรูปแบบ JSON';
