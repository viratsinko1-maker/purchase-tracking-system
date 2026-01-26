/**
 * Sync Section - Sync ข้อมูล
 */

export default function SyncSection() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>🔄</span> Sync ข้อมูล
        </h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          ระบบจะซิงค์ข้อมูลจาก SAP มายัง PR Tracking อัตโนมัติ
        </p>
      </div>

      <div className="space-y-4">
        {/* Auto Sync */}
        <div className="border border-green-200 rounded-lg p-4 bg-green-50">
          <h3 className="font-semibold text-green-900 mb-3">🤖 Auto Sync (อัตโนมัติ):</h3>
          <div className="space-y-3">
            <div>
              <p className="font-medium text-green-900 mb-2">📊 PR/PO Full Sync:</p>
              <p className="text-sm text-green-800 mb-2">ซิงค์ข้อมูล PR และ PO ทุก 2 ชั่วโมง</p>
            </div>
            <div>
              <p className="font-medium text-green-900 mb-2">📎 Attachment Sync:</p>
              <ul className="space-y-1 text-sm text-green-800 ml-4">
                <li>• Regular: ทุก 2 ชั่วโมงที่นาทีที่ 30</li>
                <li>• Midnight Full Refresh: ทุกวันเวลา 00:00 น.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Manual Sync */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 mb-3">🔧 Manual Sync (กดเอง):</h3>
          <ol className="space-y-2 text-gray-700">
            <li>1. กดปุ่ม "🔄 Sync ข้อมูล" มุมบนขวา</li>
            <li>2. ยืนยันการ Sync</li>
            <li>3. รอจนกว่าจะเสร็จ (จะมีข้อความแจ้งเมื่อซิงค์เสร็จ)</li>
          </ol>
        </div>

        {/* ดูประวัติ Sync */}
        <div className="border border-gray-200 rounded-lg p-4 bg-blue-50">
          <h3 className="font-semibold text-blue-900 mb-3">📊 ดูประวัติ Sync:</h3>
          <p className="text-blue-800 mb-3">กดปุ่ม "📋 ประวัติ Sync" เพื่อดูประวัติการซิงค์ข้อมูล</p>
          <ul className="space-y-1 text-sm text-blue-800 ml-4">
            <li>• วันเวลาที่ Sync</li>
            <li>• จำนวนข้อมูลที่ซิงค์</li>
            <li>• เวลาที่ใช้</li>
            <li>• สถานะ (สำเร็จ/ล้มเหลว)</li>
          </ul>
        </div>
      </div>

      <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>ข้อควรระวัง:</strong> ห้ามกด Manual Sync ขณะที่ Auto Sync กำลังทำงานอยู่
        </p>
      </div>
    </div>
  );
}
