/**
 * Notification Router - สำหรับจัดการ notification ใน TopBar
 */
import { z } from "zod";
import { createTRPCRouter, authenticatedProcedure } from "~/server/api/trpc";

export const notificationRouter = createTRPCRouter({
  // ดึง notifications ของ user (สำหรับ TopBar)
  getMyNotifications: authenticatedProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().optional().default(20),
      unreadOnly: z.boolean().optional().default(false),
    }))
    .query(async ({ ctx, input }) => {
      const notifications = await ctx.db.user_notification.findMany({
        where: {
          user_id: input.userId,
          ...(input.unreadOnly ? { is_read: false } : {}),
        },
        orderBy: { created_at: 'desc' },
        take: input.limit,
      });

      return notifications;
    }),

  // นับ unread notifications
  getUnreadCount: authenticatedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const count = await ctx.db.user_notification.count({
        where: {
          user_id: input.userId,
          is_read: false,
        },
      });
      return count;
    }),

  // Mark เป็น read
  markAsRead: authenticatedProcedure
    .input(z.object({
      notificationIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user_notification.updateMany({
        where: { id: { in: input.notificationIds } },
        data: { is_read: true },
      });
      return { success: true };
    }),

  // Mark ทั้งหมดเป็น read
  markAllAsRead: authenticatedProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user_notification.updateMany({
        where: { user_id: input.userId, is_read: false },
        data: { is_read: true },
      });
      return { success: true };
    }),

  // ดึงรายชื่อผู้ขอ PR ที่ยังไม่ถูก link (สำหรับ dropdown ใน Admin Users)
  getAvailableReqNames: authenticatedProcedure
    .input(z.object({
      currentUserId: z.string().optional(), // User ID ที่กำลังแก้ไข (เพื่อไม่ exclude ตัวเอง)
    }))
    .query(async ({ ctx, input }) => {
      // 1. ดึง req_names ที่ถูก link ไปแล้ว (ยกเว้น currentUserId)
      const usedReqNames = await ctx.db.user_production.findMany({
        where: {
          linked_req_name: { not: null },
          ...(input.currentUserId ? { id: { not: input.currentUserId } } : {}),
        },
        select: { linked_req_name: true },
      });
      const usedSet = new Set(usedReqNames.map(u => u.linked_req_name));

      // 2. ดึง unique req_names ทั้งหมดจาก pr_master
      const allReqNames = await ctx.db.$queryRaw<Array<{ req_name: string; pr_count: number }>>`
        SELECT req_name, COUNT(*)::INTEGER as pr_count
        FROM pr_master
        WHERE req_name IS NOT NULL AND req_name != ''
        GROUP BY req_name
        ORDER BY req_name ASC
      `;

      // 3. Filter เอาเฉพาะที่ยังไม่ถูก link
      return allReqNames.filter(r => !usedSet.has(r.req_name));
    }),
});
