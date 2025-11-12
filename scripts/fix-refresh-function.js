import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function fixFunction() {
  const client = await pool.connect();

  try {
    console.log('🔧 แก้ไข function quick_refresh_view()...');

    await client.query(`
      CREATE OR REPLACE FUNCTION quick_refresh_view()
      RETURNS TEXT AS $$
      DECLARE
          v_start_time TIMESTAMP;
          v_end_time TIMESTAMP;
          v_duration NUMERIC;
      BEGIN
          v_start_time := clock_timestamp();
          REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;
          v_end_time := clock_timestamp();
          v_duration := EXTRACT(EPOCH FROM (v_end_time - v_start_time));
          RETURN 'Refreshed successfully in ' || ROUND(v_duration, 2)::TEXT || ' seconds';
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('✓ แก้ไข function สำเร็จ\n');
    console.log('🔄 กำลัง Refresh Materialized View...');

    const result = await client.query('SELECT quick_refresh_view()');
    console.log('✓', result.rows[0].quick_refresh_view);
    console.log('\n✅ สำเร็จทุกอย่าง!');
    console.log('\n📝 ตอนนี้คุณสามารถ:');
    console.log('  1. เปิด browser: http://localhost:2025/pr-tracking');
    console.log('  2. กดปุ่ม "🔍 ค้นหา" เพื่อดูข้อมูล PR');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

fixFunction();
