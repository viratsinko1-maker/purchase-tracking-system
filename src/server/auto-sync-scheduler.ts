/**
 * Auto Sync Scheduler สำหรับ PR และ PO
 *
 * - Full Sync ทุก 2 ชั่วโมง (ใช้ node-cron)
 * - รัน PR และ PO แบบ background
 * - มี status tracking เพื่อป้องกัน manual sync ซ้อนทับ
 */

import { db } from '~/server/db';
import { createCaller } from '~/server/api/root';
import cron from 'node-cron';
import sql from 'mssql';

// SQL Server configuration (SAP B1)
const sqlConfig = {
  server: '10.1.1.199',
  database: 'TMK_PRD',
  user: 'powerquery_hq',
  password: '@Tmk963*',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  connectionTimeout: 30000,
  requestTimeout: 60000,
};

// Global sync status
let isSyncInProgress = false;
let currentSyncType: 'PR' | 'PO' | 'BOTH' | null = null;
let syncStartTime: Date | null = null;
let lastSyncEndTime: Date | null = null;

/**
 * Get current sync status
 */
export function getSyncStatus() {
  return {
    isInProgress: isSyncInProgress,
    syncType: currentSyncType,
    startTime: syncStartTime,
    lastEndTime: lastSyncEndTime,
  };
}

/**
 * Full Sync for PR
 */
async function syncPR() {
  console.log('[AUTO-SYNC] Starting PR FULL sync...');

  try {
    // สร้าง tRPC caller แบบ server-side พร้อม context
    const caller = createCaller({ db, req: undefined });

    // เรียก PR sync ด้วย fullSync: true
    const result = await caller.pr.sync({ fullSync: true });

    console.log('[AUTO-SYNC] ✅ PR FULL sync completed');
    return result;
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ PR sync error:', error);
    throw error;
  }
}

/**
 * Full Sync for PO
 */
async function syncPO() {
  console.log('[AUTO-SYNC] Starting PO FULL sync...');

  try {
    // สร้าง tRPC caller แบบ server-side พร้อม context
    const caller = createCaller({ db, req: undefined });

    // เรียก PO sync
    const result = await caller.po.sync();

    console.log('[AUTO-SYNC] ✅ PO FULL sync completed');
    return result;
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ PO sync error:', error);
    throw error;
  }
}

/**
 * Sync WO Summary
 * ดึงข้อมูลสรุป WO ทั้งหมดจาก SAP (คล้าย stored procedure usp_ssc_SummaryWObyDocument)
 * ล้างข้อมูลเก่าทั้งหมดก่อนดึงใหม่ทุกครั้ง
 */
