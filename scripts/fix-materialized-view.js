// Fix materialized view - prevent duplicate counting
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function fixMaterializedView() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Drop existing materialized view
    console.log('Dropping existing materialized view...');
    await client.query('DROP MATERIALIZED VIEW IF EXISTS mv_pr_summary CASCADE;');

    // Recreate with DISTINCT to fix duplicate counting
    console.log('Creating fixed materialized view...');
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
          pm.job_name,
          pm.remarks,
          COUNT(DISTINCT pl.id) AS total_lines,
          COUNT(DISTINCT pl.id) FILTER (WHERE pl.has_po = TRUE) AS lines_with_po,
          COUNT(DISTINCT pl.id) FILTER (WHERE pl.has_po = FALSE) AS pending_lines,
          CASE
              WHEN COUNT(DISTINCT pl.id) = 0 THEN FALSE
              WHEN COUNT(DISTINCT pl.id) FILTER (WHERE pl.has_po = FALSE) = 0 THEN TRUE
              ELSE FALSE
          END AS is_complete,
          ARRAY_AGG(DISTINCT po.po_doc_num ORDER BY po.po_doc_num) FILTER (WHERE po.po_doc_num IS NOT NULL) AS po_numbers,
          SUM(po.po_quantity) AS total_po_quantity,
          ARRAY_AGG(DISTINCT pl.line_num ORDER BY pl.line_num) FILTER (WHERE pl.has_po = FALSE) AS pending_line_numbers
      FROM
          pr_master pm
          LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
          LEFT JOIN pr_po_link po ON pm.doc_num = po.pr_doc_num
      GROUP BY
          pm.doc_num, pm.req_name, pm.department_name, pm.doc_date, pm.doc_due_date,
          pm.doc_status, pm.series_name, pm.update_date, pm.job_name, pm.remarks
      ORDER BY
          pm.doc_date DESC;
    `);

    // Create unique index for concurrent refresh
    console.log('Creating unique index...');
    await client.query('CREATE UNIQUE INDEX ON mv_pr_summary (doc_num);');

    // Create additional indexes
    console.log('Creating additional indexes...');
    await client.query('CREATE INDEX idx_mv_pr_summary_doc_date ON mv_pr_summary(doc_date);');
    await client.query('CREATE INDEX idx_mv_pr_summary_status ON mv_pr_summary(doc_status);');
    await client.query('CREATE INDEX idx_mv_pr_summary_is_complete ON mv_pr_summary(is_complete);');

    // Refresh the view
    console.log('Refreshing materialized view...');
    await client.query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_pr_summary;');

    console.log('✅ Materialized view fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing materialized view:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

fixMaterializedView()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
