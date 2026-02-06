/**
 * KPI Usage Aggregator
 *
 * Real-time aggregation of usage statistics into pre-computed summary tables.
 * Called whenever a session ends (logout/timeout/inactivity/relogin).
 */

import { db } from "~/server/db";

export interface SessionData {
  userId: string;
  userName: string;
  sessionEnd: Date;
  durationMinutes: number;
  logoutType: "manual" | "timeout" | "inactivity" | "relogin";
}

/**
 * Get week number of year (1-53)
 * Matches the calculation in my-kpi.tsx getWeekOfYear
 */
function getWeekNumber(date: Date): number {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Get week start/end dates for a given year and week number
 * Matches the calculation in my-kpi.tsx getWeeksInYear
 */
function getWeekBounds(
  year: number,
  week: number
): { start: Date; end: Date } {
  const startOfYear = new Date(year, 0, 1);
  const daysToAdd = (week - 1) * 7;
  const weekStart = new Date(startOfYear);
  weekStart.setDate(weekStart.getDate() + daysToAdd);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // Clamp to end of year
  const endOfYear = new Date(year, 11, 31);
  if (weekEnd > endOfYear) {
    weekEnd.setTime(endOfYear.getTime());
  }

  return { start: weekStart, end: weekEnd };
}

/**
 * Main function to update all KPI usage summary tables
 * Called after session_history record is created
 */
export async function updateKpiUsageSummary(session: SessionData): Promise<void> {
  try {
    const d = session.sessionEnd;
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const dateOnly = new Date(year, d.getMonth(), d.getDate());
    const week = getWeekNumber(d);
    const weekBounds = getWeekBounds(year, week);

    // Run all upserts in parallel for performance
    await Promise.all([
      upsertDaily(session, dateOnly),
      upsertWeekly(session, year, week, weekBounds),
      upsertMonthly(session, year, month),
      upsertYearly(session, year),
    ]);

    console.log(
      `[KPI-AGGREGATOR] Updated usage summary for ${session.userName} (${session.userId})`
    );
  } catch (error) {
    // Log error but don't throw - aggregation failure shouldn't block logout
    console.error("[KPI-AGGREGATOR] Error updating usage summary:", error);
  }
}

/**
 * Upsert daily summary
 */
async function upsertDaily(session: SessionData, dateKey: Date): Promise<void> {
  const existing = await db.kpi_usage_daily.findUnique({
    where: {
      user_id_date: {
        user_id: session.userId,
        date: dateKey,
      },
    },
  });

  if (existing) {
    const newTotalSessions = existing.total_sessions + 1;
    const newTotalMinutes = Number(existing.total_minutes) + session.durationMinutes;
    const newAvg = newTotalMinutes / newTotalSessions;

    await db.kpi_usage_daily.update({
      where: { id: existing.id },
      data: {
        total_sessions: newTotalSessions,
        total_minutes: newTotalMinutes,
        avg_minutes_per_session: newAvg,
        [`${session.logoutType}_logouts`]: { increment: 1 },
      },
    });
  } else {
    await db.kpi_usage_daily.create({
      data: {
        user_id: session.userId,
        user_name: session.userName,
        date: dateKey,
        total_sessions: 1,
        total_minutes: session.durationMinutes,
        avg_minutes_per_session: session.durationMinutes,
        [`${session.logoutType}_logouts`]: 1,
      },
    });
  }
}

/**
 * Upsert weekly summary
 */
async function upsertWeekly(
  session: SessionData,
  year: number,
  week: number,
  weekBounds: { start: Date; end: Date }
): Promise<void> {
  const existing = await db.kpi_usage_weekly.findUnique({
    where: {
      user_id_year_week: {
        user_id: session.userId,
        year: year,
        week: week,
      },
    },
  });

  if (existing) {
    const newTotalSessions = existing.total_sessions + 1;
    const newTotalMinutes = Number(existing.total_minutes) + session.durationMinutes;
    const newAvg = newTotalMinutes / newTotalSessions;

    await db.kpi_usage_weekly.update({
      where: { id: existing.id },
      data: {
        total_sessions: newTotalSessions,
        total_minutes: newTotalMinutes,
        avg_minutes_per_session: newAvg,
        [`${session.logoutType}_logouts`]: { increment: 1 },
      },
    });
  } else {
    await db.kpi_usage_weekly.create({
      data: {
        user_id: session.userId,
        user_name: session.userName,
        year: year,
        week: week,
        week_start: weekBounds.start,
        week_end: weekBounds.end,
        total_sessions: 1,
        total_minutes: session.durationMinutes,
        avg_minutes_per_session: session.durationMinutes,
        [`${session.logoutType}_logouts`]: 1,
      },
    });
  }
}

/**
 * Upsert monthly summary
 */
async function upsertMonthly(
  session: SessionData,
  year: number,
  month: number
): Promise<void> {
  const existing = await db.kpi_usage_monthly.findUnique({
    where: {
      user_id_year_month: {
        user_id: session.userId,
        year: year,
        month: month,
      },
    },
  });

  if (existing) {
    const newTotalSessions = existing.total_sessions + 1;
    const newTotalMinutes = Number(existing.total_minutes) + session.durationMinutes;
    const newAvg = newTotalMinutes / newTotalSessions;

    await db.kpi_usage_monthly.update({
      where: { id: existing.id },
      data: {
        total_sessions: newTotalSessions,
        total_minutes: newTotalMinutes,
        avg_minutes_per_session: newAvg,
        [`${session.logoutType}_logouts`]: { increment: 1 },
      },
    });
  } else {
    await db.kpi_usage_monthly.create({
      data: {
        user_id: session.userId,
        user_name: session.userName,
        year: year,
        month: month,
        total_sessions: 1,
        total_minutes: session.durationMinutes,
        avg_minutes_per_session: session.durationMinutes,
        [`${session.logoutType}_logouts`]: 1,
      },
    });
  }
}

/**
 * Upsert yearly summary
 */
async function upsertYearly(session: SessionData, year: number): Promise<void> {
  const existing = await db.kpi_usage_yearly.findUnique({
    where: {
      user_id_year: {
        user_id: session.userId,
        year: year,
      },
    },
  });

  if (existing) {
    const newTotalSessions = existing.total_sessions + 1;
    const newTotalMinutes = Number(existing.total_minutes) + session.durationMinutes;
    const newAvg = newTotalMinutes / newTotalSessions;

    await db.kpi_usage_yearly.update({
      where: { id: existing.id },
      data: {
        total_sessions: newTotalSessions,
        total_minutes: newTotalMinutes,
        avg_minutes_per_session: newAvg,
        [`${session.logoutType}_logouts`]: { increment: 1 },
      },
    });
  } else {
    await db.kpi_usage_yearly.create({
      data: {
        user_id: session.userId,
        user_name: session.userName,
        year: year,
        total_sessions: 1,
        total_minutes: session.durationMinutes,
        avg_minutes_per_session: session.durationMinutes,
        [`${session.logoutType}_logouts`]: 1,
      },
    });
  }
}