async function syncWOSummary() {
  console.log('[AUTO-SYNC] Starting WO Summary sync (full refresh)...');
  let sqlPool: sql.ConnectionPool | null = null;

  try {
    // เชื่อมต่อ SQL Server
    sqlPool = await sql.connect(sqlConfig);

    // Query คล้าย stored procedure แต่ดึงทุก WO (ใช้ TRY_CONVERT เพื่อรองรับข้อมูลที่ไม่ถูกต้อง)
    const result = await sqlPool.request().query(`
      SELECT
        T1.SeriesName AS WO_SeriesName,
        WO.ObjType,
        WO.DocNum AS WO_DocNum,
        WO.DocEntry AS WO_DocEntry,
        WO.DocDate,
        WO.U_U_PR_FOR AS PR_FOR,
        WO.U_U_PR_MAC AS PR_MAC,
        T2.ItemName,
        WO.ReqName,
        WO.Department,
        T3.OcrName AS DeptName,
        WO.U_WOOrder1,
        WO.U_WORespondBy,
        WA.U_FinishDate2,
        TRY_CONVERT(datetime,
          CASE WHEN WO.U_Date IS NOT NULL AND WO.U_time IS NOT NULL AND LEN(WO.U_time) >= 3
            THEN CONVERT(nvarchar(10), WO.U_Date, 102) + ' ' +
              CASE WHEN LEN(WO.U_time) = 3 THEN LEFT(WO.U_time, 1) + ':' + RIGHT(WO.U_time, 2)
                   WHEN LEN(WO.U_time) >= 4 THEN LEFT(WO.U_time, 2) + ':' + RIGHT(WO.U_time, 2)
                   ELSE NULL END
            ELSE NULL END) AS WO_U_DATE,
        TRY_CONVERT(datetime,
          CASE WHEN WO.U_FinishDate IS NOT NULL AND WO.U_TIMEF IS NOT NULL AND LEN(WO.U_TIMEF) >= 3
            THEN CONVERT(nvarchar(10), WO.U_FinishDate, 102) + ' ' +
              CASE WHEN LEN(WO.U_TIMEF) = 3 THEN LEFT(WO.U_TIMEF, 1) + ':' + RIGHT(WO.U_TIMEF, 2)
                   WHEN LEN(WO.U_TIMEF) >= 4 THEN LEFT(WO.U_TIMEF, 2) + ':' + RIGHT(WO.U_TIMEF, 2)
                   ELSE NULL END
            ELSE NULL END) AS WO_U_Finish,
        WR.UpdateDate AS WR_CloseDate,
        WO.UpdateDate AS WO_CloseDate,
        WA.UpdateDate AS WA_CloseDate,
        WC.UpdateDate AS WC_CloseDate,
        TRY_CONVERT(datetime,
          CASE WHEN WA.U_FinishDate2 IS NOT NULL AND WA.U_FinishTime2 IS NOT NULL AND LEN(WA.U_FinishTime2) >= 3
            THEN CONVERT(nvarchar(10), WA.U_FinishDate2, 102) + ' ' +
              CASE WHEN LEN(WA.U_FinishTime2) = 3 THEN LEFT(WA.U_FinishTime2, 1) + ':' + RIGHT(WA.U_FinishTime2, 2)
                   WHEN LEN(WA.U_FinishTime2) >= 4 THEN LEFT(WA.U_FinishTime2, 2) + ':' + RIGHT(WA.U_FinishTime2, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_FinishDate,
        TRY_CONVERT(datetime,
          CASE WHEN WO.U_WODATEF IS NOT NULL AND WO.U_WOHRTEF IS NOT NULL AND LEN(WO.U_WOHRTEF) >= 3
            THEN CONVERT(nvarchar(10), WO.U_WODATEF, 102) + ' ' +
              CASE WHEN LEN(WO.U_WOHRTEF) = 3 THEN LEFT(WO.U_WOHRTEF, 1) + ':' + RIGHT(WO.U_WOHRTEF, 2)
                   WHEN LEN(WO.U_WOHRTEF) >= 4 THEN LEFT(WO.U_WOHRTEF, 2) + ':' + RIGHT(WO.U_WOHRTEF, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_PlantoWork,
        TRY_CONVERT(datetime,
          CASE WHEN WA.U_startJobDate IS NOT NULL AND WA.U_startJobTime IS NOT NULL AND LEN(WA.U_startJobTime) >= 3
            THEN CONVERT(nvarchar(10), WA.U_startJobDate, 102) + ' ' +
              CASE WHEN LEN(WA.U_startJobTime) = 3 THEN LEFT(WA.U_startJobTime, 1) + ':' + RIGHT(WA.U_startJobTime, 2)
                   WHEN LEN(WA.U_startJobTime) >= 4 THEN LEFT(WA.U_startJobTime, 2) + ':' + RIGHT(WA.U_startJobTime, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_StartWork,
        TRY_CONVERT(datetime,
          CASE WHEN WC.U_WC_MCDate_STO IS NOT NULL AND WC.U_WC_MCTime_STO IS NOT NULL AND LEN(WC.U_WC_MCTime_STO) >= 3
            THEN CONVERT(nvarchar(10), WC.U_WC_MCDate_STO, 102) + ' ' +
              CASE WHEN LEN(WC.U_WC_MCTime_STO) = 3 THEN LEFT(WC.U_WC_MCTime_STO, 1) + ':' + RIGHT(WC.U_WC_MCTime_STO, 2)
                   WHEN LEN(WC.U_WC_MCTime_STO) >= 4 THEN LEFT(WC.U_WC_MCTime_STO, 2) + ':' + RIGHT(WC.U_WC_MCTime_STO, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_MCStop,
        TRY_CONVERT(datetime,
          CASE WHEN WC.U_WC_MCDate_ST IS NOT NULL AND WC.U_WC_MCTime_ST IS NOT NULL AND LEN(WC.U_WC_MCTime_ST) >= 3
            THEN CONVERT(nvarchar(10), WC.U_WC_MCDate_ST, 102) + ' ' +
              CASE WHEN LEN(WC.U_WC_MCTime_ST) = 3 THEN LEFT(WC.U_WC_MCTime_ST, 1) + ':' + RIGHT(WC.U_WC_MCTime_ST, 2)
                   WHEN LEN(WC.U_WC_MCTime_ST) >= 4 THEN LEFT(WC.U_WC_MCTime_ST, 2) + ':' + RIGHT(WC.U_WC_MCTime_ST, 2)
                   ELSE NULL END
            ELSE NULL END) AS WA_MCStart,
        WC.U_WC_Du_PDT AS DueMCStop,
        WRN.SeriesName AS WR_SeriesName,
        WR.DocNum AS WR_DocNum,
        WAN.SeriesName AS WA_SeriesName,
        WA.DocNum AS WA_DocNum,
        WCN.SeriesName AS WC_SeriesName,
        WC.DocNum AS WC_DocNum,
        WO.U_WO_Respond1,
        WO.U_WO_Respond2,
        WO.U_WO_Respond3,
        WOA.U_NAME AS WO_Approver,
        WRA.U_NAME AS WR_Approver,
        WO.U_WO_NoteOrder,
        WC.U_WCOReason1,
        WC.U_WCWorkCommit1
      FROM OPRQ WO
      INNER JOIN NNM1 T1 ON WO.Series = T1.Series
      INNER JOIN PRQ21 WO21 ON WO.DocEntry = WO21.DocEntry
      INNER JOIN OPRQ WR ON WO21.RefDocEntr = WR.DocEntry
      INNER JOIN NNM1 WRN ON WR.Series = WRN.Series AND WRN.SeriesName LIKE 'WR%'
      LEFT JOIN PRQ21 WA21 ON WO.DocEntry = WA21.RefDocEntr
      LEFT JOIN OPRQ WA ON WA21.DocEntry = WA.DocEntry
      LEFT JOIN NNM1 WAN ON WA.Series = WAN.Series AND WAN.SeriesName LIKE 'WA%'
      LEFT JOIN PRQ21 WC21 ON WO.DocEntry = WC21.RefDocEntr
      LEFT JOIN OPRQ WC ON WC21.DocEntry = WC.DocEntry
      LEFT JOIN NNM1 WCN ON WC.Series = WCN.Series AND WCN.SeriesName LIKE 'WC%'
      LEFT JOIN OITM T2 ON WO.U_U_PR_MAC = T2.ItemCode
      INNER JOIN (SELECT OUDP.Code, OOCR.* FROM OUDP INNER JOIN OOCR ON OUDP.Name = OOCR.OcrCode) T3 ON WO.Department = T3.Code
      LEFT JOIN (SELECT a.DraftEntry, a.ObjType, c.USERid, c.U_NAME, MAX(b.sortID) SortID
                  FROM OWDD a
                  INNER JOIN WDD1 b ON a.WddCode = b.WddCode
                  INNER JOIN OUSR c ON b.Userid = c.USERID
                  GROUP BY a.DraftEntry, a.ObjType, c.USERid, c.U_NAME) WOA
          ON WO.draftKey = WOA.DraftEntry AND WOA.ObjType = '1470000113'
      LEFT JOIN (SELECT a.DraftEntry, a.ObjType, c.USERid, c.U_NAME, MAX(b.sortID) SortID
                  FROM OWDD a
                  INNER JOIN WDD1 b ON a.WddCode = b.WddCode
                  INNER JOIN OUSR c ON b.UserID = c.USERID
                  GROUP BY a.DraftEntry, a.ObjType, c.USERid, c.U_NAME) WRA
          ON WR.draftKey = WRA.DraftEntry AND WRA.ObjType = '1470000113'
      WHERE T1.SeriesName LIKE 'WO%'
      ORDER BY WO.DocNum DESC
    `);

    const records = result.recordset;
    console.log(`[AUTO-SYNC] Fetched ${records.length} WO Summary records from SAP`);

    if (records.length === 0) {
      console.log('[AUTO-SYNC] No WO Summary records found');
      return { success: true, count: 0 };
    }

    // ล้างข้อมูลเก่าทั้งหมดก่อน
    await db.wo_summary.deleteMany({});
    console.log('[AUTO-SYNC] Cleared old WO Summary data');

    // Insert ข้อมูลใหม่ทั้งหมด
    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const dataToInsert = batch.map((record: any) => ({
        wo_doc_num: Number(record.WO_DocNum),
        wo_doc_entry: record.WO_DocEntry ? Number(record.WO_DocEntry) : null,
        wo_series_name: record.WO_SeriesName || null,
        obj_type: record.ObjType || null,
        doc_date: record.DocDate || null,
        pr_for: record.PR_FOR || null,
        pr_mac: record.PR_MAC || null,
        item_name: record.ItemName || null,
        req_name: record.ReqName || null,
        department: record.Department ? String(record.Department) : null,
        dept_name: record.DeptName || null,
        wo_order_1: record.U_WOOrder1 || null,
        wo_respond_by: record.U_WORespondBy || null,
        wo_respond_1: record.U_WO_Respond1 || null,
        wo_respond_2: record.U_WO_Respond2 || null,
        wo_respond_3: record.U_WO_Respond3 || null,
        wo_note_order: record.U_WO_NoteOrder || null,
        wo_u_date: record.WO_U_DATE || null,
        wo_u_finish: record.WO_U_Finish || null,
        wo_close_date: record.WO_CloseDate || null,
        wr_series_name: record.WR_SeriesName || null,
        wr_doc_num: record.WR_DocNum ? Number(record.WR_DocNum) : null,
        wr_close_date: record.WR_CloseDate || null,
        wr_approver: record.WR_Approver || null,
        wa_series_name: record.WA_SeriesName || null,
        wa_doc_num: record.WA_DocNum ? Number(record.WA_DocNum) : null,
        wa_finish_date: record.WA_FinishDate || null,
        wa_plan_to_work: record.WA_PlantoWork || null,
        wa_start_work: record.WA_StartWork || null,
        wa_close_date: record.WA_CloseDate || null,
        u_finish_date_2: record.U_FinishDate2 || null,
        wc_series_name: record.WC_SeriesName || null,
        wc_doc_num: record.WC_DocNum ? Number(record.WC_DocNum) : null,
        wc_close_date: record.WC_CloseDate || null,
        wa_mc_stop: record.WA_MCStop || null,
        wa_mc_start: record.WA_MCStart || null,
        due_mc_stop: record.DueMCStop ? Number(record.DueMCStop) : null,
        wc_reason_1: record.U_WCOReason1 || null,
        wc_work_commit_1: record.U_WCWorkCommit1 || null,
        wo_approver: record.WO_Approver || null,
        last_sync_date: new Date(),
      }));

      await db.wo_summary.createMany({
        data: dataToInsert,
      });

      insertedCount += batch.length;
    }

    console.log(`[AUTO-SYNC] ✅ WO Summary sync completed (${insertedCount} records)`);
    return { success: true, count: insertedCount };
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ WO Summary sync error:', error);
    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

/**
 * Sync WO GI Detail (Goods Issue)
 * ดึงรายละเอียดการเบิกของที่เชื่อมกับ WO จาก SAP
 * ล้างข้อมูลเก่าทั้งหมดก่อนดึงใหม่ทุกครั้ง
 */
async function syncWOGIDetail() {
  console.log('[AUTO-SYNC] Starting WO GI Detail sync (full refresh)...');
  let sqlPool: sql.ConnectionPool | null = null;

  try {
    // เชื่อมต่อ SQL Server
    sqlPool = await sql.connect(sqlConfig);

    // Query WO GI Detail
    const result = await sqlPool.request().query(`
      SELECT
        T7.SeriesName AS WO_SeriesName,
        T7.BeginStr AS WO_BeginStr,
        T4.RefDocNum AS WO_RefDocNum,
        T0.DocNum AS GI_DocNum,
        T0.DocDate AS GI_DocDate,
        T5.DocDate AS WTQ_DocDate,
        T2.ItemCode,
        T2.Dscription AS Description,
        T2.OcrCode,
        T2.OcrCode2,
        T2.OcrCode4 AS Machine,
        T2.Project,
        P0.OcrName AS OcrName,
        P2.OcrName AS OcrName2,
        T2.Quantity,
        T2.unitMsr,
        T2.INMPrice,
        T2.StockSum,
        T2.StockValue,
        T0.U_IN_EmpName AS EmpName,
        T6.U_U_PR_FOR AS PR_FOR
      FROM OIGE T0
      INNER JOIN NNM1 T1 ON T0.Series = T1.Series
      INNER JOIN IGE1 T2 ON T0.DocEntry = T2.DocEntry
      INNER JOIN IGE21 T3 ON T0.DocEntry = T3.DocEntry
      INNER JOIN WTQ21 T4 ON T3.RefDocEntr = T4.DocEntry AND T3.RefObjType = T4.ObjectType
      INNER JOIN OWTQ T5 ON T4.DocEntry = T5.DocEntry
      INNER JOIN OPRQ T6 ON T4.RefDocEntr = T6.DocEntry AND T4.RefObjType = T6.ObjType
      INNER JOIN NNM1 T7 ON T6.Series = T7.Series
      LEFT OUTER JOIN OOCR P0 ON T2.OcrCode = P0.OcrCode
      LEFT OUTER JOIN OOCR P2 ON T2.OcrCode2 = P2.OcrCode
      WHERE T7.BeginStr NOT IN ('PR', 'WR')
      ORDER BY T4.RefDocNum DESC, T0.DocNum DESC
    `);

    const records = result.recordset;
    console.log(`[AUTO-SYNC] Fetched ${records.length} WO GI Detail records from SAP`);

    if (records.length === 0) {
      console.log('[AUTO-SYNC] No WO GI Detail records found');
      return { success: true, count: 0 };
    }

    // ล้างข้อมูลเก่าทั้งหมดก่อน
    await db.wo_gi_detail.deleteMany({});
    console.log('[AUTO-SYNC] Cleared old WO GI Detail data');

    // Insert ข้อมูลใหม่ทั้งหมด
    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const dataToInsert = batch.map((record: any) => ({
        wo_doc_num: Number(record.WO_RefDocNum),
        wo_series_name: record.WO_SeriesName || null,
        gi_doc_num: Number(record.GI_DocNum),
        gi_doc_date: record.GI_DocDate || null,
        wtq_doc_date: record.WTQ_DocDate || null,
        item_code: record.ItemCode || null,
        description: record.Description || null,
        quantity: record.Quantity ? Number(record.Quantity) : null,
        unit_msr: record.unitMsr || null,
        inm_price: record.INMPrice ? Number(record.INMPrice) : null,
        stock_value: record.StockValue ? Number(record.StockValue) : null,
        ocr_code: record.OcrCode || null,
        ocr_code2: record.OcrCode2 || null,
        ocr_name: record.OcrName || null,
        ocr_name2: record.OcrName2 || null,
        ocr_code4: record.Machine || null,
        project: record.Project || null,
        emp_name: record.EmpName || null,
        pr_for: record.PR_FOR || null,
        last_sync_date: new Date(),
      }));

      await db.wo_gi_detail.createMany({
        data: dataToInsert,
      });

      insertedCount += batch.length;
    }

    console.log(`[AUTO-SYNC] ✅ WO GI Detail sync completed (${insertedCount} records)`);
    return { success: true, count: insertedCount };
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ WO GI Detail sync error:', error);
    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

/**
 * Sync WO PO Detail
 * ดึงรายละเอียด PO ที่เชื่อมกับ WO ผ่าน PR จาก SAP
 * Flow: WO (OPRQ) -> PR (OPRQ via PRQ21) -> PO (OPOR via POR21)
 * ล้างข้อมูลเก่าทั้งหมดก่อนดึงใหม่ทุกครั้ง
 */
async function syncWOPODetail() {
  console.log('[AUTO-SYNC] Starting WO PO Detail sync (full refresh)...');
  let sqlPool: sql.ConnectionPool | null = null;

  try {
    // เชื่อมต่อ SQL Server
    sqlPool = await sql.connect(sqlConfig);

    // Query: หา PO ที่ link กับ WO ผ่าน PR แล้วดึงทุก lines ของ PO เหล่านั้น
    // ใช้ OUTER APPLY เพื่อดึง GRPO/APINV แรกสุด ป้องกัน duplicate จากการ JOIN หลาย records
    const result = await sqlPool.request().query(`
      WITH WO_PO_Link AS (
        -- หา PO ที่ link กับ WO ผ่าน PR (โดยใช้ BaseRef ที่เก็บ PR DocNum)
        SELECT DISTINCT
          WO.DocNum AS WO_DocNum,
          WO_NNM1.SeriesName AS WO_SeriesName,
          PR.DocNum AS PR_DocNum,
          PR_NNM1.SeriesName AS PR_SeriesName,
          PR.ReqName AS Requester,
          PO.DocEntry AS PO_DocEntry
        FROM OPRQ WO
        INNER JOIN NNM1 WO_NNM1 ON WO.Series = WO_NNM1.Series
        INNER JOIN PRQ21 ON WO.DocEntry = PRQ21.RefDocEntr AND PRQ21.RefObjType = WO.ObjType
        INNER JOIN OPRQ PR ON PRQ21.DocEntry = PR.DocEntry
        INNER JOIN NNM1 PR_NNM1 ON PR.Series = PR_NNM1.Series
        INNER JOIN POR1 ON PR.DocNum = POR1.BaseRef AND POR1.BaseType = 1470000113
        INNER JOIN OPOR PO ON POR1.DocEntry = PO.DocEntry
        WHERE WO_NNM1.BeginStr LIKE 'WO%'
      )
      SELECT
        WPL.WO_DocNum,
        WPL.WO_SeriesName,
        WPL.PR_DocNum,
        WPL.PR_SeriesName,
        WPL.Requester,
        PO.DocNum AS PO_DocNum,
        PO.DocDate AS PO_DocDate,
        PO.Canceled AS PO_Canceled,
        POR1.LineNum AS PO_LineNum,
        POR1.ItemCode,
        POR1.Dscription AS Description,
        POR1.Quantity,
        POR1.unitMsr AS UnitMsr,
        POR1.LineTotal,
        POR1.Price,
        -- ดึงวันที่รับของจาก GRPO หรือ A/P Invoice (ใช้ GRPO แรกสุด)
        COALESCE(GRPO_First.DocDate, APINV_First.DocDate) AS GRPO_DocDate,
        COALESCE(GRPO_First.DocNum, APINV_First.DocNum) AS GRPO_DocNum
      FROM WO_PO_Link WPL
      INNER JOIN OPOR PO ON WPL.PO_DocEntry = PO.DocEntry
      INNER JOIN POR1 ON PO.DocEntry = POR1.DocEntry
      -- GRPO (Goods Receipt PO) - ดึงแค่ record แรก (เรียงตาม DocNum)
      OUTER APPLY (
        SELECT TOP 1 GRPO.DocDate, GRPO.DocNum
        FROM PDN1
        INNER JOIN OPDN GRPO ON PDN1.DocEntry = GRPO.DocEntry
        WHERE PDN1.BaseEntry = POR1.DocEntry AND PDN1.BaseLine = POR1.LineNum AND PDN1.BaseType = 22
        ORDER BY GRPO.DocNum ASC
      ) GRPO_First
      -- A/P Invoice - ดึงแค่ record แรก (เรียงตาม DocNum)
      OUTER APPLY (
        SELECT TOP 1 APINV.DocDate, APINV.DocNum
        FROM PCH1
        INNER JOIN OPCH APINV ON PCH1.DocEntry = APINV.DocEntry
        WHERE PCH1.BaseEntry = POR1.DocEntry AND PCH1.BaseLine = POR1.LineNum AND PCH1.BaseType = 22
        ORDER BY APINV.DocNum ASC
      ) APINV_First
      ORDER BY WPL.WO_DocNum DESC, PO.DocNum ASC, POR1.LineNum ASC
    `);

    const records = result.recordset;
    console.log(`[AUTO-SYNC] Fetched ${records.length} WO PO Detail records from SAP`);

    if (records.length === 0) {
      console.log('[AUTO-SYNC] No WO PO Detail records found');
      return { success: true, count: 0 };
    }

    // ล้างข้อมูลเก่าทั้งหมดก่อน
    await db.wo_po_detail.deleteMany({});
    console.log('[AUTO-SYNC] Cleared old WO PO Detail data');

    // Insert ข้อมูลใหม่ทั้งหมด
    let insertedCount = 0;
    const batchSize = 100;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      const dataToInsert = batch.map((record: any) => ({
        wo_doc_num: Number(record.WO_DocNum),
        wo_series_name: record.WO_SeriesName || null,
        pr_doc_num: record.PR_DocNum ? Number(record.PR_DocNum) : null,
        pr_series_name: record.PR_SeriesName || null,
        po_doc_num: Number(record.PO_DocNum),
        po_doc_date: record.PO_DocDate || null,
        po_canceled: record.PO_Canceled || null,
        po_line_num: record.PO_LineNum != null ? Number(record.PO_LineNum) : null,
        item_code: record.ItemCode || null,
        description: record.Description || null,
        quantity: record.Quantity ? Number(record.Quantity) : null,
        unit_msr: record.UnitMsr || null,
        price: record.Price ? Number(record.Price) : null,
        line_total: record.LineTotal ? Number(record.LineTotal) : null,
        requester: record.Requester || null,
        grpo_doc_num: record.GRPO_DocNum ? Number(record.GRPO_DocNum) : null,
        grpo_doc_date: record.GRPO_DocDate || null,
        last_sync_date: new Date(),
      }));

      await db.wo_po_detail.createMany({
        data: dataToInsert,
      });

      insertedCount += batch.length;
    }

    console.log(`[AUTO-SYNC] ✅ WO PO Detail sync completed (${insertedCount} records)`);
    return { success: true, count: insertedCount };
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ WO PO Detail sync error:', error);
    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

/**
 * Sync PR-WO Link
 * ดึงความสัมพันธ์ระหว่าง PR กับ WO โดยตรงจาก SAP (PRQ1 + PRQ21)
 */
async function syncPRWOLink() {
  console.log('[AUTO-SYNC] Starting PR-WO Link sync...');
  let sqlPool: sql.ConnectionPool | null = null;

  try {
    // เชื่อมต่อ SQL Server
    sqlPool = await sql.connect(sqlConfig);

    // Query หา PR → WO โดยตรง
    const result = await sqlPool.request().query(`
      SELECT DISTINCT
          PR.DocNum AS PRNo,
          T2.RefDocNum AS WONo
      FROM OPRQ PR
      INNER JOIN PRQ1 T1 ON PR.DocEntry = T1.DocEntry
      INNER JOIN PRQ21 T2 ON T1.DocEntry = T2.DocEntry
      WHERE PR.Series IN (SELECT Series FROM NNM1 WHERE BeginStr = 'PR')
        AND T2.RefDocNum IS NOT NULL
        AND T2.RefDocNum > 0
    `);

    const records = result.recordset;
    console.log(`[AUTO-SYNC] Fetched ${records.length} PR-WO links from SAP`);

    if (records.length === 0) {
      console.log('[AUTO-SYNC] No PR-WO links found');
      return { success: true, count: 0 };
    }

    // Upsert ข้อมูลใหม่
    let upsertedCount = 0;
    for (const record of records) {
      if (!record.PRNo || !record.WONo) continue;

      try {
        await db.pr_wo_link.upsert({
          where: {
            pr_doc_num_wo_doc_num: {
              pr_doc_num: Number(record.PRNo),
              wo_doc_num: Number(record.WONo),
            },
          },
          update: {
            last_sync_date: new Date(),
            updated_at: new Date(),
          },
          create: {
            pr_doc_num: Number(record.PRNo),
            wo_doc_num: Number(record.WONo),
          },
        });
        upsertedCount++;
      } catch (err) {
        // Skip duplicates silently
      }
    }

    console.log(`[AUTO-SYNC] ✅ PR-WO Link sync completed (${upsertedCount} records)`);
    return { success: true, count: upsertedCount };
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ PR-WO Link sync error:', error);
    throw error;
  } finally {
    if (sqlPool) {
      await sqlPool.close();
    }
  }
}

/**
 * Run full sync for both PR and PO
 */
export async function runFullAutoSync() {
  // ป้องกัน sync ซ้อนทับ
  if (isSyncInProgress) {
    console.log('[AUTO-SYNC] ⚠️ Sync already in progress, skipping...');
    return {
      success: false,
      message: 'Sync already in progress',
    };
  }

  isSyncInProgress = true;
  currentSyncType = 'BOTH';
  syncStartTime = new Date();

  console.log(`[AUTO-SYNC] 🚀 Starting full auto-sync at ${syncStartTime.toISOString()}`);

  try {
    // Sync PR first
    currentSyncType = 'PR';
    await syncPR();

    // Sync PR-WO Link (หลัง PR sync)
    console.log('[AUTO-SYNC] Syncing PR-WO links...');
    await syncPRWOLink();

    // Sync WO Summary (หลัง PR-WO Link)
    console.log('[AUTO-SYNC] Syncing WO Summary...');
    await syncWOSummary();

    // Sync WO GI Detail (หลัง WO Summary)
    console.log('[AUTO-SYNC] Syncing WO GI Detail...');
    await syncWOGIDetail();

    // Sync WO PO Detail (หลัง WO GI Detail)
    console.log('[AUTO-SYNC] Syncing WO PO Detail...');
    await syncWOPODetail();

    // Then sync PO
    currentSyncType = 'PO';
    await syncPO();

    lastSyncEndTime = new Date();
    const duration = (lastSyncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[AUTO-SYNC] ✅ Full auto-sync completed in ${duration.toFixed(2)}s`);

    return {
      success: true,
      duration,
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
    };
  } catch (error) {
    console.error('[AUTO-SYNC] ❌ Auto-sync failed:', error);
    lastSyncEndTime = new Date();

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
    };
  } finally {
    isSyncInProgress = false;
    currentSyncType = null;
    syncStartTime = null;
  }
}

/**
 * Manual Full Refresh for PR ONLY
 * ล้างข้อมูล PR ทั้งหมดแล้วดึงใหม่
 * ใช้เมื่อพบปัญหา data integrity (เช่น PR-PO link ไม่ตรงกัน)
 */
export async function runManualPRFullRefresh() {
  // ป้องกัน sync ซ้อนทับ
  if (isSyncInProgress) {
    console.log('[MANUAL-REFRESH] ⚠️ Sync already in progress, skipping...');
    return {
      success: false,
      message: 'Sync already in progress',
    };
  }

  isSyncInProgress = true;
  currentSyncType = 'PR';
  syncStartTime = new Date();

  console.log(`[MANUAL-REFRESH] 🔄 Starting MANUAL PR FULL REFRESH at ${syncStartTime.toISOString()}`);
  console.log('[MANUAL-REFRESH] 🗑️  This will TRUNCATE all PR data and re-sync from SAP');

  try {
    // เรียก PR sync ด้วย fullSync: true
    // PR router จะทำการ TRUNCATE และดึงข้อมูลใหม่ทั้งหมด
    await syncPR();

    lastSyncEndTime = new Date();
    const duration = (lastSyncEndTime.getTime() - syncStartTime.getTime()) / 1000;

    console.log(`[MANUAL-REFRESH] ✅ PR Full Refresh completed in ${duration.toFixed(2)}s`);

    return {
      success: true,
      duration,
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
      message: 'PR data has been completely refreshed',
    };
  } catch (error) {
    console.error('[MANUAL-REFRESH] ❌ PR Full Refresh failed:', error);
    lastSyncEndTime = new Date();

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      startTime: syncStartTime,
      endTime: lastSyncEndTime,
    };
  } finally {
    isSyncInProgress = false;
    currentSyncType = null;
    syncStartTime = null;
  }
}

/**
 * Initialize Auto-Sync Scheduler
 * Runs every 2 hours using node-cron
 * Timezone: Asia/Bangkok
 */
export function initAutoSyncScheduler() {
  // Schedule to run every 2 hours at :00 (00:00, 02:00, 04:00, etc.)
  cron.schedule('0 */2 * * *', async () => {
    const currentTime = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    console.log(`[AUTO-SYNC] ⏰ Scheduled sync triggered at ${currentTime}`);
    await runFullAutoSync();
  }, {
    timezone: 'Asia/Bangkok'
  });

  console.log('[AUTO-SYNC] ✅ Scheduler initialized - Full Sync will run every 2 hours');
  console.log('[AUTO-SYNC] 📅 Schedule: Every 2 hours at :00 (00:00, 02:00, 04:00, ...)');

  // แสดงเวลา sync ครั้งถัดไป
  const now = new Date();
  const nextHour = Math.ceil(now.getHours() / 2) * 2;
  const nextSync = new Date(now);
  nextSync.setHours(nextHour, 0, 0, 0);
  if (nextSync <= now) {
    nextSync.setHours(nextSync.getHours() + 2);
  }
  console.log(`[AUTO-SYNC] Next sync will be at: ${nextSync.toLocaleString('th-TH')}`);
}
