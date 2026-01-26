/**
 * Attachment Section - ไฟล์แนบ
 */

export default function AttachmentSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>📎</span> ไฟล์แนบ
        </h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          ดูและเปิดไฟล์ที่แนบกับ PR หรือ PO
        </p>
      </div>

      <div className="space-y-4">
        {/* วิธีเปิดไฟล์ */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-4">วิธีเปิดไฟล์แนบ:</h3>
          <ol className="space-y-2 text-gray-700">
            <li>1. เปิดรายละเอียด PR (คลิกที่ PR Card)</li>
            <li>2. เลื่อนลงมาที่ส่วน "ไฟล์แนบ PR"</li>
            <li>3. คลิกที่ชื่อไฟล์ (ไฟล์จะเปิดในแท็บใหม่)</li>
          </ol>
        </div>

        {/* ประเภทไฟล์ */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">การแสดงผลตามประเภทไฟล์:</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-green-50 rounded">
              <span className="text-2xl">📄</span>
              <div>
                <p className="font-medium text-green-900">PDF</p>
                <p className="text-sm text-green-700">เปิดในเบราว์เซอร์ได้ทันที</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded">
              <span className="text-2xl">🖼️</span>
              <div>
                <p className="font-medium text-blue-900">รูปภาพ (JPG, PNG, GIF)</p>
                <p className="text-sm text-blue-700">เปิดในเบราว์เซอร์ได้ทันที</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-orange-50 rounded">
              <span className="text-2xl">📊</span>
              <div>
                <p className="font-medium text-orange-900">Excel (XLSX, XLS)</p>
                <p className="text-sm text-orange-700">ดาวน์โหลดไฟล์ → เปิดด้วย Excel</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-purple-50 rounded">
              <span className="text-2xl">📝</span>
              <div>
                <p className="font-medium text-purple-900">Word (DOC, DOCX)</p>
                <p className="text-sm text-purple-700">ดาวน์โหลดไฟล์ → เปิดด้วย Word</p>
              </div>
            </div>
          </div>
        </div>

        {/* สิทธิ์การเข้าถึง */}
        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
          <h3 className="font-semibold text-purple-900 mb-3">🔐 สิทธิ์การเปิดไฟล์:</h3>
          <ul className="space-y-2 text-purple-800">
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>ไฟล์แนบ PR:</strong> ทุก Role เปิดได้</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600">✓</span>
              <span><strong>ไฟล์แนบ PO:</strong> Admin, Approval และ Manager เท่านั้น</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-red-600">✗</span>
              <span><strong>POPR และ PR:</strong> เห็นชื่อไฟล์ PO ได้ แต่คลิกเปิดไม่ได้</span>
            </li>
          </ul>
        </div>

        {/* หมายเหตุ */}
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">📌 หมายเหตุสำคัญ:</h3>
          <ul className="space-y-2 text-gray-700">
            <li>• ไฟล์ทั้งหมดเก็บอยู่ใน Network Share (\\10.1.1.199\b1_shr)</li>
            <li>• ต้องเชื่อมต่อกับเครือข่ายบริษัทถึงจะเปิดไฟล์ได้</li>
            <li>• ถ้าไม่มีไฟล์แนบจะแสดงข้อความ "ไม่มีไฟล์แนบ"</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
