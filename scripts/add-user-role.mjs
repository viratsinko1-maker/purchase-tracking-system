import pg from 'pg';
const { Client } = pg;

const client = new Client({
  host: '192.168.1.3',
  port: 5432,
  user: 'sa',
  password: '@12345',
  database: 'PR_PO',
});

async function addUserRoleColumns() {
  try {
    await client.connect();
    console.log('Connected to database');

    // Add role column
    console.log('Adding role column...');
    await client.query(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'PR';
    `);

    // Add isActive column
    console.log('Adding isActive column...');
    await client.query(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
    `);

    // Update existing users
    console.log('Updating existing users...');
    await client.query(`
      UPDATE "User"
      SET role = 'PR'
      WHERE role IS NULL;
    `);

    await client.query(`
      UPDATE "User"
      SET "isActive" = true
      WHERE "isActive" IS NULL;
    `);

    console.log('✅ Columns added successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

addUserRoleColumns();
