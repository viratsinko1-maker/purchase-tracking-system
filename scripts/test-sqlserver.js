import sql from 'mssql';

const config = {
  server: '10.1.1.199',
  database: 'TMK_PRD',
  user: 'powerquery_hq',
  password: '@Tmk963*',
  options: {
    encrypt: false, // สำหรับ SQL Server ภายในเครือข่าย
    trustServerCertificate: true,
    enableArithAbort: true
  },
  connectionTimeout: 15000,
  requestTimeout: 15000
};

async function testSQLServerConnection() {
  try {
    console.log('กำลังเชื่อมต่อกับ SQL Server...');
    console.log(`Server: ${config.server}`);
    console.log(`Database: ${config.database}`);
    console.log(`Username: ${config.user}\n`);

    const pool = await sql.connect(config);
    console.log('✓ เชื่อมต่อสำเร็จ!\n');

    // ตรวจสอบเวอร์ชัน SQL Server
    const versionResult = await pool.request().query('SELECT @@VERSION AS version');
    console.log('เวอร์ชัน SQL Server:');
    console.log(versionResult.recordset[0].version);

    // ดูรายชื่อตารางในฐานข้อมูล
    console.log('\n📋 รายชื่อตารางในฐานข้อมูล TMK_PRD:');
    const tablesResult = await pool.request().query(`
      SELECT TOP 20 TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    tablesResult.recordset.forEach((table, index) => {
      console.log(`  ${index + 1}. ${table.TABLE_NAME}`);
    });

    if (tablesResult.recordset.length === 20) {
      console.log('  ... (แสดงเพียง 20 ตารางแรก)');
    }

    console.log(`\n✓ พบทั้งหมด ${tablesResult.recordset.length}${tablesResult.recordset.length === 20 ? '+' : ''} ตาราง`);

    await pool.close();
    console.log('\n✓ ปิดการเชื่อมต่อแล้ว');

  } catch (error) {
    console.error('\n✗ เชื่อมต่อไม่สำเร็จ:', error.message);
    console.error('\nรายละเอียด:', error);
    process.exit(1);
  }
}

testSQLServerConnection();
