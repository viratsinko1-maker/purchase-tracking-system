/**
 * Backfill KPI Usage Summary Tables
 *
 * สคริปต์นี้ใช้สำหรับ migrate ข้อมูลเดิมจาก session_history
 * ไปยัง pre-aggregated tables (kpi_usage_daily, weekly, monthly, yearly)
 *
 * วิธีใช้:
 * npx ts-node scripts/backfill-kpi-usage.ts
 *
 * หรือถ้าใช้ tsx:
 * npx tsx scripts/backfill-kpi-usage.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Get week number of year (1-53)
 */
function getWeekNumber(date: Date): number {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const diffTime = date.getTime() - startOfYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Get week start/end dates
 */
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

async function backfillDaily() {
  console.log("📅 Backfilling daily summaries...");

  // Group by user_id and date
  const dailyData = await prisma.$queryRaw<
    Array<{
      user_id: string;
      user_name: string | null;
      date: Date;
      total_sessions: bigint;
      total_minutes: number;
      manual_logouts: bigint;
      timeout_logouts: bigint;
      inactivity_logouts: bigint;
      relogin_logouts: bigint;
    }>
  >`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      DATE(session_end) as date,
      COUNT(*) as total_sessions,
      SUM(duration_minutes) as total_minutes,
      SUM(CASE WHEN logout_type = 'manual' THEN 1 ELSE 0 END) as manual_logouts,
      SUM(CASE WHEN logout_type = 'timeout' THEN 1 ELSE 0 END) as timeout_logouts,
      SUM(CASE WHEN logout_type = 'inactivity' THEN 1 ELSE 0 END) as inactivity_logouts,
      SUM(CASE WHEN logout_type = 'relogin' THEN 1 ELSE 0 END) as relogin_logouts
    FROM session_history
    GROUP BY user_id, DATE(session_end)
  `;

  let inserted = 0;
  for (const row of dailyData) {
    const totalSessions = Number(row.total_sessions);
    const totalMinutes = Number(row.total_minutes);
    const avgMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0;

    await prisma.kpi_usage_daily.upsert({
      where: {
        user_id_date: {
          user_id: row.user_id,
          date: row.date,
        },
      },
      update: {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: Number(row.manual_logouts),
        timeout_logouts: Number(row.timeout_logouts),
        inactivity_logouts: Number(row.inactivity_logouts),
        relogin_logouts: Number(row.relogin_logouts),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        date: row.date,
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: Number(row.manual_logouts),
        timeout_logouts: Number(row.timeout_logouts),
        inactivity_logouts: Number(row.inactivity_logouts),
        relogin_logouts: Number(row.relogin_logouts),
      },
    });
    inserted++;
  }

  console.log(`   ✅ Inserted/Updated ${inserted} daily records`);
}

async function backfillWeekly() {
  console.log("📆 Backfilling weekly summaries...");

  // Get all sessions
  const sessions = await prisma.session_history.findMany({
    select: {
      user_id: true,
      user_name: true,
      session_end: true,
      duration_minutes: true,
      logout_type: true,
    },
  });

  // Group by user, year, week
  const weeklyMap = new Map<
    string,
    {
      user_id: string;
      user_name: string;
      year: number;
      week: number;
      total_sessions: number;
      total_minutes: number;
      manual_logouts: number;
      timeout_logouts: number;
      inactivity_logouts: number;
      relogin_logouts: number;
    }
  >();

  for (const session of sessions) {
    const year = session.session_end.getFullYear();
    const week = getWeekNumber(session.session_end);
    const key = `${session.user_id}-${year}-${week}`;

    const existing = weeklyMap.get(key) ?? {
      user_id: session.user_id,
      user_name: session.user_name ?? session.user_id,
      year,
      week,
      total_sessions: 0,
      total_minutes: 0,
      manual_logouts: 0,
      timeout_logouts: 0,
      inactivity_logouts: 0,
      relogin_logouts: 0,
    };

    existing.total_sessions++;
    existing.total_minutes += Number(session.duration_minutes);
    if (session.logout_type === "manual") existing.manual_logouts++;
    if (session.logout_type === "timeout") existing.timeout_logouts++;
    if (session.logout_type === "inactivity") existing.inactivity_logouts++;
    if (session.logout_type === "relogin") existing.relogin_logouts++;

    weeklyMap.set(key, existing);
  }

  let inserted = 0;
  for (const row of weeklyMap.values()) {
    const weekBounds = getWeekBounds(row.year, row.week);
    const avgMinutes =
      row.total_sessions > 0 ? row.total_minutes / row.total_sessions : 0;

    await prisma.kpi_usage_weekly.upsert({
      where: {
        user_id_year_week: {
          user_id: row.user_id,
          year: row.year,
          week: row.week,
        },
      },
      update: {
        total_sessions: row.total_sessions,
        total_minutes: row.total_minutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: row.manual_logouts,
        timeout_logouts: row.timeout_logouts,
        inactivity_logouts: row.inactivity_logouts,
        relogin_logouts: row.relogin_logouts,
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name,
        year: row.year,
        week: row.week,
        week_start: weekBounds.start,
        week_end: weekBounds.end,
        total_sessions: row.total_sessions,
        total_minutes: row.total_minutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: row.manual_logouts,
        timeout_logouts: row.timeout_logouts,
        inactivity_logouts: row.inactivity_logouts,
        relogin_logouts: row.relogin_logouts,
      },
    });
    inserted++;
  }

  console.log(`   ✅ Inserted/Updated ${inserted} weekly records`);
}

async function backfillMonthly() {
  console.log("📆 Backfilling monthly summaries...");

  // Group by user_id, year, month (PostgreSQL syntax)
  const monthlyData = await prisma.$queryRaw<
    Array<{
      user_id: string;
      user_name: string | null;
      year: number;
      month: number;
      total_sessions: bigint;
      total_minutes: number;
      manual_logouts: bigint;
      timeout_logouts: bigint;
      inactivity_logouts: bigint;
      relogin_logouts: bigint;
    }>
  >`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      EXTRACT(YEAR FROM session_end)::integer as year,
      EXTRACT(MONTH FROM session_end)::integer as month,
      COUNT(*) as total_sessions,
      SUM(duration_minutes) as total_minutes,
      SUM(CASE WHEN logout_type = 'manual' THEN 1 ELSE 0 END) as manual_logouts,
      SUM(CASE WHEN logout_type = 'timeout' THEN 1 ELSE 0 END) as timeout_logouts,
      SUM(CASE WHEN logout_type = 'inactivity' THEN 1 ELSE 0 END) as inactivity_logouts,
      SUM(CASE WHEN logout_type = 'relogin' THEN 1 ELSE 0 END) as relogin_logouts
    FROM session_history
    GROUP BY user_id, EXTRACT(YEAR FROM session_end), EXTRACT(MONTH FROM session_end)
  `;

  let inserted = 0;
  for (const row of monthlyData) {
    const totalSessions = Number(row.total_sessions);
    const totalMinutes = Number(row.total_minutes);
    const avgMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0;

    await prisma.kpi_usage_monthly.upsert({
      where: {
        user_id_year_month: {
          user_id: row.user_id,
          year: row.year,
          month: row.month,
        },
      },
      update: {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: Number(row.manual_logouts),
        timeout_logouts: Number(row.timeout_logouts),
        inactivity_logouts: Number(row.inactivity_logouts),
        relogin_logouts: Number(row.relogin_logouts),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        year: row.year,
        month: row.month,
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: Number(row.manual_logouts),
        timeout_logouts: Number(row.timeout_logouts),
        inactivity_logouts: Number(row.inactivity_logouts),
        relogin_logouts: Number(row.relogin_logouts),
      },
    });
    inserted++;
  }

  console.log(`   ✅ Inserted/Updated ${inserted} monthly records`);
}

async function backfillYearly() {
  console.log("📆 Backfilling yearly summaries...");

  // Group by user_id, year (PostgreSQL syntax)
  const yearlyData = await prisma.$queryRaw<
    Array<{
      user_id: string;
      user_name: string | null;
      year: number;
      total_sessions: bigint;
      total_minutes: number;
      manual_logouts: bigint;
      timeout_logouts: bigint;
      inactivity_logouts: bigint;
      relogin_logouts: bigint;
    }>
  >`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      EXTRACT(YEAR FROM session_end)::integer as year,
      COUNT(*) as total_sessions,
      SUM(duration_minutes) as total_minutes,
      SUM(CASE WHEN logout_type = 'manual' THEN 1 ELSE 0 END) as manual_logouts,
      SUM(CASE WHEN logout_type = 'timeout' THEN 1 ELSE 0 END) as timeout_logouts,
      SUM(CASE WHEN logout_type = 'inactivity' THEN 1 ELSE 0 END) as inactivity_logouts,
      SUM(CASE WHEN logout_type = 'relogin' THEN 1 ELSE 0 END) as relogin_logouts
    FROM session_history
    GROUP BY user_id, EXTRACT(YEAR FROM session_end)
  `;

  let inserted = 0;
  for (const row of yearlyData) {
    const totalSessions = Number(row.total_sessions);
    const totalMinutes = Number(row.total_minutes);
    const avgMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0;

    await prisma.kpi_usage_yearly.upsert({
      where: {
        user_id_year: {
          user_id: row.user_id,
          year: row.year,
        },
      },
      update: {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: Number(row.manual_logouts),
        timeout_logouts: Number(row.timeout_logouts),
        inactivity_logouts: Number(row.inactivity_logouts),
        relogin_logouts: Number(row.relogin_logouts),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        year: row.year,
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        avg_minutes_per_session: avgMinutes,
        manual_logouts: Number(row.manual_logouts),
        timeout_logouts: Number(row.timeout_logouts),
        inactivity_logouts: Number(row.inactivity_logouts),
        relogin_logouts: Number(row.relogin_logouts),
      },
    });
    inserted++;
  }

  console.log(`   ✅ Inserted/Updated ${inserted} yearly records`);
}

async function main() {
  console.log("🚀 Starting KPI Usage Backfill...\n");

  try {
    // Check if there's any data to backfill
    const sessionCount = await prisma.session_history.count();
    console.log(`📊 Found ${sessionCount} sessions in session_history\n`);

    if (sessionCount === 0) {
      console.log("⚠️  No sessions found. Nothing to backfill.");
      return;
    }

    await backfillDaily();
    await backfillWeekly();
    await backfillMonthly();
    await backfillYearly();

    console.log("\n✅ Backfill completed successfully!");
  } catch (error) {
    console.error("\n❌ Backfill failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
