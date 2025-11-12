import sql from 'mssql';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SQL Server configuration
const sqlConfig = {
  server: '10.1.1.199',
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

async function syncWithUpsert() {
  let sqlPool = null;

  try {
    console.log('🔄 เริ่มการซิงค์ข้อมูล PR-PO (Upsert Mode)...\n');

    // เชื่อมต่อ SQL Server
    console.log('📡 กำลังเชื่อมต่อ SQL Server...');
    sqlPool = await sql.connect(sqlConfig);
    console.log('✓ เชื่อมต่อ SQL Server สำเร็จ\n');

    // ดึงข้อมูลจาก SQL Server
    console.log('📥 กำลังดึงข้อมูลจาก SQL Server...');
    const result = await sqlPool.request().query(`
      SELECT
          T0.DocEntry AS "PR_DocEntry",
          T0.DocNum AS "PR_No",
          T0.DocDate AS "PR_Date",
          T0.DocDueDate AS "PR_DueDate",
          T5.SeriesName AS "SeriesName",
          T0.ReqName AS "PR_Requester",
          T4.Remarks AS "PR_Department",
          T0.U_U_PR_FOR AS "PR_JobName",
          T0.Comments AS "PR_Remarks",
          T0.DocStatus AS "PR_Status",
          T3.DocNum AS "PO_No",
          T1.Dscription AS "PO_Description",
          T1.Quantity AS "PO_Quantity",
          T1.unitMsr AS "PO_Unit",
          T1.LineNum AS "PO_LineNum"
      FROM
          OPRQ T0
          LEFT JOIN POR1 T1 ON T1.BaseRef = T0.DocNum
          LEFT JOIN OPOR T3 ON T3.DocEntry = T1.DocEntry
          LEFT JOIN OUDP T4 ON T0.Department = T4.Code
          LEFT JOIN NNM1 T5 ON T0.Series = T5.Series
      ORDER BY
          T0.DocDate ASC
    `);

    const records = result.recordset;
    console.log(`✓ ดึงข้อมูลได้ ${records.length} รายการ\n`);

    // Upsert แต่ละรายการ
    console.log('📤 กำลัง Upsert ข้อมูลเข้า PostgreSQL...');

    let createCount = 0;
    let updateCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        // สร้าง unique key จาก PR + PO + LineNum
        const uniqueKey = {
          prDocEntry: record.PR_DocEntry,
          prNo: record.PR_No,
          poNo: record.PO_No || null,
          poLineNum: record.PO_LineNum || null
        };

        // ตรวจสอบว่ามีอยู่แล้วหรือไม่
        const existing = await prisma.purchaseRequestPO.findFirst({
          where: uniqueKey
        });

        if (existing) {
          // Update
          await prisma.purchaseRequestPO.update({
            where: { id: existing.id },
            data: {
              prDate: new Date(record.PR_Date),
              prDueDate: new Date(record.PR_DueDate),
              seriesName: record.SeriesName,
              prRequester: record.PR_Requester,
              prDepartment: record.PR_Department,
              prJobName: record.PR_JobName,
              prRemarks: record.PR_Remarks,
              prStatus: record.PR_Status,
              poDescription: record.PO_Description,
              poQuantity: record.PO_Quantity,
              poUnit: record.PO_Unit
            }
          });
          updateCount++;
        } else {
          // Create
          await prisma.purchaseRequestPO.create({
            data: {
              prDocEntry: record.PR_DocEntry,
              prNo: record.PR_No,
              prDate: new Date(record.PR_Date),
              prDueDate: new Date(record.PR_DueDate),
              seriesName: record.SeriesName,
              prRequester: record.PR_Requester,
              prDepartment: record.PR_Department,
              prJobName: record.PR_JobName,
              prRemarks: record.PR_Remarks,
              prStatus: record.PR_Status,
              poNo: record.PO_No,
              poDescription: record.PO_Description,
              poQuantity: record.PO_Quantity,
              poUnit: record.PO_Unit,
              poLineNum: record.PO_LineNum
            }
          });
          createCount++;
        }

        // แสดงความคืบหน้า
        if ((i + 1) % 100 === 0) {
          console.log(`  ⏳ ดำเนินการ ${i + 1}/${records.length} (Create: ${createCount}, Update: ${updateCount})`);
        }
      } catch (error) {
        errorCount++;
        console.error(`  ✗ ข้อผิดพลาดที่รายการ ${i + 1}: ${error.message}`);
      }
    }

    console.log('\n📊 สรุปผลการซิงค์:');
    console.log(`  ➕ สร้างใหม่: ${createCount} รายการ`);
    console.log(`  🔄 อัพเดต: ${updateCount} รายการ`);
    if (errorCount > 0) {
      console.log(`  ✗ ล้มเหลว: ${errorCount} รายการ`);
    }

    console.log('\n✅ การซิงค์ข้อมูลเสร็จสมบูรณ์!');

  } catch (error) {
    console.error('\n❌ เกิดข้อผิดพลาด:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
    await prisma.$disconnect();
  }
}

syncWithUpsert();
