import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initPODeliveryTracking() {
  try {
    console.log('🚀 Starting PO Delivery Tracking schema initialization...');

    // Drop existing table if exists
    console.log('📦 Dropping existing table...');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS po_delivery_tracking_log CASCADE');

    // Create po_delivery_tracking_log table
    console.log('📋 Creating po_delivery_tracking_log table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE po_delivery_tracking_log (
        id SERIAL PRIMARY KEY,
        po_doc_num INTEGER NOT NULL,
        delivery_status VARCHAR(50) NOT NULL,
        note TEXT,
        tracked_by VARCHAR(255),
        tracked_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes
    console.log('🔍 Creating indexes...');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_delivery_tracking_po_doc_num ON po_delivery_tracking_log(po_doc_num)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_delivery_tracking_tracked_at ON po_delivery_tracking_log(tracked_at)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_delivery_tracking_delivery_status ON po_delivery_tracking_log(delivery_status)');

    console.log('✅ PO Delivery Tracking schema initialization completed successfully!');
    console.log('');
    console.log('📋 Created table:');
    console.log('  - po_delivery_tracking_log');
    console.log('');
    console.log('🔍 Created indexes for po_doc_num, tracked_at, delivery_status');
    console.log('');
    console.log('🎉 Ready to use!');
    console.log('');

  } catch (error) {
    console.error('❌ Error initializing PO Delivery Tracking schema:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initPODeliveryTracking()
  .then(() => {
    console.log('👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
