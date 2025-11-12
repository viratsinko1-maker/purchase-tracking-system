-- Fix timezone for activity_trail.created_at
-- Change to store as Thailand time (UTC+7) instead of UTC

-- Drop the existing column default
ALTER TABLE activity_trail ALTER COLUMN created_at DROP DEFAULT;

-- Set new default with Thailand timezone
ALTER TABLE activity_trail ALTER COLUMN created_at SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Bangkok');

-- Update existing records to Thailand time (add 7 hours)
UPDATE activity_trail SET created_at = created_at + INTERVAL '7 hours';
