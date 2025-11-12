import fs from 'fs';
import pkg from 'pg';
const { Pool } = pkg;

// อ่าน .env เพื่อเอา DATABASE_URL
import dotenv from 'dotenv';
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ไม่พบ DATABASE_URL ใน .env');
  process.exit(1);
}

// สร้าง Pool จาก DATABASE_URL
const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function createSchema() {
  const client = await pool.connect();

  try {
    console.log('📖 กำลังอ่านไฟล์ SQL...');
    const sql = fs.readFileSync('create_pr_tracking_schema.sql', 'utf8');

    console.log('🔨 กำลังสร้าง schema ใหม่...\n');

    // Execute SQL (ต้องแบ่งเป็น statements เพราะ pg ไม่รองรับ multi-statement)
    await client.query(sql);

    console.log('\n✅ สร้าง schema สำเร็จ!');
    console.log('\n📊 ตรวจสอบ tables ที่สร้างใหม่:');

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    tables.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });

    console.log('\n🔍 ตรวจสอบ views:');
    const views = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    views.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });

    console.log('\n🔍 ตรวจสอบ materialized views:');
    const mviews = await client.query(`
      SELECT matviewname
      FROM pg_matviews
      WHERE schemaname = 'public'
      ORDER BY matviewname;
    `);

    mviews.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.matviewname}`);
    });

    console.log('\n📝 ขั้นตอนต่อไป:');
    console.log('  1. รัน: node sync-pr-po-new.js');
    console.log('  2. เปิด browser: http://localhost:2025/pr-tracking');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error('\nรายละเอียด:');
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

createSchema();
