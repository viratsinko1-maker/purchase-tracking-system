import type { NextApiRequest, NextApiResponse } from "next";
import { db } from "~/server/db";
import { withMethodPermissions } from "~/server/api/middleware/withPermission";

// Default roles to seed
const DEFAULT_ROLES = [
  { name: "ผู้ดูแลระบบ", code: "Admin", priority: 1, description: "สิทธิ์สูงสุด สามารถจัดการทุกอย่างในระบบ" },
  { name: "ผู้อนุมัติ", code: "Approval", priority: 2, description: "อนุมัติ PR และ PO" },
  { name: "ผู้จัดการ", code: "Manager", priority: 3, description: "จัดการและดูรายงาน" },
  { name: "จัดซื้อ", code: "POPR", priority: 4, description: "สร้างและจัดการ PR/PO" },
  { name: "คลังสินค้า", code: "Warehouse", priority: 5, description: "รับของและจัดการคลัง" },
  { name: "ทั่วไป", code: "PR", priority: 6, description: "สร้าง PR และดูข้อมูลพื้นฐาน" },
];

async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // GET - List all roles
    if (req.method === "GET") {
      const roles = await db.system_role.findMany({
        orderBy: { priority: "asc" },
      });
      return res.status(200).json({ roles });
    }

    // POST - Create role or seed defaults
    if (req.method === "POST") {
      const { action, name, code, priority, description, isActive } = req.body;

      // Seed default roles
      if (action === "seed") {
        let created = 0;
        let skipped = 0;

        for (const role of DEFAULT_ROLES) {
          // Check if role with same code already exists
          const existing = await db.system_role.findUnique({
            where: { code: role.code },
          });

          if (existing) {
            skipped++;
            continue;
          }

          // Check if priority is already taken
          const existingPriority = await db.system_role.findUnique({
            where: { priority: role.priority },
          });

          const actualPriority = existingPriority
            ? (await db.system_role.findMany()).length + created + 1
            : role.priority;

          await db.system_role.create({
            data: {
              name: role.name,
              code: role.code,
              priority: actualPriority,
              description: role.description,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          created++;
        }

        return res.status(200).json({
          success: true,
          message: `เพิ่ม Role เริ่มต้น ${created} รายการ (ข้าม ${skipped} รายการที่มีอยู่แล้ว)`,
        });
      }

      // Create new role
      if (!name || !code || priority === undefined) {
        return res.status(400).json({ error: "กรุณาระบุข้อมูลให้ครบถ้วน (name, code, priority)" });
      }

      // Check if code already exists
      const existingCode = await db.system_role.findUnique({
        where: { code },
      });
      if (existingCode) {
        return res.status(400).json({ error: `รหัส "${code}" มีอยู่แล้ว` });
      }

      // Check if name already exists
      const existingName = await db.system_role.findUnique({
        where: { name },
      });
      if (existingName) {
        return res.status(400).json({ error: `ชื่อ "${name}" มีอยู่แล้ว` });
      }

      // Check if priority already exists
      const existingPriority = await db.system_role.findUnique({
        where: { priority: parseInt(priority) },
      });
      if (existingPriority) {
        return res.status(400).json({ error: `ลำดับ ${priority} มี Role อื่นใช้อยู่แล้ว (${existingPriority.name})` });
      }

      const role = await db.system_role.create({
        data: {
          name,
          code,
          priority: parseInt(priority),
          description: description || null,
          isActive: isActive !== false,
          updatedAt: new Date(),
        },
      });

      return res.status(201).json({ success: true, role });
    }

    // PUT - Update role
    if (req.method === "PUT") {
      const { id, name, code, priority, description, isActive } = req.body;

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ ID ของ Role" });
      }

      // Check if role exists
      const existingRole = await db.system_role.findUnique({
        where: { id: parseInt(id) },
      });
      if (!existingRole) {
        return res.status(404).json({ error: "ไม่พบ Role นี้" });
      }

      // Check if code already exists (for other roles)
      if (code && code !== existingRole.code) {
        const existingCode = await db.system_role.findFirst({
          where: {
            code,
            id: { not: parseInt(id) },
          },
        });
        if (existingCode) {
          return res.status(400).json({ error: `รหัส "${code}" มี Role อื่นใช้อยู่แล้ว` });
        }
      }

      // Check if name already exists (for other roles)
      if (name && name !== existingRole.name) {
        const existingName = await db.system_role.findFirst({
          where: {
            name,
            id: { not: parseInt(id) },
          },
        });
        if (existingName) {
          return res.status(400).json({ error: `ชื่อ "${name}" มี Role อื่นใช้อยู่แล้ว` });
        }
      }

      // Check if priority already exists (for other roles)
      if (priority !== undefined && parseInt(priority) !== existingRole.priority) {
        const existingPriority = await db.system_role.findFirst({
          where: {
            priority: parseInt(priority),
            id: { not: parseInt(id) },
          },
        });
        if (existingPriority) {
          return res.status(400).json({ error: `ลำดับ ${priority} มี Role อื่นใช้อยู่แล้ว (${existingPriority.name})` });
        }
      }

      const role = await db.system_role.update({
        where: { id: parseInt(id) },
        data: {
          name: name || existingRole.name,
          code: code || existingRole.code,
          priority: priority !== undefined ? parseInt(priority) : existingRole.priority,
          description: description !== undefined ? (description || null) : existingRole.description,
          isActive: isActive !== undefined ? isActive : existingRole.isActive,
          updatedAt: new Date(),
        },
      });

      return res.status(200).json({ success: true, role });
    }

    // DELETE - Delete role
    if (req.method === "DELETE") {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: "ไม่พบ ID ของ Role" });
      }

      // Check if role exists
      const existingRole = await db.system_role.findUnique({
        where: { id: parseInt(id) },
      });
      if (!existingRole) {
        return res.status(404).json({ error: "ไม่พบ Role นี้" });
      }

      await db.system_role.delete({
        where: { id: parseInt(id) },
      });

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    console.error("Roles API error:", error);
    return res.status(500).json({ error: "เกิดข้อผิดพลาดภายในระบบ" });
  }
}

// Apply permission middleware - protect admin roles management
export default withMethodPermissions(handler, {
  GET: { tableName: 'admin_roles', action: 'read' },
  POST: { tableName: 'admin_roles', action: 'create' },  // Also handles seed action
  PUT: { tableName: 'admin_roles', action: 'update' },
  DELETE: { tableName: 'admin_roles', action: 'delete' },
});
