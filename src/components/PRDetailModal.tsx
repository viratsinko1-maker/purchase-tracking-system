import { useState, useEffect, Fragment } from "react";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";
import PODetailModal from "./PODetailModal";

interface PRDetailModalProps {
  prNo: number;
  isOpen: boolean;
  onClose: () => void;
  hideTrackingButtons?: boolean; // ซ่อนปุ่มติดตาม PR
}

export default function PRDetailModal({ prNo, isOpen, onClose, hideTrackingButtons = false }: PRDetailModalProps) {

  // ดึงข้อมูล user ที่ล็อคอินอยู่
  const { user } = useAuth();

  // State สำหรับเปิด PO Detail Modal
  const [selectedPoNo, setSelectedPoNo] = useState<number | null>(null);

  // รีเซ็ต state เมื่อปิด modal
  useEffect(() => {
    if (!isOpen) {
      setSelectedPoNo(null);
      setExpandedTrackingId(null);
      setShowApprovers(false);
    }
  }, [isOpen]);

  // ปิด modal นี้เมื่อเปิด nested modal (ป้องกัน stack เกิน 2 ชั้น)
  const handleOpenPoModal = (poNo: number) => {
    setSelectedPoNo(poNo);
    // ถ้าเป็น modal ที่ไม่มีปุ่มติดตาม (nested level 2) ให้ปิด parent modal
    if (hideTrackingButtons) {
      onClose();
    }
  };

  // State สำหรับบันทึกการติดตาม
  const [urgencyLevel, setUrgencyLevel] = useState<'ด่วนที่สุด' | 'ด่วน' | 'ปกติ' | 'ปิดแล้ว'>('ปกติ');
  const [note, setNote] = useState('');
  const [trackedBy, setTrackedBy] = useState('');

  // State สำหรับตอบการติดตาม (เก็บ tracking ID ที่ expand อยู่)
  const [expandedTrackingId, setExpandedTrackingId] = useState<number | null>(null);

  // State สำหรับฟอร์มตอบกลับแต่ละรายการ (ใช้ object เก็บข้อมูลแต่ละ tracking)
  const [responseFormData, setResponseFormData] = useState<{[key: number]: {note: string, by: string}}>({});

  // State สำหรับแสดง/ซ่อนฟอร์มบันทึกการติดตามใหม่
  const [showNewTrackingForm, setShowNewTrackingForm] = useState(false);

  // State สำหรับแสดง/ซ่อนส่วนผู้อนุมัติ
  const [showApprovers, setShowApprovers] = useState(false);

  // State สำหรับ Success Modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // OCR Code lookup map (ocr_code2 -> ชื่อแผนก)
  const [ocrCodeMap, setOcrCodeMap] = useState<Map<string, string>>(new Map());

  // Fetch OCR codes for tooltip
  useEffect(() => {
    const fetchOcrCodes = async () => {
      try {
        const response = await fetch("/api/admin/ocr-codes");
        const data = await response.json();
        if (data.success && data.data) {
          const map = new Map<string, string>();
          data.data.forEach((item: { name: string; remarks: string | null }) => {
            if (item.remarks) {
              map.set(item.name, item.remarks);
            }
          });
          setOcrCodeMap(map);
        }
      } catch (error) {
        console.error("Error fetching OCR codes:", error);
      }
    };
    void fetchOcrCodes();
  }, []);

  const utils = api.useUtils();

  // ดึงข้อมูล PR detail
  const { data: prData, isLoading } = api.pr.getByPRNo.useQuery(
    { prNo },
    { enabled: isOpen && prNo > 0 }
  );

  // ดึงประวัติ Tracking พร้อม Responses
  const { data: trackingHistory } = api.pr.getTrackingWithResponses.useQuery(
    { prNo },
    { enabled: isOpen && prNo > 0 }
  );

  // ดึงไฟล์แนบ PR
  const { data: attachments } = api.pr.getPRAttachments.useQuery(
    { prNo },
    { enabled: isOpen && prNo > 0 }
  );

  // ดึงข้อมูลการรับเอกสารและการอนุมัติ
  const { data: documentReceipt } = api.pr.getDocumentReceipt.useQuery(
    { prNo },
    { enabled: isOpen && prNo > 0 }
  );

  // ดึง tracking ล่าสุด
  const latestTracking = trackingHistory && trackingHistory.length > 0 ? trackingHistory[0] : null;

  // ตั้งค่าชื่อผู้ติดตามเริ่มต้นเป็นชื่อผู้ใช้ที่ล็อคอินอยู่
  useEffect(() => {
    if (user?.name && !trackedBy) {
      setTrackedBy(user.name);
    }
  }, [user?.name]);

  // Mutation สำหรับบันทึก tracking
  const createTrackingMutation = api.pr.createTracking.useMutation({
    onSuccess: async () => {
      // Reset form
      setUrgencyLevel('ปกติ');
      setNote('');
      setShowNewTrackingForm(false); // ปิดฟอร์ม
      // ไม่ reset trackedBy เพื่อให้ใช้ชื่อเดิมต่อ
      // Refetch tracking history
      await utils.pr.getTrackingWithResponses.invalidate({ prNo });
      await utils.pr.getLatestTrackings.invalidate();
      await utils.pr.getAllSummary.invalidate();

      // แสดง modal สำเร็จ
      setSuccessMessage('บันทึกการติดตามเรียบร้อยแล้ว');
      setShowSuccessModal(true);
    },
    onError: (error) => {
      alert(`✗ เกิดข้อผิดพลาด: ${error.message}`);
    },
  });

  // Mutation สำหรับบันทึก response
  const createResponseMutation = api.pr.createTrackingResponse.useMutation({
    onSuccess: async (data, variables) => {
      // Reset form สำหรับ tracking ID นั้นๆ
      const trackingId = variables.trackingId;
      setResponseFormData(prev => {
        const newData = {...prev};
        delete newData[trackingId];
        return newData;
      });
      setExpandedTrackingId(null);

      // Refetch tracking history
      await utils.pr.getTrackingWithResponses.invalidate({ prNo });
      await utils.pr.getLatestTrackings.invalidate();
      await utils.pr.getAllSummary.invalidate();

      // แสดง modal สำเร็จ
      setSuccessMessage('บันทึกการตอบเรียบร้อยแล้ว');
      setShowSuccessModal(true);
    },
    onError: (error) => {
      alert(`✗ เกิดข้อผิดพลาด: ${error.message}`);
    },
  });

  const handleSubmitTracking = (e: React.FormEvent) => {
    e.preventDefault();
    createTrackingMutation.mutate({
      prNo,
      urgencyLevel,
      note: note.trim() || undefined,
      trackedBy: trackedBy.trim() || undefined,
    });
  };

  const handleSubmitResponse = (trackingId: number) => (e: React.FormEvent) => {
    e.preventDefault();

    const formData = responseFormData[trackingId];
    if (!formData) return;

    createResponseMutation.mutate({
      trackingId,
      prNo,
      responseNote: formData.note.trim() || undefined,
      respondedBy: user?.name || undefined,
    });
  };

  const toggleResponseForm = (trackingId: number) => {
    if (expandedTrackingId === trackingId) {
      setExpandedTrackingId(null);
    } else {
      setExpandedTrackingId(trackingId);
      // Initialize form data ถ้ายังไม่มี
      if (!responseFormData[trackingId]) {
        setResponseFormData(prev => ({
          ...prev,
          [trackingId]: { note: '', by: '' }
        }));
      }
    }
  };

  const updateResponseFormData = (trackingId: number, field: 'note' | 'by', value: string) => {
    setResponseFormData(prev => ({
      ...prev,
      [trackingId]: {
        ...(prev[trackingId] || { note: '', by: '' }),
        [field]: value
      }
    }));
  };

  // ดึงรายการ PO ทั้งหมดที่เกี่ยวข้องกับ PR นี้
  const poNumbers = prData?.lines
    .flatMap((line: any) => line.po_list.map((po: any) => po.po_doc_num))
    .filter((num: number, index: number, self: number[]) => self.indexOf(num) === index) || [];

  // ดึงข้อมูล PO Info (วันที่ออก PO)
  const { data: poInfoMap } = api.pr.getPOInfoBatch.useQuery(
    { poNumbers },
    { enabled: poNumbers.length > 0 }
  );

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
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

  const formatNumber = (num: number | null | string) => {
    if (num === null || num === undefined) return "-";
    return Number(num).toLocaleString("th-TH");
  };

  const formatName = (name: string | null) => {
    if (!name) return "-";
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
    }
    return name;
  };

  const getUrgencyStyle = (level: string) => {
    switch (level) {
      case 'ด่วนที่สุด':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ด่วน':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'ปกติ':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ปิดแล้ว':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getUrgencyBgStyle = (level: string) => {
    switch (level) {
      case 'ด่วนที่สุด':
        return 'bg-red-50';
      case 'ด่วน':
        return 'bg-orange-50';
      case 'ปกติ':
        return 'bg-blue-50';
      case 'ปิดแล้ว':
        return 'bg-gray-50';
      default:
        return 'bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <Fragment>
      {/* PR Modal - แสดงตลอด แม้จะมี nested modal */}
      <div className={`fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-2 ${hideTrackingButtons ? 'z-[60]' : 'z-50'}`}>
        {/* ขยาย modal ให้ใหญ่ขึ้นเกือบเต็มจอ */}
        <div className="relative w-[98vw] max-h-[98vh] overflow-hidden rounded-lg bg-gray-50 shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                PR #{prNo}
              </h2>
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

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(98vh - 72px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            </div>
          ) : !prData ? (
            <div className="text-center py-20 text-gray-600">ไม่พบข้อมูล PR</div>
          ) : (
            <div className="space-y-6">
                  {/* PR Info */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-lg font-semibold text-gray-900">ข้อมูล PR</h3>
                      <div className="flex items-center gap-2">
                        {/* Status Badge */}
                        <span className={`inline-block rounded px-3 py-1 text-sm font-medium ${
                          prData.status === "O"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}>
                          {prData.status === "O" ? "Open" : "Closed"}
                        </span>

                        {/* Urgency Badge */}
                        {latestTracking && (
                          <span className={`inline-block rounded px-3 py-1 text-sm font-medium border ${getUrgencyStyle(latestTracking.urgency_level)}`}>
                            {latestTracking.urgency_level}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-gray-600">ผู้เปิด PR</p>
                        <p className="font-medium text-gray-900">{formatName(prData.req_name)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">หน่วยงาน</p>
                        <p className="font-medium text-gray-900">{prData.department || "-"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">System Date (วันที่คีย์ข้อมูล)</p>
                        <p className="font-medium text-gray-900">{formatDate(prData.create_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">วันที่เปิด PR</p>
                        <p className="font-medium text-gray-900">{formatDate(prData.date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">วันที่ครบกำหนด</p>
                        <p className="font-medium text-gray-900">{formatDate(prData.due_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">วันที่อัพเดตล่าสุด</p>
                        <p className="font-medium text-gray-900">{formatDate(prData.update_date)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">ชื่องาน</p>
                        <p className="font-medium text-gray-900">{prData.job_name || "-"}</p>
                      </div>
                      <div className="md:col-span-3">
                        <p className="text-sm text-gray-600">หมายเหตุ</p>
                        <p className="font-medium text-gray-900">{prData.remarks || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {/* PR Lines */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">รายการสินค้า</h3>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Line</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รหัสสินค้า</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายละเอียด</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รหัสแผนก</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">เครื่องจักร</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">โครงการ</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จำนวน</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">PO</th>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายละเอียด PO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {prData.lines.map((line: any) =>
                            line.po_list && line.po_list.length > 0 ? (
                              line.po_list.map((po: any, poIndex: number) => (
                                <tr key={`${line.line_id}-${poIndex}`} className="hover:bg-gray-50">
                                  {poIndex === 0 && (
                                    <>
                                      <td rowSpan={line.po_list.length} className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                                        #{line.line_num}
                                      </td>
                                      <td rowSpan={line.po_list.length} className="px-3 py-2 text-sm text-gray-600">
                                        {line.item_code || "-"}
                                      </td>
                                      <td rowSpan={line.po_list.length} className="px-3 py-2 text-sm text-gray-600">
                                        <div className="max-w-xs truncate" title={line.description}>
                                          {line.description}
                                        </div>
                                      </td>
                                      <td rowSpan={line.po_list.length} className="whitespace-nowrap px-3 py-2 text-sm">
                                        {line.ocr_code2 && (
                                          <span
                                            className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 cursor-help"
                                            title={ocrCodeMap.get(line.ocr_code2) || line.ocr_code2}
                                          >
                                            {line.ocr_code2}
                                          </span>
                                        )}
                                        {!line.ocr_code2 && <span className="text-gray-400">-</span>}
                                      </td>
                                      <td rowSpan={line.po_list.length} className="whitespace-nowrap px-3 py-2 text-sm">
                                        {line.ocr_code4 && (
                                          <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-800">
                                            {line.ocr_code4}
                                          </span>
                                        )}
                                        {!line.ocr_code4 && <span className="text-gray-400">-</span>}
                                      </td>
                                      <td rowSpan={line.po_list.length} className="px-3 py-2 text-sm text-gray-600">
                                        {line.project ? (
                                          <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800" title={line.project}>
                                            {line.project}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">-</span>
                                        )}
                                      </td>
                                      <td rowSpan={line.po_list.length} className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                                        {formatNumber(line.quantity)} {line.unit_msr || ""}
                                      </td>
                                      <td rowSpan={line.po_list.length} className="whitespace-nowrap px-3 py-2 text-sm">
                                        <span className={`inline-block rounded px-2 py-1 text-xs ${
                                          line.line_status === "O"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-gray-100 text-gray-800"
                                        }`}>
                                          {line.line_status === "O" ? "Open" : "Closed"}
                                        </span>
                                      </td>
                                    </>
                                  )}
                                  <td className="whitespace-nowrap px-3 py-2 text-sm">
                                    {user?.role === 'PR' ? (
                                      <span className="font-semibold text-gray-400 cursor-not-allowed">
                                        PO #{po.po_doc_num}
                                      </span>
                                    ) : (
                                      <button
                                        onClick={() => handleOpenPoModal(po.po_doc_num)}
                                        className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition"
                                      >
                                        PO #{po.po_doc_num}
                                      </button>
                                    )}
                                    <div className="text-xs text-gray-500">
                                      {po.po_status === "O" ? "Open" : "Closed"}
                                    </div>
                                    {poInfoMap && poInfoMap.get && poInfoMap.get(po.po_doc_num) && (
                                      <div className="text-xs text-green-600 font-medium">
                                        ออกเมื่อ: {formatDate(poInfoMap.get(po.po_doc_num).po_doc_date)}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-sm text-gray-600">
                                    <div className="max-w-xs truncate" title={po.po_description || "-"}>
                                      {po.po_description || "-"}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      จำนวน: {formatNumber(po.po_quantity)} {po.po_unit || ""}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      ครบกำหนด: {formatDate(po.po_due_date)}
                                    </div>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr key={line.line_id} className="bg-orange-50">
                                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                                  #{line.line_num}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {line.item_code || "-"}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  <div className="max-w-xs truncate" title={line.description}>
                                    {line.description}
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-sm">
                                  {line.ocr_code2 && (
                                    <span
                                      className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 cursor-help"
                                      title={ocrCodeMap.get(line.ocr_code2) || line.ocr_code2}
                                    >
                                      {line.ocr_code2}
                                    </span>
                                  )}
                                  {!line.ocr_code2 && <span className="text-gray-400">-</span>}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-sm">
                                  {line.ocr_code4 && (
                                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-cyan-100 text-cyan-800">
                                      {line.ocr_code4}
                                    </span>
                                  )}
                                  {!line.ocr_code4 && <span className="text-gray-400">-</span>}
                                </td>
                                <td className="px-3 py-2 text-sm text-gray-600">
                                  {line.project ? (
                                    <span className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800" title={line.project}>
                                      {line.project}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-600">
                                  {formatNumber(line.quantity)} {line.unit_msr || ""}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-sm">
                                  <span className={`inline-block rounded px-2 py-1 text-xs ${
                                    line.line_status === "O"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-gray-100 text-gray-800"
                                  }`}>
                                    {line.line_status === "O" ? "Open" : "Closed"}
                                  </span>
                                </td>
                                <td colSpan={2} className="px-3 py-2 text-center text-sm text-orange-600">
                                  <span className="font-semibold">⚠ ยังไม่มี PO</span>
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PR Attachments */}
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-900">ไฟล์แนบ PR</h3>
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
                                <a
                                  href={apiFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition truncate"
                                  title={fullFileName}
                                >
                                  {fullFileName}
                                </a>
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

                  {/* Approvers Section - Collapsible */}
                  {documentReceipt && (
                    <div className="rounded-lg bg-white p-6 shadow">
                      {/* Header with expand/collapse */}
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setShowApprovers(!showApprovers)}
                      >
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <svg className="h-5 w-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          สถานะการอนุมัติ <span className="text-sm font-normal text-gray-500">(กดเพื่อเปิด/ปิด)</span>
                        </h3>
                        <button
                          className="p-1 rounded hover:bg-gray-100 transition"
                          title={showApprovers ? "ซ่อนรายละเอียด" : "แสดงรายละเอียด"}
                        >
                          <svg
                            className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${showApprovers ? 'rotate-180' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Expandable content */}
                      {showApprovers && (
                        <div className="mt-4 space-y-4">
                          {/* Receipt Info */}
                          <div className="bg-gray-50 rounded-lg p-3">
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">การรับเอกสาร</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-600">วันที่รับ:</span>{" "}
                                <span className="font-medium">{documentReceipt.receipt_date ? formatDate(documentReceipt.receipt_date) : '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-600">ผู้รับ:</span>{" "}
                                <span className="font-medium">{documentReceipt.received_by || '-'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Requester Approval */}
                          <div className={`rounded-lg p-3 ${documentReceipt.requester_approval_at ? 'bg-purple-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {documentReceipt.requester_approval_at ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-gray-400">○</span>
                              )}
                              <h4 className="text-sm font-semibold text-purple-700">ผู้ขอซื้อ (Requester)</h4>
                            </div>
                            {documentReceipt.requester_approval_at ? (
                              <div className="ml-5 text-sm">
                                <p><span className="text-gray-600">อนุมัติโดย:</span> <span className="font-medium">{documentReceipt.requester_approval_by || '-'}</span></p>
                                <p><span className="text-gray-600">เมื่อ:</span> <span className="font-medium">{formatDateTime(documentReceipt.requester_approval_at)}</span></p>
                              </div>
                            ) : (
                              <p className="ml-5 text-sm text-gray-500 italic">รอการอนุมัติ</p>
                            )}
                          </div>

                          {/* Line Approval */}
                          <div className={`rounded-lg p-3 ${documentReceipt.line_approval_at ? 'bg-blue-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {documentReceipt.line_approval_at ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-gray-400">○</span>
                              )}
                              <h4 className="text-sm font-semibold text-blue-700">ผู้อนุมัติตามสายงาน (Line)</h4>
                            </div>
                            {documentReceipt.line_approval_at ? (
                              <div className="ml-5 text-sm">
                                <p><span className="text-gray-600">อนุมัติโดย:</span> <span className="font-medium">{documentReceipt.line_approval_by || '-'}</span></p>
                                <p><span className="text-gray-600">เมื่อ:</span> <span className="font-medium">{formatDateTime(documentReceipt.line_approval_at)}</span></p>
                              </div>
                            ) : (
                              <p className="ml-5 text-sm text-gray-500 italic">รอการอนุมัติ</p>
                            )}
                          </div>

                          {/* Cost Center Approval */}
                          <div className={`rounded-lg p-3 ${documentReceipt.cost_center_approval_at ? 'bg-green-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {documentReceipt.cost_center_approval_at ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-gray-400">○</span>
                              )}
                              <h4 className="text-sm font-semibold text-green-700">ผู้อนุมัติ Cost Center</h4>
                            </div>
                            {documentReceipt.cost_center_approval_at ? (
                              <div className="ml-5 text-sm">
                                <p><span className="text-gray-600">อนุมัติโดย:</span> <span className="font-medium">{documentReceipt.cost_center_approval_by || '-'}</span></p>
                                <p><span className="text-gray-600">เมื่อ:</span> <span className="font-medium">{formatDateTime(documentReceipt.cost_center_approval_at)}</span></p>
                              </div>
                            ) : (
                              <p className="ml-5 text-sm text-gray-500 italic">รอการอนุมัติ</p>
                            )}
                          </div>

                          {/* Procurement Approval */}
                          <div className={`rounded-lg p-3 ${documentReceipt.procurement_approval_at ? 'bg-orange-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {documentReceipt.procurement_approval_at ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-gray-400">○</span>
                              )}
                              <h4 className="text-sm font-semibold text-orange-700">งานจัดซื้อพัสดุ (Procurement)</h4>
                            </div>
                            {documentReceipt.procurement_approval_at ? (
                              <div className="ml-5 text-sm">
                                <p><span className="text-gray-600">อนุมัติโดย:</span> <span className="font-medium">{documentReceipt.procurement_approval_by || '-'}</span></p>
                                <p><span className="text-gray-600">เมื่อ:</span> <span className="font-medium">{formatDateTime(documentReceipt.procurement_approval_at)}</span></p>
                              </div>
                            ) : (
                              <p className="ml-5 text-sm text-gray-500 italic">รอการอนุมัติ</p>
                            )}
                          </div>

                          {/* VPC Approval */}
                          <div className={`rounded-lg p-3 ${documentReceipt.vpc_approval_at ? 'bg-indigo-50' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              {documentReceipt.vpc_approval_at ? (
                                <span className="text-green-500">✓</span>
                              ) : (
                                <span className="text-gray-400">○</span>
                              )}
                              <h4 className="text-sm font-semibold text-indigo-700">VP-C (Final Approval)</h4>
                            </div>
                            {documentReceipt.vpc_approval_at ? (
                              <div className="ml-5 text-sm">
                                <p><span className="text-gray-600">อนุมัติโดย:</span> <span className="font-medium">{documentReceipt.vpc_approval_by || '-'}</span></p>
                                <p><span className="text-gray-600">เมื่อ:</span> <span className="font-medium">{formatDateTime(documentReceipt.vpc_approval_at)}</span></p>
                              </div>
                            ) : (
                              <p className="ml-5 text-sm text-gray-500 italic">รอการอนุมัติ</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* การติดตาม PR - รวมฟอร์มบันทึกใหม่และประวัติเก่า */}
                  {!hideTrackingButtons && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">📝 การติดตาม PR</h3>
                      <div className="space-y-4">
                        {/* การ์ดสำหรับบันทึกการติดตามใหม่ */}
                        <div className="rounded-lg bg-white shadow">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                            {/* ซ้าย: ฟอร์มบันทึกการติดตาม */}
                            {user?.role !== 'POPR' && (
                              <div className="border-r border-gray-200 pr-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold text-blue-700">📋 การติดตาม</h4>
                                  <button
                                    onClick={() => setShowNewTrackingForm(!showNewTrackingForm)}
                                    className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white font-medium hover:bg-blue-700 transition"
                                  >
                                    {showNewTrackingForm ? '✕ ปิด' : '📝 เพิ่มคำถาม'}
                                  </button>
                                </div>

                                {!showNewTrackingForm ? (
                                  <p className="text-sm text-gray-500 italic">คลิกปุ่ม "เพิ่มคำถาม" เพื่อบันทึกการติดตาม</p>
                                ) : (
                                <form onSubmit={handleSubmitTracking} className="space-y-3">
                                  {/* ระดับความเร่งด่วน */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      ระดับความเร่งด่วน *
                                    </label>
                                    <div className="grid grid-cols-2 gap-1">
                                      <label className="flex items-center cursor-pointer">
                                        <input
                                          type="radio"
                                          name="urgency"
                                          value="ด่วนที่สุด"
                                          checked={urgencyLevel === 'ด่วนที่สุด'}
                                          onChange={(e) => setUrgencyLevel(e.target.value as any)}
                                          className="mr-1"
                                        />
                                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                                          ด่วนที่สุด
                                        </span>
                                      </label>
                                      <label className="flex items-center cursor-pointer">
                                        <input
                                          type="radio"
                                          name="urgency"
                                          value="ด่วน"
                                          checked={urgencyLevel === 'ด่วน'}
                                          onChange={(e) => setUrgencyLevel(e.target.value as any)}
                                          className="mr-1"
                                        />
                                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">
                                          ด่วน
                                        </span>
                                      </label>
                                      <label className="flex items-center cursor-pointer">
                                        <input
                                          type="radio"
                                          name="urgency"
                                          value="ปกติ"
                                          checked={urgencyLevel === 'ปกติ'}
                                          onChange={(e) => setUrgencyLevel(e.target.value as any)}
                                          className="mr-1"
                                        />
                                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                                          ปกติ
                                        </span>
                                      </label>
                                      <label className="flex items-center cursor-pointer">
                                        <input
                                          type="radio"
                                          name="urgency"
                                          value="ปิดแล้ว"
                                          checked={urgencyLevel === 'ปิดแล้ว'}
                                          onChange={(e) => setUrgencyLevel(e.target.value as any)}
                                          className="mr-1"
                                        />
                                        <span className="rounded px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800">
                                          ปิดแล้ว
                                        </span>
                                      </label>
                                    </div>
                                  </div>

                                  {/* หมายเหตุ */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      หมายเหตุ
                                    </label>
                                    <textarea
                                      value={note}
                                      onChange={(e) => setNote(e.target.value)}
                                      rows={3}
                                      className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="ระบุคำถาม/หมายเหตุ"
                                    />
                                  </div>

                                  {/* ชื่อผู้ติดตาม */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      ชื่อผู้ติดตาม
                                    </label>
                                    <input
                                      type="text"
                                      value={trackedBy}
                                      disabled
                                      className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-500 shadow-sm"
                                      placeholder="ชื่อผู้ติดตาม"
                                    />
                                  </div>

                                  {/* วันเวลา */}
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      วันเวลาที่ติดตาม
                                    </label>
                                    <input
                                      type="text"
                                      value={new Date().toLocaleString('th-TH', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                      disabled
                                      className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-500 shadow-sm"
                                    />
                                  </div>

                                  {/* Submit Button */}
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setShowNewTrackingForm(false)}
                                      className="rounded-md bg-gray-200 px-3 py-1 text-xs text-gray-700 font-medium hover:bg-gray-300"
                                    >
                                      ยกเลิก
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={createTrackingMutation.isPending}
                                      className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white font-medium hover:bg-blue-700 disabled:bg-gray-400"
                                    >
                                      {createTrackingMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                                    </button>
                                  </div>
                                </form>
                              )}
                              </div>
                            )}

                            {/* ขวา: พื้นที่ว่างหรือคำอธิบาย */}
                            <div className={user?.role !== 'POPR' ? "pl-4" : ""}>
                              <h4 className="text-sm font-semibold text-green-700 mb-3">💬 การตอบกลับ</h4>
                              <p className="text-sm text-gray-500 italic">
                                เมื่อมีการติดตามแล้ว จะสามารถตอบกลับได้ที่นี่
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* ประวัติการติดตามทั้งหมด */}
                        {trackingHistory && trackingHistory.length > 0 ? (
                          <>
                            {trackingHistory.map((track: any) => (
                              <div key={track.id} className="rounded-lg bg-white shadow">
                                {/* Grid 2 คอลัมน์: การติดตาม (ซ้าย) และการตอบกลับ (ขวา) */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                                  {/* ซ้าย: การติดตาม */}
                                  <div className="border-r border-gray-200 pr-4">
                                    <h4 className="text-sm font-semibold text-blue-700 mb-3">📋 การติดตาม</h4>
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`inline-block rounded px-3 py-1 text-sm font-medium border ${getUrgencyStyle(track.urgency_level)}`}>
                                          {track.urgency_level}
                                        </span>
                                      </div>
                                      <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                                        <p className="font-medium">วันเวลาที่ติดตาม:</p>
                                        <p>{formatDateTime(track.tracked_at)}</p>
                                      </div>
                                      {track.tracked_by && (
                                        <p className="text-sm text-gray-600">
                                          <span className="font-medium">ผู้ติดตาม:</span> {track.tracked_by}
                                        </p>
                                      )}
                                      {track.note && (
                                        <div>
                                          <p className="text-xs font-medium text-gray-600 mb-1">หมายเหตุ:</p>
                                          <p className={`text-sm text-gray-700 p-2 rounded ${getUrgencyBgStyle(track.urgency_level)}`}>
                                            {track.note}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* ขวา: การตอบกลับ */}
                                  <div className="pl-4">
                                    <div className="flex items-center justify-between mb-3">
                                      <h4 className="text-sm font-semibold text-green-700">💬 การตอบกลับ</h4>
                                      {!hideTrackingButtons && user?.role !== 'PR' && user?.role !== 'POPR' && (
                                        <button
                                          onClick={() => toggleResponseForm(track.id)}
                                          className="rounded-md bg-green-600 px-3 py-1 text-xs text-white font-medium hover:bg-green-700 transition"
                                        >
                                          {expandedTrackingId === track.id ? '✕ ปิด' : '💬 ตอบกลับ'}
                                        </button>
                                      )}
                                    </div>

                                    {/* แสดงการตอบกลับที่มีอยู่แล้ว */}
                                    {track.tracking_response_log && track.tracking_response_log.length > 0 ? (
                                      <div className="space-y-2 mb-3">
                                        {track.tracking_response_log.map((response: any) => (
                                          <div key={response.id} className="p-2 bg-green-50 rounded border-l-4 border-green-500">
                                            <p className="text-sm text-gray-700 mb-1">{response.response_note || "-"}</p>
                                            <div className="text-xs text-gray-600 bg-white p-1.5 rounded">
                                              <p><span className="font-medium">ตอบโดย:</span> {response.responded_by || "-"}</p>
                                              <p className="mt-0.5"><span className="font-medium">วันเวลาที่ตอบกลับ:</span> {formatDateTime(response.responded_at)}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 italic mb-3">ยังไม่มีการตอบกลับ</p>
                                    )}

                                    {/* ฟอร์มตอบกลับ - แสดงเมื่อกดปุ่ม (ซ่อนสำหรับ role PR และ POPR) */}
                                    {expandedTrackingId === track.id && user?.role !== 'PR' && user?.role !== 'POPR' && (
                                      <form onSubmit={handleSubmitResponse(track.id)} className="mt-3 pt-3 border-t border-gray-200">
                                        <div className="space-y-3">
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              หมายเหตุการตอบกลับ
                                            </label>
                                            <textarea
                                              value={responseFormData[track.id]?.note || ''}
                                              onChange={(e) => updateResponseFormData(track.id, 'note', e.target.value)}
                                              rows={3}
                                              className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                              placeholder="ระบุคำตอบ"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              ชื่อผู้ตอบกลับ
                                            </label>
                                            <input
                                              type="text"
                                              value={user?.name || ''}
                                              disabled
                                              className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-500 shadow-sm"
                                              placeholder="ชื่อผู้ตอบกลับ"
                                            />
                                          </div>
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              วันเวลาที่ตอบกลับ
                                            </label>
                                            <input
                                              type="text"
                                              value={new Date().toLocaleString('th-TH', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                              disabled
                                              className="w-full rounded-md border border-gray-300 bg-gray-50 px-2 py-1 text-xs text-gray-500 shadow-sm"
                                            />
                                          </div>
                                          <div className="flex justify-end gap-2">
                                            <button
                                              type="button"
                                              onClick={() => toggleResponseForm(track.id)}
                                              className="rounded-md bg-gray-200 px-3 py-1 text-xs text-gray-700 font-medium hover:bg-gray-300"
                                            >
                                              ยกเลิก
                                            </button>
                                            <button
                                              type="submit"
                                              disabled={createResponseMutation.isPending}
                                              className="rounded-md bg-green-600 px-3 py-1 text-xs text-white font-medium hover:bg-green-700 disabled:bg-gray-400"
                                            >
                                              {createResponseMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                                            </button>
                                          </div>
                                        </div>
                                      </form>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        ) : (
                          <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow text-sm">
                            ยังไม่มีประวัติการติดตาม
                          </div>
                        )}
                      </div>
                    </div>
                  )}
            </div>
          )}
        </div>
      </div>

      </div>

      {/* PO Detail Modal (ซ้อนทับ) - z-index สูงกว่า */}
      {selectedPoNo && (
        <PODetailModal
          poNo={selectedPoNo}
          isOpen={!!selectedPoNo}
          onClose={() => setSelectedPoNo(null)}
          hideTrackingButtons={true}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="flex flex-col items-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">บันทึกสำเร็จ</h3>
              <p className="text-center text-gray-600 mb-6">{successMessage}</p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  // Refetch data without reloading the page
                  void utils.pr.invalidate();
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
