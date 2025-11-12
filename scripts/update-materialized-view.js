// Script to update materialized view with job_name and remarks columns
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function updateMaterializedView() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Drop existing materialized view
    console.log('Dropping existing materialized view...');
    await client.query('DROP MATERIALIZED VIEW IF EXISTS mv_pr_summary CASCADE;');

    // Recreate with job_name and remarks
    console.log('Creating new materialized view with job_name and remarks...');
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
          COUNT(pl.id) AS total_lines,
          COUNT(pl.id) FILTER (WHERE pl.has_po = TRUE) AS lines_with_po,
          COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) AS pending_lines,
          CASE
              WHEN COUNT(pl.id) = 0 THEN FALSE
              WHEN COUNT(pl.id) FILTER (WHERE pl.has_po = FALSE) = 0 THEN TRUE
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

    // Update vw_pr_detail view
    console.log('Updating vw_pr_detail view...');
    await client.query('DROP VIEW IF EXISTS vw_pr_detail CASCADE;');
    await client.query(`
      CREATE OR REPLACE VIEW vw_pr_detail AS
      SELECT
          -- ข้อมูล PR Master
          pm.id AS pr_master_id,
          pm.doc_num AS pr_doc_num,
          pm.req_name AS pr_req_name,
          pm.department_name AS pr_department,
          pm.doc_date AS pr_date,
          pm.doc_due_date AS pr_due_date,
          pm.doc_status AS pr_status,
          pm.series_name AS pr_series,
          pm.update_date AS pr_update_date,
          pm.req_date AS pr_req_date,
          pm.job_name AS pr_job_name,
          pm.remarks AS pr_remarks,

          -- ข้อมูล PR Lines
          pl.id AS pr_line_id,
          pl.line_num AS pr_line_num,
          pl.item_code AS pr_item_code,
          pl.description AS pr_description,
          pl.quantity AS pr_quantity,
          pl.line_status AS pr_line_status,
          pl.project AS pr_project,
          pl.vendor_num AS pr_vendor,
          pl.has_po AS has_po,

          -- ข้อมูล PO Link
          po.id AS po_link_id,
          po.po_doc_num AS po_doc_num,
          po.po_due_date AS po_due_date,
          po.po_line_description AS po_description,
          po.po_quantity AS po_quantity,
          po.po_unit AS po_unit,
          po.po_line_status AS po_status
      FROM
          pr_master pm
          LEFT JOIN pr_lines pl ON pm.doc_num = pl.pr_doc_num
          LEFT JOIN pr_po_link po ON (pm.doc_num = po.pr_doc_num AND pl.description = po.pr_line_description)
      ORDER BY
          pm.doc_date DESC, pm.doc_num DESC, pl.line_num ASC;
    `);

    console.log('✅ Materialized view and views updated successfully!');
    console.log('You can now sync data to populate the views.');

  } catch (error) {
    console.error('❌ Error updating materialized view:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

updateMaterializedView()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
