/**
 * Search Filter Section - การค้นหาและกรอง PR
 */

export default function SearchFilterSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>🔍</span> การค้นหาและกรอง PR
        </h2>
      </div>

      <div className="space-y-4">
        {/* การค้นหา */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4">🔍 วิธีการค้นหา PR:</h3>
          <div className="space-y-3">
            <div className="bg-blue-50 p-3 rounded">
              <h4 className="font-medium text-blue-900">1. ค้นหาด้วยเลข PR</h4>
              <p className="text-sm text-blue-700">พิมพ์เลข PR หรือบางส่วน เช่น "251010125"</p>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <h4 className="font-medium text-blue-900">2. ค้นหาด้วยชื่อผู้เปิด PR</h4>
              <p className="text-sm text-blue-700">พิมพ์ชื่อหรือนามสกุล เช่น "สมชาย"</p>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <h4 className="font-medium text-blue-900">3. ค้นหาด้วยชื่อโครงการ/งาน</h4>
              <p className="text-sm text-blue-700">พิมพ์ชื่อโครงการ เช่น "ซ่อมเครื่องจักร"</p>
            </div>
            <div className="bg-blue-50 p-3 rounded">
              <h4 className="font-medium text-blue-900">4. ค้นหาจากหมายเหตุการติดตาม</h4>
              <p className="text-sm text-blue-700">พิมพ์คำที่มีในหมายเหตุ เช่น "รอราคา"</p>
            </div>
          </div>
        </div>

        {/* การกรอง */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4">🎯 ตัวกรองข้อมูล:</h3>
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">📅 กรองตามวันที่:</h4>
              <p className="text-sm text-gray-600 ml-4">เลือกช่วงวันที่ที่ต้องการดู (ตั้งค่าเริ่มต้นเป็นเดือนปัจจุบัน)</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">📊 กรองตามสถานะ PR:</h4>
              <ul className="text-sm text-gray-700 ml-4 space-y-1">
                <li>• Open - PR ที่ยังเปิดอยู่</li>
                <li>• Closed - PR ที่ปิดแล้ว</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">📦 กรองตามสถานะ PO:</h4>
              <ul className="text-sm text-gray-700 ml-4 space-y-1">
                <li>• ไม่มี PO เลย - PR ที่ยังไม่ได้ออก PO</li>
                <li>• PO ยังไม่ครบ - PR ที่ออก PO บางรายการ</li>
                <li>• PO ครบ - PR ที่ออก PO ครบทุกรายการ (100%)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">⚡ กรองตามความเร่งด่วน:</h4>
              <ul className="text-sm text-gray-700 ml-4 space-y-1">
                <li>• ด่วนที่สุด - งานเร่งด่วนมาก</li>
                <li>• ด่วน - งานค่อนข้างเร่ง</li>
                <li>• ปกติ - งานปกติทั่วไป</li>
                <li>• ปิดแล้ว - งานเสร็จแล้ว</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
        <p className="text-sm text-yellow-800">
          💡 <strong>เคล็ดลับ:</strong> สามารถใช้หลายเงื่อนไขร่วมกันได้ เช่น เลือกวันที่ + พิมพ์ชื่อผู้เปิด
        </p>
      </div>
    </div>
  );
}
