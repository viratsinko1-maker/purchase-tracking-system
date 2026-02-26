/**
 * KPI Router - Approval & Receive Confirm KPI Tracking
 */
import { z } from "zod";
import { createTRPCRouter, createTableProcedure, adminProcedure } from "~/server/api/trpc";

export const kpiRouter = createTRPCRouter({
  // =====================================================
  // PERSONAL KPI (สำหรับดู KPI ของตัวเอง)
  // =====================================================

  // =====================================================
  // PERSONAL APPROVAL KPI - Pre-aggregated (รายวัน/สัปดาห์/เดือน/ปี)
  // =====================================================

  // 🔹 Daily Approval KPI (summary per stage + detail records)
  getMyApprovalKPIDaily: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      date: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, date } = input;
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nextDay = new Date(dateOnly);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get pre-aggregated summary per stage
      const summaries = await ctx.db.kpi_approval_daily.findMany({
        where: { user_id: userId, date: dateOnly },
      });

      // Get detail records for this day
      const details = await ctx.db.approval_kpi_metric.findMany({
        where: {
          user_id: userId,
          approved_at: { gte: dateOnly, lt: nextDay },
        },
        orderBy: { approved_at: 'desc' },
      });

      const stageOrder = ['requester', 'line', 'cost_center', 'procurement', 'vpc'];
      const stageNames: Record<string, string> = {
        requester: 'ผู้ขอซื้อ',
        line: 'ผู้อนุมัติตามสายงาน',
        cost_center: 'ผู้อนุมัติตาม Cost Center',
        procurement: 'งานจัดซื้อพัสดุ',
        vpc: 'VP-C',
      };

      const stages: Record<string, {
        count: number;
        avgDays: number | null;
        onTimeCount: number;
        lateCount: number;
        onTimeRate: number | null;
      }> = {};

      for (const s of summaries) {
        const total = s.on_time_count + s.late_count;
        stages[s.approval_stage] = {
          count: s.total_count,
          avgDays: Number(s.avg_duration_days),
          onTimeCount: s.on_time_count,
          lateCount: s.late_count,
          onTimeRate: total > 0 ? Math.round((s.on_time_count / total) * 100) : null,
        };
      }

      return {
        stages,
        stageOrder,
        stageNames,
        details: details.map(d => ({
          prDocNum: d.pr_doc_num,
          stage: d.approval_stage,
          stageName: stageNames[d.approval_stage] || d.approval_stage,
          approvedAt: d.approved_at,
          durationDays: Number(d.duration_days),
          isOnTime: d.is_on_time,
        })),
      };
    }),

  // 🔹 Weekly Approval KPI (all weeks of year)
  getMyApprovalKPIWeekly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year } = input;

      const records = await ctx.db.kpi_approval_weekly.findMany({
        where: { user_id: userId, year },
        orderBy: { week: 'asc' },
      });

      return {
        records: records.map(r => {
          const total = r.on_time_count + r.late_count;
          return {
            week: r.week,
            weekStart: r.week_start,
            weekEnd: r.week_end,
            approvalStage: r.approval_stage,
            totalCount: r.total_count,
            avgDays: Number(r.avg_duration_days),
            onTimeCount: r.on_time_count,
            lateCount: r.late_count,
            onTimeRate: total > 0 ? Math.round((r.on_time_count / total) * 100) : null,
          };
        }),
      };
    }),

  // 🔹 Monthly Approval KPI (all months of year)
  getMyApprovalKPIMonthly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year } = input;

      const records = await ctx.db.kpi_approval_monthly.findMany({
        where: { user_id: userId, year },
        orderBy: { month: 'asc' },
      });

      return {
        records: records.map(r => {
          const total = r.on_time_count + r.late_count;
          return {
            month: r.month,
            approvalStage: r.approval_stage,
            totalCount: r.total_count,
            avgDays: Number(r.avg_duration_days),
            onTimeCount: r.on_time_count,
            lateCount: r.late_count,
            onTimeRate: total > 0 ? Math.round((r.on_time_count / total) * 100) : null,
          };
        }),
      };
    }),

  // 🔹 Yearly Approval KPI (all years)
  getMyApprovalKPIYearly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      const records = await ctx.db.kpi_approval_yearly.findMany({
        where: { user_id: userId },
        orderBy: { year: 'asc' },
      });

      return {
        records: records.map(r => {
          const total = r.on_time_count + r.late_count;
          return {
            year: r.year,
            approvalStage: r.approval_stage,
            totalCount: r.total_count,
            avgDays: Number(r.avg_duration_days),
            onTimeCount: r.on_time_count,
            lateCount: r.late_count,
            onTimeRate: total > 0 ? Math.round((r.on_time_count / total) * 100) : null,
          };
        }),
      };
    }),

  // =====================================================
  // PERSONAL RECEIVE KPI - Pre-aggregated (รายวัน/สัปดาห์/เดือน/ปี)
  // =====================================================

  // 🔹 Daily Receive Confirm KPI (summary + detail records)
  getMyReceiveKPIDaily: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      date: z.date(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, date } = input;
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nextDay = new Date(dateOnly);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get pre-aggregated summary
      const summary = await ctx.db.kpi_receive_daily.findUnique({
        where: {
          user_id_date: { user_id: userId, date: dateOnly },
        },
      });

      // Get detail records for this day
      const details = await ctx.db.receive_confirm_kpi_metric.findMany({
        where: {
          user_id: userId,
          confirmed_at: { gte: dateOnly, lt: nextDay },
        },
        orderBy: { confirmed_at: 'desc' },
      });

      const totalWithSLA = (summary?.on_time_count ?? 0) + (summary?.late_count ?? 0);

      return {
        summary: summary ? {
          totalCount: summary.total_count,
          avgMinutes: Number(summary.avg_duration_min),
          onTimeCount: summary.on_time_count,
          lateCount: summary.late_count,
          onTimeRate: totalWithSLA > 0 ? Math.round((summary.on_time_count / totalWithSLA) * 100) : null,
          confirmedCount: summary.confirmed_count,
          rejectedCount: summary.rejected_count,
        } : null,
        details: details.map(d => ({
          prDocNum: d.pr_doc_num,
          batchKey: d.batch_key,
          receivedAt: d.received_at,
          confirmedAt: d.confirmed_at,
          durationMinutes: Math.round(Number(d.duration_minutes)),
          isOnTime: d.is_on_time,
          confirmStatus: d.confirm_status,
          itemsCount: d.items_count,
        })),
      };
    }),

  // 🔹 Weekly Receive Confirm KPI (all weeks of year)
  getMyReceiveKPIWeekly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year } = input;

      const records = await ctx.db.kpi_receive_weekly.findMany({
        where: { user_id: userId, year },
        orderBy: { week: 'asc' },
      });

      return {
        records: records.map(r => {
          const totalWithSLA = r.on_time_count + r.late_count;
          return {
            week: r.week,
            weekStart: r.week_start,
            weekEnd: r.week_end,
            totalCount: r.total_count,
            avgMinutes: Math.round(Number(r.avg_duration_min)),
            onTimeCount: r.on_time_count,
            lateCount: r.late_count,
            onTimeRate: totalWithSLA > 0 ? Math.round((r.on_time_count / totalWithSLA) * 100) : null,
            confirmedCount: r.confirmed_count,
            rejectedCount: r.rejected_count,
          };
        }),
      };
    }),

  // 🔹 Monthly Receive Confirm KPI (all months of year)
  getMyReceiveKPIMonthly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year } = input;

      const records = await ctx.db.kpi_receive_monthly.findMany({
        where: { user_id: userId, year },
        orderBy: { month: 'asc' },
      });

      return {
        records: records.map(r => {
          const totalWithSLA = r.on_time_count + r.late_count;
          return {
            month: r.month,
            totalCount: r.total_count,
            avgMinutes: Math.round(Number(r.avg_duration_min)),
            onTimeCount: r.on_time_count,
            lateCount: r.late_count,
            onTimeRate: totalWithSLA > 0 ? Math.round((r.on_time_count / totalWithSLA) * 100) : null,
            confirmedCount: r.confirmed_count,
            rejectedCount: r.rejected_count,
          };
        }),
      };
    }),

  // 🔹 Yearly Receive Confirm KPI (all years)
  getMyReceiveKPIYearly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      const records = await ctx.db.kpi_receive_yearly.findMany({
        where: { user_id: userId },
        orderBy: { year: 'asc' },
      });

      return {
        records: records.map(r => {
          const totalWithSLA = r.on_time_count + r.late_count;
          return {
            year: r.year,
            totalCount: r.total_count,
            avgMinutes: Math.round(Number(r.avg_duration_min)),
            onTimeCount: r.on_time_count,
            lateCount: r.late_count,
            onTimeRate: totalWithSLA > 0 ? Math.round((r.on_time_count / totalWithSLA) * 100) : null,
            confirmedCount: r.confirmed_count,
            rejectedCount: r.rejected_count,
          };
        }),
      };
    }),

  // 🔹 ดึง Approval KPI ของ user ที่ login
  getMyApprovalKPI: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, dateFrom, dateTo } = input;

      // Build date filter
      const dateFilter: any = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;

      // Get KPI metrics grouped by stage
      const metrics = await ctx.db.approval_kpi_metric.groupBy({
        by: ['approval_stage'],
        where: {
          user_id: userId,
          ...(dateFrom || dateTo ? { created_at: dateFilter } : {}),
        },
        _count: { id: true },
        _avg: { duration_days: true },
        _sum: { duration_days: true },
      });

      // Get on-time rate per stage
      const onTimeStats = await ctx.db.approval_kpi_metric.groupBy({
        by: ['approval_stage', 'is_on_time'],
        where: {
          user_id: userId,
          is_on_time: { not: null },
          ...(dateFrom || dateTo ? { created_at: dateFilter } : {}),
        },
        _count: { id: true },
      });

      // Calculate on-time rate per stage
      const stageStats: Record<string, {
        count: number;
        avgDays: number | null;
        onTimeCount: number;
        lateCount: number;
        onTimeRate: number | null;
      }> = {};

      for (const metric of metrics) {
        stageStats[metric.approval_stage] = {
          count: metric._count.id,
          avgDays: metric._avg.duration_days ? Number(metric._avg.duration_days) : null,
          onTimeCount: 0,
          lateCount: 0,
          onTimeRate: null,
        };
      }

      for (const stat of onTimeStats) {
        const stage = stat.approval_stage;
        if (!stageStats[stage]) continue;

        if (stat.is_on_time === true) {
          stageStats[stage]!.onTimeCount = stat._count.id;
        } else if (stat.is_on_time === false) {
          stageStats[stage]!.lateCount = stat._count.id;
        }
      }

      // Calculate on-time rates
      for (const stage in stageStats) {
        const s = stageStats[stage]!;
        const total = s.onTimeCount + s.lateCount;
        if (total > 0) {
          s.onTimeRate = Math.round((s.onTimeCount / total) * 100);
        }
      }

      return {
        stages: stageStats,
        stageOrder: ['requester', 'line', 'cost_center', 'procurement', 'vpc'],
        stageNames: {
          requester: 'ผู้ขอซื้อ',
          line: 'ผู้อนุมัติตามสายงาน',
          cost_center: 'ผู้อนุมัติตาม Cost Center',
          procurement: 'งานจัดซื้อพัสดุ',
          vpc: 'VP-C',
        },
      };
    }),

  // 🔹 ดึง Receive Confirm KPI ของ user ที่ login
  getMyReceiveConfirmKPI: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, dateFrom, dateTo } = input;

      const dateFilter: any = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;

      // Get overall metrics
      const metrics = await ctx.db.receive_confirm_kpi_metric.aggregate({
        where: {
          user_id: userId,
          ...(dateFrom || dateTo ? { created_at: dateFilter } : {}),
        },
        _count: { id: true },
        _avg: { duration_minutes: true },
      });

      // Get on-time stats
      const onTimeStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['is_on_time'],
        where: {
          user_id: userId,
          is_on_time: { not: null },
          ...(dateFrom || dateTo ? { created_at: dateFilter } : {}),
        },
        _count: { id: true },
      });

      // Get confirmed vs rejected stats
      const statusStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['confirm_status'],
        where: {
          user_id: userId,
          ...(dateFrom || dateTo ? { created_at: dateFilter } : {}),
        },
        _count: { id: true },
      });

      let onTimeCount = 0;
      let lateCount = 0;
      let confirmedCount = 0;
      let rejectedCount = 0;

      for (const stat of onTimeStats) {
        if (stat.is_on_time === true) onTimeCount = stat._count.id;
        else if (stat.is_on_time === false) lateCount = stat._count.id;
      }

      for (const stat of statusStats) {
        if (stat.confirm_status === 'confirmed') confirmedCount = stat._count.id;
        else if (stat.confirm_status === 'rejected') rejectedCount = stat._count.id;
      }

      const totalWithSLA = onTimeCount + lateCount;
      const onTimeRate = totalWithSLA > 0 ? Math.round((onTimeCount / totalWithSLA) * 100) : null;

      return {
        totalCount: metrics._count.id,
        avgMinutes: metrics._avg.duration_minutes ? Number(metrics._avg.duration_minutes) : null,
        onTimeCount,
        lateCount,
        onTimeRate,
        confirmedCount,
        rejectedCount,
      };
    }),

  // 🔹 ดึง KPI Trend (Last 30 days) ของ user
  getMyKPITrend: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      days: z.number().default(30),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, days } = input;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get daily approval KPI
      const approvalTrend = await ctx.db.$queryRawUnsafe<Array<{
        date: Date;
        count: number;
        avg_days: number;
      }>>(`
        SELECT
          DATE(created_at) as date,
          COUNT(*)::INT as count,
          AVG(duration_days)::FLOAT as avg_days
        FROM approval_kpi_metric
        WHERE user_id = $1 AND created_at >= $2
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, userId, startDate);

      // Get daily receive confirm KPI
      const receiveConfirmTrend = await ctx.db.$queryRawUnsafe<Array<{
        date: Date;
        count: number;
        avg_minutes: number;
      }>>(`
        SELECT
          DATE(created_at) as date,
          COUNT(*)::INT as count,
          AVG(duration_minutes)::FLOAT as avg_minutes
        FROM receive_confirm_kpi_metric
        WHERE user_id = $1 AND created_at >= $2
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `, userId, startDate);

      return {
        approvalTrend,
        receiveConfirmTrend,
      };
    }),

  // =====================================================
  // ADMIN KPI (สำหรับดู KPI ทุกคน - Admin only)
  // =====================================================

  // 🔹 ดึง Approval KPI ทุกคน (Admin)
  getAllApprovalKPI: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      stage: z.string().optional(),
      ocrCode2: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo, stage, ocrCode2 } = input;

      const dateFilter: any = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;

      const whereClause: any = {};
      if (dateFrom || dateTo) whereClause.created_at = dateFilter;
      if (stage) whereClause.approval_stage = stage;
      if (ocrCode2) whereClause.ocr_code2 = ocrCode2;

      // Get KPI grouped by user and stage
      const metrics = await ctx.db.approval_kpi_metric.groupBy({
        by: ['user_id', 'user_name', 'approval_stage'],
        where: whereClause,
        _count: { id: true },
        _avg: { duration_days: true },
      });

      // Get on-time stats
      const onTimeStats = await ctx.db.approval_kpi_metric.groupBy({
        by: ['user_id', 'approval_stage', 'is_on_time'],
        where: {
          ...whereClause,
          is_on_time: { not: null },
        },
        _count: { id: true },
      });

      // Combine data
      const userStageMap: Map<string, {
        userId: string;
        userName: string;
        stage: string;
        count: number;
        avgDays: number | null;
        onTimeCount: number;
        lateCount: number;
        onTimeRate: number | null;
      }> = new Map();

      for (const m of metrics) {
        const key = `${m.user_id}-${m.approval_stage}`;
        userStageMap.set(key, {
          userId: m.user_id,
          userName: m.user_name,
          stage: m.approval_stage,
          count: m._count.id,
          avgDays: m._avg.duration_days ? Number(m._avg.duration_days) : null,
          onTimeCount: 0,
          lateCount: 0,
          onTimeRate: null,
        });
      }

      for (const stat of onTimeStats) {
        const key = `${stat.user_id}-${stat.approval_stage}`;
        const entry = userStageMap.get(key);
        if (!entry) continue;

        if (stat.is_on_time === true) entry.onTimeCount = stat._count.id;
        else if (stat.is_on_time === false) entry.lateCount = stat._count.id;
      }

      // Calculate on-time rates
      for (const entry of userStageMap.values()) {
        const total = entry.onTimeCount + entry.lateCount;
        if (total > 0) {
          entry.onTimeRate = Math.round((entry.onTimeCount / total) * 100);
        }
      }

      return Array.from(userStageMap.values());
    }),

  // 🔹 ดึง Receive Confirm KPI ทุกคน (Admin)
  getAllReceiveConfirmKPI: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      const dateFilter: any = {};
      if (dateFrom) dateFilter.gte = dateFrom;
      if (dateTo) dateFilter.lte = dateTo;

      const whereClause = dateFrom || dateTo ? { created_at: dateFilter } : {};

      // Get KPI grouped by user
      const metrics = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['user_id', 'user_name'],
        where: whereClause,
        _count: { id: true },
        _avg: { duration_minutes: true },
        _sum: { items_count: true },
      });

      // Get on-time stats
      const onTimeStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['user_id', 'is_on_time'],
        where: {
          ...whereClause,
          is_on_time: { not: null },
        },
        _count: { id: true },
      });

      // Get status stats
      const statusStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['user_id', 'confirm_status'],
        where: whereClause,
        _count: { id: true },
      });

      // Combine data
      const userMap: Map<string, {
        userId: string;
        userName: string;
        count: number;
        itemsCount: number;
        avgMinutes: number | null;
        onTimeCount: number;
        lateCount: number;
        onTimeRate: number | null;
        confirmedCount: number;
        rejectedCount: number;
      }> = new Map();

      for (const m of metrics) {
        userMap.set(m.user_id, {
          userId: m.user_id,
          userName: m.user_name,
          count: m._count.id,
          itemsCount: m._sum.items_count || 0,
          avgMinutes: m._avg.duration_minutes ? Number(m._avg.duration_minutes) : null,
          onTimeCount: 0,
          lateCount: 0,
          onTimeRate: null,
          confirmedCount: 0,
          rejectedCount: 0,
        });
      }

      for (const stat of onTimeStats) {
        const entry = userMap.get(stat.user_id);
        if (!entry) continue;

        if (stat.is_on_time === true) entry.onTimeCount = stat._count.id;
        else if (stat.is_on_time === false) entry.lateCount = stat._count.id;
      }

      for (const stat of statusStats) {
        const entry = userMap.get(stat.user_id);
        if (!entry) continue;

        if (stat.confirm_status === 'confirmed') entry.confirmedCount = stat._count.id;
        else if (stat.confirm_status === 'rejected') entry.rejectedCount = stat._count.id;
      }

      // Calculate on-time rates
      for (const entry of userMap.values()) {
        const total = entry.onTimeCount + entry.lateCount;
        if (total > 0) {
          entry.onTimeRate = Math.round((entry.onTimeCount / total) * 100);
        }
      }

      return Array.from(userMap.values());
    }),

  // =====================================================
  // SLA CONFIG (Admin only)
  // =====================================================

  // 🔹 ดึง SLA Config ทั้งหมด
  getSLAConfigs: adminProcedure
    .query(async ({ ctx }) => {
      const configs = await ctx.db.kpi_sla_config.findMany({
        orderBy: [
          { kpi_type: 'asc' },
          { stage: 'asc' },
        ],
      });
      return configs;
    }),

  // 🔹 สร้างหรืออัพเดท SLA Config
  upsertSLAConfig: adminProcedure
    .input(z.object({
      kpiType: z.enum(['approval', 'receive_confirm']),
      stage: z.string().nullable(),
      targetMinutes: z.number().min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { kpiType, stage, targetMinutes, description } = input;
      const now = new Date();

      // Check if config exists
      const existing = await ctx.db.kpi_sla_config.findFirst({
        where: {
          kpi_type: kpiType,
          stage: stage,
        },
      });

      if (existing) {
        return ctx.db.kpi_sla_config.update({
          where: { id: existing.id },
          data: {
            target_minutes: targetMinutes,
            target_hours: targetMinutes / 60,
            description,
            updated_at: now,
          },
        });
      } else {
        return ctx.db.kpi_sla_config.create({
          data: {
            kpi_type: kpiType,
            stage,
            target_minutes: targetMinutes,
            target_hours: targetMinutes / 60,
            description,
            is_active: true,
          },
        });
      }
    }),

  // 🔹 ลบ SLA Config
  deleteSLAConfig: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.kpi_sla_config.delete({
        where: { id: input.id },
      });
      return { success: true };
    }),

  // 🔹 Toggle SLA Config active status
  toggleSLAConfigActive: adminProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.kpi_sla_config.update({
        where: { id: input.id },
        data: {
          is_active: input.isActive,
          updated_at: new Date(),
        },
      });
    }),

  // =====================================================
  // USAGE ANALYTICS (สถิติการใช้งานระบบ)
  // =====================================================

  // 🔹 ดึงสถิติการใช้งานรายวัน (Admin)
  getDailyUsageStats: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      // Default to last 30 days
      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get session history grouped by date
      const sessions = await ctx.db.session_history.findMany({
        where: {
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          user_id: true,
          session_start: true,
          duration_minutes: true,
        },
      });

      // Group by date
      const dailyStats: Record<string, {
        date: string;
        loginCount: number;
        uniqueUsers: Set<string>;
        totalMinutes: number;
      }> = {};

      for (const session of sessions) {
        const dateStr = session.session_start.toISOString().split('T')[0]!;

        if (!dailyStats[dateStr]) {
          dailyStats[dateStr] = {
            date: dateStr,
            loginCount: 0,
            uniqueUsers: new Set(),
            totalMinutes: 0,
          };
        }

        dailyStats[dateStr]!.loginCount++;
        dailyStats[dateStr]!.uniqueUsers.add(session.user_id);
        dailyStats[dateStr]!.totalMinutes += Number(session.duration_minutes);
      }

      // Convert to array and calculate averages
      return Object.values(dailyStats)
        .map(day => ({
          date: day.date,
          loginCount: day.loginCount,
          uniqueUserCount: day.uniqueUsers.size,
          totalMinutes: Math.round(day.totalMinutes),
          avgMinutesPerSession: day.loginCount > 0 ? Math.round(day.totalMinutes / day.loginCount) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }),

  // 🔹 ดึงสถิติการใช้งานรายคน (Admin)
  getUserUsageStats: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      // Default to last 30 days
      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get aggregated stats per user
      const stats = await ctx.db.session_history.groupBy({
        by: ['user_id', 'user_name'],
        where: {
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { id: true },
        _sum: { duration_minutes: true, duration_seconds: true },
        _avg: { duration_minutes: true },
        _min: { session_start: true },
        _max: { session_end: true },
      });

      return stats.map(s => ({
        userId: s.user_id,
        userName: s.user_name ?? s.user_id,
        loginCount: s._count.id,
        totalMinutes: s._sum.duration_minutes ? Math.round(Number(s._sum.duration_minutes)) : 0,
        avgMinutesPerSession: s._avg.duration_minutes ? Math.round(Number(s._avg.duration_minutes)) : 0,
        firstLogin: s._min.session_start,
        lastLogin: s._max.session_end,
      })).sort((a, b) => b.loginCount - a.loginCount);
    }),

  // 🔹 ดึงสถิติรวม (Summary) สำหรับ Admin
  getUsageSummary: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      // Default to last 30 days
      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Get all sessions in range
      const sessions = await ctx.db.session_history.findMany({
        where: {
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          user_id: true,
          duration_minutes: true,
          logout_type: true,
        },
      });

      // Calculate stats
      const uniqueUsers = new Set(sessions.map(s => s.user_id));
      const totalMinutes = sessions.reduce((sum, s) => sum + Number(s.duration_minutes), 0);
      const logoutTypes = sessions.reduce((acc, s) => {
        acc[s.logout_type] = (acc[s.logout_type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Get current active sessions
      const activeSessionCount = await ctx.db.active_session.count();

      return {
        totalSessions: sessions.length,
        uniqueUsers: uniqueUsers.size,
        totalMinutes: Math.round(totalMinutes),
        totalHours: Math.round(totalMinutes / 60),
        avgMinutesPerSession: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
        avgSessionsPerUser: uniqueUsers.size > 0 ? Math.round(sessions.length / uniqueUsers.size) : 0,
        logoutTypes: {
          manual: logoutTypes['manual'] ?? 0,
          timeout: logoutTypes['timeout'] ?? 0,
          kicked: logoutTypes['kicked'] ?? 0,
          forceLogout: logoutTypes['force_logout'] ?? 0,
        },
        currentActiveSessions: activeSessionCount,
      };
    }),

  // 🔹 ดึงรายละเอียด Session ของ User (Admin)
  getUserSessionHistory: adminProcedure
    .input(z.object({
      userId: z.string(),
      limit: z.number().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.db.session_history.findMany({
        where: { user_id: input.userId },
        orderBy: { session_start: 'desc' },
        take: input.limit,
      });

      return sessions.map(s => ({
        id: s.id,
        sessionStart: s.session_start,
        sessionEnd: s.session_end,
        durationMinutes: Math.round(Number(s.duration_minutes)),
        ipAddress: s.ip_address,
        computerName: s.computer_name,
        logoutType: s.logout_type,
      }));
    }),

  // 🔹 ดึงสถิติรายวัน + รายคน (Daily with per-user breakdown)
  getDailyUsageWithUsers: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const sessions = await ctx.db.session_history.findMany({
        where: {
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          user_id: true,
          user_name: true,
          session_start: true,
          duration_minutes: true,
          logout_type: true,
        },
        orderBy: { session_start: 'desc' },
      });

      // Group by date, then by user
      const dailyData: Record<string, {
        date: string;
        totalLogins: number;
        totalMinutes: number;
        users: Record<string, {
          userId: string;
          userName: string;
          loginCount: number;
          totalMinutes: number;
        }>;
      }> = {};

      for (const session of sessions) {
        const dateStr = session.session_start.toISOString().split('T')[0]!;

        if (!dailyData[dateStr]) {
          dailyData[dateStr] = {
            date: dateStr,
            totalLogins: 0,
            totalMinutes: 0,
            users: {},
          };
        }

        const day = dailyData[dateStr]!;
        day.totalLogins++;
        day.totalMinutes += Number(session.duration_minutes);

        if (!day.users[session.user_id]) {
          day.users[session.user_id] = {
            userId: session.user_id,
            userName: session.user_name ?? session.user_id,
            loginCount: 0,
            totalMinutes: 0,
          };
        }

        day.users[session.user_id]!.loginCount++;
        day.users[session.user_id]!.totalMinutes += Number(session.duration_minutes);
      }

      // Convert to array
      return Object.values(dailyData)
        .map(day => ({
          date: day.date,
          totalLogins: day.totalLogins,
          uniqueUsers: Object.keys(day.users).length,
          totalMinutes: Math.round(day.totalMinutes),
          avgMinutesPerSession: day.totalLogins > 0 ? Math.round(day.totalMinutes / day.totalLogins) : 0,
          users: Object.values(day.users)
            .map(u => ({
              ...u,
              totalMinutes: Math.round(u.totalMinutes),
              avgMinutes: u.loginCount > 0 ? Math.round(u.totalMinutes / u.loginCount) : 0,
            }))
            .sort((a, b) => b.loginCount - a.loginCount),
        }))
        .sort((a, b) => b.date.localeCompare(a.date)); // Latest first
    }),

  // 🔹 ดึงสถิติรายสัปดาห์ (Weekly Stats)
  getWeeklyUsageStats: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // Default 90 days

      const sessions = await ctx.db.session_history.findMany({
        where: {
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          user_id: true,
          user_name: true,
          session_start: true,
          duration_minutes: true,
        },
      });

      // Helper to get week start (Monday)
      const getWeekStart = (date: Date): string => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
        d.setDate(diff);
        return d.toISOString().split('T')[0]!;
      };

      // Group by week
      const weeklyData: Record<string, {
        weekStart: string;
        totalLogins: number;
        totalMinutes: number;
        uniqueUsers: Set<string>;
        users: Record<string, {
          userId: string;
          userName: string;
          loginCount: number;
          totalMinutes: number;
        }>;
      }> = {};

      for (const session of sessions) {
        const weekStart = getWeekStart(session.session_start);

        if (!weeklyData[weekStart]) {
          weeklyData[weekStart] = {
            weekStart,
            totalLogins: 0,
            totalMinutes: 0,
            uniqueUsers: new Set(),
            users: {},
          };
        }

        const week = weeklyData[weekStart]!;
        week.totalLogins++;
        week.totalMinutes += Number(session.duration_minutes);
        week.uniqueUsers.add(session.user_id);

        if (!week.users[session.user_id]) {
          week.users[session.user_id] = {
            userId: session.user_id,
            userName: session.user_name ?? session.user_id,
            loginCount: 0,
            totalMinutes: 0,
          };
        }

        week.users[session.user_id]!.loginCount++;
        week.users[session.user_id]!.totalMinutes += Number(session.duration_minutes);
      }

      return Object.values(weeklyData)
        .map(week => ({
          weekStart: week.weekStart,
          weekEnd: (() => {
            const d = new Date(week.weekStart);
            d.setDate(d.getDate() + 6);
            return d.toISOString().split('T')[0]!;
          })(),
          totalLogins: week.totalLogins,
          uniqueUsers: week.uniqueUsers.size,
          totalMinutes: Math.round(week.totalMinutes),
          avgMinutesPerSession: week.totalLogins > 0 ? Math.round(week.totalMinutes / week.totalLogins) : 0,
          users: Object.values(week.users)
            .map(u => ({
              ...u,
              totalMinutes: Math.round(u.totalMinutes),
              avgMinutes: u.loginCount > 0 ? Math.round(u.totalMinutes / u.loginCount) : 0,
            }))
            .sort((a, b) => b.loginCount - a.loginCount),
        }))
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)); // Latest first
    }),

  // 🔹 ดึงสถิติรายเดือน (Monthly Stats)
  getMonthlyUsageStats: adminProcedure
    .input(z.object({
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { dateFrom, dateTo } = input;

      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000); // Default 1 year

      const sessions = await ctx.db.session_history.findMany({
        where: {
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          user_id: true,
          user_name: true,
          session_start: true,
          duration_minutes: true,
        },
      });

      // Group by month (YYYY-MM)
      const monthlyData: Record<string, {
        month: string;
        totalLogins: number;
        totalMinutes: number;
        uniqueUsers: Set<string>;
        users: Record<string, {
          userId: string;
          userName: string;
          loginCount: number;
          totalMinutes: number;
        }>;
      }> = {};

      for (const session of sessions) {
        const month = session.session_start.toISOString().substring(0, 7); // YYYY-MM

        if (!monthlyData[month]) {
          monthlyData[month] = {
            month,
            totalLogins: 0,
            totalMinutes: 0,
            uniqueUsers: new Set(),
            users: {},
          };
        }

        const m = monthlyData[month]!;
        m.totalLogins++;
        m.totalMinutes += Number(session.duration_minutes);
        m.uniqueUsers.add(session.user_id);

        if (!m.users[session.user_id]) {
          m.users[session.user_id] = {
            userId: session.user_id,
            userName: session.user_name ?? session.user_id,
            loginCount: 0,
            totalMinutes: 0,
          };
        }

        m.users[session.user_id]!.loginCount++;
        m.users[session.user_id]!.totalMinutes += Number(session.duration_minutes);
      }

      // Thai month names
      const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

      return Object.values(monthlyData)
        .map(m => {
          const [year, monthNum] = m.month.split('-');
          const monthIndex = parseInt(monthNum!, 10) - 1;
          return {
            month: m.month,
            monthDisplay: `${thaiMonths[monthIndex]} ${parseInt(year!, 10) + 543}`,
            totalLogins: m.totalLogins,
            uniqueUsers: m.uniqueUsers.size,
            totalMinutes: Math.round(m.totalMinutes),
            totalHours: Math.round(m.totalMinutes / 60),
            avgMinutesPerSession: m.totalLogins > 0 ? Math.round(m.totalMinutes / m.totalLogins) : 0,
            users: Object.values(m.users)
              .map(u => ({
                ...u,
                totalMinutes: Math.round(u.totalMinutes),
                avgMinutes: u.loginCount > 0 ? Math.round(u.totalMinutes / u.loginCount) : 0,
              }))
              .sort((a, b) => b.loginCount - a.loginCount),
          };
        })
        .sort((a, b) => b.month.localeCompare(a.month)); // Latest first
    }),

  // 🔹 ดึงสถิติการใช้งานของตัวเอง (สำหรับ /my-kpi)
  getMyUsageStats: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, dateFrom, dateTo } = input;

      const endDate = dateTo ?? new Date();
      const startDate = dateFrom ?? new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);

      const sessions = await ctx.db.session_history.findMany({
        where: {
          user_id: userId,
          session_start: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          session_start: true,
          session_end: true,
          duration_minutes: true,
          logout_type: true,
          ip_address: true,
        },
        orderBy: { session_start: 'desc' },
        take: 50,
      });

      // Calculate summary
      const totalSessions = sessions.length;
      const totalMinutes = sessions.reduce((sum, s) => sum + Number(s.duration_minutes), 0);
      const avgMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;

      // Logout type breakdown
      const logoutTypes = sessions.reduce((acc, s) => {
        acc[s.logout_type] = (acc[s.logout_type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        summary: {
          totalSessions,
          totalMinutes: Math.round(totalMinutes),
          totalHours: Math.round(totalMinutes / 60),
          avgMinutesPerSession: avgMinutes,
          manualLogouts: logoutTypes['manual'] ?? 0,
          timeoutLogouts: logoutTypes['timeout'] ?? 0,
        },
        recentSessions: sessions.map(s => ({
          sessionStart: s.session_start,
          sessionEnd: s.session_end,
          durationMinutes: Math.round(Number(s.duration_minutes)),
          logoutType: s.logout_type,
          ipAddress: s.ip_address,
        })),
      };
    }),

  // =====================================================
  // PERSONAL USAGE STATS - Pre-aggregated (รายวัน/สัปดาห์/เดือน/ปี)
  // =====================================================

  // 🔹 Daily Usage Stats (summary + session list)
  getMyUsageStatsDaily: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      date: z.date(), // วันที่ต้องการดู
    }))
    .query(async ({ ctx, input }) => {
      const { userId, date } = input;

      // Get date only (strip time)
      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nextDay = new Date(dateOnly);
      nextDay.setDate(nextDay.getDate() + 1);

      // Get pre-aggregated summary
      const summary = await ctx.db.kpi_usage_daily.findUnique({
        where: {
          user_id_date: {
            user_id: userId,
            date: dateOnly,
          },
        },
      });

      // Get session list for this day
      const sessions = await ctx.db.session_history.findMany({
        where: {
          user_id: userId,
          session_end: {
            gte: dateOnly,
            lt: nextDay,
          },
        },
        select: {
          session_start: true,
          session_end: true,
          duration_minutes: true,
          logout_type: true,
          ip_address: true,
        },
        orderBy: { session_start: 'desc' },
      });

      return {
        summary: summary ? {
          totalSessions: summary.total_sessions,
          totalMinutes: Math.round(Number(summary.total_minutes)),
          totalHours: Math.round(Number(summary.total_minutes) / 60),
          avgMinutesPerSession: Math.round(Number(summary.avg_minutes_per_session)),
          manualLogouts: summary.manual_logouts,
          timeoutLogouts: summary.timeout_logouts,
          inactivityLogouts: summary.inactivity_logouts,
          reloginLogouts: summary.relogin_logouts,
        } : {
          totalSessions: 0,
          totalMinutes: 0,
          totalHours: 0,
          avgMinutesPerSession: 0,
          manualLogouts: 0,
          timeoutLogouts: 0,
          inactivityLogouts: 0,
          reloginLogouts: 0,
        },
        recentSessions: sessions.map(s => ({
          sessionStart: s.session_start,
          sessionEnd: s.session_end,
          durationMinutes: Math.round(Number(s.duration_minutes)),
          logoutType: s.logout_type,
          ipAddress: s.ip_address,
        })),
      };
    }),

  // 🔹 Weekly Usage Stats (all weeks of year)
  getMyUsageStatsWeekly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year } = input;

      const records = await ctx.db.kpi_usage_weekly.findMany({
        where: { user_id: userId, year },
        orderBy: { week: 'asc' },
      });

      return {
        records: records.map(r => ({
          week: r.week,
          weekStart: r.week_start,
          weekEnd: r.week_end,
          totalSessions: r.total_sessions,
          totalMinutes: Math.round(Number(r.total_minutes)),
          totalHours: Math.round(Number(r.total_minutes) / 60),
          avgMinutesPerSession: Math.round(Number(r.avg_minutes_per_session)),
          manualLogouts: r.manual_logouts,
          timeoutLogouts: r.timeout_logouts,
          inactivityLogouts: r.inactivity_logouts,
          reloginLogouts: r.relogin_logouts,
        })),
      };
    }),

  // 🔹 Monthly Usage Stats (all months of year)
  getMyUsageStatsMonthly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
      year: z.number(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year } = input;

      const records = await ctx.db.kpi_usage_monthly.findMany({
        where: { user_id: userId, year },
        orderBy: { month: 'asc' },
      });

      return {
        records: records.map(r => ({
          month: r.month,
          totalSessions: r.total_sessions,
          totalMinutes: Math.round(Number(r.total_minutes)),
          totalHours: Math.round(Number(r.total_minutes) / 60),
          avgMinutesPerSession: Math.round(Number(r.avg_minutes_per_session)),
          manualLogouts: r.manual_logouts,
          timeoutLogouts: r.timeout_logouts,
          inactivityLogouts: r.inactivity_logouts,
          reloginLogouts: r.relogin_logouts,
        })),
      };
    }),

  // 🔹 Yearly Usage Stats (all years)
  getMyUsageStatsYearly: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      const records = await ctx.db.kpi_usage_yearly.findMany({
        where: { user_id: userId },
        orderBy: { year: 'asc' },
      });

      return {
        records: records.map(r => ({
          year: r.year,
          totalSessions: r.total_sessions,
          totalMinutes: Math.round(Number(r.total_minutes)),
          totalHours: Math.round(Number(r.total_minutes) / 60),
          avgMinutesPerSession: Math.round(Number(r.avg_minutes_per_session)),
          manualLogouts: r.manual_logouts,
          timeoutLogouts: r.timeout_logouts,
          inactivityLogouts: r.inactivity_logouts,
          reloginLogouts: r.relogin_logouts,
        })),
      };
    }),

  // =====================================================
  // PERSONAL KPI SUMMARY (สำหรับ My KPI - รายไตรมาส/รายปี)
  // =====================================================

  // 🔹 Personal Approval KPI Summary (รวมทุก stage)
  getMyApprovalKPISummary: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      year: z.number().optional(),      // พ.ศ.
      quarter: z.number().optional(),   // 1-4 (null = ทั้งปี)
    }))
    .query(async ({ ctx, input }) => {
      const { year, quarter } = input;
      const userId = ctx.user?.id;

      if (!userId) {
        return {
          total: 0,
          onTime: 0,
          late: 0,
          onTimeRate: null as number | null,
          avgDays: 0,
        };
      }

      // Calculate date range from year/quarter
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543; // แปลง พ.ศ. เป็น ค.ศ.

        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = { user_id: userId };
      if (dateFrom && dateTo) {
        whereClause.created_at = { gte: dateFrom, lte: dateTo };
      }

      // Get overall metrics
      const metrics = await ctx.db.approval_kpi_metric.aggregate({
        where: whereClause,
        _count: { id: true },
        _avg: { duration_days: true },
      });

      // Get on-time stats
      const onTimeStats = await ctx.db.approval_kpi_metric.groupBy({
        by: ['is_on_time'],
        where: {
          ...whereClause,
          is_on_time: { not: null },
        },
        _count: { id: true },
      });

      let onTime = 0;
      let late = 0;
      for (const stat of onTimeStats) {
        if (stat.is_on_time === true) onTime = stat._count.id;
        else if (stat.is_on_time === false) late = stat._count.id;
      }

      const totalWithSLA = onTime + late;
      const onTimeRate = totalWithSLA > 0 ? Math.round((onTime / totalWithSLA) * 100) : null;

      return {
        total: metrics._count.id,
        onTime,
        late,
        onTimeRate,
        avgDays: metrics._avg.duration_days ? Number(metrics._avg.duration_days) : 0,
      };
    }),

  // 🔹 Personal Receive Confirm KPI Summary
  getMyReceiveConfirmKPISummary: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { year, quarter } = input;
      const userId = ctx.user?.id;

      if (!userId) {
        return {
          total: 0,
          onTime: 0,
          late: 0,
          onTimeRate: null as number | null,
          avgMinutes: 0,
        };
      }

      // Calculate date range
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;

        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = { user_id: userId };
      if (dateFrom && dateTo) {
        whereClause.created_at = { gte: dateFrom, lte: dateTo };
      }

      // Get overall metrics
      const metrics = await ctx.db.receive_confirm_kpi_metric.aggregate({
        where: whereClause,
        _count: { id: true },
        _avg: { duration_minutes: true },
      });

      // Get on-time stats
      const onTimeStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['is_on_time'],
        where: {
          ...whereClause,
          is_on_time: { not: null },
        },
        _count: { id: true },
      });

      let onTime = 0;
      let late = 0;
      for (const stat of onTimeStats) {
        if (stat.is_on_time === true) onTime = stat._count.id;
        else if (stat.is_on_time === false) late = stat._count.id;
      }

      const totalWithSLA = onTime + late;
      const onTimeRate = totalWithSLA > 0 ? Math.round((onTime / totalWithSLA) * 100) : null;

      return {
        total: metrics._count.id,
        onTime,
        late,
        onTimeRate,
        avgMinutes: metrics._avg.duration_minutes ? Math.round(Number(metrics._avg.duration_minutes)) : 0,
      };
    }),

  // 🔹 Personal Usage KPI Summary
  getMyUsageKPISummary: createTableProcedure('my_kpi', 'read')
    .input(z.object({
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { year, quarter } = input;
      const userId = ctx.user?.id;

      if (!userId) {
        return {
          totalLogins: 0,
          totalHours: 0,
          avgMinutesPerSession: 0,
          manualLogouts: 0,
          timeoutLogouts: 0,
        };
      }

      // Calculate date range
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;

        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = { user_id: userId };
      if (dateFrom && dateTo) {
        whereClause.session_start = { gte: dateFrom, lte: dateTo };
      }

      // Get sessions
      const sessions = await ctx.db.session_history.findMany({
        where: whereClause,
        select: {
          duration_minutes: true,
          logout_type: true,
        },
      });

      const totalLogins = sessions.length;
      const totalMinutes = sessions.reduce((sum, s) => sum + Number(s.duration_minutes), 0);
      const avgMinutes = totalLogins > 0 ? Math.round(totalMinutes / totalLogins) : 0;

      // Logout type breakdown
      let manualLogouts = 0;
      let timeoutLogouts = 0;
      for (const s of sessions) {
        if (s.logout_type === 'manual') manualLogouts++;
        else if (s.logout_type === 'timeout') timeoutLogouts++;
      }

      return {
        totalLogins,
        totalHours: Math.round(totalMinutes / 60),
        avgMinutesPerSession: avgMinutes,
        manualLogouts,
        timeoutLogouts,
      };
    }),

  // =====================================================
  // KPI SUMMARY (สำหรับ Admin Dashboard - รายไตรมาส/รายปี)
  // =====================================================

  // Helper: แปลง พ.ศ. + Quarter เป็น date range
  // year: พ.ศ. (เช่น 2569)
  // quarter: 1-4 (null = ทั้งปี)

  // 🔹 Approval KPI Summary (รวมทุก stage รายคน)
  getApprovalKPISummary: adminProcedure
    .input(z.object({
      year: z.number().optional(),      // พ.ศ.
      quarter: z.number().optional(),   // 1-4 (null = ทั้งปี)
    }))
    .query(async ({ ctx, input }) => {
      const { year, quarter } = input;

      // Calculate date range from year/quarter
      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543; // แปลง พ.ศ. เป็น ค.ศ.

        if (quarter) {
          // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
          const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59); // Last day of quarter
        } else {
          // Full year
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = {};
      if (dateFrom && dateTo) {
        whereClause.created_at = { gte: dateFrom, lte: dateTo };
      }

      // Get all metrics
      const metrics = await ctx.db.approval_kpi_metric.groupBy({
        by: ['user_id', 'user_name'],
        where: whereClause,
        _count: { id: true },
        _avg: { duration_days: true },
        _sum: { duration_days: true },
      });

      // Get on-time stats per user
      const onTimeStats = await ctx.db.approval_kpi_metric.groupBy({
        by: ['user_id', 'is_on_time'],
        where: {
          ...whereClause,
          is_on_time: { not: null },
        },
        _count: { id: true },
      });

      // Build user map
      const userMap: Map<string, {
        userId: string;
        userName: string;
        total: number;
        onTime: number;
        late: number;
        avgDays: number;
      }> = new Map();

      for (const m of metrics) {
        userMap.set(m.user_id, {
          userId: m.user_id,
          userName: m.user_name,
          total: m._count.id,
          onTime: 0,
          late: 0,
          avgDays: m._avg.duration_days ? Number(m._avg.duration_days) : 0,
        });
      }

      for (const stat of onTimeStats) {
        const user = userMap.get(stat.user_id);
        if (!user) continue;

        if (stat.is_on_time === true) user.onTime = stat._count.id;
        else if (stat.is_on_time === false) user.late = stat._count.id;
      }

      // Calculate overall and user rates
      let overallTotal = 0;
      let overallOnTime = 0;
      let overallLate = 0;
      let overallDays = 0;

      const byUser = Array.from(userMap.values()).map(u => {
        overallTotal += u.total;
        overallOnTime += u.onTime;
        overallLate += u.late;
        overallDays += u.avgDays * u.total;

        const totalWithSLA = u.onTime + u.late;
        return {
          ...u,
          onTimeRate: totalWithSLA > 0 ? Math.round((u.onTime / totalWithSLA) * 100) : null,
        };
      }).sort((a, b) => b.total - a.total);

      const overallTotalWithSLA = overallOnTime + overallLate;

      return {
        overall: {
          total: overallTotal,
          onTime: overallOnTime,
          late: overallLate,
          onTimeRate: overallTotalWithSLA > 0 ? Math.round((overallOnTime / overallTotalWithSLA) * 100) : null,
          avgDays: overallTotal > 0 ? Number((overallDays / overallTotal).toFixed(2)) : 0,
        },
        byUser,
      };
    }),

  // 🔹 Receive Confirm KPI Summary (รายคน)
  getReceiveConfirmKPISummary: adminProcedure
    .input(z.object({
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { year, quarter } = input;

      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;

        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = {};
      if (dateFrom && dateTo) {
        whereClause.created_at = { gte: dateFrom, lte: dateTo };
      }

      // Get metrics by user
      const metrics = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['user_id', 'user_name'],
        where: whereClause,
        _count: { id: true },
        _avg: { duration_minutes: true },
      });

      // Get on-time stats
      const onTimeStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['user_id', 'is_on_time'],
        where: {
          ...whereClause,
          is_on_time: { not: null },
        },
        _count: { id: true },
      });

      // Build user map
      const userMap: Map<string, {
        userId: string;
        userName: string;
        total: number;
        onTime: number;
        late: number;
        avgMinutes: number;
      }> = new Map();

      for (const m of metrics) {
        userMap.set(m.user_id, {
          userId: m.user_id,
          userName: m.user_name,
          total: m._count.id,
          onTime: 0,
          late: 0,
          avgMinutes: m._avg.duration_minutes ? Math.round(Number(m._avg.duration_minutes)) : 0,
        });
      }

      for (const stat of onTimeStats) {
        const user = userMap.get(stat.user_id);
        if (!user) continue;

        if (stat.is_on_time === true) user.onTime = stat._count.id;
        else if (stat.is_on_time === false) user.late = stat._count.id;
      }

      // Calculate overall
      let overallTotal = 0;
      let overallOnTime = 0;
      let overallLate = 0;
      let overallMinutes = 0;

      const byUser = Array.from(userMap.values()).map(u => {
        overallTotal += u.total;
        overallOnTime += u.onTime;
        overallLate += u.late;
        overallMinutes += u.avgMinutes * u.total;

        const totalWithSLA = u.onTime + u.late;
        return {
          ...u,
          onTimeRate: totalWithSLA > 0 ? Math.round((u.onTime / totalWithSLA) * 100) : null,
        };
      }).sort((a, b) => b.total - a.total);

      const overallTotalWithSLA = overallOnTime + overallLate;

      return {
        overall: {
          total: overallTotal,
          onTime: overallOnTime,
          late: overallLate,
          onTimeRate: overallTotalWithSLA > 0 ? Math.round((overallOnTime / overallTotalWithSLA) * 100) : null,
          avgMinutes: overallTotal > 0 ? Math.round(overallMinutes / overallTotal) : 0,
        },
        byUser,
      };
    }),

  // 🔹 Usage KPI Summary (Login/Logout รายคน)
  getUsageKPISummary: adminProcedure
    .input(z.object({
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { year, quarter } = input;

      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;

        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = {};
      if (dateFrom && dateTo) {
        whereClause.session_start = { gte: dateFrom, lte: dateTo };
      }

      // Get all sessions
      const sessions = await ctx.db.session_history.findMany({
        where: whereClause,
        select: {
          user_id: true,
          user_name: true,
          duration_minutes: true,
          logout_type: true,
        },
      });

      // Group by user
      const userMap: Map<string, {
        userId: string;
        userName: string;
        loginCount: number;
        totalMinutes: number;
        manualLogouts: number;
        timeoutLogouts: number;
      }> = new Map();

      for (const s of sessions) {
        let user = userMap.get(s.user_id);
        if (!user) {
          user = {
            userId: s.user_id,
            userName: s.user_name ?? s.user_id,
            loginCount: 0,
            totalMinutes: 0,
            manualLogouts: 0,
            timeoutLogouts: 0,
          };
          userMap.set(s.user_id, user);
        }

        user.loginCount++;
        user.totalMinutes += Number(s.duration_minutes);
        if (s.logout_type === 'manual') user.manualLogouts++;
        else if (s.logout_type === 'timeout') user.timeoutLogouts++;
      }

      // Calculate overall
      let overallLogins = 0;
      let overallMinutes = 0;
      let overallManual = 0;
      let overallTimeout = 0;

      const byUser = Array.from(userMap.values()).map(u => {
        overallLogins += u.loginCount;
        overallMinutes += u.totalMinutes;
        overallManual += u.manualLogouts;
        overallTimeout += u.timeoutLogouts;

        return {
          ...u,
          totalMinutes: Math.round(u.totalMinutes),
          totalHours: Math.round(u.totalMinutes / 60),
          avgMinutes: u.loginCount > 0 ? Math.round(u.totalMinutes / u.loginCount) : 0,
        };
      }).sort((a, b) => b.loginCount - a.loginCount);

      return {
        overall: {
          totalLogins: overallLogins,
          uniqueUsers: userMap.size,
          totalMinutes: Math.round(overallMinutes),
          totalHours: Math.round(overallMinutes / 60),
          avgMinutesPerSession: overallLogins > 0 ? Math.round(overallMinutes / overallLogins) : 0,
          manualLogouts: overallManual,
          timeoutLogouts: overallTimeout,
        },
        byUser,
      };
    }),

  // =====================================================
  // ADMIN: View Individual User KPI
  // =====================================================

  // 🔹 Admin: Get all users for dropdown selection
  getAdminUsersList: adminProcedure
    .query(async ({ ctx }) => {
      const users = await ctx.db.user_production.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
        },
        orderBy: { name: 'asc' },
      });

      return users.map(u => ({
        id: u.id,
        name: u.name || u.username || u.email || u.id,
        role: u.role,
      }));
    }),

  // 🔹 Admin: Get specific user's Approval KPI Summary
  getAdminUserApprovalKPISummary: adminProcedure
    .input(z.object({
      userId: z.string(),
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year, quarter } = input;

      if (!userId) {
        return { total: 0, onTime: 0, late: 0, onTimeRate: null as number | null, avgDays: 0 };
      }

      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;
        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = { user_id: userId };
      if (dateFrom && dateTo) {
        whereClause.created_at = { gte: dateFrom, lte: dateTo };
      }

      const metrics = await ctx.db.approval_kpi_metric.aggregate({
        where: whereClause,
        _count: { id: true },
        _avg: { duration_days: true },
      });

      const onTimeStats = await ctx.db.approval_kpi_metric.groupBy({
        by: ['is_on_time'],
        where: { ...whereClause, is_on_time: { not: null } },
        _count: { id: true },
      });

      let onTime = 0;
      let late = 0;
      for (const stat of onTimeStats) {
        if (stat.is_on_time === true) onTime = stat._count.id;
        else if (stat.is_on_time === false) late = stat._count.id;
      }

      const totalWithSLA = onTime + late;
      const onTimeRate = totalWithSLA > 0 ? Math.round((onTime / totalWithSLA) * 100) : null;

      return {
        total: metrics._count.id,
        onTime,
        late,
        onTimeRate,
        avgDays: metrics._avg.duration_days ? Number(metrics._avg.duration_days) : 0,
      };
    }),

  // 🔹 Admin: Get specific user's Receive Confirm KPI Summary
  getAdminUserReceiveConfirmKPISummary: adminProcedure
    .input(z.object({
      userId: z.string(),
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year, quarter } = input;

      if (!userId) {
        return { total: 0, onTime: 0, late: 0, onTimeRate: null as number | null, avgMinutes: 0 };
      }

      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;
        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = { user_id: userId };
      if (dateFrom && dateTo) {
        whereClause.created_at = { gte: dateFrom, lte: dateTo };
      }

      const metrics = await ctx.db.receive_confirm_kpi_metric.aggregate({
        where: whereClause,
        _count: { id: true },
        _avg: { duration_minutes: true },
      });

      const onTimeStats = await ctx.db.receive_confirm_kpi_metric.groupBy({
        by: ['is_on_time'],
        where: { ...whereClause, is_on_time: { not: null } },
        _count: { id: true },
      });

      let onTime = 0;
      let late = 0;
      for (const stat of onTimeStats) {
        if (stat.is_on_time === true) onTime = stat._count.id;
        else if (stat.is_on_time === false) late = stat._count.id;
      }

      const totalWithSLA = onTime + late;
      const onTimeRate = totalWithSLA > 0 ? Math.round((onTime / totalWithSLA) * 100) : null;

      return {
        total: metrics._count.id,
        onTime,
        late,
        onTimeRate,
        avgMinutes: metrics._avg.duration_minutes ? Math.round(Number(metrics._avg.duration_minutes)) : 0,
      };
    }),

  // 🔹 Admin: Get specific user's Usage KPI Summary
  getAdminUserUsageKPISummary: adminProcedure
    .input(z.object({
      userId: z.string(),
      year: z.number().optional(),
      quarter: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId, year, quarter } = input;

      if (!userId) {
        return { totalLogins: 0, totalHours: 0, avgMinutesPerSession: 0, manualLogouts: 0, timeoutLogouts: 0 };
      }

      let dateFrom: Date | undefined;
      let dateTo: Date | undefined;

      if (year) {
        const gregorianYear = year - 543;
        if (quarter) {
          const startMonth = (quarter - 1) * 3;
          dateFrom = new Date(gregorianYear, startMonth, 1);
          dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
        } else {
          dateFrom = new Date(gregorianYear, 0, 1);
          dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
        }
      }

      const whereClause: any = { user_id: userId };
      if (dateFrom && dateTo) {
        whereClause.session_start = { gte: dateFrom, lte: dateTo };
      }

      const sessions = await ctx.db.session_history.findMany({
        where: whereClause,
        select: {
          duration_minutes: true,
          logout_type: true,
        },
      });

      let totalMinutes = 0;
      let manualLogouts = 0;
      let timeoutLogouts = 0;

      for (const s of sessions) {
        totalMinutes += Number(s.duration_minutes);
        if (s.logout_type === 'manual') manualLogouts++;
        else if (s.logout_type === 'timeout') timeoutLogouts++;
      }

      return {
        totalLogins: sessions.length,
        totalHours: Math.round(totalMinutes / 60),
        avgMinutesPerSession: sessions.length > 0 ? Math.round(totalMinutes / sessions.length) : 0,
        manualLogouts,
        timeoutLogouts,
      };
    }),
});
