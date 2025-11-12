import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function fixFunction() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('📡 เชื่อมต่อ PostgreSQL...\n');

    console.log('🔧 กำลังแก้ไข function quick_refresh_view()...');

    await client.query(`
      CREATE OR REPLACE FUNCTION quick_refresh_view()
      RETURNS TEXT AS $$
      DECLARE
          v_start_time TIMESTAMP;
          v_end_time TIMESTAMP;
          v_duration NUMERIC;
      BEGIN
          v_start_time := clock_timestamp();

          -- Refresh Materialized View แบบ CONCURRENTLY (ไม่ lock table)
          REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;

          v_end_time := clock_timestamp();
          v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));

          RETURN 'Refreshed successfully in ' || v_duration::TEXT || ' seconds';
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✓ แก้ไข function สำเร็จ!\n');

    console.log('🧪 ทดสอบ function...');
    const result = await client.query('SELECT quick_refresh_view()');
    console.log(`✓ ${result.rows[0].quick_refresh_view}\n`);

    console.log('✅ เสร็จสิ้น!');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

fixFunction();
