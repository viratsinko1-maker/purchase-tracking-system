/**
 * Backfill KPI Receive Confirm Summary Tables
 *
 * Migrate existing data from receive_confirm_kpi_metric
 * to pre-aggregated tables (kpi_receive_daily, weekly, monthly, yearly)
 *
 * Usage: npx tsx scripts/backfill-kpi-receive.ts
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
  console.log("Backfilling receive daily summaries...");

  const data = await prisma.$queryRaw<Array<{
    user_id: string;
    user_name: string | null;
    date: Date;
    total_count: bigint;
    total_duration_min: number;
    on_time_count: bigint;
    late_count: bigint;
    confirmed_count: bigint;
    rejected_count: bigint;
  }>>`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      DATE(confirmed_at) as date,
      COUNT(*) as total_count,
      SUM(duration_minutes) as total_duration_min,
      SUM(CASE WHEN is_on_time = true THEN 1 ELSE 0 END) as on_time_count,
      SUM(CASE WHEN is_on_time = false THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN confirm_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN confirm_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM receive_confirm_kpi_metric
    GROUP BY user_id, DATE(confirmed_at)
  `;

  let inserted = 0;
  for (const row of data) {
    const count = Number(row.total_count);
    const totalMin = Number(row.total_duration_min);
    const avgMin = count > 0 ? totalMin / count : 0;

    await prisma.kpi_receive_daily.upsert({
      where: {
        user_id_date: {
          user_id: row.user_id,
          date: row.date,
        },
      },
      update: {
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
        confirmed_count: Number(row.confirmed_count),
        rejected_count: Number(row.rejected_count),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        date: row.date,
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
        confirmed_count: Number(row.confirmed_count),
        rejected_count: Number(row.rejected_count),
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} daily records`);
}

async function backfillWeekly() {
  console.log("Backfilling receive weekly summaries...");

  const metrics = await prisma.receive_confirm_kpi_metric.findMany({
    select: {
      user_id: true,
      user_name: true,
      confirmed_at: true,
      duration_minutes: true,
      is_on_time: true,
      confirm_status: true,
    },
  });

  const weeklyMap = new Map<string, {
    user_id: string;
    user_name: string;
    year: number;
    week: number;
    total_count: number;
    total_duration_min: number;
    on_time_count: number;
    late_count: number;
    confirmed_count: number;
    rejected_count: number;
  }>();

  for (const m of metrics) {
    const year = m.confirmed_at.getFullYear();
    const week = getWeekNumber(m.confirmed_at);
    const key = `${m.user_id}-${year}-${week}`;

    const existing = weeklyMap.get(key) ?? {
      user_id: m.user_id,
      user_name: m.user_name,
      year,
      week,
      total_count: 0,
      total_duration_min: 0,
      on_time_count: 0,
      late_count: 0,
      confirmed_count: 0,
      rejected_count: 0,
    };

    existing.total_count++;
    existing.total_duration_min += Number(m.duration_minutes);
    if (m.is_on_time === true) existing.on_time_count++;
    if (m.is_on_time === false) existing.late_count++;
    if (m.confirm_status === 'confirmed') existing.confirmed_count++;
    if (m.confirm_status === 'rejected') existing.rejected_count++;

    weeklyMap.set(key, existing);
  }

  let inserted = 0;
  for (const row of weeklyMap.values()) {
    const weekBounds = getWeekBounds(row.year, row.week);
    const avgMin = row.total_count > 0 ? row.total_duration_min / row.total_count : 0;

    await prisma.kpi_receive_weekly.upsert({
      where: {
        user_id_year_week: {
          user_id: row.user_id,
          year: row.year,
          week: row.week,
        },
      },
      update: {
        total_count: row.total_count,
        total_duration_min: row.total_duration_min,
        avg_duration_min: avgMin,
        on_time_count: row.on_time_count,
        late_count: row.late_count,
        confirmed_count: row.confirmed_count,
        rejected_count: row.rejected_count,
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name,
        year: row.year,
        week: row.week,
        week_start: weekBounds.start,
        week_end: weekBounds.end,
        total_count: row.total_count,
        total_duration_min: row.total_duration_min,
        avg_duration_min: avgMin,
        on_time_count: row.on_time_count,
        late_count: row.late_count,
        confirmed_count: row.confirmed_count,
        rejected_count: row.rejected_count,
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} weekly records`);
}

async function backfillMonthly() {
  console.log("Backfilling receive monthly summaries...");

  const data = await prisma.$queryRaw<Array<{
    user_id: string;
    user_name: string | null;
    year: number;
    month: number;
    total_count: bigint;
    total_duration_min: number;
    on_time_count: bigint;
    late_count: bigint;
    confirmed_count: bigint;
    rejected_count: bigint;
  }>>`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      EXTRACT(YEAR FROM confirmed_at)::integer as year,
      EXTRACT(MONTH FROM confirmed_at)::integer as month,
      COUNT(*) as total_count,
      SUM(duration_minutes) as total_duration_min,
      SUM(CASE WHEN is_on_time = true THEN 1 ELSE 0 END) as on_time_count,
      SUM(CASE WHEN is_on_time = false THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN confirm_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN confirm_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM receive_confirm_kpi_metric
    GROUP BY user_id, EXTRACT(YEAR FROM confirmed_at), EXTRACT(MONTH FROM confirmed_at)
  `;

  let inserted = 0;
  for (const row of data) {
    const count = Number(row.total_count);
    const totalMin = Number(row.total_duration_min);
    const avgMin = count > 0 ? totalMin / count : 0;

    await prisma.kpi_receive_monthly.upsert({
      where: {
        user_id_year_month: {
          user_id: row.user_id,
          year: row.year,
          month: row.month,
        },
      },
      update: {
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
        confirmed_count: Number(row.confirmed_count),
        rejected_count: Number(row.rejected_count),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        year: row.year,
        month: row.month,
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
        confirmed_count: Number(row.confirmed_count),
        rejected_count: Number(row.rejected_count),
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} monthly records`);
}

async function backfillYearly() {
  console.log("Backfilling receive yearly summaries...");

  const data = await prisma.$queryRaw<Array<{
    user_id: string;
    user_name: string | null;
    year: number;
    total_count: bigint;
    total_duration_min: number;
    on_time_count: bigint;
    late_count: bigint;
    confirmed_count: bigint;
    rejected_count: bigint;
  }>>`
    SELECT
      user_id,
      MAX(user_name) as user_name,
      EXTRACT(YEAR FROM confirmed_at)::integer as year,
      COUNT(*) as total_count,
      SUM(duration_minutes) as total_duration_min,
      SUM(CASE WHEN is_on_time = true THEN 1 ELSE 0 END) as on_time_count,
      SUM(CASE WHEN is_on_time = false THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN confirm_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
      SUM(CASE WHEN confirm_status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
    FROM receive_confirm_kpi_metric
    GROUP BY user_id, EXTRACT(YEAR FROM confirmed_at)
  `;

  let inserted = 0;
  for (const row of data) {
    const count = Number(row.total_count);
    const totalMin = Number(row.total_duration_min);
    const avgMin = count > 0 ? totalMin / count : 0;

    await prisma.kpi_receive_yearly.upsert({
      where: {
        user_id_year: {
          user_id: row.user_id,
          year: row.year,
        },
      },
      update: {
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
        confirmed_count: Number(row.confirmed_count),
        rejected_count: Number(row.rejected_count),
      },
      create: {
        user_id: row.user_id,
        user_name: row.user_name ?? row.user_id,
        year: row.year,
        total_count: count,
        total_duration_min: totalMin,
        avg_duration_min: avgMin,
        on_time_count: Number(row.on_time_count),
        late_count: Number(row.late_count),
        confirmed_count: Number(row.confirmed_count),
        rejected_count: Number(row.rejected_count),
      },
    });
    inserted++;
  }

  console.log(`  Inserted/Updated ${inserted} yearly records`);
}

async function main() {
  console.log("Starting KPI Receive Confirm Backfill...\n");

  try {
    const count = await prisma.receive_confirm_kpi_metric.count();
    console.log(`Found ${count} records in receive_confirm_kpi_metric\n`);

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
