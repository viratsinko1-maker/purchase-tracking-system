import pkg from 'pg';
const { Client } = pkg;
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function runSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('📡 กำลังเชื่อมต่อ PostgreSQL...');
    await client.connect();
    console.log('✓ เชื่อมต่อสำเร็จ\n');

    console.log('📄 กำลังอ่านไฟล์ schema...');
    const schema = readFileSync('./create_pr_tracking_schema.sql', 'utf8');
    console.log('✓ อ่านไฟล์สำเร็จ\n');

    console.log('🔄 กำลังรัน SQL schema...');
    console.log('⚠️  ขั้นตอนนี้จะ DROP tables เก่าและสร้างใหม่ทั้งหมด');

    const startTime = Date.now();
    await client.query(schema);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`\n✅ รัน schema สำเร็จ! (ใช้เวลา ${duration} วินาที)\n`);

    console.log('📊 ตรวจสอบ tables ที่สร้างขึ้น...');
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n✓ Tables ที่สร้างแล้ว:');
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

    // ตรวจสอบ views
    const viewsResult = await client.query(`
      SELECT table_name
      FROM information_schema.views
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n✓ Views ที่สร้างแล้ว:');
    viewsResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });

    // ตรวจสอบ materialized views
    const mvResult = await client.query(`
      SELECT matviewname
      FROM pg_matviews
      WHERE schemaname = 'public'
      ORDER BY matviewname;
    `);

    console.log('\n✓ Materialized Views ที่สร้างแล้ว:');
    mvResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.matviewname}`);
    });

    // ตรวจสอบ functions
    const funcResult = await client.query(`
      SELECT routine_name
      FROM information_schema.routines
      WHERE routine_schema = 'public'
      AND routine_type = 'FUNCTION'
      AND routine_name IN ('upsert_pr_data', 'quick_refresh_view', 'update_timestamp')
      ORDER BY routine_name;
    `);

    console.log('\n✓ Functions ที่สร้างแล้ว:');
    funcResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.routine_name}()`);
    });

    console.log('\n🎉 Schema creation completed successfully!\n');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runSchema();
