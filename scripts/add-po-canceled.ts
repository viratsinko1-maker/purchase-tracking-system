import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addPoCanceled() {
  try {
    console.log('🚀 Adding CANCELED field to PO schema...');

    // เพิ่มคอลัมน์ canceled ใน po_master
    console.log('📋 Adding canceled column to po_master...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE po_master
      ADD COLUMN IF NOT EXISTS canceled VARCHAR(1) DEFAULT 'N'
    `);

    // สร้าง index สำหรับ canceled
    console.log('🔍 Creating index for canceled...');
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_po_master_canceled ON po_master(canceled)
    `);

    // Drop และสร้าง materialized view ใหม่
    console.log('📊 Recreating materialized view mv_po_summary...');
    await prisma.$executeRawUnsafe('DROP MATERIALIZED VIEW IF EXISTS mv_po_summary CASCADE');

    await prisma.$executeRawUnsafe(`
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
        pm.canceled,
        COUNT(pl.id) AS total_lines,
        SUM(pl.quantity) AS total_quantity,
        ARRAY_AGG(DISTINCT pl.base_ref ORDER BY pl.base_ref) FILTER (WHERE pl.base_ref IS NOT NULL) AS pr_numbers
      FROM
        po_master pm
        LEFT JOIN po_lines pl ON pm.doc_num = pl.po_doc_num
      GROUP BY
        pm.doc_num, pm.doc_date, pm.doc_due_date, pm.doc_status,
        pm.update_date, pm.create_date, pm.req_date, pm.cancel_date, pm.canceled
      ORDER BY
        pm.doc_date DESC
    `);

    // สร้าง unique index สำหรับ materialized view
    console.log('🔍 Creating indexes for materialized view...');
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX ON mv_po_summary (doc_num)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_mv_po_summary_doc_date ON mv_po_summary(doc_date)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_mv_po_summary_status ON mv_po_summary(doc_status)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_mv_po_summary_canceled ON mv_po_summary(canceled)');

    console.log('✅ Successfully added CANCELED field to PO schema!');
    console.log('');
    console.log('📋 Changes:');
    console.log('  - Added canceled column to po_master');
    console.log('  - Added index for canceled field');
    console.log('  - Recreated mv_po_summary with canceled field');
    console.log('');
    console.log('🎉 Ready! Please run Full Sync to update data.');
    console.log('');

  } catch (error) {
    console.error('❌ Error adding CANCELED field:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
addPoCanceled()
  .then(() => {
    console.log('👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
