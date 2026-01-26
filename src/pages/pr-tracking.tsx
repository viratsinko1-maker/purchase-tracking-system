import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import PRDetailModal from "~/components/PRDetailModal";
import PRDocumentReceiptModal from "~/components/PRDocumentReceiptModal";
import { useAuth } from "~/hooks/useAuth";
import { PRCard, SyncModals } from "~/components/pr-tracking";

// Import shared utils
import { getDefaultDateRange } from "~/utils/dateUtils";
import { getUrgencyStyle } from "~/utils/urgencyStyles";
import { useSyncStatus } from "~/hooks/useSyncStatus";

export default function PRTracking() {
  const router = useRouter();
  const { user } = useAuth();
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  // State ธรรมดา
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [poFilter, setPOFilter] = useState<string>("");
  const [urgencyFilter, setUrgencyFilter] = useState<string[]>([]); // เปลี่ยนเป็น array
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);

  // แยก search filters - แถวที่ 3
  const [searchRequester, setSearchRequester] = useState(""); // ชื่อผู้เปิด
  const [searchDepartment, setSearchDepartment] = useState(""); // หน่วยงาน
  const [searchProject, setSearchProject] = useState(""); // ชื่อโครงการ
  const [searchPRNo, setSearchPRNo] = useState(""); // เลข PR (partial match)
  const [searchTracking, setSearchTracking] = useState(""); // การติดตาม
  const [exactPRNo, setExactPRNo] = useState(""); // เลข PR (exact match, ไม่สนใจวันที่)

  const [isSyncing, setIsSyncing] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(true);
  const [showConfirmSync, setShowConfirmSync] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showSyncingModal, setShowSyncingModal] = useState(false);
  const [showUrgencyDropdown, setShowUrgencyDropdown] = useState(false);
  // Auto-sync status monitoring (replaced state with hook)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false); // สำหรับ expand/collapse - เริ่มต้นซ่อนไว้
  const [sortBy, setSortBy] = useState<'pr_number' | 'tracking_date'>('pr_number'); // การเรียงลำดับ
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // State สำหรับ filter สถานะการตอบ
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

  // Modal state
  const [selectedPRNo, setSelectedPRNo] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Document Receipt Modal state
  const [receiptModalPRNo, setReceiptModalPRNo] = useState<number | null>(null);
  const [receiptModalCreateDate, setReceiptModalCreateDate] = useState<Date | string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

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

  // ตรวจสอบว่าต้องใช้ช่วง 12 เดือนหรือไม่
  const need12MonthsRange = urgencyFilter.length > 0 ||
    answerStatus.allAnswered || answerStatus.partiallyAnswered || answerStatus.neverAnswered ||
    sortBy === 'tracking_date';

  // เมื่อมีการเปลี่ยน filters ที่ต้องใช้ช่วงวันที่ ให้อัปเดต date picker อัตโนมัติ
  useEffect(() => {
    if (need12MonthsRange) {
      const now = new Date();
      // ย้อนหลัง 5 เดือน (เหมือนกับปุ่มย้อน 2-3 เดือน)
      const fiveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setDateFrom(fiveMonthsAgo.toISOString().split('T')[0]!);
      setDateTo(lastDay.toISOString().split('T')[0]!);
    } else {
      // รีเซ็ตกลับไปค่า default (เดือนปัจจุบัน)
      const defaultRange = getDefaultDateRange();
      setDateFrom(defaultRange.from);
      setDateTo(defaultRange.to);
    }
  }, [need12MonthsRange]);

  // ดึงข้อมูล PR Summary
  const { data, isLoading, refetch } = api.pr.getAllSummary.useQuery(
    exactPRNo
      ? {
          // ค้นหา PR โดยตรง (exact match) - ไม่สนใจ filter อื่น
          search: `EXACT:${exactPRNo}`,
          status: undefined,
          dateFrom: undefined,
          dateTo: undefined,
        }
      : {
          search: searchRequester || searchDepartment || searchProject || searchPRNo || undefined,
          status: statusFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
    { enabled: shouldFetch }
  );

  // ดึง Latest Trackings สำหรับ PR ทั้งหมด
  const allPRNumbers = useMemo(() => {
    return data?.data.map(pr => pr.doc_num) || [];
  }, [data?.data]);

  const { data: trackingsMap, refetch: refetchTrackings } = api.pr.getLatestTrackings.useQuery(
    { prNumbers: allPRNumbers },
    { enabled: allPRNumbers.length > 0 }
  );


  // Auto-sync status monitoring using custom hook
  const { isAutoSyncing } = useSyncStatus({
    onSyncComplete: () => {
      if (shouldFetch) {
        void refetch();
      }
    },
    logPrefix: '[PR-TRACKING]',
  });

  // Filter ข้อมูล PR ตาม PO Status, Urgency Level และ search filters
  const filteredData = useMemo(() => {
    if (!data?.data) return [];

    let filtered = data.data;

    // ถ้าใช้ exactPRNo จะไม่ใช้ filter อื่น (เพราะ query ไปแล้วจาก backend)
    if (exactPRNo) {
      return filtered;
    }

    // Filter by requester name
    if (searchRequester) {
      const searchLower = searchRequester.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.req_name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by department
    if (searchDepartment) {
      const searchLower = searchDepartment.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.department_name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by project name
    if (searchProject) {
      const searchLower = searchProject.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.job_name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by PR No (partial match - ค้นหาแบบบางส่วน)
    if (searchPRNo) {
      filtered = filtered.filter(pr =>
        pr.doc_num.toString().includes(searchPRNo)
      );
    }

    // Filter by tracking (note or tracked_by)
    if (searchTracking && trackingsMap) {
      const searchLower = searchTracking.toLowerCase();
      filtered = filtered.filter(pr => {
        const tracking = trackingsMap[pr.doc_num];
        if (!tracking) return false;

        const noteMatch = tracking.note?.toLowerCase().includes(searchLower);
        const trackedByMatch = tracking.tracked_by?.toLowerCase().includes(searchLower);

        return noteMatch || trackedByMatch;
      });
    }

    // Filter by PO status
    if (poFilter) {
      filtered = filtered.filter(pr => {
        const linesWithPO = pr.lines_with_po || 0;
        const totalLines = pr.total_lines || 0;

        if (poFilter === 'no_po') {
          return linesWithPO === 0;
        } else if (poFilter === 'partial_po') {
          return linesWithPO > 0 && linesWithPO < totalLines;
        } else if (poFilter === 'full_po') {
          return linesWithPO === totalLines && totalLines > 0;
        }
        return true;
      });
    }

    // Filter by urgency level (ใช้ latest tracking เท่านั้น - ไม่ใช่ย้อนหลัง 12 เดือน)
    if (urgencyFilter.length > 0 && trackingsMap) {
      filtered = filtered.filter(pr => {
        const tracking = trackingsMap[pr.doc_num];
        if (!tracking) return false;
        return urgencyFilter.includes(tracking.urgency_level);
      });
    }

    // Filter by answer status (สถานะการตอบ)
    const hasAnyStatusSelected = answerStatus.allAnswered || answerStatus.partiallyAnswered || answerStatus.neverAnswered;
    if (hasAnyStatusSelected && trackingsMap) {
      filtered = filtered.filter(pr => {
        const tracking = trackingsMap[pr.doc_num];
        if (!tracking) return false;

        const totalQuestions = tracking.total_questions || 0;
        const answeredQuestions = tracking.answered_questions || 0;

        const isAllAnswered = answeredQuestions === totalQuestions && totalQuestions > 0;
        const isPartiallyAnswered = answeredQuestions > 0 && answeredQuestions < totalQuestions;
        const isNeverAnswered = answeredQuestions === 0 && totalQuestions > 0;

        return (
          (answerStatus.allAnswered && isAllAnswered) ||
          (answerStatus.partiallyAnswered && isPartiallyAnswered) ||
          (answerStatus.neverAnswered && isNeverAnswered)
        );
      });
    }

    // เรียงตามที่เลือก
    if (sortBy === 'tracking_date') {
      // กรองเฉพาะ PR ที่มีข้อมูลการติดตาม (มี tracked_at)
      filtered = filtered.filter(pr => {
        const tracking = trackingsMap?.[pr.doc_num];
        return tracking?.tracked_at;
      });

      // เรียงตามวันเวลาการติดตามล่าสุด (ใหม่สุดก่อน)
      filtered.sort((a, b) => {
        const trackingA = trackingsMap?.[a.doc_num];
        const trackingB = trackingsMap?.[b.doc_num];

        const dateA = trackingA?.tracked_at ? new Date(trackingA.tracked_at).getTime() : 0;
        const dateB = trackingB?.tracked_at ? new Date(trackingB.tracked_at).getTime() : 0;

        return dateB - dateA; // ใหม่สุดก่อน
      });
    } else {
      // เรียงตามเลข PR (มากสุดก่อน) - เป็น default
      filtered.sort((a, b) => b.doc_num - a.doc_num);
    }

    return filtered;
  }, [data, poFilter, urgencyFilter, searchPRNo, searchRequester, searchDepartment, searchProject, searchTracking, trackingsMap, exactPRNo, answerStatus, sortBy]);

  // ฟังก์ชันค้นหา
  const handleSearch = () => {
    setShouldFetch(true);
    if (shouldFetch) {
      void refetch();
    }
  };

  // Sync mutation
  const syncMutation = api.pr.sync.useMutation({
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
    setShowSyncingModal(true); // แสดง loading modal
    syncMutation.mutate();
  };

  const handleReset = () => {
    setStatusFilter("");
    setPOFilter("");
    setUrgencyFilter([]);
    setSearchRequester("");
    setSearchDepartment("");
    setSearchProject("");
    setSearchPRNo("");
    setSearchTracking("");
    setExactPRNo("");
    setDateFrom(defaultDates.from);
    setDateTo(defaultDates.to);
    setAnswerStatus({
      allAnswered: false,
      partiallyAnswered: false,
      neverAnswered: false,
    });
    setSortBy('pr_number');
    setShouldFetch(true);
  };

  // เปิด Modal
  const openModal = (prNo: number) => {
    setSelectedPRNo(prNo);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPRNo(null);
  };

  // เปิด Receipt Modal
  const openReceiptModal = (
    prNo: number,
    createDate: Date | string | null,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // ป้องกันการเปิด PR Detail Modal
    setReceiptModalPRNo(prNo);
    setReceiptModalCreateDate(createDate);
    setIsReceiptModalOpen(true);
  };

  const closeReceiptModal = () => {
    setIsReceiptModalOpen(false);
    setReceiptModalPRNo(null);
    setReceiptModalCreateDate(null);
    // Refetch data หลังจาก approve เพื่อให้แสดงสถานะล่าสุด
    void refetch();
    void refetchTrackings();
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isModalOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  return (
    <>
      <Head>
        <title>PR Tracking System</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </Head>

      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">PR Tracking System</h1>
        </div>

        {/* Filter Section - Sticky */}
        <div className="sticky top-0 z-10 mb-4 sm:mb-6 rounded-lg bg-white p-4 sm:p-6 shadow">
          <div className="space-y-3">
            {/* แถวที่ 1: วันที่ + Quick Date Filters + ปุ่ม Expand/Collapse */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
              {/* Date Pickers - label อยู่ซ้ายแถวเดียวกัน */}
              <div className="flex gap-4 flex-shrink-0 w-full sm:w-auto items-center">
                <div className="flex items-center gap-2">
                  <label htmlFor="dateFrom" className="text-sm font-bold text-orange-600 whitespace-nowrap">จากวันที่</label>
                  <input
                    type="date"
                    id="dateFrom"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="dateTo" className="text-sm font-bold text-orange-600 whitespace-nowrap">ถึงวันที่</label>
                  <input
                    type="date"
                    id="dateTo"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Date Filters - ลดขนาดลงครึ่งหนึ่ง */}
              <div className="grid grid-cols-3 gap-2 flex-shrink-0 w-full sm:w-auto sm:max-w-[350px]">
                <button
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDateFrom(firstDay.toISOString().split('T')[0]!);
                    setDateTo(lastDay.toISOString().split('T')[0]!);
                  }}
                  className="rounded-md bg-blue-100 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 active:bg-blue-300 transition whitespace-nowrap"
                >
                  📅 เดือนปัจจุบัน
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDateFrom(twoMonthsAgo.toISOString().split('T')[0]!);
                    setDateTo(lastDay.toISOString().split('T')[0]!);
                  }}
                  className="rounded-md bg-purple-100 px-2 py-1.5 text-xs font-medium text-purple-700 hover:bg-purple-200 active:bg-purple-300 transition whitespace-nowrap"
                >
                  📅 ย้อน 2 เดือน
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDateFrom(threeMonthsAgo.toISOString().split('T')[0]!);
                    setDateTo(lastDay.toISOString().split('T')[0]!);
                  }}
                  className="rounded-md bg-orange-100 px-2 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-200 active:bg-orange-300 transition whitespace-nowrap"
                >
                  📅 ย้อน 3 เดือน
                </button>
              </div>

              {/* ปุ่ม Sync, รีเซ็ต, ความเร่งด่วน, การเรียง, สถานะการตอบ และ Expand/Collapse */}
              <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0 w-full sm:w-auto">
                {/* แถวแรก: Sync, รีเซ็ต (บนมือถือและ desktop) */}
                <div className="flex gap-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing || isAutoSyncing}
                    className={`rounded-md px-4 py-2 text-sm font-medium text-white transition whitespace-nowrap ${
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
                    className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 active:bg-purple-800 transition whitespace-nowrap"
                  >
                    รีเซ็ต
                  </button>
                  {/* ปุ่ม Expand - แสดงเฉพาะบนมือถือ */}
                  <button
                    type="button"
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition whitespace-nowrap ml-auto sm:hidden"
                    title={isFiltersExpanded ? "ซ่อน Filters" : "แสดง Filters"}
                  >
                    {isFiltersExpanded ? "▲ ซ่อน" : "▼ แสดง"}
                  </button>
                </div>

                {/* 3 Dropdown: ความเร่งด่วน, การเรียง, สถานะการตอบ */}
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  {/* Dropdown ความเร่งด่วน */}
                  <div className="relative w-full sm:w-auto">
                    <button
                      onClick={() => setShowUrgencyDropdown(!showUrgencyDropdown)}
                      className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap"
                      title="ความเร่งด่วน"
                    >
                      {urgencyFilter.length === 0 ? '⚡ ความเร่งด่วน ▼' : `⚡ (${urgencyFilter.length})`}
                    </button>

                    {showUrgencyDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowUrgencyDropdown(false)}
                        />
                        <div className="absolute z-20 mt-1 left-0 sm:right-0 sm:left-auto w-56 rounded-md bg-white shadow-lg border border-gray-200 top-full">
                          <div className="py-1">
                            <div className="px-4 py-2 text-xs text-gray-500 font-medium border-b border-gray-200">
                              12 เดือนล่าสุด
                            </div>
                            {['ด่วนที่สุด', 'ด่วน', 'ปกติ', 'ปิดแล้ว'].map((level) => (
                              <label key={level} className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={urgencyFilter.includes(level)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setUrgencyFilter([...urgencyFilter, level]);
                                    } else {
                                      setUrgencyFilter(urgencyFilter.filter(l => l !== level));
                                    }
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={`ml-3 px-2 py-0.5 rounded text-xs border ${getUrgencyStyle(level)}`}>
                                  {level}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dropdown การเรียงลำดับ */}
                  <div className="relative w-full sm:w-auto">
                    <button
                      onClick={() => setShowSortDropdown(!showSortDropdown)}
                      className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap"
                      title="เรียงลำดับ"
                    >
                      {sortBy === 'pr_number' ? '🔢 เลข PR' : '📅 วันติดตาม'} ▼
                    </button>

                    {showSortDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowSortDropdown(false)}
                        />
                        <div className="absolute z-20 mt-1 left-0 sm:right-0 sm:left-auto w-48 rounded-md bg-white shadow-lg border border-gray-200 top-full">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                setSortBy('pr_number');
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                sortBy === 'pr_number' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                              }`}
                            >
                              🔢 เรียงตามเลข PR
                            </button>
                            <button
                              onClick={() => {
                                setSortBy('tracking_date');
                                setShowSortDropdown(false);
                              }}
                              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                                sortBy === 'tracking_date' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                              }`}
                            >
                              📅 เรียงตามวันติดตาม
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dropdown สถานะการตอบ */}
                  <div className="relative w-full sm:w-auto">
                    <button
                      onClick={() => setShowAnswerStatusDropdown(!showAnswerStatusDropdown)}
                      className="w-full sm:w-auto rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap"
                      title="สถานะการตอบ"
                    >
                      {
                        answerStatus.allAnswered || answerStatus.partiallyAnswered || answerStatus.neverAnswered
                          ? [
                              answerStatus.allAnswered && '✅',
                              answerStatus.partiallyAnswered && '⚠️',
                              answerStatus.neverAnswered && '❌'
                            ].filter(Boolean).join(' ')
                          : 'สถานะ ▼'
                      }
                    </button>

                    {showAnswerStatusDropdown && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setShowAnswerStatusDropdown(false)}
                        />
                        <div className="absolute z-20 mt-1 left-0 sm:right-0 sm:left-auto w-56 rounded-md bg-white shadow-lg border border-gray-200 top-full">
                          <div className="py-1">
                            <label className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={answerStatus.allAnswered}
                                onChange={() => setAnswerStatus(prev => ({ ...prev, allAnswered: !prev.allAnswered }))}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-3 text-sm text-gray-700">✅ ตอบทุกคำถามแล้ว</span>
                            </label>
                            <label className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={answerStatus.partiallyAnswered}
                                onChange={() => setAnswerStatus(prev => ({ ...prev, partiallyAnswered: !prev.partiallyAnswered }))}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-3 text-sm text-gray-700">⚠️ ยังตอบไม่ครบ</span>
                            </label>
                            <label className="flex items-center px-4 py-2 hover:bg-gray-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={answerStatus.neverAnswered}
                                onChange={() => setAnswerStatus(prev => ({ ...prev, neverAnswered: !prev.neverAnswered }))}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="ml-3 text-sm text-gray-700">❌ ไม่เคยตอบเลย</span>
                            </label>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className="hidden sm:block rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition whitespace-nowrap"
                  title={isFiltersExpanded ? "ซ่อน Filters" : "แสดง Filters"}
                >
                  {isFiltersExpanded ? "▲ ซ่อน" : "▼ แสดง"}
                </button>
              </div>
            </div>

            {/* แถวที่ 2 และ 3: แสดงเมื่อ expanded */}
            {isFiltersExpanded && (
              <>
                {/* แถวที่ 2: Filters หลัก + Exact PR Search */}
                <div className="space-y-2">
                  {/* แถว 2.1: สถานะ, สถานะ PO, ความเร่งด่วน */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* สถานะ */}
                    <div>
                      <label htmlFor="status" className="block text-sm font-bold text-orange-600 mb-1">สถานะ</label>
                      <select
                        id="status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="" className="text-gray-400">ทั้งหมด</option>
                        <option value="O">Open</option>
                        <option value="C">Closed</option>
                      </select>
                    </div>

                    {/* PO Status Filter */}
                    <div>
                      <label htmlFor="poFilter" className="block text-sm font-bold text-orange-600 mb-1">สถานะ PO</label>
                      <select
                        id="poFilter"
                        value={poFilter}
                        onChange={(e) => setPOFilter(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="" className="text-gray-400">ทั้งหมด</option>
                        <option value="full_po">PO ครบ</option>
                        <option value="partial_po">PO ยังไม่ครบ</option>
                        <option value="no_po">ไม่มี PO เลย</option>
                      </select>
                    </div>

                    {/* Exact PR Search - กรอบสีแดง */}
                    <div>
                      <label htmlFor="exactPR" className="block text-sm font-bold text-red-700 mb-1">
                        🔍 ค้นหา PR โดยตรง
                      </label>
                      <input
                        type="text"
                        id="exactPR"
                        placeholder="เลข PR เต็ม เช่น 251010106"
                        value={exactPRNo}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setExactPRNo(value);
                          if (value) {
                            setShouldFetch(true);
                            void refetch();
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && exactPRNo) {
                            setShouldFetch(true);
                            void refetch();
                          }
                        }}
                        className="w-full rounded-md border-2 border-red-400 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-50 placeholder:text-red-400"
                      />
                    </div>
                  </div>
                </div>

                {/* แถวที่ 3: Search Filters แยกเป็นช่องๆ (ใช้ช่วงวันที่) */}
                <div className="space-y-2">
                  {/* แถว 3.1: ค้นหาชื่อผู้เปิด, หน่วยงาน, ชื่อโครงการ (3 คอลัมน์) */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* ค้นหาชื่อผู้เปิด */}
                    <div>
                      <label htmlFor="searchRequester" className="block text-sm font-bold text-orange-600 mb-1">
                        ค้นหาชื่อผู้เปิด
                      </label>
                      <input
                        type="text"
                        id="searchRequester"
                        placeholder="ชื่อผู้เปิด PR..."
                        value={searchRequester}
                        onChange={(e) => setSearchRequester(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </div>

                    {/* ค้นหาหน่วยงาน */}
                    <div>
                      <label htmlFor="searchDepartment" className="block text-sm font-bold text-orange-600 mb-1">
                        ค้นหาหน่วยงาน
                      </label>
                      <input
                        type="text"
                        id="searchDepartment"
                        placeholder="ชื่อหน่วยงาน..."
                        value={searchDepartment}
                        onChange={(e) => setSearchDepartment(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </div>

                    {/* ค้นหาชื่อโครงการ */}
                    <div>
                      <label htmlFor="searchProject" className="block text-sm font-bold text-orange-600 mb-1">
                        ค้นหาชื่อโครงการ
                      </label>
                      <input
                        type="text"
                        id="searchProject"
                        placeholder="ชื่อโครงการ..."
                        value={searchProject}
                        onChange={(e) => setSearchProject(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  {/* แถว 3.2: ค้นหาเลข PR และการติดตาม (2 คอลัมน์) */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* ค้นหาเลข PR (แบบบางส่วน) */}
                    <div>
                      <label htmlFor="searchPRNo" className="block text-sm font-bold text-orange-600 mb-1">
                        ค้นหา PR (ตามช่วงวันที่)
                      </label>
                      <input
                        type="text"
                        id="searchPRNo"
                        placeholder="25101... (บางส่วนก็ได้)"
                        value={searchPRNo}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          setSearchPRNo(value);
                        }}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </div>

                    {/* ค้นหาการติดตาม */}
                    <div>
                      <label htmlFor="searchTracking" className="block text-sm font-bold text-orange-600 mb-1">
                        ค้นหาการติดตาม
                      </label>
                      <input
                        type="text"
                        id="searchTracking"
                        placeholder="หมายเหตุ, ผู้ติดตาม..."
                        value={searchTracking}
                        onChange={(e) => setSearchTracking(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* PR Cards - Grid 3 columns */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            <div className="col-span-full flex items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            </div>
          ) : filteredData && filteredData.length > 0 ? (
            filteredData.map((pr) => (
              <PRCard
                key={pr.doc_num}
                pr={pr}
                tracking={trackingsMap?.[pr.doc_num]}
                ocrCodeMap={ocrCodeMap}
                onCardClick={openModal}
                onReceiptClick={openReceiptModal}
              />
            ))
          ) : (
            <div className="col-span-full rounded-lg bg-white p-8 text-center text-gray-500 shadow">
              ไม่พบข้อมูล PR
            </div>
          )}
        </div>

        {/* PR Detail Modal with Keyboard Navigation (NO SWIPE - ป้องกันการเลื่อน) */}
        {selectedPRNo && (
          <PRDetailModal
            prNo={selectedPRNo}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedPRNo(null);
              // Refetch ทั้ง PR data และ tracking data เมื่อปิด modal
              void refetch();
              void refetchTrackings();
            }}
          />
        )}

        {/* Document Receipt Modal */}
        {receiptModalPRNo && (
          <PRDocumentReceiptModal
            prNo={receiptModalPRNo}
            prCreateDate={receiptModalCreateDate}
            isOpen={isReceiptModalOpen}
            onClose={closeReceiptModal}
          />
        )}

        {/* Sync Modals */}
        <SyncModals
          showSyncingModal={showSyncingModal}
          showConfirmSync={showConfirmSync}
          showSuccessModal={showSuccessModal}
          showErrorModal={showErrorModal}
          errorMessage={errorMessage}
          onCancelSync={() => setShowConfirmSync(false)}
          onConfirmSync={confirmSync}
          onCloseSuccess={() => setShowSuccessModal(false)}
          onCloseError={() => setShowErrorModal(false)}
        />
      </div>
    </>
  );
}
