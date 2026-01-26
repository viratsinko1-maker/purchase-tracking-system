/**
 * Admin Section - Admin Features
 */

export default function AdminSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>👑</span> Admin Features
        </h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          ฟีเจอร์พิเศษสำหรับ Admin เท่านั้น
        </p>
      </div>

      <div className="space-y-4">
        {/* จัดการผู้ใช้ */}
        <div className="border-2 border-purple-200 rounded-lg p-5 bg-purple-50">
          <h3 className="font-semibold text-purple-900 mb-3 text-lg">👥 จัดการผู้ใช้</h3>
          <p className="text-purple-800 mb-3">Admin เท่านั้นที่สามารถจัดการผู้ใช้ได้</p>
          <ul className="space-y-2 text-purple-800">
            <li>• เพิ่มผู้ใช้ใหม่ (กำหนด Username, Password, Role)</li>
            <li>• แก้ไขข้อมูลผู้ใช้ (ชื่อ-นามสกุล, Role, รหัสผ่าน)</li>
            <li>• ลบผู้ใช้ (ไม่สามารถยกเลิกได้)</li>
            <li>• ดูข้อมูลผู้ใช้ทั้งหมด</li>
          </ul>
          <p className="text-sm text-purple-700 mt-3">📍 เข้าได้ที่: เมนู "จัดการผู้ใช้"</p>
        </div>

        {/* Activity Trail */}
        <div className="border-2 border-blue-200 rounded-lg p-5 bg-blue-50">
          <h3 className="font-semibold text-blue-900 mb-3 text-lg">🔔 Activity Trail</h3>
          <p className="text-blue-800 mb-3">Admin เท่านั้นที่สามารถดูประวัติการใช้งานได้</p>
          <ul className="space-y-2 text-blue-800">
            <li>• ดูประวัติ Login/Logout</li>
            <li>• ดูประวัติการแก้ไขข้อมูล (Create/Update/Delete)</li>
            <li>• ดูประวัติการ Sync</li>
            <li>• กรองตามวันที่, ผู้ใช้, ประเภทการกระทำ</li>
          </ul>
          <p className="text-sm text-blue-700 mt-3">📍 เข้าได้ที่: เมนู "Activity Trail" (Admin เท่านั้น)</p>
        </div>

        {/* Telegram Notification */}
        <div className="border-2 border-green-200 rounded-lg p-5 bg-green-50">
          <h3 className="font-semibold text-green-900 mb-3 text-lg">📱 การแจ้งเตือน Telegram</h3>
          <p className="text-green-800 mb-3">ระบบส่งการแจ้งเตือนผ่าน Telegram</p>
          <ul className="space-y-2 text-green-800">
            <li>• แจ้ง PR ที่ค้างนานกว่า 7 วัน (ทุกวันเวลา 09:00 น.)</li>
            <li>• แจ้งเมื่อ Sync เสร็จสิ้นหรือล้มเหลว</li>
            <li>• แจ้งเมื่อมี PR เร่งด่วน</li>
          </ul>
          <p className="text-sm text-green-700 mt-3">⚙️ การตั้งค่า: ติดต่อผู้ดูแลระบบ</p>
        </div>
      </div>
    </div>
  );
}
