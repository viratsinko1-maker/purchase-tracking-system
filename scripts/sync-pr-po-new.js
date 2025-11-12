import sql from 'mssql';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// โหลด .env
dotenv.config();

// SQL Server configuration (SAP B1)
const sqlConfig = {
  server: '10.1.1.199',  // ใช้ IP แทนชื่อเซิร์ฟเวอร์เพื่อหลีกเลี่ยงปัญหา DNS
  database: 'TMK_PRD',
  user: 'powerquery_hq',
  password: '@Tmk963*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  },
  connectionTimeout: 30000,
  requestTimeout: 30000
};

// PostgreSQL configuration (ใช้ DATABASE_URL จาก .env)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/**
 * ฟังก์ชันแปลงข้อมูลจาก SAP เป็น JSON format สำหรับ upsert_pr_data()
 */
function transformDataToJSON(sapRecords) {
  const prMasterMap = new Map();
  const prLinesMap = new Map();
  const prPoLinksMap = new Map();

  sapRecords.forEach((record) => {
    const prDocNum = record['เลขที่ PR'];

    // ✅ สร้าง PR Master
    if (!prMasterMap.has(prDocNum)) {
      prMasterMap.set(prDocNum, {
        doc_num: prDocNum,
        req_name: record['ชื่อผู้เปิด PR'],
        department_name: record['ชื่อหน่วยงานผู้เปิด PR'],
        doc_date: record['วันที่เปิด PR'] ? new Date(record['วันที่เปิด PR']).toISOString().split('T')[0] : null,
        doc_due_date: record['วันที่ครบกำหนด PR'] ? new Date(record['วันที่ครบกำหนด PR']).toISOString().split('T')[0] : null,
        doc_status: record['สถานะเอกสาร PR'],
        update_date: record['วันที่อัปเดตล่าสุด'] ? new Date(record['วันที่อัปเดตล่าสุด']).toISOString() : null,
        create_date: record['วันที่สร้างเอกสาร'] ? new Date(record['วันที่สร้างเอกสาร']).toISOString() : null,
        req_date: record['วันที่ต้องการของ'] ? new Date(record['วันที่ต้องการของ']).toISOString().split('T')[0] : null,
        series: record['Series'],
        series_name: record['คำนำหน้าเอกสาร PR']
      });
    }

    // ✅ สร้าง PR Lines
    const lineKey = `${prDocNum}-${record['รหัสสินค้า (PR)']}-${record['ชื่อสินค้า / รายการ (PR)']}`;
    if (!prLinesMap.has(lineKey)) {
      prLinesMap.set(lineKey, {
        pr_doc_num: prDocNum,
        line_num: 0, // จะต้องมาจากข้อมูลจริง (ถ้ามี)
        item_code: record['รหัสสินค้า (PR)'],
        description: record['ชื่อสินค้า / รายการ (PR)'],
        quantity: record['จำนวนที่ขอ (PR)'],
        line_status: record['สถานะรายการ (PR)'],
        line_date: record['วันที่รายการ (PR)'] ? new Date(record['วันที่รายการ (PR)']).toISOString().split('T')[0] : null,
        ocr_code: record['OcrCode'],
        ocr_code2: record['OcrCode2'],
        ocr_code4: record['OcrCode4'],
        project: record['รหัสโครงการ (PR)'],
        vendor_num: record['รหัสผู้ขาย (PR)'],
        serial_num: record['Serial Number (PR)']
      });
    }

    // ✅ สร้าง PR-PO Links (ถ้ามี PO)
    if (record['เลขที่ PO']) {
      const poKey = `${prDocNum}-${record['ชื่อสินค้า / รายการ (PR)']}-${record['เลขที่ PO']}`;
      if (!prPoLinksMap.has(poKey)) {
        prPoLinksMap.set(poKey, {
          pr_doc_num: prDocNum,
          pr_line_description: record['ชื่อสินค้า / รายการ (PR)'],
          po_doc_num: record['เลขที่ PO'],
          po_due_date: record['วันที่ครบกำหนด PO'] ? new Date(record['วันที่ครบกำหนด PO']).toISOString().split('T')[0] : null,
          po_line_description: record['รายละเอียดสินค้า (PO)'],
          po_quantity: record['จำนวนใน PO'],
          po_unit: record['หน่วยใน PO'],
          po_line_status: record['สถานะรายการ (PO)']
        });
      }
    }
  });

  // แปลง Map เป็น Array และใส่ line_num ให้ pr_lines
  const prMaster = Array.from(prMasterMap.values());
  const prLinesArray = Array.from(prLinesMap.values());

  // จัดเรียง pr_lines ตาม pr_doc_num และใส่ line_num
  const prLinesByDocNum = {};
  prLinesArray.forEach(line => {
    if (!prLinesByDocNum[line.pr_doc_num]) {
      prLinesByDocNum[line.pr_doc_num] = [];
    }
    prLinesByDocNum[line.pr_doc_num].push(line);
  });

  const prLines = [];
  Object.keys(prLinesByDocNum).forEach(docNum => {
    prLinesByDocNum[docNum].forEach((line, index) => {
      prLines.push({
        ...line,
        line_num: index // ใส่ line_num เริ่มจาก 0
      });
    });
  });

  return {
    pr_master: prMaster,
    pr_lines: prLines,
    pr_po_links: Array.from(prPoLinksMap.values())
  };
}

