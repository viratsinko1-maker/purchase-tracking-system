import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function verifyData() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔍 ตรวจสอบข้อมูลในระบบ PR Tracking...\n');

    // 1. นับจำนวนข้อมูลในแต่ละ table
    console.log('📊 จำนวนข้อมูลในแต่ละ Table:');

    const prMasterCount = await client.query('SELECT COUNT(*) FROM pr_master');
    console.log(`  ✓ PR Master: ${parseInt(prMasterCount.rows[0].count).toLocaleString()} รายการ`);

    const prLinesCount = await client.query('SELECT COUNT(*) FROM pr_lines');
    console.log(`  ✓ PR Lines: ${parseInt(prLinesCount.rows[0].count).toLocaleString()} รายการ`);

    const prPoLinkCount = await client.query('SELECT COUNT(*) FROM pr_po_link');
    console.log(`  ✓ PR-PO Links: ${parseInt(prPoLinkCount.rows[0].count).toLocaleString()} รายการ`);

    const syncLogCount = await client.query('SELECT COUNT(*) FROM sync_log');
    console.log(`  ✓ Sync Log: ${parseInt(syncLogCount.rows[0].count).toLocaleString()} รายการ\n`);

    // 2. ตรวจสอบ materialized view
    console.log('📋 Materialized View Summary:');
    const mvCount = await client.query('SELECT COUNT(*) FROM mv_pr_summary');
    console.log(`  ✓ mv_pr_summary: ${parseInt(mvCount.rows[0].count).toLocaleString()} รายการ\n`);

    // 3. ตัวอย่างข้อมูลจาก mv_pr_summary
    console.log('📝 ตัวอย่างข้อมูล (Top 5 PR):');
    const samples = await client.query(`
      SELECT
        doc_num,
        req_name,
        department_name,
        doc_date,
        total_lines,
        lines_with_po,
        pending_lines,
        is_complete
      FROM mv_pr_summary
      ORDER BY doc_date DESC
      LIMIT 5
    `);

    samples.rows.forEach((row, index) => {
      console.log(`\n  ${index + 1}. PR #${row.doc_num}`);
      console.log(`     วันที่: ${row.doc_date}`);
      console.log(`     ผู้เปิด: ${row.req_name || '-'}`);
      console.log(`     หน่วยงาน: ${row.department_name || '-'}`);
      console.log(`     จำนวน lines: ${row.total_lines}`);
      console.log(`     มี PO: ${row.lines_with_po} / รอ: ${row.pending_lines}`);
      console.log(`     สถานะ: ${row.is_complete ? 'ครบแล้ว ✓' : 'รอดำเนินการ...'}`);
    });

    // 4. สถิติ PR
    console.log('\n\n📈 สถิติ PR:');
    const stats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_complete = TRUE) AS complete_count,
        COUNT(*) FILTER (WHERE is_complete = FALSE AND doc_status = 'O') AS pending_count,
        COUNT(*) FILTER (WHERE doc_status = 'C') AS closed_count,
        COUNT(*) AS total_count
      FROM mv_pr_summary
    `);

    const stat = stats.rows[0];
    console.log(`  ✓ PR ที่ครบแล้ว: ${parseInt(stat.complete_count).toLocaleString()} รายการ`);
    console.log(`  ✓ PR ที่รอดำเนินการ: ${parseInt(stat.pending_count).toLocaleString()} รายการ`);
    console.log(`  ✓ PR ที่ปิดแล้ว: ${parseInt(stat.closed_count).toLocaleString()} รายการ`);
    console.log(`  ✓ รวมทั้งหมด: ${parseInt(stat.total_count).toLocaleString()} รายการ\n`);

    // 5. ดู sync log ล่าสุด
    console.log('📜 Sync Log ล่าสุด:');
    const log = await client.query(`
      SELECT
        sync_date,
        sync_type,
        records_processed,
        pr_updated,
        pr_lines_updated,
        po_links_updated,
        duration_seconds,
        status
      FROM sync_log
      ORDER BY sync_date DESC
      LIMIT 1
    `);

    if (log.rows.length > 0) {
      const l = log.rows[0];
      console.log(`  วันที่: ${l.sync_date}`);
      console.log(`  ประเภท: ${l.sync_type}`);
      console.log(`  Records: ${parseInt(l.records_processed).toLocaleString()}`);
      console.log(`  PR: ${parseInt(l.pr_updated).toLocaleString()} / Lines: ${parseInt(l.pr_lines_updated).toLocaleString()} / PO Links: ${parseInt(l.po_links_updated).toLocaleString()}`);
      console.log(`  เวลาที่ใช้: ${l.duration_seconds} วินาที`);
      console.log(`  สถานะ: ${l.status}`);
    }

    console.log('\n✅ การตรวจสอบข้อมูลเสร็จสมบูรณ์!\n');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

verifyData();
