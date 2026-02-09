import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('Clearing 4 KPI usage tables...');

  const d = await db.kpi_usage_daily.deleteMany();
  const w = await db.kpi_usage_weekly.deleteMany();
  const m = await db.kpi_usage_monthly.deleteMany();
  const y = await db.kpi_usage_yearly.deleteMany();

  console.log('Deleted kpi_usage_daily:', d.count);
  console.log('Deleted kpi_usage_weekly:', w.count);
  console.log('Deleted kpi_usage_monthly:', m.count);
  console.log('Deleted kpi_usage_yearly:', y.count);

  // Verify
  const dc = await db.kpi_usage_daily.count();
  const wc = await db.kpi_usage_weekly.count();
  const mc = await db.kpi_usage_monthly.count();
  const yc = await db.kpi_usage_yearly.count();

  console.log('\nVerification (all should be 0):');
  console.log('kpi_usage_daily:', dc);
  console.log('kpi_usage_weekly:', wc);
  console.log('kpi_usage_monthly:', mc);
  console.log('kpi_usage_yearly:', yc);

  await db.$disconnect();
}

main();