/**
 * ฟังก์ชันหลักสำหรับ sync ข้อมูล
 */
async function syncPRPOData() {
  let sqlPool = null;
  let pgClient = null;

  try {
    console.log('🔄 เริ่มการซิงค์ข้อมูล PR-PO (Schema v2.0)...\n');

    // ✅ STEP 1: เชื่อมต่อ SQL Server (SAP B1)
    console.log('📡 กำลังเชื่อมต่อ SQL Server (SAP B1)...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✓ เชื่อมต่อ SQL Server สำเร็จ\n');

    // ✅ STEP 2: ดึงข้อมูลจาก SAP ด้วย Query ใหม่
    console.log('📥 กำลังดึงข้อมูลจาก SAP...');
    const result = await sqlPool.request().query(`
      SELECT
          -- 🔹 ข้อมูลหัวเอกสาร PR
          T0.[DocNum]            AS "เลขที่ PR",
          T0.[ReqName]           AS "ชื่อผู้เปิด PR",
          T5.[Remarks]           AS "ชื่อหน่วยงานผู้เปิด PR",
          T0.[DocDate]           AS "วันที่เปิด PR",
          T0.[DocDueDate]        AS "วันที่ครบกำหนด PR",
          T0.[DocStatus]         AS "สถานะเอกสาร PR",
          T0.[UpdateDate]        AS "วันที่อัปเดตล่าสุด",
          T0.[CreateDate]        AS "วันที่สร้างเอกสาร",
          T0.[ReqDate]           AS "วันที่ต้องการของ",

          -- 🔹 รายละเอียดรายการใน PR
          T1.[ItemCode]          AS "รหัสสินค้า (PR)",
          T1.[Dscription]        AS "ชื่อสินค้า / รายการ (PR)",
          T1.[Quantity]          AS "จำนวนที่ขอ (PR)",
          T1.[LineStatus]        AS "สถานะรายการ (PR)",
          T1.[DocDate]           AS "วันที่รายการ (PR)",
          T1.[OcrCode],
          T1.[OcrCode2],
          T1.[OcrCode4],
          T1.[Project]           AS "รหัสโครงการ (PR)",
          T1.[VendorNum]         AS "รหัสผู้ขาย (PR)",
          T1.[SerialNum]         AS "Serial Number (PR)",

          -- 🔹 ข้อมูลเกี่ยวกับเอกสาร PR / Series
          T2.[Series],
          T2.[BeginStr]          AS "คำนำหน้าเอกสาร PR",

          -- 🔹 ข้อมูลที่เชื่อมโยงกับ PO
          T3.[BaseRef]           AS "เลขที่ PR ที่อ้างอิงใน PO",
          T4.[DocNum]            AS "เลขที่ PO",
          T4.[DocDueDate]        AS "วันที่ครบกำหนด PO",
          T3.[Dscription]        AS "รายละเอียดสินค้า (PO)",
          T3.[Quantity]          AS "จำนวนใน PO",
          T3.[unitMsr]           AS "หน่วยใน PO",
          T3.[LineStatus]        AS "สถานะรายการ (PO)"

      FROM
          OPRQ T0
          INNER JOIN PRQ1 T1 ON T0.[DocEntry] = T1.[DocEntry]
          LEFT JOIN NNM1 T2 ON T0.[Series] = T2.[Series]
          LEFT JOIN POR1 T3
              ON (T0.[DocNum] = T3.[BaseRef] AND T1.[Dscription] = T3.[Dscription])
          LEFT JOIN OPOR T4 ON T3.[DocEntry] = T4.[DocEntry]
          LEFT JOIN OUDP T5 ON T0.[Department] = T5.[Code]

      WHERE
          T2.[BeginStr] = 'PR'        -- แสดงเฉพาะเอกสารที่เป็น PR เท่านั้น

      ORDER BY
          T0.[DocNum];
    `);

    const records = result.recordset;
    console.log(`✓ ดึงข้อมูลได้ ${records.length} รายการ\n`);

    if (records.length === 0) {
      console.log('⚠️  ไม่มีข้อมูลให้ซิงค์');
      return;
    }

    // ✅ STEP 3: แปลงข้อมูลเป็น JSON format
    console.log('🔄 กำลังแปลงข้อมูลเป็น JSON format...');
    const jsonData = transformDataToJSON(records);

    console.log(`✓ แปลงข้อมูลเสร็จสิ้น:`);
    console.log(`  - PR Master: ${jsonData.pr_master.length} รายการ`);
    console.log(`  - PR Lines: ${jsonData.pr_lines.length} รายการ`);
    console.log(`  - PO Links: ${jsonData.pr_po_links.length} รายการ\n`);

    // ✅ STEP 4: เชื่อมต่อ PostgreSQL และเรียก function upsert_pr_data()
    console.log('📡 กำลังเชื่อมต่อ PostgreSQL...');
    pgClient = await pgPool.connect();
    console.log('✓ เชื่อมต่อ PostgreSQL สำเร็จ\n');

    console.log('💾 กำลัง UPSERT ข้อมูลเข้า PostgreSQL...');
    const startTime = Date.now();

    const upsertResult = await pgClient.query(
      'SELECT * FROM upsert_pr_data($1::JSONB)',
      [JSON.stringify(jsonData)]
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const result_data = upsertResult.rows[0];
    console.log(`✓ UPSERT เสร็จสิ้น (ใช้เวลา ${duration} วินาที)\n`);

    console.log('📊 สรุปผลการ UPSERT:');
    console.log(`  - PR Master: ${result_data.pr_master_updated} รายการ`);
    console.log(`  - PR Lines: ${result_data.pr_lines_updated} รายการ`);
    console.log(`  - PO Links: ${result_data.po_links_updated} รายการ`);
    console.log(`  - สถานะ: ${result_data.status}`);

    if (result_data.error_msg) {
      console.log(`  - Error: ${result_data.error_msg}`);
    }

    // ✅ STEP 5: Refresh Materialized View
    console.log('\n🔄 กำลัง Refresh Materialized View...');
    const refreshResult = await pgClient.query('SELECT quick_refresh_view()');
    console.log(`✓ ${refreshResult.rows[0].quick_refresh_view}\n`);

    console.log('✅ การซิงค์ข้อมูลเสร็จสมบูรณ์!\n');

    console.log('📝 สามารถดูข้อมูลได้จาก:');
    console.log('  - SELECT * FROM mv_pr_summary;           -- สรุป PR ทั้งหมด');
    console.log('  - SELECT * FROM vw_pr_pending;           -- PR ที่ยังไม่ครบ');
    console.log('  - SELECT * FROM vw_pr_detail;            -- รายละเอียด PR พร้อม PO');
    console.log('  - SELECT * FROM sync_log ORDER BY id DESC LIMIT 1;  -- ดู log');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    // ปิดการเชื่อมต่อ
    if (sqlPool) {
      await sqlPool.close();
    }
    if (pgClient) {
      pgClient.release();
    }
    await pgPool.end();
  }
}

// รันสคริปต์
syncPRPOData();
