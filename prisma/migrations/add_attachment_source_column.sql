-- Add source column to warehouse_receive_attachment
-- to distinguish files uploaded from warehouse (new page) vs confirm page
ALTER TABLE warehouse_receive_attachment
ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'warehouse';
