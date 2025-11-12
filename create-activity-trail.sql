-- สร้าง table activity_trail สำหรับบันทึก Activity Trail
CREATE TABLE IF NOT EXISTS activity_trail (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  user_name VARCHAR(255),
  ip_address VARCHAR(50),
  action VARCHAR(50) NOT NULL,
  description TEXT,
  pr_no INTEGER,
  po_no INTEGER,
  tracking_id INTEGER,
  metadata JSONB,
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP
);

-- สร้าง indexes สำหรับค้นหาเร็วขึ้น
CREATE INDEX IF NOT EXISTS idx_activity_trail_user_id ON activity_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_trail_action ON activity_trail(action);
CREATE INDEX IF NOT EXISTS idx_activity_trail_pr_no ON activity_trail(pr_no);
CREATE INDEX IF NOT EXISTS idx_activity_trail_po_no ON activity_trail(po_no);
CREATE INDEX IF NOT EXISTS idx_activity_trail_created_at ON activity_trail(created_at DESC);

-- เพิ่ม comment อธิบายการใช้งาน
COMMENT ON TABLE activity_trail IS 'Activity Trail - บันทึกการกระทำของผู้ใช้ทั้งหมด';
COMMENT ON COLUMN activity_trail.action IS 'ประเภทการกระทำ: LOGIN, LOGOUT, VIEW_PR, TRACK_PR, RESPONSE_PR, VIEW_PO, TRACK_DELIVERY, SYNC_DATA';
