-- Query latest 10 activity trail logs
SELECT
  id,
  user_id,
  user_name,
  ip_address,
  action,
  description,
  pr_no,
  po_no,
  tracking_id,
  metadata,
  created_at
FROM activity_trail
ORDER BY created_at DESC
LIMIT 10;
