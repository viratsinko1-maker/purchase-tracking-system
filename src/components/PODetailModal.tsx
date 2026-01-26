import { useState, useEffect, Fragment } from "react";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";
import PRDetailModal from "./PRDetailModal";

interface PODetailModalProps {
  poNo: number;
  isOpen: boolean;
  onClose: () => void;
  hideTrackingButtons?: boolean;
}

export default function PODetailModal({ poNo, isOpen, onClose, hideTrackingButtons = false }: PODetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');

  // ดึงข้อมูล user ที่ล็อคอินอยู่
  const { user } = useAuth();

  // State สำหรับเปิด PR Detail Modal
  const [selectedPrNo, setSelectedPrNo] = useState<number | null>(null);

  // รีเซ็ต state เมื่อปิด modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedPrNo(null);
      setActiveTab('details');
      setShowTrackingForm(false);
    }
  }, [isOpen]);

  // ปิด modal นี้เมื่อเปิด nested modal (ป้องกัน stack เกิน 2 ชั้น)
  const handleOpenPrModal = (prNo: number) => {
    setSelectedPrNo(prNo);
    // ถ้าเป็น modal ที่ไม่มีปุ่มติดตาม (nested level 2) ให้ปิด parent modal
    if (hideTrackingButtons) {
      onClose();
    }
  };

  // State สำหรับฟอร์มบันทึกการส่งของ
  const [showTrackingForm, setShowTrackingForm] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState<'ปกติ' | 'ไม่ปกติ' | 'อื่นๆ'>('ปกติ');
  const [note, setNote] = useState('');
  const [trackedBy, setTrackedBy] = useState('');
  const [showSuccessWarning, setShowSuccessWarning] = useState(false);

  const utils = api.useUtils();

  // ดึงข้อมูล PO detail
  const { data: poData, isLoading } = api.po.getDetail.useQuery(
    { poNo },
    { enabled: isOpen && poNo > 0 }
  );

  // ดึงประวัติการติดตามการส่งของ
  const { data: trackingHistory } = api.po.getDeliveryTrackingHistory.useQuery(
    { poNo },
    { enabled: isOpen && poNo > 0 }
  );

  // ดึงไฟล์แนบ PO
  const { data: attachments } = api.po.getPOAttachments.useQuery(
    { poNo },
    { enabled: isOpen && poNo > 0 }
  );

  // ตั้งค่าชื่อผู้บันทึกเริ่มต้นเป็นชื่อผู้ใช้ที่ล็อคอินอยู่
  useEffect(() => {
    if (user?.name && !trackedBy) {
      setTrackedBy(user.name);
    }
  }, [user?.name]);

  // Mutation สำหรับบันทึก tracking
  const createTrackingMutation = api.po.createDeliveryTracking.useMutation({
    onSuccess: async () => {
      setDeliveryStatus('ปกติ');
      setNote('');
      setShowTrackingForm(false);
      await utils.po.getDeliveryTrackingHistory.invalidate({ poNo });
      setShowSuccessWarning(true);
    },
    onError: (error) => {
      alert(`✗ เกิดข้อผิดพลาด: ${error.message}`);
    },
  });

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatNumber = (num: number | null | undefined) => {
    if (!num && num !== 0) return "0";
    return num.toLocaleString("th-TH", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getDeliveryStatusStyle = (status: string) => {
    switch (status) {
      case 'ปกติ':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'ไม่ปกติ':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'อื่นๆ':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const handleSubmitTracking = (e: React.FormEvent) => {
    e.preventDefault();
    createTrackingMutation.mutate({
      poNo,
      deliveryStatus,
      note: note.trim() || undefined,
      trackedBy: trackedBy.trim() || undefined,
    });
  };

  const latestTracking = trackingHistory && trackingHistory.length > 0 ? trackingHistory[0] : null;

  if (!isOpen) return null;

  return (
    <Fragment>
      {/* PO Modal - แสดงตลอด แม้จะมี nested modal */}
      <div className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-2 ${hideTrackingButtons ? 'z-[60]' : 'z-50'}`}>
        {/* ขยาย modal ให้ใหญ่ขึ้นเกือบเต็มจอ */}
        <div className="relative w-[98vw] max-h-[98vh] overflow-hidden rounded-lg bg-gray-50 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">PO #{poNo}</h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 hover:bg-white/20 transition"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

        {/* Tabs */}
        {!hideTrackingButtons && (
          <div className="sticky top-[72px] z-10 border-b border-gray-200 bg-white">
            <div className="flex px-6">
              <button
                onClick={() => setActiveTab('details')}
                className={`px-6 py-3 text-sm font-medium transition ${
                  activeTab === 'details'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                รายละเอียด PO
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-3 text-sm font-medium transition ${
                  activeTab === 'history'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                ประวัติการส่งของ
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(98vh - 160px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            </div>
          ) : poData && poData.success ? (
            <>
              {/* Tab: รายละเอียด PO */}
              {(hideTrackingButtons || activeTab === 'details') && (
                <div className="space-y-6">
                  {/* PO Info */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">ข้อมูล PO</h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-sm text-gray-600">เลขที่ PO</p>
                        <p className="font-medium text-gray-900">PO #{poData.po.doc_num}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">สถานะ</p>
                        <p className="font-medium flex items-center gap-2">
                          <span className={`inline-block rounded px-2 py-1 text-sm ${
                            poData.po.doc_status === "O" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                          }`}>
                            {poData.po.doc_status === "O" ? "Open" : "Closed"}
                          </span>

                          {/* แสดง Canceled badge */}
                          {poData.po.canceled === "Y" && (
                            <span className="inline-block rounded px-2 py-1 text-sm bg-red-100 text-red-800 font-medium">
                              ยกเลิก
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">วันที่สร้าง</p>
                        <p className="font-medium text-gray-900">{formatDate(poData.po.doc_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">วันที่ครบกำหนด</p>
                        <p className="font-medium text-gray-900">{formatDate(poData.po.doc_due_date)}</p>
                      </div>
                      {poData.po.req_date && (
                        <div>
                          <p className="text-sm text-gray-600">วันที่ต้องการของ</p>
                          <p className="font-medium text-gray-900">{formatDate(poData.po.req_date)}</p>
                        </div>
                      )}
                      {poData.po.cancel_date && (
                        <div>
                          <p className="text-sm text-gray-600">วันที่ยกเลิก</p>
                          <p className="font-medium text-gray-900">{formatDate(poData.po.cancel_date)}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PO Lines */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">
                      รายการสินค้า ({poData.lines.length} รายการ)
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">#</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รหัสสินค้า</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายละเอียด</th>
                            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">จำนวน</th>
                            <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                            <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จาก PR</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {poData.lines.map((line: any) => (
                            <tr key={line.id} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">#{line.line_num + 1}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">{line.item_code || "-"}</td>
                              <td className="px-3 py-2 text-sm text-gray-600">
                                <div className="max-w-xs truncate" title={line.description || "-"}>
                                  {line.description || "-"}
                                </div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600 text-right">
                                {formatNumber(line.quantity)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-center">
                                <span className={`inline-block rounded px-2 py-1 text-xs ${
                                  line.line_status === "O" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                                }`}>
                                  {line.line_status === "O" ? "Open" : "Closed"}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-sm text-center">
                                {line.base_ref ? (
                                  <button
                                    onClick={() => handleOpenPrModal(line.base_ref)}
                                    className="font-semibold text-purple-600 hover:text-purple-800 hover:underline cursor-pointer transition"
                                  >
                                    PR #{line.base_ref}
                                  </button>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PO Attachments */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">ไฟล์แนบ PO</h3>
                    {attachments && attachments.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {attachments.map((attachment) => {
                          const originalFileUrl = `file://10.1.1.199/b1_shr/TMK/Attachments/${attachment.file_name}.${attachment.file_ext}`;
                          const apiFileUrl = `/api/attachment?path=${encodeURIComponent(originalFileUrl)}`;
                          const fullFileName = `${attachment.file_name}.${attachment.file_ext}`;

                          return (
                            <div key={attachment.id} className="flex items-center gap-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                              <svg className="h-5 w-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <div className="flex-1 flex items-center gap-2">
                                {user?.role === 'POPR' ? (
                                  <span className="text-sm font-medium text-gray-400 cursor-not-allowed truncate" title={fullFileName}>
                                    {fullFileName}
                                  </span>
                                ) : (
                                  <a
                                    href={apiFileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition truncate"
                                    title={fullFileName}
                                  >
                                    {fullFileName}
                                  </a>
                                )}
                                {attachment.uploaded_date && (
                                  <span className="text-xs text-gray-500 whitespace-nowrap">
                                    -- {formatDate(attachment.uploaded_date)}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        ไม่มีไฟล์แนบ
                      </div>
                    )}
                  </div>

                  {/* แสดงการติดตามล่าสุด (ถ้ามี) */}
                  {!hideTrackingButtons && latestTracking && (
                    <div className="rounded-lg bg-gradient-to-r from-green-50 to-green-100 p-6 shadow border-l-4 border-green-500">
                      <h3 className="mb-3 text-lg font-semibold text-gray-900">📦 การติดตามล่าสุด</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div>
                            <p className="text-sm text-gray-600">สถานะการส่งของ</p>
                            <span className={`inline-block rounded px-3 py-1 text-sm font-medium border mt-1 ${getDeliveryStatusStyle(latestTracking.delivery_status)}`}>
                              {latestTracking.delivery_status}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">ผู้บันทึก</p>
                            <p className="font-medium text-gray-900">{latestTracking.tracked_by || "-"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">วันเวลาที่บันทึก</p>
                            <p className="font-medium text-gray-900">{formatDateTime(latestTracking.tracked_at)}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">หมายเหตุ/เหตุผล</p>
                          <p className="font-medium text-gray-900">{latestTracking.note || "-"}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ปุ่มบันทึกการส่งของ */}
                  {!hideTrackingButtons && (
                    <div>
                      <button
                        onClick={() => setShowTrackingForm(!showTrackingForm)}
                        className="rounded-md bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition"
                      >
                        {showTrackingForm ? '✕ ปิดฟอร์ม' : '📝 บันทึกการส่งของ'}
                      </button>
                    </div>
                  )}

                  {/* ฟอร์มบันทึกการส่งของ */}
                  {!hideTrackingButtons && showTrackingForm && (
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h3 className="mb-4 text-lg font-semibold text-gray-900">บันทึกการส่งของ</h3>
                      <form onSubmit={handleSubmitTracking} className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          {/* สถานะการส่งของ */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              สถานะการส่งของ *
                            </label>
                            <div className="space-y-2">
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name="deliveryStatus"
                                  value="ปกติ"
                                  checked={deliveryStatus === 'ปกติ'}
                                  onChange={(e) => setDeliveryStatus(e.target.value as any)}
                                  className="mr-2"
                                />
                                <span className="rounded px-3 py-1 text-sm font-medium bg-green-100 text-green-800">
                                  ปกติ
                                </span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name="deliveryStatus"
                                  value="ไม่ปกติ"
                                  checked={deliveryStatus === 'ไม่ปกติ'}
                                  onChange={(e) => setDeliveryStatus(e.target.value as any)}
                                  className="mr-2"
                                />
                                <span className="rounded px-3 py-1 text-sm font-medium bg-red-100 text-red-800">
                                  ไม่ปกติ
                                </span>
                              </label>
                              <label className="flex items-center cursor-pointer">
                                <input
                                  type="radio"
                                  name="deliveryStatus"
                                  value="อื่นๆ"
                                  checked={deliveryStatus === 'อื่นๆ'}
                                  onChange={(e) => setDeliveryStatus(e.target.value as any)}
                                  className="mr-2"
                                />
                                <span className="rounded px-3 py-1 text-sm font-medium bg-gray-100 text-gray-800">
                                  อื่นๆ
                                </span>
                              </label>
                            </div>
                          </div>

                          {/* หมายเหตุ/เหตุผล */}
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              หมายเหตุ/เหตุผล
                            </label>
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={3}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                              placeholder="ระบุหมายเหตุหรือเหตุผล (ถ้ามี)"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            ชื่อผู้บันทึก
                          </label>
                          <input
                            type="text"
                            value={trackedBy}
                            disabled
                            className="w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 shadow-sm md:w-1/2"
                            placeholder="ระบุชื่อผู้บันทึก"
                          />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowTrackingForm(false)}
                            className="rounded-md bg-gray-200 px-6 py-2 text-gray-700 font-medium hover:bg-gray-300 transition"
                          >
                            ยกเลิก
                          </button>
                          <button
                            type="submit"
                            disabled={createTrackingMutation.isPending}
                            className="rounded-md bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                          >
                            {createTrackingMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: ประวัติการส่งของ */}
              {!hideTrackingButtons && activeTab === 'history' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">ประวัติการส่งของ</h3>
                  {trackingHistory && trackingHistory.length > 0 ? (
                    <div className="space-y-3">
                      {trackingHistory.map((track: any) => (
                        <div key={track.id} className="rounded-lg bg-white shadow p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className={`inline-block rounded px-3 py-1 text-sm font-medium border ${getDeliveryStatusStyle(track.delivery_status)}`}>
                                  {track.delivery_status}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {formatDateTime(track.tracked_at)}
                                </span>
                              </div>
                              {track.note && (
                                <p className="text-sm text-gray-700 p-2 bg-gray-50 rounded">
                                  {track.note}
                                </p>
                              )}
                              {track.tracked_by && (
                                <p className="text-xs text-gray-500">
                                  โดย: {track.tracked_by}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg bg-white p-8 text-center text-gray-500 shadow">
                      ยังไม่มีการบันทึกการส่งของ
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-20 text-gray-600">ไม่พบข้อมูล PO</div>
          )}
        </div>
      </div>

      </div>

      {/* PR Detail Modal (ซ้อนทับ) - z-index สูงกว่า */}
      {selectedPrNo && (
        <PRDetailModal
          prNo={selectedPrNo}
          isOpen={!!selectedPrNo}
          onClose={() => setSelectedPrNo(null)}
          hideTrackingButtons={true}
        />
      )}

      {/* Success Modal */}
      {showSuccessWarning && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">บันทึกสำเร็จ</h3>
              <p className="text-center text-gray-600 mb-6">บันทึกการติดตามการส่งของเรียบร้อยแล้ว</p>
              <button
                onClick={() => {
                  setShowSuccessWarning(false);
                  // Refetch data without reloading the page
                  void utils.po.invalidate();
                }}
                className="w-full rounded-md bg-green-600 px-6 py-3 text-white font-medium hover:bg-green-700 transition"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </Fragment>
  );
}
