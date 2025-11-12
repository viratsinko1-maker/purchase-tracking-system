import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { getSyncStatus, runFullAutoSync } from "~/server/auto-sync-scheduler";

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
  getStatus: publicProcedure.query(async () => {
    return getSyncStatus();
  }),

  /**
   * เรียกใช้ Manual Full Sync (สำหรับ Admin หรือเมื่อต้องการ sync ทันที)
   * จะตรวจสอบว่ามี auto-sync ทำงานอยู่หรือไม่ก่อน
   */
  manualSync: publicProcedure.mutation(async () => {
    return await runFullAutoSync();
  }),
});
