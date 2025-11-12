import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initPOSchema() {
  try {
    console.log('🚀 Starting PO schema initialization...');

    // Drop existing objects
    console.log('📦 Dropping existing PO objects...');
    await prisma.$executeRawUnsafe('DROP MATERIALIZED VIEW IF EXISTS mv_po_summary CASCADE');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS po_lines CASCADE');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS po_master CASCADE');
    await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS po_sync_log CASCADE');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS update_po_timestamp() CASCADE');
    await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS refresh_po_view() CASCADE');

    // Create po_master table
    console.log('📋 Creating po_master table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE po_master (
        id SERIAL PRIMARY KEY,
        doc_num INTEGER NOT NULL UNIQUE,
        doc_date DATE NOT NULL,
        doc_due_date DATE,
        doc_status VARCHAR(1) DEFAULT 'O',
        update_date TIMESTAMP,
        create_date TIMESTAMP,
        req_date DATE,
        cancel_date DATE,
        last_sync_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create po_lines table
    console.log('📋 Creating po_lines table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE po_lines (
        id SERIAL PRIMARY KEY,
        po_doc_num INTEGER NOT NULL,
        line_num INTEGER NOT NULL,
        item_code VARCHAR(255),
        description TEXT,
        quantity NUMERIC(19, 6),
        line_status VARCHAR(1),
        base_ref INTEGER,
        last_sync_date TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_po_master FOREIGN KEY (po_doc_num)
          REFERENCES po_master(doc_num) ON DELETE CASCADE,
        CONSTRAINT uq_po_line UNIQUE (po_doc_num, line_num, description)
      )
    `);

    // Create po_sync_log table
    console.log('📋 Creating po_sync_log table...');
    await prisma.$executeRawUnsafe(`
      CREATE TABLE po_sync_log (
        id SERIAL PRIMARY KEY,
        sync_date TIMESTAMP DEFAULT NOW(),
        sync_type VARCHAR(50) DEFAULT 'FULL',
        records_synced INTEGER DEFAULT 0,
        duration_seconds NUMERIC(10, 2),
        status VARCHAR(20) DEFAULT 'success',
        error_message TEXT
      )
    `);

    // Create indexes for po_master
    console.log('🔍 Creating indexes for po_master...');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_master_doc_num ON po_master(doc_num)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_master_doc_date ON po_master(doc_date)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_master_update_date ON po_master(update_date)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_master_doc_status ON po_master(doc_status)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_master_composite ON po_master(doc_status, doc_date)');

    // Create indexes for po_lines
    console.log('🔍 Creating indexes for po_lines...');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_lines_po_doc_num ON po_lines(po_doc_num)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_lines_item_code ON po_lines(item_code)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_lines_line_status ON po_lines(line_status)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_po_lines_base_ref ON po_lines(base_ref)');
    await prisma.$executeRawUnsafe(`CREATE INDEX idx_po_lines_description ON po_lines USING gin(to_tsvector('simple', description))`);

    // Create trigger function
    console.log('⚡ Creating trigger function...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION update_po_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    // Create triggers
    console.log('⚡ Creating triggers...');
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER update_po_master_timestamp
        BEFORE UPDATE ON po_master
        FOR EACH ROW
        EXECUTE FUNCTION update_po_timestamp()
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER update_po_lines_timestamp
        BEFORE UPDATE ON po_lines
        FOR EACH ROW
        EXECUTE FUNCTION update_po_timestamp()
    `);

    // Create materialized view
    console.log('📊 Creating materialized view mv_po_summary...');
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
        COUNT(pl.id) AS total_lines,
        SUM(pl.quantity) AS total_quantity,
        ARRAY_AGG(DISTINCT pl.base_ref ORDER BY pl.base_ref) FILTER (WHERE pl.base_ref IS NOT NULL) AS pr_numbers
      FROM
        po_master pm
        LEFT JOIN po_lines pl ON pm.doc_num = pl.po_doc_num
      GROUP BY
        pm.doc_num, pm.doc_date, pm.doc_due_date, pm.doc_status,
        pm.update_date, pm.create_date, pm.req_date, pm.cancel_date
      ORDER BY
        pm.doc_date DESC
    `);

    // Create unique index for materialized view
    console.log('🔍 Creating unique index for materialized view...');
    await prisma.$executeRawUnsafe('CREATE UNIQUE INDEX ON mv_po_summary (doc_num)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_mv_po_summary_doc_date ON mv_po_summary(doc_date)');
    await prisma.$executeRawUnsafe('CREATE INDEX idx_mv_po_summary_status ON mv_po_summary(doc_status)');

    // Create refresh function
    console.log('⚙️ Creating refresh function...');
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION refresh_po_view()
      RETURNS TEXT AS $$
      DECLARE
        v_start_time TIMESTAMP;
        v_end_time TIMESTAMP;
        v_duration NUMERIC;
      BEGIN
        v_start_time := clock_timestamp();
        REFRESH MATERIALIZED VIEW CONCURRENTLY mv_po_summary;
        v_end_time := clock_timestamp();
        v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));
        RETURN format('PO view refreshed successfully in %.2f seconds', v_duration);
      END;
      $$ LANGUAGE plpgsql
    `);

    console.log('✅ PO schema initialization completed successfully!');
    console.log('');
    console.log('📋 Created tables:');
    console.log('  - po_master');
    console.log('  - po_lines');
    console.log('  - po_sync_log');
    console.log('');
    console.log('📊 Created materialized view:');
    console.log('  - mv_po_summary');
    console.log('');
    console.log('🔍 Created indexes and triggers');
    console.log('⚙️ Created functions: update_po_timestamp(), refresh_po_view()');
    console.log('');
    console.log('🎉 Ready to use! You can now:');
    console.log('  1. Visit http://localhost:2025/po-tracking');
    console.log('  2. Click the Sync button to fetch PO data from SAP');
    console.log('');

  } catch (error) {
    console.error('❌ Error initializing PO schema:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the initialization
initPOSchema()
  .then(() => {
    console.log('👋 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
