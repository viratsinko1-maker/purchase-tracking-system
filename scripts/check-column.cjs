const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  await p.$executeRawUnsafe("ALTER TABLE po_lines ADD COLUMN IF NOT EXISTS base_line INT");
  console.log('Column added successfully');
  const cols = await p.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_name = 'po_lines' ORDER BY ordinal_position");
  console.log('po_lines columns:', cols.map(c => c.column_name));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
