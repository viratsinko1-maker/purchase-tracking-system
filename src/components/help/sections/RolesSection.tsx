/**
 * Roles Section - ระบบ Role และสิทธิ์การใช้งาน
 */

export default function RolesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>🔐</span> ระบบ Role และสิทธิ์การใช้งาน
        </h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          ระบบมีการแบ่งสิทธิ์การใช้งานตาม Role (บทบาท) ของผู้ใช้ แต่ละ Role มีสิทธิ์ในการใช้งานที่แตกต่างกัน
        </p>
      </div>

      <div className="space-y-4">
        {/* Admin Role */}
        <RoleCard
          icon="👑"
          title="Admin (ผู้ดูแลระบบ)"
          subtitle="สิทธิ์สูงสุด ควบคุมทุกอย่างในระบบ"
          bgColor="purple"
          permissions={[
            { allowed: true, text: "ดู/ค้นหา/กรอง PR และ PO ได้ทั้งหมด" },
            { allowed: true, text: "ถามและตอบคำถามได้" },
            { allowed: true, text: "อนุมัติ PR ได้" },
            { allowed: true, text: "บันทึกการติดตาม PR ได้" },
            { allowed: true, text: "บันทึกสถานะการส่งของ PO ได้" },
            { allowed: true, text: "เปิดไฟล์แนบ PR และ PO ได้" },
            { allowed: true, text: "จัดการผู้ใช้ (เพิ่ม/แก้ไข/ลบ)", highlight: true },
            { allowed: true, text: "ดูประวัติการใช้งาน (Activity Trail)", highlight: true },
          ]}
        />

        {/* Approval Role */}
        <RoleCard
          icon="✅"
          title="Approval (ผู้อนุมัติ)"
          subtitle="อนุมัติ PR และจัดการระบบส่วนใหญ่"
          bgColor="pink"
          permissions={[
            { allowed: true, text: "ดู/ค้นหา/กรอง PR และ PO ได้ทั้งหมด" },
            { allowed: true, text: "อนุมัติ PR ได้", highlight: true },
            { allowed: true, text: "ถามและตอบคำถามได้" },
            { allowed: true, text: "บันทึกการติดตาม PR ได้" },
            { allowed: true, text: "แก้ไข PR Document Receipt ได้" },
            { allowed: true, text: "บันทึกสถานะการส่งของ PO ได้" },
            { allowed: true, text: "เปิดไฟล์แนบ PR และ PO ได้" },
            { allowed: false, text: "จัดการผู้ใช้ไม่ได้" },
            { allowed: false, text: "ดู Activity Trail ไม่ได้" },
          ]}
        />

        {/* Manager Role */}
        <RoleCard
          icon="👔"
          title="Manager (ผู้จัดการ)"
          subtitle="ตอบคำถามได้ แต่ถามไม่ได้"
          bgColor="blue"
          permissions={[
            { allowed: true, text: "ดู/ค้นหา/กรอง PR และ PO ได้ทั้งหมด" },
            { allowed: true, text: "ตอบคำถามในระบบ PR Q&A ได้", highlight: true },
            { allowed: true, text: "แก้ไข PR Document Receipt ได้" },
            { allowed: false, text: "ถามคำถามไม่ได้ (แต่อ่านได้)" },
            { allowed: false, text: "อนุมัติ PR ไม่ได้" },
            { allowed: true, text: "บันทึกสถานะการส่งของ PO ได้" },
            { allowed: true, text: "เปิดไฟล์แนบ PR และ PO ได้" },
            { allowed: false, text: "เข้าหน้าจัดการผู้ใช้ไม่ได้" },
          ]}
        />

        {/* POPR Role */}
        <RoleCard
          icon="📦"
          title="POPR (เจ้าหน้าที่ PO/PR)"
          subtitle="ดู PO ได้ แต่ตอบคำถามไม่ได้"
          bgColor="green"
          permissions={[
            { allowed: true, text: "ดู/ค้นหา/กรอง PR ได้ทั้งหมด" },
            { allowed: true, text: "เข้าหน้า PO Tracking ได้", highlight: true },
            { allowed: true, text: "เปิด PO Detail ได้ (แต่ไฟล์แนบ PO กดไม่ได้)", highlight: true },
            { allowed: true, text: "ถามคำถามในระบบ PR Q&A ได้" },
            { allowed: false, text: "ตอบคำถามไม่ได้ (แต่อ่านได้)" },
            { allowed: false, text: "อนุมัติ PR ไม่ได้" },
            { allowed: false, text: "เปิดไฟล์แนบ PO ไม่ได้ (เห็นชื่อไฟล์เท่านั้น)" },
            { allowed: true, text: "เปิดไฟล์แนบ PR ได้" },
          ]}
        />

        {/* PR Role */}
        <RoleCard
          icon="📋"
          title="PR (เจ้าหน้าที่ PR)"
          subtitle="ดู PR ได้ เข้า PO ไม่ได้"
          bgColor="orange"
          permissions={[
            { allowed: true, text: "ดู/ค้นหา/กรอง PR ได้ทั้งหมด" },
            { allowed: true, text: "ถามคำถามในระบบ PR Q&A ได้" },
            { allowed: true, text: "เปิดไฟล์แนบ PR ได้" },
            { allowed: false, text: "ตอบคำถามไม่ได้ (แต่อ่านได้)" },
            { allowed: false, text: "อนุมัติ PR ไม่ได้" },
            { allowed: false, text: "เข้าหน้า PO Tracking ไม่ได้" },
            { allowed: false, text: "เปิด PO Detail ไม่ได้ (เห็นเลข PO เป็นสีเทา กดไม่ได้)" },
          ]}
        />
      </div>

      {/* ตารางเปรียบเทียบ */}
      <PermissionComparisonTable />

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <p className="text-sm text-blue-800">
          💡 <strong>หมายเหตุ:</strong> ถ้าพยายามเข้าหน้าที่ไม่มีสิทธิ์ ระบบจะแจ้งเตือนและนำกลับไปหน้า PR Tracking
        </p>
      </div>
    </div>
  );
}

