/**
 * Overview Section - ภาพรวมระบบ PR Tracking
 */

export default function OverviewSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📋</span> ภาพรวมระบบ PR Tracking
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          ระบบ PR Tracking เป็นระบบสำหรับติดตามสถานะของใบขอซื้อ (Purchase Request - PR)
          ตั้งแต่เปิด PR จนถึงการออก PO (Purchase Order) พร้อมระบบบันทึกการติดตามงาน
        </p>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">ฟีเจอร์หลัก:</h3>
        <ul className="space-y-2 text-blue-800">
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>ค้นหาและกรอง PR ตามเงื่อนไขต่างๆ</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>ดูสถานะความคืบหน้า (มี PO หรือยัง)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>บันทึกการติดตามพร้อมระดับความเร่งด่วน</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>ถามตอบคำถามระหว่างทีม (PR Q&A)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>อนุมัติ PR ออนไลน์</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>ดูรายละเอียด PR, PO และไฟล์แนบ</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500">✓</span>
            <span>ซิงค์ข้อมูลจาก SAP อัตโนมัติ</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
