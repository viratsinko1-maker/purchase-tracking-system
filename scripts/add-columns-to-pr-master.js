// Script to add job_name and remarks columns to pr_master table
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

async function addColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database...');

    // Add job_name column
    console.log('Adding job_name column to pr_master...');
    await client.query(`
      ALTER TABLE pr_master
      ADD COLUMN IF NOT EXISTS job_name TEXT;
    `);

    // Add remarks column
    console.log('Adding remarks column to pr_master...');
    await client.query(`
      ALTER TABLE pr_master
      ADD COLUMN IF NOT EXISTS remarks TEXT;
    `);

    console.log('✅ Columns added successfully!');

  } catch (error) {
    console.error('❌ Error adding columns:', error);
    throw error;
  } finally {
    await client.end();
    console.log('Database connection closed.');
  }
}

addColumns()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
