import { useState, useMemo } from "react";
import { useRouter } from "next/router";
import { api } from "~/utils/api";

// Helper function สำหรับวันที่ (Default: วันนี้)
const getDefaultDateRange = () => {
  const now = new Date();
  const today = now.toISOString().split('T')[0];

  return {
    from: today,
    to: today,
  };
};

export default function POSyncHistoryPage() {
  const router = useRouter();
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [showFullSyncConfirm, setShowFullSyncConfirm] = useState(false);

  const { data, isLoading, error, refetch } = api.po.getSyncHistory.useQuery({
    dateFrom,
    dateTo,
  });

  const syncMutation = api.po.sync.useMutation({
    onSuccess: () => {
      void refetch();
      setShowFullSyncConfirm(false);
      alert('Full Sync สำเร็จ! รีเฟรชหน้าเพื่อดูผลลัพธ์');
    },
    onError: (error) => {
      alert(`Full Sync ล้มเหลว: ${error.message}`);
      setShowFullSyncConfirm(false);
    },
  });

  const handleFullSync = () => {
    setShowFullSyncConfirm(true);
  };

  const confirmFullSync = () => {
    syncMutation.mutate();
  };

  // Helper: แปลงเวลา UTC เป็นเวลาไทย
  const toThaiDateTime = (date: Date) => {
    return new Date(date).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Handle search
  const handleSearch = () => {
    void refetch();
  };

  // Filter เฉพาะ sync ที่สำเร็จ
  const successfulSessions = data?.sessions?.filter((session: any) => session.status === 'success') || [];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">กำลังโหลด...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600">เกิดข้อผิดพลาด: {error.message}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ประวัติการซิงค์ PO</h1>
            <p className="mt-1 text-sm text-gray-600">
              รายละเอียดการซิงค์ข้อมูล PO จาก SAP
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleFullSync}
              disabled={syncMutation.isPending}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
            >
              {syncMutation.isPending ? 'กำลัง Sync...' : '🔄 Full Sync'}
            </button>
            <button
              onClick={() => router.push('/po-tracking')}
              className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
            >
              ← กลับหน้าหลัก
            </button>
          </div>
        </div>

        {/* Full Sync Confirmation Modal */}
        {showFullSyncConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">ยืนยัน Full Sync</h3>
                  <p className="text-sm text-gray-600">กรุณาอ่านคำเตือนด้านล่าง</p>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-yellow-50 p-4 text-sm text-gray-700">
                <p className="mb-2 font-medium">⚠️ คำเตือน:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Full Sync จะดึงข้อมูล PO ทั้งหมดจาก SAP</li>
                  <li>อาจใช้เวลานาน 30-60 วินาที</li>
                  <li>ควรใช้เมื่อต้องการอัพเดตข้อมูล PO ล่าสุด</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmFullSync}
                  disabled={syncMutation.isPending}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
                >
                  {syncMutation.isPending ? 'กำลัง Sync...' : 'ยืนยัน Full Sync'}
                </button>
                <button
                  onClick={() => setShowFullSyncConfirm(false)}
                  disabled={syncMutation.isPending}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:bg-gray-100"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Date Filter */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">
                วันที่จาก
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700">
                วันที่ถึง
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              🔍 ค้นหา
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 text-sm text-gray-600">
          พบ <span className="font-medium">{successfulSessions.length}</span> รายการ
        </div>

        {/* Sync Sessions */}
        {successfulSessions.length > 0 ? (
          <div className="space-y-3">
            {successfulSessions.map((session: any) => {
              return (
                <div key={session.id} className="overflow-hidden rounded-lg bg-white shadow">
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      {/* Date/Time */}
                      <span className="font-semibold text-gray-900">
                        {toThaiDateTime(session.sync_date)}
                      </span>

                      <span className="text-gray-300">|</span>

                      {/* Sync Type Badge */}
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-purple-100 text-purple-800">
                        🌙 Full Sync
                      </span>

                      {/* Success Badge */}
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                        ✓ สำเร็จ
                      </span>

                      <span className="text-gray-300">|</span>

                      {/* Duration */}
                      <span className="text-gray-600 text-xs">
                        ⏱️ {session.duration_seconds} วินาที
                      </span>

                      <span className="text-gray-300">|</span>

                      {/* Records */}
                      <span className="text-gray-600 text-xs">
                        📦 {session.records_synced} records
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-white px-6 py-12 text-center shadow">
            <p className="text-gray-500">ไม่พบประวัติการซิงค์ในช่วงวันที่ที่เลือก</p>
          </div>
        )}
      </div>
    </main>
  );
}
