import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function testConnection() {
  let client;
  try {
    console.log('🔄 กำลังทดสอบการเชื่อมต่อ PostgreSQL...');
    console.log('📍 Connection String:', process.env.DATABASE_URL);

    client = await pool.connect();
    console.log('✅ เชื่อมต่อ PostgreSQL สำเร็จ!');

    const result = await client.query('SELECT version()');
    console.log('📊 PostgreSQL Version:', result.rows[0].version);

    // ทดสอบ query ตาราง
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log('\n📋 ตารางในฐานข้อมูล:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ ไม่สามารถเชื่อมต่อ PostgreSQL:', error.message);
    console.error('Error details:', error);
  } finally {
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testConnection();
