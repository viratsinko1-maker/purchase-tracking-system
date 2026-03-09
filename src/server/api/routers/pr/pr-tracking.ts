/**
 * PR Tracking Router - createTracking, getTrackingHistory, getLatestTrackings, responses
 */
import { z } from "zod";
import { createTRPCRouter, createTableProcedure } from "~/server/api/trpc";
import { notifyPRTracking, notifyPRTrackingResponse, sendTelegramMessageToUser } from "~/server/services/telegram";
import { getClientIp } from "~/server/utils/getClientIp";

export const prTrackingRouter = createTRPCRouter({
  // 🔹 สร้าง User Tracking Log ใหม่
  createTracking: createTableProcedure('pr_qa', 'create')
    .input(z.object({
      prNo: z.number(),
      urgencyLevel: z.enum(['ด่วนที่สุด', 'ด่วน', 'ปกติ', 'ปิดแล้ว']),
      note: z.string().optional(),
      trackedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const tracking = await ctx.db.user_tracking_log.create({
        data: {
          pr_doc_num: input.prNo,
          urgency_level: input.urgencyLevel,
          note: input.note || null,
          tracked_by: input.trackedBy || null,
        },
      });

      // Log activity trail
      try {
        const ipAddress = ctx.req ? getClientIp(ctx.req) : 'unknown';
        await ctx.db.activity_trail.create({
          data: {
            user_id: undefined,
            user_name: input.trackedBy ?? undefined,
            ip_address: ipAddress,
            action: 'TRACK_PR',
            description: input.note || 'บันทึกการติดตาม PR',
            pr_no: input.prNo,
            tracking_id: tracking.id,
            metadata: { urgency_level: input.urgencyLevel },
            created_at: new Date(),
          },
        });
      } catch (error) {
        console.error('[createTracking] Failed to log activity:', error);
      }

      // Send Telegram notification
      try {
        const prData = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          job_name: string | null;
          req_name: string | null;
          department_name: string | null;
        }>>(`
          SELECT doc_num, job_name, req_name, department_name
          FROM pr_master
          WHERE doc_num = $1
        `, input.prNo);

        if (prData && prData.length > 0) {
          const pr = prData[0];
          await notifyPRTracking({
            prNo: input.prNo,
            jobName: pr?.job_name || null,
            prRemarks: null,
            requesterName: pr?.req_name || null,
            departmentName: pr?.department_name || null,
            urgencyLevel: input.urgencyLevel,
            trackingNote: input.note || null,
            trackedBy: input.trackedBy || null,
            trackedAt: tracking.tracked_at,
          });
        }
      } catch (error) {
        console.error('[createTracking] Failed to send Telegram notification:', error);
      }

      // สร้าง In-App Notification ไปหา Manager ทุกคน (คำถามที่ยังไม่ได้ตอบ)
      try {
        const managers = await ctx.db.user_production.findMany({
          where: { role: 'Manager', isActive: true },
          select: { id: true, name: true },
        });

        if (managers.length > 0) {
          await ctx.db.user_notification.createMany({
            data: managers.map(mgr => ({
              user_id: mgr.id,
              type: 'qa_pending',
              title: `PR #${input.prNo} - มีคำถามใหม่`,
              message: `คำถาม: ${input.note || '-'}\nถามโดย: ${input.trackedBy || '-'}`,
              pr_doc_num: input.prNo,
              is_read: false,
            })),
          });
          console.log(`[Notification] Created qa_pending notification for ${managers.length} managers`);
        }
      } catch (error) {
        console.error('[createTracking] Failed to create manager notifications:', error);
      }

      return tracking;
    }),

  // 🔹 ดึงประวัติ Tracking ของ PR
  getTrackingHistory: createTableProcedure('pr_qa', 'read')
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const history = await ctx.db.user_tracking_log.findMany({
        where: { pr_doc_num: input.prNo },
        orderBy: { tracked_at: 'desc' },
      });
      return history;
    }),

  // 🔹 ดึง Tracking ล่าสุดของแต่ละ PR พร้อมคำตอบล่าสุด
  getLatestTrackings: createTableProcedure('pr_qa', 'read')
    .input(z.object({
      prNumbers: z.array(z.number()),
    }))
    .query(async ({ ctx, input }) => {
      const trackings = await ctx.db.$queryRawUnsafe<Array<{
        tracking_id: number;
        pr_doc_num: number;
        urgency_level: string;
        note: string | null;
        tracked_at: Date;
        tracked_by: string | null;
      }>>(`
        SELECT DISTINCT ON (pr_doc_num)
          id as tracking_id, pr_doc_num, urgency_level, note, tracked_at, tracked_by
        FROM user_tracking_log
        WHERE pr_doc_num = ANY($1::int[])
        ORDER BY pr_doc_num, tracked_at DESC
      `, input.prNumbers);

      const trackingIds = trackings.map(t => t.tracking_id);

      let latestResponses: Array<{
        tracking_id: number;
        response_note: string | null;
        responded_by: string | null;
        responded_at: Date;
      }> = [];

      if (trackingIds.length > 0) {
        latestResponses = await ctx.db.$queryRawUnsafe(`
          SELECT DISTINCT ON (tracking_id)
            tracking_id, response_note, responded_by, responded_at
          FROM tracking_response_log
          WHERE tracking_id = ANY($1::int[])
          ORDER BY tracking_id, responded_at DESC
        `, trackingIds);
      }

      const trackingStats = await ctx.db.$queryRawUnsafe<Array<{
        pr_doc_num: number;
        total_questions: number;
        answered_questions: number;
      }>>(`
        SELECT
          utl.pr_doc_num,
          COUNT(DISTINCT utl.id)::int as total_questions,
          COUNT(DISTINCT CASE WHEN trl.tracking_id IS NOT NULL THEN utl.id END)::int as answered_questions
        FROM user_tracking_log utl
        LEFT JOIN tracking_response_log trl ON utl.id = trl.tracking_id
        WHERE utl.pr_doc_num = ANY($1::int[])
        GROUP BY utl.pr_doc_num
      `, input.prNumbers);

      const responseMap = new Map();
      latestResponses.forEach(response => {
        responseMap.set(response.tracking_id, response);
      });

      const statsMap = new Map();
      trackingStats.forEach(stat => {
        statsMap.set(stat.pr_doc_num, {
          total_questions: stat.total_questions,
          answered_questions: stat.answered_questions,
        });
      });

      const trackingMap: Record<number, any> = {};
      trackings.forEach(tracking => {
        const latestResponse = responseMap.get(tracking.tracking_id);
        const stats = statsMap.get(tracking.pr_doc_num) || { total_questions: 0, answered_questions: 0 };
        trackingMap[tracking.pr_doc_num] = {
          ...tracking,
          latest_response: latestResponse || null,
          total_questions: stats.total_questions,
          answered_questions: stats.answered_questions,
        };
      });

      return trackingMap;
    }),

  // 🔹 สร้าง Tracking Response
  createTrackingResponse: createTableProcedure('pr_qa', 'respond')
    .input(z.object({
      trackingId: z.number(),
      prNo: z.number(),
      responseNote: z.string().optional(),
      respondedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // ลบ notification qa_pending ของ Manager ทั้งหมดสำหรับ PR นี้ (เพราะมีคำตอบแล้ว)
      try {
        const deleted = await ctx.db.user_notification.deleteMany({
          where: { type: 'qa_pending', pr_doc_num: input.prNo },
        });
        if (deleted.count > 0) {
          console.log(`[Notification] Deleted ${deleted.count} qa_pending notifications for PR #${input.prNo}`);
        }
      } catch (error) {
        console.error('[createTrackingResponse] Failed to delete qa_pending notifications:', error);
      }

      const response = await ctx.db.tracking_response_log.create({
        data: {
          tracking_id: input.trackingId,
          pr_doc_num: input.prNo,
          response_note: input.responseNote || null,
          responded_by: input.respondedBy || null,
        },
      });

      // Log activity trail
      try {
        const ipAddress = ctx.req ? getClientIp(ctx.req) : 'unknown';
        await ctx.db.activity_trail.create({
          data: {
            user_id: undefined,
            user_name: input.respondedBy ?? undefined,
            ip_address: ipAddress,
            action: 'RESPONSE_PR',
            description: input.responseNote || 'ตอบกลับการติดตาม PR',
            pr_no: input.prNo,
            tracking_id: input.trackingId,
            metadata: { response_id: response.id },
            created_at: new Date(),
          },
        });
      } catch (error) {
        console.error('[createTrackingResponse] Failed to log activity:', error);
      }

      // Send Telegram notification
      try {
        const prData = await ctx.db.$queryRawUnsafe<Array<{
          doc_num: number;
          job_name: string | null;
          req_name: string | null;
          department_name: string | null;
        }>>(`
          SELECT doc_num, job_name, req_name, department_name
          FROM pr_master
          WHERE doc_num = $1
        `, input.prNo);

        const trackingData = await ctx.db.user_tracking_log.findUnique({
          where: { id: input.trackingId },
        });

        if (prData && prData.length > 0 && trackingData) {
          const pr = prData[0];
          await notifyPRTrackingResponse({
            prNo: input.prNo,
            jobName: pr?.job_name || null,
            prRemarks: null,
            requesterName: pr?.req_name || null,
            departmentName: pr?.department_name || null,
            urgencyLevel: trackingData.urgency_level,
            trackingNote: trackingData.note,
            trackedBy: trackingData.tracked_by,
            trackedAt: trackingData.tracked_at,
            responseNote: input.responseNote || '',
            respondedBy: input.respondedBy || null,
            respondedAt: response.responded_at,
          });

          // === ส่ง Telegram ส่วนตัวไปหาผู้ถาม ===
          // Track the asker's chat ID for later comparison
          let askerChatId: string | null = null;

          if (trackingData.tracked_by) {
            try {
              // ค้นหา exact match ก่อน ถ้าไม่เจอลองเติม trailing space
              let matchedUser = await ctx.db.user_production.findFirst({
                where: {
                  name: trackingData.tracked_by,
                  telegramChatId: { not: null },
                  isActive: true,
                },
                select: { name: true, telegramChatId: true },
              });

              // ถ้าไม่เจอ ลองค้นหาแบบมี trailing space
              if (!matchedUser) {
                matchedUser = await ctx.db.user_production.findFirst({
                  where: {
                    name: trackingData.tracked_by + ' ',
                    telegramChatId: { not: null },
                    isActive: true,
                  },
                  select: { name: true, telegramChatId: true },
                });
              }

              if (matchedUser?.telegramChatId) {
                // Save for later comparison with PR opener
                askerChatId = matchedUser.telegramChatId;

                const formatName = (name: string | null): string => {
                  if (!name) return "-";
                  if (name.includes(',')) {
                    const parts = name.split(',').map(p => p.trim());
                    return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
                  }
                  return name;
                };

                const formatDateTime = (date: Date | string | null): string => {
                  if (!date) return "-";
                  return new Date(date).toLocaleString("th-TH", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                };

                const personalMessage = `🔔 <b>มีการตอบกลับคำถามของคุณ</b>

📋 PR #${input.prNo}
🏗️ โครงการ: ${pr?.job_name || '-'}

❓ <b>คำถามของคุณ:</b>
${trackingData.note || '-'}

💬 <b>คำตอบ:</b>
${input.responseNote || '-'}
👤 ตอบโดย: ${formatName(input.respondedBy || null)}
🕐 เมื่อ: ${formatDateTime(response.responded_at)}`;

                await sendTelegramMessageToUser(matchedUser.telegramChatId, personalMessage);
                console.log(`[Telegram] Sent personal notification to asker: ${matchedUser.name}`);
              }
            } catch (personalNotifyError) {
              console.error('[Telegram] Failed to send personal notification to asker:', personalNotifyError);
            }
          }

          // === ส่ง Notification (In-App + Telegram) ไปหาผู้เปิด PR ===
          if (pr?.req_name) {
            try {
              // ใช้ linked_req_name แทน name.contains เพื่อความแม่นยำ
              const prOpenerUser = await ctx.db.user_production.findFirst({
                where: {
                  linked_req_name: pr.req_name,  // Match exact กับ req_name ใน pr_master
                  isActive: true,
                },
                select: { id: true, name: true, telegramChatId: true },
              });

              // เช็คว่าผู้เปิด PR กับผู้ถาม เป็นคนเดียวกันไหม (เทียบ chatId)
              const openerChatId = prOpenerUser?.telegramChatId;

              // สร้าง notification สำหรับผู้เปิด PR (ถ้าเป็นคนละคนกับผู้ถาม หรือไม่มี askerChatId)
              if (prOpenerUser && (!askerChatId || openerChatId !== askerChatId)) {
                // 1. สร้าง In-App Notification (สำหรับ TopBar)
                await ctx.db.user_notification.create({
                  data: {
                    user_id: prOpenerUser.id,
                    type: 'qa_answered',
                    title: `มีการตอบคำถามใน PR #${input.prNo}`,
                    message: `คำถาม: ${trackingData.note || '-'}\nตอบโดย: ${input.respondedBy || '-'}`,
                    pr_doc_num: input.prNo,
                    is_read: false,
                  },
                });
                console.log(`[Notification] Created in-app notification for PR opener: ${prOpenerUser.name}`);

                // 2. ส่ง Telegram (ถ้ามี telegramChatId)
                if (prOpenerUser.telegramChatId) {
                  const formatName = (name: string | null): string => {
                    if (!name) return "-";
                    if (name.includes(',')) {
                      const parts = name.split(',').map(p => p.trim());
                      return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
                    }
                    return name;
                  };

                  const formatDateTime = (date: Date | string | null): string => {
                    if (!date) return "-";
                    return new Date(date).toLocaleString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  };

                  const openerMessage = `🔔 <b>มีการตอบคำถามใน PR ของคุณ</b>

📋 PR #${input.prNo}
🏗️ โครงการ: ${pr?.job_name || '-'}

❓ <b>คำถาม:</b>
${trackingData.note || '-'}
👤 ถามโดย: ${formatName(trackingData.tracked_by || null)}

💬 <b>คำตอบ:</b>
${input.responseNote || '-'}
👤 ตอบโดย: ${formatName(input.respondedBy || null)}
🕐 เมื่อ: ${formatDateTime(response.responded_at)}`;

                  await sendTelegramMessageToUser(prOpenerUser.telegramChatId, openerMessage);
                  console.log(`[Telegram] Sent personal notification to PR opener: ${prOpenerUser.name}`);
                }
              } else if (openerChatId === askerChatId) {
                console.log(`[Telegram] PR opener is same as asker, skipping duplicate notification`);
              }
            } catch (openerNotifyError) {
              console.error('[Notification] Failed to send notification to PR opener:', openerNotifyError);
            }
          }
        }
      } catch (error) {
        console.error('[createTrackingResponse] Failed to send Telegram notification:', error);
      }

      return response;
    }),

  // 🔹 ดึงประวัติคำตอบการติดตาม
  getTrackingResponses: createTableProcedure('pr_qa', 'read')
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const responses = await ctx.db.tracking_response_log.findMany({
        where: { pr_doc_num: input.prNo },
        include: { user_tracking_log: true },
        orderBy: { responded_at: 'desc' },
      });
      return responses;
    }),

  // 🔹 ดึงข้อมูล Tracking พร้อม Responses
  getTrackingWithResponses: createTableProcedure('pr_qa', 'read')
    .input(z.object({ prNo: z.number() }))
    .query(async ({ ctx, input }) => {
      const trackings = await ctx.db.user_tracking_log.findMany({
        where: { pr_doc_num: input.prNo },
        include: {
          tracking_response_log: {
            orderBy: { responded_at: 'desc' },
          },
        },
        orderBy: { tracked_at: 'desc' },
      });
      return trackings;
    }),

  // 🔹 ดึง PR Numbers ตามระดับความเร่งด่วน
  getPRsByUrgencyLevels: createTableProcedure('pr_qa', 'read')
    .input(z.object({
      urgencyLevels: z.array(z.string()),
    }))
    .query(async ({ ctx, input }) => {
      if (input.urgencyLevels.length === 0) {
        return [];
      }

      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      const dateString = twelveMonthsAgo.toISOString().split('T')[0];

      const trackings = await ctx.db.$queryRawUnsafe<Array<{
        pr_doc_num: number;
        urgency_level: string;
        tracked_at: Date;
      }>>(`
        SELECT DISTINCT ON (pr_doc_num)
          pr_doc_num, urgency_level, tracked_at
        FROM user_tracking_log
        WHERE urgency_level = ANY($1::text[])
          AND DATE(tracked_at) >= $2::DATE
        ORDER BY pr_doc_num, tracked_at DESC
      `, input.urgencyLevels, dateString);

      return trackings.map(t => t.pr_doc_num);
    }),

  // 🔹 ดึงข้อมูล Q&A ทั้งหมด
  getAllQA: createTableProcedure('pr_qa', 'read')
    .input(z.object({
      trackedBy: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      prNo: z.number().optional(),
      requesterName: z.string().optional(),
      jobName: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let filteredPrNos: number[] | undefined;

      if (input.requesterName || input.jobName) {
        const prWhereConditions: any = {};

        if (input.requesterName) {
          prWhereConditions.req_name = { contains: input.requesterName, mode: 'insensitive' };
        }
        if (input.jobName) {
          prWhereConditions.job_name = { contains: input.jobName, mode: 'insensitive' };
        }

        const filteredPRs = await ctx.db.pr_master.findMany({
          where: prWhereConditions,
          select: { doc_num: true },
        });

        filteredPrNos = filteredPRs.map(pr => pr.doc_num);
        if (filteredPrNos.length === 0) {
          return [];
        }
      }

      const whereConditions: any = {};

      if (input.trackedBy) {
        whereConditions.tracked_by = { contains: input.trackedBy, mode: 'insensitive' };
      }

      if (input.dateFrom || input.dateTo) {
        whereConditions.tracked_at = {};
        if (input.dateFrom) {
          whereConditions.tracked_at.gte = new Date(input.dateFrom);
        }
        if (input.dateTo) {
          const toDate = new Date(input.dateTo);
          toDate.setHours(23, 59, 59, 999);
          whereConditions.tracked_at.lte = toDate;
        }
      }

      if (input.prNo) {
        whereConditions.pr_doc_num = input.prNo;
      }

      if (filteredPrNos) {
        whereConditions.pr_doc_num = { in: filteredPrNos };
      }

      const trackings = await ctx.db.user_tracking_log.findMany({
        where: whereConditions,
        include: {
          tracking_response_log: {
            orderBy: { responded_at: 'desc' },
          },
        },
        orderBy: [
          { pr_doc_num: 'desc' },
          { tracked_at: 'desc' },
        ],
      });

      const prNos = [...new Set(trackings.map(t => t.pr_doc_num))];
      const prMasters = await ctx.db.pr_master.findMany({
        where: { doc_num: { in: prNos } },
        select: {
          doc_num: true,
          req_name: true,
          department_name: true,
          series_name: true,
          job_name: true,
        },
      });

      const prInfoMap = new Map(prMasters.map(pr => [pr.doc_num, pr]));

      const qaData = trackings.map(tracking => ({
        ...tracking,
        pr_info: prInfoMap.get(tracking.pr_doc_num) || null,
      }));

      return qaData;
    }),

  // 🔹 ดึง PR พร้อม Tracking ล่าสุด (12 เดือนย้อนหลัง)
  getPRsWithTrackingsLast12Months: createTableProcedure('pr_qa', 'read')
    .query(async ({ ctx }) => {
      const date12MonthsAgo = new Date();
      date12MonthsAgo.setMonth(date12MonthsAgo.getMonth() - 12);
      const dateFrom = date12MonthsAgo.toISOString().split('T')[0];

      const trackingsWithPRs = await ctx.db.$queryRawUnsafe<Array<{
        tracking_id: number;
        pr_doc_num: number;
        urgency_level: string;
        note: string | null;
        tracked_at: Date;
        tracked_by: string | null;
        req_name: string | null;
        department_name: string | null;
        doc_date: Date;
        doc_due_date: Date;
        doc_status: string;
        series_name: string | null;
        update_date: Date;
        job_name: string | null;
        remarks: string | null;
        total_lines: number;
        lines_with_po: number;
        pending_lines: number;
        is_complete: boolean;
        po_numbers: number[];
        total_po_quantity: number | null;
      }>>(`
        SELECT DISTINCT ON (utl.pr_doc_num)
          utl.id as tracking_id, utl.pr_doc_num, utl.urgency_level, utl.note, utl.tracked_at, utl.tracked_by,
          mv.req_name, mv.department_name, mv.doc_date, mv.doc_due_date, mv.doc_status, mv.series_name,
          mv.update_date, mv.job_name, mv.remarks, mv.total_lines, mv.lines_with_po, mv.pending_lines,
          mv.is_complete, mv.po_numbers, mv.total_po_quantity
        FROM user_tracking_log utl
        INNER JOIN mv_pr_summary mv ON utl.pr_doc_num = mv.doc_num
        WHERE utl.tracked_at >= $1::DATE
        ORDER BY utl.pr_doc_num, utl.tracked_at DESC
      `, dateFrom);

      const trackingIds = trackingsWithPRs.map(t => t.tracking_id);

      let latestResponses: Array<{
        tracking_id: number;
        response_note: string | null;
        responded_by: string | null;
        responded_at: Date;
      }> = [];

      if (trackingIds.length > 0) {
        latestResponses = await ctx.db.$queryRawUnsafe(`
          SELECT DISTINCT ON (tracking_id)
            tracking_id, response_note, responded_by, responded_at
          FROM tracking_response_log
          WHERE tracking_id = ANY($1::int[])
          ORDER BY tracking_id, responded_at DESC
        `, trackingIds);
      }

      const prNumbers = trackingsWithPRs.map(t => t.pr_doc_num);
      const trackingStats = await ctx.db.$queryRawUnsafe<Array<{
        pr_doc_num: number;
        total_questions: number;
        answered_questions: number;
      }>>(`
        SELECT
          utl.pr_doc_num,
          COUNT(DISTINCT utl.id)::int as total_questions,
          COUNT(DISTINCT CASE WHEN trl.tracking_id IS NOT NULL THEN utl.id END)::int as answered_questions
        FROM user_tracking_log utl
        LEFT JOIN tracking_response_log trl ON utl.id = trl.tracking_id
        WHERE utl.pr_doc_num = ANY($1::int[])
        GROUP BY utl.pr_doc_num
      `, prNumbers);

      const responseMap = new Map();
      latestResponses.forEach(response => {
        responseMap.set(response.tracking_id, response);
      });

      const statsMap = new Map();
      trackingStats.forEach(stat => {
        statsMap.set(stat.pr_doc_num, {
          total_questions: stat.total_questions,
          answered_questions: stat.answered_questions,
        });
      });

      const result = trackingsWithPRs.map(item => {
        const latestResponse = responseMap.get(item.tracking_id);
        const stats = statsMap.get(item.pr_doc_num) || { total_questions: 0, answered_questions: 0 };

        return {
          doc_num: item.pr_doc_num,
          req_name: item.req_name,
          department_name: item.department_name,
          doc_date: item.doc_date,
          doc_due_date: item.doc_due_date,
          doc_status: item.doc_status,
          series_name: item.series_name,
          update_date: item.update_date,
          job_name: item.job_name,
          remarks: item.remarks,
          total_lines: item.total_lines,
          lines_with_po: item.lines_with_po,
          pending_lines: item.pending_lines,
          is_complete: item.is_complete,
          po_numbers: item.po_numbers,
          total_po_quantity: item.total_po_quantity,
          tracking: {
            tracking_id: item.tracking_id,
            urgency_level: item.urgency_level,
            note: item.note,
            tracked_at: item.tracked_at,
            tracked_by: item.tracked_by,
            latest_response: latestResponse || null,
            total_questions: stats.total_questions,
            answered_questions: stats.answered_questions,
          },
        };
      });

      return { success: true, data: result };
    }),
});
