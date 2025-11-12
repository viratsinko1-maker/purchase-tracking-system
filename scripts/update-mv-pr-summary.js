import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function updateMaterializedView() {
  const client = await pool.connect();

  try {
    console.log('🔧 กำลังอัปเดต Materialized View...\n');

    // Drop และสร้างใหม่
    console.log('1️⃣ ลบ Materialized View เก่า...');
    await client.query('DROP MATERIALIZED VIEW IF EXISTS mv_pr_summary CASCADE;');
    console.log('✓ ลบสำเร็จ\n');

    console.log('2️⃣ สร้าง Materialized View ใหม่ (แก้ไขการนับให้ถูกต้อง)...');
    await client.query(`
      CREATE MATERIALIZED VIEW mv_pr_summary AS
      SELECT
          pm.doc_num,
          pm.req_name,
          pm.department_name,
          pm.doc_date,
          pm.doc_due_date,
          pm.doc_status,
          pm.series_name,
          pm.update_date,
          -- นับจาก pr_lines เท่านั้น (ไม่นับจาก pr_po_link เพื่อไม่ให้นับซ้ำ)
          COUNT(pl.id) AS total_lines,
          COUNT(pl.id) FILTER (WHERE pl.has_po = TRUE) AS lines_with_po,
          COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) AS pending_lines,
          CASE
              WHEN COUNT(pl.id) = 0 THEN FALSE
              WHEN COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) = 0 THEN TRUE
              ELSE FALSE
          END AS is_complete,
          -- ดึง PO numbers จาก subquery แยกต่างหาก
          (
              SELECT ARRAY_AGG(DISTINCT po.po_doc_num ORDER BY po.po_doc_num)
              FROM pr_po_link po
              WHERE po.pr_doc_num = pm.doc_num
          ) AS po_numbers,
          (
              SELECT SUM(po.po_quantity)
              FROM pr_po_link po
              WHERE po.pr_doc_num = pm.doc_num
          ) AS total_po_quantity,
          -- array ของ line numbers ที่ยังไม่มี PO
          ARRAY_AGG(pl.line_num ORDER BY pl.line_num) FILTER (WHERE pl.has_po = FALSE) AS pending_line_numbers
      FROM
          pr_master pm
          LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
      GROUP BY
          pm.doc_num, pm.req_name, pm.department_name, pm.doc_date, pm.doc_due_date,
          pm.doc_status, pm.series_name, pm.update_date
      ORDER BY
          pm.doc_date DESC;
    `);
    console.log('✓ สร้างสำเร็จ\n');

    console.log('3️⃣ สร้าง Unique Index...');
    await client.query('CREATE UNIQUE INDEX ON mv_pr_summary (doc_num);');
    console.log('✓ สร้าง unique index สำเร็จ\n');

    console.log('4️⃣ สร้าง Indexes เพิ่มเติม...');
    await client.query('CREATE INDEX idx_mv_pr_summary_doc_date ON mv_pr_summary(doc_date);');
    await client.query('CREATE INDEX idx_mv_pr_summary_status ON mv_pr_summary(doc_status);');
    await client.query('CREATE INDEX idx_mv_pr_summary_is_complete ON mv_pr_summary(is_complete);');
    console.log('✓ สร้าง indexes สำเร็จ\n');

    console.log('5️⃣ Refresh Materialized View...');
    await client.query('REFRESH MATERIALIZED VIEW mv_pr_summary;');
    console.log('✓ Refresh สำเร็จ\n');

    console.log('✅ อัปเดต Materialized View เสร็จสมบูรณ์!');
    console.log('\n📝 ตอนนี้ mv_pr_summary มี field ใหม่:');
    console.log('  - pending_line_numbers: array ของ line numbers ที่ยังไม่มี PO');
    console.log('\n🔄 กำลังทดสอบ query...');

    const test = await client.query(`
      SELECT doc_num, total_lines, lines_with_po, pending_lines, pending_line_numbers
      FROM mv_pr_summary
      WHERE pending_lines > 0
      LIMIT 3;
    `);

    console.log('\n📊 ตัวอย่างข้อมูล:');
    test.rows.forEach((row, i) => {
      console.log(`\n  ${i + 1}. PR #${row.doc_num}:`);
      console.log(`     - Total lines: ${row.total_lines}`);
      console.log(`     - Lines with PO: ${row.lines_with_po}`);
      console.log(`     - Pending lines: ${row.pending_lines}`);
      console.log(`     - Pending line numbers: ${row.pending_line_numbers ? row.pending_line_numbers.join(', ') : 'none'}`);
    });

    console.log('\n✨ เสร็จสมบูรณ์!');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

updateMaterializedView();
