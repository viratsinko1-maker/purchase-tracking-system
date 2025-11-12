import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('Running attachment tables migration...');

    // Create PR Attachments Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS pr_attachments (
        id SERIAL PRIMARY KEY,
        pr_doc_num INTEGER NOT NULL,
        attachment_entry INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        src_path TEXT,
        trgt_path TEXT,
        file_ext VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Created pr_attachments table');

    // Create PO Attachments Table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS po_attachments (
        id SERIAL PRIMARY KEY,
        po_doc_num INTEGER NOT NULL,
        attachment_entry INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        src_path TEXT,
        trgt_path TEXT,
        file_ext VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Created po_attachments table');

    // Create indexes for PR attachments
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_pr_attachments_pr_doc_num ON pr_attachments(pr_doc_num)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_pr_attachments_attachment_entry ON pr_attachments(attachment_entry)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_pr_attachments_created_at ON pr_attachments(created_at)`);
    console.log('✓ Created indexes for pr_attachments');

    // Create indexes for PO attachments
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_po_attachments_po_doc_num ON po_attachments(po_doc_num)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_po_attachments_attachment_entry ON po_attachments(attachment_entry)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_po_attachments_created_at ON po_attachments(created_at)`);
    console.log('✓ Created indexes for po_attachments');

    // Create unique constraints
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pr_attachments_unique ON pr_attachments(pr_doc_num, attachment_entry, file_name)`);
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS idx_po_attachments_unique ON po_attachments(po_doc_num, attachment_entry, file_name)`);
    console.log('✓ Created unique constraints');

    // Add foreign key constraints
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE pr_attachments
        ADD CONSTRAINT IF NOT EXISTS fk_pr_attachments_pr_doc_num
        FOREIGN KEY (pr_doc_num)
        REFERENCES pr_master(doc_num)
        ON DELETE CASCADE
      `);
      console.log('✓ Added FK constraint for pr_attachments');
    } catch (e) {
      console.log('⚠ FK constraint for pr_attachments already exists or skipped');
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE po_attachments
        ADD CONSTRAINT IF NOT EXISTS fk_po_attachments_po_doc_num
        FOREIGN KEY (po_doc_num)
        REFERENCES po_master(doc_num)
        ON DELETE CASCADE
      `);
      console.log('✓ Added FK constraint for po_attachments');
    } catch (e) {
      console.log('⚠ FK constraint for po_attachments already exists or skipped');
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
