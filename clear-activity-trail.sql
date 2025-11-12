-- Clear all activity trail data
TRUNCATE TABLE activity_trail RESTART IDENTITY CASCADE;

-- Add computer_name column
ALTER TABLE activity_trail ADD COLUMN IF NOT EXISTS computer_name VARCHAR(255);

-- Create index for computer_name
CREATE INDEX IF NOT EXISTS idx_activity_trail_computer_name ON activity_trail(computer_name);

-- Update comment
COMMENT ON COLUMN activity_trail.computer_name IS 'ชื่อเครื่องคอมพิวเตอร์ที่ใช้งาน';
