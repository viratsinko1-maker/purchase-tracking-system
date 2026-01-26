/**
 * Features Section - ฟีเจอร์หลักของระบบ
 */

export default function FeaturesSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>✨</span> ฟีเจอร์หลักของระบบ
        </h2>
      </div>

      <div className="space-y-4">
        {/* PR Tracking */}
        <div className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
          <h3 className="font-semibold text-blue-900 mb-3 text-lg flex items-center gap-2">
            <span>📋</span> PR Tracking
          </h3>
          <p className="text-blue-800 mb-3">ติดตามสถานะ PR ตั้งแต่เปิดจนได้ PO</p>
          <ul className="space-y-2 text-blue-800">
            <li>• ดูสถานะ PR (Open/Closed)</li>
            <li>• ดูเปอร์เซ็นต์ที่ได้ PO แล้ว</li>
            <li>• บันทึกการติดตามพร้อมระดับความเร่งด่วน</li>
            <li>• ดูรายละเอียด PR และรายการสินค้า</li>
          </ul>
        </div>

        {/* PR Q&A */}
        <div className="border-2 border-purple-200 rounded-lg p-5 bg-purple-50">
          <h3 className="font-semibold text-purple-900 mb-3 text-lg flex items-center gap-2">
            <span>💬</span> PR Q&A
          </h3>
          <p className="text-purple-800 mb-3">ถามตอบคำถามระหว่างทีม</p>
          <ul className="space-y-2 text-purple-800">
            <li>• <strong>PR และ POPR:</strong> ถามคำถามได้</li>
            <li>• <strong>Manager:</strong> ตอบคำถามได้</li>
            <li>• <strong>Admin:</strong> ทำได้ทั้งถามและตอบ</li>
            <li>• กรองตามสถานะการตอบ (ตอบครบ/บางส่วน/ยังไม่ตอบ)</li>
          </ul>
        </div>

        {/* PR Overview */}
        <div className="border-2 border-green-200 rounded-lg p-5 bg-green-50">
          <h3 className="font-semibold text-green-900 mb-3 text-lg flex items-center gap-2">
            <span>📊</span> PR Overview
          </h3>
          <p className="text-green-800 mb-3">ภาพรวมและสถิติ PR</p>
          <ul className="space-y-2 text-green-800">
            <li>• สถิติ PR รายเดือน (Open/Closed)</li>
            <li>• จำนวน PR ที่มี/ไม่มี PO</li>
            <li>• กราฟแสดงแนวโน้ม</li>
            <li>• ตารางสรุปรายเดือน</li>
          </ul>
        </div>

        {/* PR Approval */}
        <div className="border-2 border-pink-200 rounded-lg p-5 bg-pink-50">
          <h3 className="font-semibold text-pink-900 mb-3 text-lg flex items-center gap-2">
            <span>✅</span> PR Approval
          </h3>
          <p className="text-pink-800 mb-3">อนุมัติ PR ออนไลน์ (Admin และ Approval เท่านั้น)</p>
          <ul className="space-y-2 text-pink-800">
            <li>• อนุมัติหรือปฏิเสธ PR</li>
            <li>• ระบุเหตุผล (ถ้าไม่อนุมัติ)</li>
            <li>• ดูสถานะการอนุมัติ (รออนุมัติ/อนุมัติแล้ว/ไม่อนุมัติ)</li>
            <li>• กรองตามสถานะการอนุมัติ</li>
          </ul>
        </div>

        {/* PO Tracking */}
        <div className="border-2 border-orange-200 rounded-lg p-5 bg-orange-50">
          <h3 className="font-semibold text-orange-900 mb-3 text-lg flex items-center gap-2">
            <span>📦</span> PO Tracking
          </h3>
          <p className="text-orange-800 mb-3">ติดตามใบสั่งซื้อ (PO)</p>
          <ul className="space-y-2 text-orange-800">
            <li>• ค้นหา PO ด้วยเลข PO หรือชื่อ Vendor</li>
            <li>• บันทึกสถานะการส่งของ (Admin และ Manager)</li>
            <li>• ดูรายการสินค้าใน PO</li>
            <li>• เปิดไฟล์แนบ PO (ยกเว้น POPR และ PR)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
