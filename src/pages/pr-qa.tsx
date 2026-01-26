import { useState, useMemo } from "react";
import Head from "next/head";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";
import PRDetailModal from "~/components/PRDetailModal";

// Import shared utils
import { formatThaiDate, formatThaiDateTime } from "~/utils/dateUtils";
import { formatName } from "~/utils/formatters";
import { getUrgencyStyle } from "~/utils/urgencyStyles";

// Helper function สำหรับวันที่ (ไม่ใช้ default date range แล้ว - แสดงทุกวัน)
const getDefaultDateRange = () => {
  return {
    from: '',
    to: '',
  };
};

// Alias for backward compatibility
const formatDate = formatThaiDate;
const formatDateTime = formatThaiDateTime;

export default function PRQAPage() {
  const { user } = useAuth();
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  const [trackedBy, setTrackedBy] = useState("");
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [prNoFilter, setPrNoFilter] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [jobName, setJobName] = useState("");
  const [answerStatus, setAnswerStatus] = useState<{
    allAnswered: boolean;
    partiallyAnswered: boolean;
    neverAnswered: boolean;
  }>({
    allAnswered: false,
    partiallyAnswered: false,
    neverAnswered: false,
  });
  const [showAnswerStatusDropdown, setShowAnswerStatusDropdown] = useState(false);
  const [sortBy, setSortBy] = useState<'question_date' | 'pr_number'>('question_date'); // การเรียงลำดับ
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [selectedPrNo, setSelectedPrNo] = useState<number | null>(null);
  const [expandedTrackingId, setExpandedTrackingId] = useState<number | null>(null);

  // ดึงข้อมูล Q&A
  const { data: qaData, isLoading, refetch } = api.pr.getAllQA.useQuery({
    trackedBy: trackedBy || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    prNo: prNoFilter ? parseInt(prNoFilter) : undefined,
    requesterName: requesterName || undefined,
    jobName: jobName || undefined,
  });

  // จัดกลุ่มข้อมูล Q&A ตาม PR Number
  const groupedQAData = useMemo(() => {
    if (!qaData) return [];

    // สร้าง Map เพื่อเก็บ PR แต่ละตัว
    const prMap = new Map<number, {
      pr_doc_num: number;
      pr_info: any;
      questions: any[];
    }>();

    qaData.forEach((qa) => {
      if (!prMap.has(qa.pr_doc_num)) {
        prMap.set(qa.pr_doc_num, {
          pr_doc_num: qa.pr_doc_num,
          pr_info: qa.pr_info,
          questions: [],
        });
      }
      prMap.get(qa.pr_doc_num)!.questions.push(qa);
    });

    // แปลง Map เป็น Array และเรียงตามที่เลือก
    let result = Array.from(prMap.values()).sort((a, b) => {
      if (sortBy === 'pr_number') {
        // เรียงตามเลข PR (มากสุดก่อน)
        return b.pr_doc_num - a.pr_doc_num;
      } else {
        // เรียงตามวันถามล่าสุด (เดิม)
        const latestDateA = Math.max(...a.questions.map(q => new Date(q.tracked_at).getTime()));
        const latestDateB = Math.max(...b.questions.map(q => new Date(q.tracked_at).getTime()));
        return latestDateB - latestDateA;
      }
    });

    // กรองตามสถานะการตอบ
    const hasAnyStatusSelected = answerStatus.allAnswered || answerStatus.partiallyAnswered || answerStatus.neverAnswered;

    if (hasAnyStatusSelected) {
      result = result.filter((prGroup) => {
        const totalQuestions = prGroup.questions.length;
        const answeredQuestions = prGroup.questions.filter(q => q.tracking_response_log.length > 0).length;

        const isAllAnswered = answeredQuestions === totalQuestions && totalQuestions > 0;
        const isPartiallyAnswered = answeredQuestions > 0 && answeredQuestions < totalQuestions;
        const isNeverAnswered = answeredQuestions === 0;

        return (
          (answerStatus.allAnswered && isAllAnswered) ||
          (answerStatus.partiallyAnswered && isPartiallyAnswered) ||
          (answerStatus.neverAnswered && isNeverAnswered)
        );
      });
    }

    return result;
  }, [qaData, answerStatus, sortBy]);

  const utils = api.useUtils();

  const handleReset = () => {
    setTrackedBy("");
    setDateFrom(defaultDates.from);
    setDateTo(defaultDates.to);
    setPrNoFilter("");
    setRequesterName("");
    setJobName("");
    setAnswerStatus({
      allAnswered: false,
      partiallyAnswered: false,
      neverAnswered: false,
    });
    setSortBy('question_date');
  };

  const handleAnswerStatusChange = (key: keyof typeof answerStatus) => {
    setAnswerStatus(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const getAnswerStatusLabel = () => {
    const selected = [];
    if (answerStatus.allAnswered) selected.push('ตอบครบ');
    if (answerStatus.partiallyAnswered) selected.push('ตอบไม่ครบ');
    if (answerStatus.neverAnswered) selected.push('ไม่เคยตอบ');

    if (selected.length === 0) return 'สถานะการตอบ';
    if (selected.length === 3) return 'ทุกสถานะ';
    return selected.join(', ');
  };

  return (
    <>
      <Head>
        <title>PR Q&A - คำถามและคำตอบ</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-800">
              💬 PR Q&A - คำถามและคำตอบ
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              ดูคำถามและคำตอบทั้งหมดในรูปแบบตาราง
            </p>
          </div>

          {/* Filters - Sticky */}
          <div className="sticky top-0 z-10 mb-6 rounded-lg bg-white p-4 shadow">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              {/* Row 1 */}
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  เรียงลำดับ
                </label>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none"
                >
                  <span className="block truncate">
                    {sortBy === 'pr_number' ? '🔢 เลข PR (มากสุด)' : '📅 วันถามล่าสุด'}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 mt-5">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>

                {showSortDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSortDropdown(false)}
                    />
                    <div className="absolute z-20 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setSortBy('question_date');
                            setShowSortDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                            sortBy === 'question_date' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          📅 วันถามล่าสุด
                        </button>
                        <button
                          onClick={() => {
                            setSortBy('pr_number');
                            setShowSortDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                            sortBy === 'pr_number' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                          }`}
                        >
                          🔢 เลข PR (มากสุด)
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ชื่อผู้ถาม
                </label>
                <input
                  type="text"
                  value={trackedBy}
                  onChange={(e) => setTrackedBy(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="ค้นหาชื่อผู้ถาม"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ผู้เปิด PR
                </label>
                <input
                  type="text"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="ค้นหาผู้เปิด PR"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ชื่องาน
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="ค้นหาชื่องาน"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  PR No
                </label>
                <input
                  type="number"
                  value={prNoFilter}
                  onChange={(e) => setPrNoFilter(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                  placeholder="เลขที่ PR"
                />
              </div>

              {/* Row 2 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  วันที่ถาม (จาก)
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  วันที่ถาม (ถึง)
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  สถานะการตอบ
                </label>
                <button
                  onClick={() => setShowAnswerStatusDropdown(!showAnswerStatusDropdown)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm shadow-sm hover:bg-gray-50 focus:border-blue-500 focus:outline-none"
                >
                  <span className="block truncate">{getAnswerStatusLabel()}</span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 mt-5">
                    <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                </button>

                {showAnswerStatusDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowAnswerStatusDropdown(false)}
                    />
                    <div className="absolute z-20 mt-1 w-full rounded-md bg-white shadow-lg border border-gray-200">
                      <div className="py-1">
                        <label className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={answerStatus.allAnswered}
                            onChange={() => handleAnswerStatusChange('allAnswered')}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">✅ ตอบทุกคำถามแล้ว</span>
                        </label>
                        <label className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={answerStatus.partiallyAnswered}
                            onChange={() => handleAnswerStatusChange('partiallyAnswered')}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">⚠️ ยังตอบไม่ครบ</span>
                        </label>
                        <label className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={answerStatus.neverAnswered}
                            onChange={() => handleAnswerStatusChange('neverAnswered')}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-3 text-sm text-gray-700">❌ ไม่เคยตอบเลย</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-end gap-2">
                <button
                  onClick={() => void refetch()}
                  className="flex-1 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  🔍 ค้นหา
                </button>
                <button
                  onClick={handleReset}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  รีเซ็ต
                </button>
              </div>
            </div>
          </div>

          {/* Cards View - จัดกลุ่มตาม PR */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="rounded-lg bg-white p-12 text-center shadow">
                <div className="flex justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                </div>
                <p className="mt-2 text-sm text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            ) : !groupedQAData || groupedQAData.length === 0 ? (
              <div className="rounded-lg bg-white p-12 text-center text-gray-500 shadow">
                ไม่พบข้อมูลคำถาม-คำตอบ
              </div>
            ) : (
              groupedQAData.map((prGroup) => {
                // นับจำนวนคำถามและคำถามที่มีคำตอบ
                const totalQuestions = prGroup.questions.length;
                const answeredQuestions = prGroup.questions.filter(q => q.tracking_response_log.length > 0).length;

                return (
                  <div
                    key={prGroup.pr_doc_num}
                    className="rounded-lg bg-white shadow-md border-2 border-black overflow-hidden"
                  >
                    {/* Card Header - แสดงเฉพาะ PR No, ชื่อผู้เปิด, ชื่องาน */}
                    <div
                      onClick={() => setExpandedTrackingId(
                        expandedTrackingId === prGroup.pr_doc_num ? null : prGroup.pr_doc_num
                      )}
                      className="cursor-pointer bg-white px-6 py-4 hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            {/* PR No */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPrNo(prGroup.pr_doc_num);
                              }}
                              className="text-lg font-bold text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              PR #{prGroup.pr_doc_num}
                            </button>

                            {/* Badge แสดงจำนวนคำถามและคำถามที่ตอบแล้ว */}
                            <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold bg-blue-100 text-blue-800">
                              {totalQuestions} คำถาม
                            </span>
                            <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              answeredQuestions > 0
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-600"
                            }`}>
                              {answeredQuestions} ตอบแล้ว
                            </span>
                          </div>

                          {/* ชื่อผู้เปิด PR */}
                          <p className="mt-2 text-sm text-gray-700">
                            <span className="font-medium">ผู้เปิด PR:</span> {prGroup.pr_info?.req_name ? formatName(prGroup.pr_info.req_name) : "-"}
                          </p>

                          {/* ชื่องาน */}
                          <p className="mt-1 text-sm text-gray-600">
                            <span className="font-medium">งาน:</span> {prGroup.pr_info?.job_name || "-"}
                          </p>
                        </div>

                        {/* Expand/Collapse Button */}
                        <button
                          className="ml-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
                        >
                          {expandedTrackingId === prGroup.pr_doc_num ? "▲ ซ่อน" : "▼ ดูคำถาม-คำตอบ"}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Section - คำถามและคำตอบทั้งหมดของ PR นี้ */}
                    {expandedTrackingId === prGroup.pr_doc_num && (
                      <div className="border-t-2 border-black bg-gray-50 p-6">
                        <div className="space-y-6">
                          {prGroup.questions.map((qa, index) => {
                            // กลับลำดับการนับ - คำถามล่าสุด (index 0) จะเป็นเลขที่มากสุด
                            const questionNumber = totalQuestions - index;

                            return (
                            <div key={qa.id} className="bg-white rounded-lg p-4 border border-gray-200">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:items-center">
                                {/* คอลัมน์ซ้าย: คำถาม */}
                                <div className="flex flex-col justify-center">
                                  <div className="flex items-center gap-2 mb-3">
                                    <h4 className="text-sm font-semibold text-gray-700">
                                      📝 คำถามที่ {questionNumber}
                                    </h4>
                                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${getUrgencyStyle(qa.urgency_level)}`}>
                                      {qa.urgency_level}
                                    </span>
                                  </div>
                                  <div className="rounded-lg bg-blue-50 p-4 text-sm text-gray-800 border-l-4 border-blue-500">
                                    <p className="whitespace-pre-wrap">{qa.note || "ไม่มีคำถาม"}</p>
                                    <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-gray-600">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">ถามโดย:</span>
                                        <span>{qa.tracked_by || "-"}</span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="font-medium">เมื่อ:</span>
                                        <span>{formatDateTime(qa.tracked_at)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* คอลัมน์ขวา: คำตอบทั้งหมด */}
                                <div>
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                    💬 คำตอบ ({qa.tracking_response_log.length} รายการ)
                                  </h4>
                                  <div className="space-y-3 max-h-96 overflow-y-auto">
                                    {qa.tracking_response_log.length === 0 ? (
                                      <div className="rounded-lg bg-gray-100 p-4 text-sm text-gray-500 italic text-center">
                                        ยังไม่มีคำตอบ
                                      </div>
                                    ) : (
                                      qa.tracking_response_log.map((response: any) => (
                                        <div key={response.id} className="rounded-lg bg-green-50 p-4 border-l-4 border-green-500">
                                          <p className="text-sm text-gray-800 mb-2 whitespace-pre-wrap">
                                            {response.response_note || "-"}
                                          </p>
                                          <div className="flex items-center gap-4 text-xs text-gray-600">
                                            <span className="font-medium">ตอบโดย: {response.responded_by || "-"}</span>
                                            <span>•</span>
                                            <span>{formatDateTime(response.responded_at)}</span>
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Summary */}
          {groupedQAData && groupedQAData.length > 0 && (
            <div className="mt-4 rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-700">
                พบทั้งหมด <span className="font-semibold text-blue-600">{groupedQAData.length}</span> PR • {" "}
                <span className="font-semibold text-orange-600">
                  {groupedQAData.reduce((sum, pr) => sum + pr.questions.length, 0)}
                </span> คำถาม
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PR Detail Modal */}
      {selectedPrNo && (
        <PRDetailModal
          prNo={selectedPrNo}
          isOpen={!!selectedPrNo}
          onClose={() => setSelectedPrNo(null)}
          hideTrackingButtons={false}
        />
      )}
    </>
  );
}
