import { useState, useMemo, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";
import { usePagePermission } from "~/hooks/usePermission";
import PODetailModal from "~/components/PODetailModal";

// Import shared utils
import { getDefaultDateRange } from "~/utils/dateUtils";
import { formatName } from "~/utils/formatters";
import { getDeliveryStatusStyle, getDeliveryBgStyle, getDeliveryBorderStyle } from "~/utils/deliveryStyles";

export default function POTracking() {
  const router = useRouter();
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  // State ธรรมดา
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(true);

  // Check permission access using permission system
  const { canAccess, loading: permLoading } = usePagePermission('/po-tracking');

  useEffect(() => {
    if (!permLoading && !canAccess) {
      void router.push('/pr-tracking?error=no_permission');
    }
  }, [canAccess, permLoading, router]);
  const [showConfirmSync, setShowConfirmSync] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSyncingModal, setShowSyncingModal] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);
  const wasAutoSyncingRef = useRef(false);

  // Modal state
  const [selectedPONo, setSelectedPONo] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ดึงข้อมูล PO Summary
  const { data, isLoading, refetch } = api.po.getAllSummary.useQuery(
    {
      search: search || undefined,
      status: statusFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    { enabled: shouldFetch }
  );

  // ดึง Latest Delivery Trackings สำหรับ PO ทั้งหมด
  const poNumbers = data?.data.map(po => po.doc_num) || [];
  const { data: trackingsMap } = api.po.getLatestDeliveryTrackings.useQuery(
    { poNumbers },
    { enabled: poNumbers.length > 0 }
  );

  // Polling สำหรับตรวจสอบสถานะ Auto-Sync
  const { data: syncStatus } = api.sync.getStatus.useQuery(undefined, {
    refetchInterval: 5000, // Poll ทุก 5 วินาที
    refetchIntervalInBackground: true,
  });

  // ตรวจสอบว่า Auto-Sync เสร็จสิ้นหรือไม่ และ auto-refresh
  useEffect(() => {
    if (!syncStatus) return;

    const currentlyAutoSyncing = syncStatus.isInProgress;

    // อัพเดท state
    setIsAutoSyncing(currentlyAutoSyncing);

    // ถ้า auto-sync เพิ่งเสร็จ (เปลี่ยนจาก true -> false)
    if (wasAutoSyncingRef.current && !currentlyAutoSyncing) {
      console.log('[PO-TRACKING] Auto-sync completed, refreshing data...');
      if (shouldFetch) {
        void refetch();
      }
    }

    // เก็บสถานะปัจจุบันไว้เช็คครั้งต่อไป
    wasAutoSyncingRef.current = currentlyAutoSyncing;
  }, [syncStatus, shouldFetch, refetch]);

  // ฟังก์ชันค้นหา
  const handleSearch = () => {
    setShouldFetch(true);
    if (shouldFetch) {
      void refetch();
    }
  };

  // Sync mutation
  const syncMutation = api.po.sync.useMutation({
    onSuccess: async () => {
      setIsSyncing(false);
      setShowSyncingModal(false);
      if (shouldFetch) {
        await refetch();
      }
      setShowSuccessModal(true);
    },
    onError: (error) => {
      setIsSyncing(false);
      setShowSyncingModal(false);
      setErrorMessage(error.message);
      setShowErrorModal(true);
    },
  });

  const handleSync = () => {
    // ถ้า auto-sync กำลังทำงานอยู่ ให้แสดง warning แทน
    if (isAutoSyncing) {
      setErrorMessage("⚠️ ระบบกำลังทำงานอัตโนมัติอยู่ กรุณารอให้เสร็จก่อน");
      setShowErrorModal(true);
      return;
    }
    setShowConfirmSync(true);
  };

  const confirmSync = () => {
    setShowConfirmSync(false);
    setIsSyncing(true);
    setShowSyncingModal(true);
    syncMutation.mutate();
  };

  const handleReset = () => {
    setSearch("");
    setStatusFilter("");
    setDateFrom(defaultDates.from);
    setDateTo(defaultDates.to);
    setShouldFetch(true);
  };

  // เปิด Modal
  const openModal = (poNo: number) => {
    setSelectedPONo(poNo);
    setIsModalOpen(true);
  };

  const formatNumber = (num: number | null | undefined) => {
    if (!num && num !== 0) return "0";
    return num.toLocaleString("th-TH");
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <>
      <Head>
        <title>PO Tracking System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">PO Tracking System</h1>

            {/* ปุ่มด้านขวา: PR Tracking */}
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/pr-tracking')}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 active:bg-blue-800 transition shadow"
              >
                📄 PR Tracking
              </button>
            </div>
          </div>
        </div>

        {/* Filter Section - Sticky */}
        <div className="sticky top-0 z-10 mb-4 sm:mb-6 rounded-lg bg-white p-4 sm:p-6 shadow">
          <div className="space-y-3">
            {/* แถวที่ 1: วันที่ */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700 mb-1">วันที่จาก</label>
                <input
                  type="date"
                  id="dateFrom"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700 mb-1">วันที่ถึง</label>
                <input
                  type="date"
                  id="dateTo"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* แถวที่ 2: Filter ทั้งหมดในแถวเดียว */}
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end sm:gap-2 sm:flex-wrap">
              {/* สถานะ */}
              <div className="sm:w-32">
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select
                  id="status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="O">Open</option>
                  <option value="C">Closed</option>
                </select>
              </div>

              {/* ค้นหา */}
              <div className="sm:flex-1 col-span-2">
                <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">ค้นหา</label>
                <input
                  type="text"
                  id="search"
                  placeholder="PO No, PR No..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* ปุ่มต่างๆ */}
              <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-span-1 sm:flex">
                <button
                  onClick={handleSearch}
                  disabled={isLoading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-400 active:bg-blue-800 transition"
                >
                  {isLoading ? "ค้นหา..." : "🔍"}
                </button>
                <button
                  onClick={handleSync}
                  disabled={isSyncing || isAutoSyncing}
                  className={`rounded-md px-4 py-2 text-sm font-medium text-white transition ${
                    isAutoSyncing
                      ? "bg-orange-600 hover:bg-orange-700 active:bg-orange-800"
                      : "bg-green-600 hover:bg-green-700 active:bg-green-800"
                  } disabled:bg-gray-400`}
                  title={isAutoSyncing ? "ระบบกำลังทำงานอัตโนมัติอยู่" : "Sync ข้อมูลจาก SAP"}
                >
                  {isSyncing ? "ซิงค์..." : isAutoSyncing ? "⏳" : "🔄"}
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition"
                >
                  รีเซ็ต
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PO Cards - Grid 3 columns */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            </div>
          ) : data && data.data && data.data.length > 0 ? (
            data.data.map((po: any) => {
              const tracking = trackingsMap?.get ? trackingsMap.get(po.doc_num) : null;

              return (
                <div
                  key={po.doc_num}
                  onClick={() => openModal(po.doc_num)}
                  className={`cursor-pointer rounded-lg bg-white p-4 shadow transition hover:shadow-lg active:shadow-md ${tracking ? getDeliveryBorderStyle(tracking.delivery_status) : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-blue-600">PO #{po.doc_num}</h3>
                        <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          po.doc_status === "O" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}>
                          {po.doc_status === "O" ? "Open" : "Closed"}
                        </span>

                        {/* แสดง Canceled badge */}
                        {po.canceled === "Y" && (
                          <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-red-100 text-red-800">
                            ยกเลิก
                          </span>
                        )}

                        {/* แสดงสถานะการส่งของ */}
                        {tracking && (
                          <span className={`inline-block rounded px-3 py-1 text-xs font-medium border ${getDeliveryStatusStyle(tracking.delivery_status)}`}>
                            {tracking.delivery_status}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm text-gray-600">
                        สร้างเมื่อ: {formatDate(po.doc_date)}
                      </p>
                      {po.doc_due_date && (
                        <p className="text-xs text-gray-500">
                          ครบกำหนด: {formatDate(po.doc_due_date)}
                        </p>
                      )}

                      {/* แสดงหมายเหตุและผู้ติดตาม */}
                      {tracking && (tracking.note || tracking.tracked_by) && (
                        <div className={`mt-3 ml-auto w-1/2 rounded-lg px-3 py-2 overflow-hidden ${getDeliveryBgStyle(tracking.delivery_status)}`}>
                          {/* หมายเหตุ */}
                          {tracking.note && (
                            <p className="text-sm italic line-clamp-3 break-words" title={tracking.note}>
                              💬 {tracking.note}
                            </p>
                          )}
                          {/* ผู้ติดตาม */}
                          {tracking.tracked_by && (
                            <p className="mt-1 text-xs truncate block" title={tracking.tracked_by}>
                              👤 ติดตามโดย: {formatName(tracking.tracked_by)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-3 text-xs flex-wrap">
                      <div>
                        <span className="text-gray-600">รายการ:</span>{" "}
                        <span className="font-medium">{formatNumber(po.total_lines)}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">จำนวน:</span>{" "}
                        <span className="font-medium">{formatNumber(po.total_quantity)}</span>
                      </div>
                      {po.pr_numbers && po.pr_numbers.length > 0 && (
                        <div>
                          <span className="text-gray-600">จาก PR:</span>{" "}
                          <span className="font-medium text-purple-600">
                            {po.pr_numbers.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full rounded-lg bg-white p-8 text-center text-gray-500 shadow">
              ไม่พบข้อมูล PO
            </div>
          )}
        </div>

        {/* PO Detail Modal */}
        {selectedPONo && (
          <PODetailModal
            poNo={selectedPONo}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedPONo(null);
              void refetch();
            }}
          />
        )}

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

        {/* Modals อื่นๆ */}
        {showConfirmSync && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold">ยืนยันการ Sync</h3>
              <p className="mt-2 text-gray-600">คุณต้องการ Sync ข้อมูล PO ใหม่จาก SAP หรือไม่?</p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowConfirmSync(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={confirmSync}
                  className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-green-600">✓ Sync สำเร็จ</h3>
              <p className="mt-2 text-gray-600">ข้อมูลได้รับการอัพเดตเรียบร้อยแล้ว</p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}

        {showErrorModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-red-600">✗ เกิดข้อผิดพลาด</h3>
              <p className="mt-2 text-gray-600">{errorMessage}</p>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
