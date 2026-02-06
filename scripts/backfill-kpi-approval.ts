/**
 * Backfill KPI Approval Summary Tables
 *
 * Migrate existing data from approval_kpi_metric
 * to pre-aggregated tables (kpi_approval_daily, weekly, monthly, yearly)
 *
 * Usage: npx tsx scripts/backfill-kpi-approval.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
  if (weekEnd > endOfYear) weekEnd.setTime(endOfYear.getTime());
  return { start: weekStart, end: weekEnd };
}

async function backfillDaily() {
  console.log("Backfilling approval daily summaries...");

  const data = await prisma.$queryRaw<Array<{
    user_id: string;
    user_name: string | null;
    date: Date;
    approval_stage: string;
    total_count: bigint;
    total_duration_min: number;
    on_time_count: bigint;
    late_count: bigint;
  }>>`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      DATE(approved_at) as date,
      approval_stage,
      COUNT(*) as total_count,
      SUM(duration_minutes) as total_duration_min,
      SUM(CASE WHEN is_on_time = true THEN 1 ELSE 0 END) as on_time_count,
      SUM(CASE WHEN is_on_time = false THEN 1 ELSE 0 END) as late_count
    FROM approval_kpi_metric
    GROUP BY user_id, DATE(approved_at), approval_stage
  `;

  let inserted = 0;
  for (const row of data) {
    const count = Number(row.total_count);
    const totalMin = Number(row.total_duration_min);
    const avgMin = count > 0 ? totalMin / count : 0;

    await prisma.kpi_approval_daily.upsert({
      where: {
        user_id_date_approval_stage: {
          user_id: row.user_id,
          date: row.date,
          approval_stage: row.approval_stage,
        },
      },
      update: {
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        date: row.date,
        approval_stage: row.approval_stage,
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} daily records`);
}

async function backfillWeekly() {
  console.log("Backfilling approval weekly summaries...");

  const metrics = await prisma.approval_kpi_metric.findMany({
    select: {
      user_id: true,
      user_name: true,
      approved_at: true,
      approval_stage: true,
      duration_minutes: true,
      is_on_time: true,
    },
  });

  const weeklyMap = new Map<string, {
    user_id: string;
    user_name: string;
    year: number;
    week: number;
    approval_stage: string;
    total_count: number;
    total_duration_min: number;
    on_time_count: number;
    late_count: number;
  }>();

  for (const m of metrics) {
    const year = m.approved_at.getFullYear();
    const week = getWeekNumber(m.approved_at);
    const key = `${m.user_id}-${year}-${week}-${m.approval_stage}`;

    const existing = weeklyMap.get(key) ?? {
      user_id: m.user_id,
      user_name: m.user_name,
      year,
      week,
      approval_stage: m.approval_stage,
      total_count: 0,
      total_duration_min: 0,
      on_time_count: 0,
      late_count: 0,
    };

    existing.total_count++;
    existing.total_duration_min += Number(m.duration_minutes);
    if (m.is_on_time === true) existing.on_time_count++;
    if (m.is_on_time === false) existing.late_count++;

    weeklyMap.set(key, existing);
  }

  let inserted = 0;
  for (const row of weeklyMap.values()) {
    const weekBounds = getWeekBounds(row.year, row.week);
    const avgMin = row.total_count > 0 ? row.total_duration_min / row.total_count : 0;

    await prisma.kpi_approval_weekly.upsert({
      where: {
        user_id_year_week_approval_stage: {
          user_id: row.user_id,
          year: row.year,
          week: row.week,
          approval_stage: row.approval_stage,
        },
      },
      update: {
        total_count: row.total_count,
        total_duration_min: row.total_duration_min,
        avg_duration_min: avgMin,
        on_time_count: row.on_time_count,
        late_count: row.late_count,
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name,
        year: row.year,
        week: row.week,
        week_start: weekBounds.start,
        week_end: weekBounds.end,
        approval_stage: row.approval_stage,
        total_count: row.total_count,
        total_duration_min: row.total_duration_min,
        avg_duration_min: avgMin,
        on_time_count: row.on_time_count,
        late_count: row.late_count,
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} weekly records`);
}

async function backfillMonthly() {
  console.log("Backfilling approval monthly summaries...");

  const data = await prisma.$queryRaw<Array<{
    user_id: string;
    user_name: string | null;
    year: number;
    month: number;
    approval_stage: string;
    total_count: bigint;
    total_duration_min: number;
    on_time_count: bigint;
    late_count: bigint;
  }>>`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      EXTRACT(YEAR FROM approved_at)::integer as year,
      EXTRACT(MONTH FROM approved_at)::integer as month,
      approval_stage,
      COUNT(*) as total_count,
      SUM(duration_minutes) as total_duration_min,
      SUM(CASE WHEN is_on_time = true THEN 1 ELSE 0 END) as on_time_count,
      SUM(CASE WHEN is_on_time = false THEN 1 ELSE 0 END) as late_count
    FROM approval_kpi_metric
    GROUP BY user_id, EXTRACT(YEAR FROM approved_at), EXTRACT(MONTH FROM approved_at), approval_stage
  `;

  let inserted = 0;
  for (const row of data) {
    const count = Number(row.total_count);
    const totalMin = Number(row.total_duration_min);
    const avgMin = count > 0 ? totalMin / count : 0;

    await prisma.kpi_approval_monthly.upsert({
      where: {
        user_id_year_month_approval_stage: {
          user_id: row.user_id,
          year: row.year,
          month: row.month,
          approval_stage: row.approval_stage,
        },
      },
      update: {
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        year: row.year,
        month: row.month,
        approval_stage: row.approval_stage,
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} monthly records`);
}

async function backfillYearly() {
  console.log("Backfilling approval yearly summaries...");

  const data = await prisma.$queryRaw<Array<{
    user_id: string;
    user_name: string | null;
    year: number;
    approval_stage: string;
    total_count: bigint;
    total_duration_min: number;
    on_time_count: bigint;
    late_count: bigint;
  }>>`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      EXTRACT(YEAR FROM approved_at)::integer as year,
      approval_stage,
      COUNT(*) as total_count,
      SUM(duration_minutes) as total_duration_min,
      SUM(CASE WHEN is_on_time = true THEN 1 ELSE 0 END) as on_time_count,
      SUM(CASE WHEN is_on_time = false THEN 1 ELSE 0 END) as late_count
    FROM approval_kpi_metric
    GROUP BY user_id, EXTRACT(YEAR FROM approved_at), approval_stage
  `;

  let inserted = 0;
  for (const row of data) {
    const count = Number(row.total_count);
    const totalMin = Number(row.total_duration_min);
    const avgMin = count > 0 ? totalMin / count : 0;

    await prisma.kpi_approval_yearly.upsert({
      where: {
        user_id_year_approval_stage: {
          user_id: row.user_id,
          year: row.year,
          approval_stage: row.approval_stage,
        },
      },
      update: {
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        year: row.year,
        approval_stage: row.approval_stage,
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} yearly records`);
}

async function main() {
  console.log("Starting KPI Approval Backfill...\n");

  try {
    const count = await prisma.approval_kpi_metric.count();
    console.log(`Found ${count} records in approval_kpi_metric\n`);

    if (count === 0) {
      console.log("No records found. Nothing to backfill.");
      return;
    }

    await backfillDaily();
    await backfillWeekly();
    await backfillMonthly();
    await backfillYearly();

    console.log("\nBackfill completed successfully!");
  } catch (error) {
    console.error("\nBackfill failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
