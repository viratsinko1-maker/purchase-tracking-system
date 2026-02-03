import { z } from "zod";
import {
  createTRPCRouter,
  createTableProcedure,
} from "~/server/api/trpc";
import { getSyncStatus, runFullAutoSync, runManualPRFullRefresh } from "~/server/auto-sync-scheduler";

/**
 * Sync Router สำหรับ Auto-Sync Status และการควบคุม
 */
export const syncRouter = createTRPCRouter({

  /**
   * ดึงสถานะของ Auto-Sync ปัจจุบัน
   * ใช้สำหรับ Frontend polling เพื่อ:
   * - แสดงสถานะว่ากำลัง sync อยู่หรือไม่
   * - Block manual sync button ขณะที่ auto-sync ทำงาน
   * - Trigger auto-refresh เมื่อ sync เสร็จ
   */
  getStatus: createTableProcedure('admin_sync_pr', 'read').query(async () => {
    return getSyncStatus();
  }),

  /**
   * เรียกใช้ Manual Full Sync (สำหรับ Admin หรือเมื่อต้องการ sync ทันที)
   * จะตรวจสอบว่ามี auto-sync ทำงานอยู่หรือไม่ก่อน
   */
  manualSync: createTableProcedure('admin_sync', 'execute').mutation(async () => {
    return await runFullAutoSync();
  }),

  /**
   * Manual PR Full Refresh - ล้างข้อมูล PR ทั้งหมดแล้วดึงใหม่
   * ใช้เมื่อพบปัญหา data integrity (เช่น PR-PO link ไม่ตรงกัน)
   * ⚠️ WARNING: จะ TRUNCATE ข้อมูล PR ทั้งหมดแล้วดึงใหม่จาก SAP
   */
  manualPRRefresh: createTableProcedure('admin_sync', 'refresh').mutation(async () => {
    return await runManualPRFullRefresh();
  }),
});