// Role Card Component
interface Permission {
  allowed: boolean;
  text: string;
  highlight?: boolean;
}

interface RoleCardProps {
  icon: string;
  title: string;
  subtitle: string;
  bgColor: 'purple' | 'pink' | 'blue' | 'green' | 'orange';
  permissions: Permission[];
}

function RoleCard({ icon, title, subtitle, bgColor, permissions }: RoleCardProps) {
  const colors = {
    purple: { border: 'border-purple-200', bg: 'from-purple-50 to-purple-100', title: 'text-purple-900', subtitle: 'text-purple-700', highlight: 'text-purple-700' },
    pink: { border: 'border-pink-200', bg: 'from-pink-50 to-pink-100', title: 'text-pink-900', subtitle: 'text-pink-700', highlight: 'text-pink-700' },
    blue: { border: 'border-blue-200', bg: 'from-blue-50 to-blue-100', title: 'text-blue-900', subtitle: 'text-blue-700', highlight: 'text-blue-700' },
    green: { border: 'border-green-200', bg: 'from-green-50 to-green-100', title: 'text-green-900', subtitle: 'text-green-700', highlight: 'text-green-700' },
    orange: { border: 'border-orange-200', bg: 'from-orange-50 to-orange-100', title: 'text-orange-900', subtitle: 'text-orange-700', highlight: 'text-orange-700' },
  };
  const c = colors[bgColor];

  return (
    <div className={`border-2 ${c.border} rounded-lg p-5 bg-gradient-to-r ${c.bg}`}>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <h3 className={`text-xl font-bold ${c.title}`}>{title}</h3>
          <p className={`text-sm ${c.subtitle}`}>{subtitle}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 mt-3">
        <h4 className={`font-semibold ${c.title} mb-3`}>สิทธิ์การใช้งาน:</h4>
        <ul className="space-y-2 text-gray-700">
          {permissions.map((p, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className={p.allowed ? "text-green-500" : "text-red-500"}>
                {p.allowed ? "✓" : "✗"}
              </span>
              <span className={`${!p.allowed ? 'text-gray-500' : ''} ${p.highlight ? `font-semibold ${c.highlight}` : ''}`}>
                {p.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Permission Comparison Table
function PermissionComparisonTable() {
  const features = [
    { name: "ดู PR Tracking", admin: true, approval: true, manager: true, popr: true, pr: true },
    { name: "ดู PO Tracking", admin: true, approval: true, manager: true, popr: true, pr: false },
    { name: "อนุมัติ PR", admin: true, approval: true, manager: false, popr: false, pr: false },
    { name: "ถามคำถาม", admin: true, approval: true, manager: false, popr: true, pr: true },
    { name: "ตอบคำถาม", admin: true, approval: true, manager: true, popr: false, pr: false },
    { name: "เปิดไฟล์แนบ PR", admin: true, approval: true, manager: true, popr: true, pr: true },
    { name: "เปิดไฟล์แนบ PO", admin: true, approval: true, manager: true, popr: false, pr: false },
    { name: "จัดการผู้ใช้", admin: true, approval: false, manager: false, popr: false, pr: false },
    { name: "ดู Activity Trail", admin: true, approval: false, manager: false, popr: false, pr: false },
  ];

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <h3 className="font-semibold text-gray-900 mb-4">📊 ตารางเปรียบเทียบสิทธิ์:</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">ฟีเจอร์</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-purple-700">Admin</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-pink-700">Approval</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-blue-700">Manager</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-green-700">POPR</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-orange-700">PR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {features.map((f, i) => (
              <tr key={i} className={i % 2 === 1 ? "bg-gray-50" : ""}>
                <td className="px-4 py-3 text-sm text-gray-700">{f.name}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-lg ${f.admin ? "text-green-600" : "text-red-600"}`}>{f.admin ? "✓" : "✗"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-lg ${f.approval ? "text-green-600" : "text-red-600"}`}>{f.approval ? "✓" : "✗"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-lg ${f.manager ? "text-green-600" : "text-red-600"}`}>{f.manager ? "✓" : "✗"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-lg ${f.popr ? "text-green-600" : "text-red-600"}`}>{f.popr ? "✓" : "✗"}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-lg ${f.pr ? "text-green-600" : "text-red-600"}`}>{f.pr ? "✓" : "✗"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
