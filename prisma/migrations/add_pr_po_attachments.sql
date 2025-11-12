-- Create PR Attachments Table
CREATE TABLE IF NOT EXISTS pr_attachments (
  id SERIAL PRIMARY KEY,
  pr_doc_num INTEGER NOT NULL,
  attachment_entry INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  src_path TEXT,
  trgt_path TEXT,
  file_ext VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create PO Attachments Table
CREATE TABLE IF NOT EXISTS po_attachments (
  id SERIAL PRIMARY KEY,
  po_doc_num INTEGER NOT NULL,
  attachment_entry INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  src_path TEXT,
  trgt_path TEXT,
  file_ext VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for PR attachments
CREATE INDEX IF NOT EXISTS idx_pr_attachments_pr_doc_num ON pr_attachments(pr_doc_num);
CREATE INDEX IF NOT EXISTS idx_pr_attachments_attachment_entry ON pr_attachments(attachment_entry);
CREATE INDEX IF NOT EXISTS idx_pr_attachments_created_at ON pr_attachments(created_at);

-- Create indexes for PO attachments
CREATE INDEX IF NOT EXISTS idx_po_attachments_po_doc_num ON po_attachments(po_doc_num);
CREATE INDEX IF NOT EXISTS idx_po_attachments_attachment_entry ON po_attachments(attachment_entry);
CREATE INDEX IF NOT EXISTS idx_po_attachments_created_at ON po_attachments(created_at);

-- Create unique constraint to prevent duplicate attachments
CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_attachments_unique
  ON pr_attachments(pr_doc_num, attachment_entry, file_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_po_attachments_unique
  ON po_attachments(po_doc_num, attachment_entry, file_name);

-- Add foreign key constraints
ALTER TABLE pr_attachments
  ADD CONSTRAINT fk_pr_attachments_pr_doc_num
  FOREIGN KEY (pr_doc_num)
  REFERENCES pr_master(doc_num)
  ON DELETE CASCADE;

ALTER TABLE po_attachments
  ADD CONSTRAINT fk_po_attachments_po_doc_num
  FOREIGN KEY (po_doc_num)
  REFERENCES po_master(doc_num)
  ON DELETE CASCADE;

COMMENT ON TABLE pr_attachments IS 'Stores attachment files for Purchase Requests';
COMMENT ON TABLE po_attachments IS 'Stores attachment files for Purchase Orders';
