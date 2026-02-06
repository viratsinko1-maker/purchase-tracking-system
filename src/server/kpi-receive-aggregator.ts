/**
 * KPI Receive Confirm Aggregator
 *
 * Real-time aggregation of receive confirm KPI into pre-computed summary tables.
 * Called whenever a receive_confirm_kpi_metric record is created.
 */

import { db } from "~/server/db";

export interface ReceiveMetricData {
  userId: string;
  userName: string;
  confirmedAt: Date;
  durationMinutes: number;
  isOnTime: boolean | null;
  confirmStatus: "confirmed" | "rejected";
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

export async function updateKpiReceiveSummary(data: ReceiveMetricData): Promise<void> {
  try {
    const d = data.confirmedAt;
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

    console.log(`[KPI-RECEIVE-AGG] Updated for ${data.userName}`);
  } catch (error) {
    console.error("[KPI-RECEIVE-AGG] Error:", error);
  }
}

async function upsertDaily(data: ReceiveMetricData, dateKey: Date): Promise<void> {
  const existing = await db.kpi_receive_daily.findUnique({
    where: {
      user_id_date: {
        user_id: data.userId,
        date: dateKey,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalMin = Number(existing.total_duration_min) + data.durationMinutes;
    const newAvg = newTotalMin / newCount;

    await db.kpi_receive_daily.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_min: newTotalMin,
        avg_duration_min: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
        confirmed_count: data.confirmStatus === "confirmed" ? { increment: 1 } : undefined,
        rejected_count: data.confirmStatus === "rejected" ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_receive_daily.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        date: dateKey,
        total_count: 1,
        total_duration_min: data.durationMinutes,
        avg_duration_min: data.durationMinutes,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
        confirmed_count: data.confirmStatus === "confirmed" ? 1 : 0,
        rejected_count: data.confirmStatus === "rejected" ? 1 : 0,
      },
    });
  }
}

async function upsertWeekly(
  data: ReceiveMetricData,
  year: number,
  week: number,
  weekBounds: { start: Date; end: Date }
): Promise<void> {
  const existing = await db.kpi_receive_weekly.findUnique({
    where: {
      user_id_year_week: {
        user_id: data.userId,
        year,
        week,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalMin = Number(existing.total_duration_min) + data.durationMinutes;
    const newAvg = newTotalMin / newCount;

    await db.kpi_receive_weekly.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_min: newTotalMin,
        avg_duration_min: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
        confirmed_count: data.confirmStatus === "confirmed" ? { increment: 1 } : undefined,
        rejected_count: data.confirmStatus === "rejected" ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_receive_weekly.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        year,
        week,
        week_start: weekBounds.start,
        week_end: weekBounds.end,
        total_count: 1,
        total_duration_min: data.durationMinutes,
        avg_duration_min: data.durationMinutes,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
        confirmed_count: data.confirmStatus === "confirmed" ? 1 : 0,
        rejected_count: data.confirmStatus === "rejected" ? 1 : 0,
      },
    });
  }
}

async function upsertMonthly(data: ReceiveMetricData, year: number, month: number): Promise<void> {
  const existing = await db.kpi_receive_monthly.findUnique({
    where: {
      user_id_year_month: {
        user_id: data.userId,
        year,
        month,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalMin = Number(existing.total_duration_min) + data.durationMinutes;
    const newAvg = newTotalMin / newCount;

    await db.kpi_receive_monthly.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_min: newTotalMin,
        avg_duration_min: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
        confirmed_count: data.confirmStatus === "confirmed" ? { increment: 1 } : undefined,
        rejected_count: data.confirmStatus === "rejected" ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_receive_monthly.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        year,
        month,
        total_count: 1,
        total_duration_min: data.durationMinutes,
        avg_duration_min: data.durationMinutes,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
        confirmed_count: data.confirmStatus === "confirmed" ? 1 : 0,
        rejected_count: data.confirmStatus === "rejected" ? 1 : 0,
      },
    });
  }
}

async function upsertYearly(data: ReceiveMetricData, year: number): Promise<void> {
  const existing = await db.kpi_receive_yearly.findUnique({
    where: {
      user_id_year: {
        user_id: data.userId,
        year,
      },
    },
  });

  if (existing) {
    const newCount = existing.total_count + 1;
    const newTotalMin = Number(existing.total_duration_min) + data.durationMinutes;
    const newAvg = newTotalMin / newCount;

    await db.kpi_receive_yearly.update({
      where: { id: existing.id },
      data: {
        total_count: newCount,
        total_duration_min: newTotalMin,
        avg_duration_min: newAvg,
        on_time_count: data.isOnTime === true ? { increment: 1 } : undefined,
        late_count: data.isOnTime === false ? { increment: 1 } : undefined,
        confirmed_count: data.confirmStatus === "confirmed" ? { increment: 1 } : undefined,
        rejected_count: data.confirmStatus === "rejected" ? { increment: 1 } : undefined,
      },
    });
  } else {
    await db.kpi_receive_yearly.create({
      data: {
        user_id: data.userId,
        user_name: data.userName,
        year,
        total_count: 1,
        total_duration_min: data.durationMinutes,
        avg_duration_min: data.durationMinutes,
        on_time_count: data.isOnTime === true ? 1 : 0,
        late_count: data.isOnTime === false ? 1 : 0,
        confirmed_count: data.confirmStatus === "confirmed" ? 1 : 0,
        rejected_count: data.confirmStatus === "rejected" ? 1 : 0,
      },
    });
  }
}
