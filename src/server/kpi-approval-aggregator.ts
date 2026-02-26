/**
 * KPI Approval Aggregator
 *
 * Real-time aggregation of approval KPI into pre-computed summary tables.
 * Called whenever an approval_kpi_metric record is created.
 */

import { db } from "~/server/db";

export interface ApprovalMetricData {
  userId: string;
  userName: string;
  approvalStage: string;
  approvedAt: Date;
  durationDays: number;
  isOnTime: boolean | null;
}

function getWeekNumber(date: Date): number {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

function getWeekBounds(year: number, week: number): { start: Date; end: Date } {
  const startOfYear = new Date(year, 0, 1);
  const daysToAdd = (week - 1) * 7;
  const weekStart = new Date(startOfYear);
  weekStart.setDate(weekStart.getDate() + daysToAdd);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const endOfYear = new Date(year, 11, 31);
  if (weekEnd > endOfYear) {
    weekEnd.setTime(endOfYear.getTime());
  }

  return { start: weekStart, end: weekEnd };
}

export async function updateKpiApprovalSummary(data: ApprovalMetricData): Promise<void> {
  try {
    const d = data.approvedAt;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const dateOnly = new Date(year, d.getMonth(), d.getDate());
    const week = getWeekNumber(d);
    const weekBounds = getWeekBounds(year, week);

    await Promise.all([
      upsertDaily(data, dateOnly),
      upsertWeekly(data, year, week, weekBounds),
      upsertMonthly(data, year, month),
      upsertYearly(data, year),
    ]);

    console.log(`[KPI-APPROVAL-AGG] Updated for ${data.userName} stage=${data.approvalStage}`);
  } catch (error) {
    console.error("[KPI-APPROVAL-AGG] Error:", error);
  }
}

async function upsertDaily(data: ApprovalMetricData, dateKey: Date): Promise<void> {
  const existing = await db.kpi_approval_daily.findUnique({
    where: {
      user_id_date_approval_stage: {
        user_id: data.userId,
        date: dateKey,
        approval_stage: data.approvalStage,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalDays = Number(existing.total_duration_days) + data.durationDays;
    const newAvg = newTotalDays / newCount;

    await db.kpi_approval_daily.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_days: newTotalDays,
        avg_duration_days: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_approval_daily.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        date: dateKey,
        approval_stage: data.approvalStage,
        total_count: 1,
        total_duration_days: data.durationDays,
        avg_duration_days: data.durationDays,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
      },
    });
  }
}

async function upsertWeekly(
  data: ApprovalMetricData,
  year: number,
  week: number,
  weekBounds: { start: Date; end: Date }
): Promise<void> {
  const existing = await db.kpi_approval_weekly.findUnique({
    where: {
      user_id_year_week_approval_stage: {
        user_id: data.userId,
        year,
        week,
        approval_stage: data.approvalStage,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalDays = Number(existing.total_duration_days) + data.durationDays;
    const newAvg = newTotalDays / newCount;

    await db.kpi_approval_weekly.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_days: newTotalDays,
        avg_duration_days: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_approval_weekly.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        year,
        week,
        week_start: weekBounds.start,
        week_end: weekBounds.end,
        approval_stage: data.approvalStage,
        total_count: 1,
        total_duration_days: data.durationDays,
        avg_duration_days: data.durationDays,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
      },
    });
  }
}

async function upsertMonthly(data: ApprovalMetricData, year: number, month: number): Promise<void> {
  const existing = await db.kpi_approval_monthly.findUnique({
    where: {
      user_id_year_month_approval_stage: {
        user_id: data.userId,
        year,
        month,
        approval_stage: data.approvalStage,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalDays = Number(existing.total_duration_days) + data.durationDays;
    const newAvg = newTotalDays / newCount;

    await db.kpi_approval_monthly.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_days: newTotalDays,
        avg_duration_days: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_approval_monthly.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        year,
        month,
        approval_stage: data.approvalStage,
        total_count: 1,
        total_duration_days: data.durationDays,
        avg_duration_days: data.durationDays,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
      },
    });
  }
}

async function upsertYearly(data: ApprovalMetricData, year: number): Promise<void> {
  const existing = await db.kpi_approval_yearly.findUnique({
    where: {
      user_id_year_approval_stage: {
        user_id: data.userId,
        year,
        approval_stage: data.approvalStage,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalDays = Number(existing.total_duration_days) + data.durationDays;
    const newAvg = newTotalDays / newCount;

    await db.kpi_approval_yearly.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_days: newTotalDays,
        avg_duration_days: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_approval_yearly.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        year,
        approval_stage: data.approvalStage,
        total_count: 1,
        total_duration_days: data.durationDays,
        avg_duration_days: data.durationDays,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
      },
    });
  }
}
