/**
 * Sync Modals Component
 * Contains loading, confirm, success, and error modals for sync operations
 */

interface SyncModalsProps {
  /** Whether syncing modal is shown */
  showSyncingModal: boolean;
  /** Whether confirm sync modal is shown */
  showConfirmSync: boolean;
  /** Whether success modal is shown */
  showSuccessModal: boolean;
  /** Whether error modal is shown */
  showErrorModal: boolean;
  /** Error message to display */
  errorMessage: string;
  /** Callback when confirm sync is cancelled */
  onCancelSync: () => void;
  /** Callback when sync is confirmed */
  onConfirmSync: () => void;
  /** Callback when success modal is closed */
  onCloseSuccess: () => void;
  /** Callback when error modal is closed */
  onCloseError: () => void;
}

export default function SyncModals({
  showSyncingModal,
  showConfirmSync,
  showSuccessModal,
  showErrorModal,
  errorMessage,
  onCancelSync,
  onConfirmSync,
  onCloseSuccess,
  onCloseError,
}: SyncModalsProps) {
  return (
    <>
      {/* Loading Modal - แสดงเมื่อกำลัง Sync */}
      {showSyncingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              <h3 className="mt-4 text-lg font-bold text-gray-900">กำลังโหลดข้อมูล...</h3>
              <p className="mt-2 text-sm text-gray-600 text-center">กรุณารอสักครู่ ระบบกำลังดึงข้อมูลจาก SAP</p>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Sync Modal */}
      {showConfirmSync && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">ยืนยันการ Sync</h3>
            <p className="mt-2 text-gray-600">คุณต้องการ Sync ข้อมูลใหม่จาก SAP หรือไม่?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={onCancelSync}
                className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
              >
                ยกเลิก
              </button>
              <button
                onClick={onConfirmSync}
                className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-green-600">Sync สำเร็จ</h3>
            <p className="mt-2 text-gray-600">ข้อมูลได้รับการอัพเดตเรียบร้อยแล้ว</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onCloseSuccess}
                className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {showErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-red-600">เกิดข้อผิดพลาด</h3>
            <p className="mt-2 text-gray-600">{errorMessage}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onCloseError}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
