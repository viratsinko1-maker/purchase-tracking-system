import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "~/utils/api";
import PRDetailModal from "~/components/PRDetailModal";
import PRDocumentReceiptModal from "~/components/PRDocumentReceiptModal";
import { useAuth } from "~/hooks/useAuth";
import { PRCard, SyncModals } from "~/components/pr-tracking";
import PageGuard from "~/components/PageGuard";
import { authFetch } from "~/lib/authFetch";

// Import shared utils
import { getDefaultDateRange } from "~/utils/dateUtils";
import { getUrgencyStyle } from "~/utils/urgencyStyles";
import { useSyncStatus } from "~/hooks/useSyncStatus";

function PRTrackingContent() {
  const router = useRouter();
  const { user } = useAuth();
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  // State ธรรมดา
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [poFilter, setPOFilter] = useState<string>("");
  const [urgencyFilter, setUrgencyFilter] = useState<string[]>([]); // เปลี่ยนเป็น array
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);

  // Multi-select filters สำหรับ หน่วยงาน และ แผนก (OCR Code)
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]); // หน่วยงาน (department_name)
  const [ocrCodeFilter, setOcrCodeFilter] = useState<string[]>([]); // แผนก (ocr_code2)
  const [showDepartmentDropdown, setShowDepartmentDropdown] = useState(false);
  const [showOcrCodeDropdown, setShowOcrCodeDropdown] = useState(false);

  // แยก search filters - แถวที่ 3
  const [searchRequester, setSearchRequester] = useState(""); // ชื่อผู้เปิด
  const [searchDepartment, setSearchDepartment] = useState(""); // หน่วยงาน (text search)
  const [searchProject, setSearchProject] = useState(""); // ชื่อโครงการ
  const [searchPRNo, setSearchPRNo] = useState(""); // เลข PR (partial match)
  const [searchTracking, setSearchTracking] = useState(""); // การติดตาม
  const [searchProjectCode, setSearchProjectCode] = useState(""); // เลขโครงการ
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

  // State สำหรับ filter WO
  const [woFilter, setWoFilter] = useState<string>(""); // "", "has_wo", "no_wo"
  const [showWoDropdown, setShowWoDropdown] = useState(false);

  // Modal state
  const [selectedPRNo, setSelectedPRNo] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Document Receipt Modal state
  const [receiptModalPRNo, setReceiptModalPRNo] = useState<number | null>(null);
  const [receiptModalCreateDate, setReceiptModalCreateDate] = useState<Date | string | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // OCR Code lookup map (ocr_code2 -> ชื่อแผนก)
  const [ocrCodeMap, setOcrCodeMap] = useState<Map<string, string>>(new Map());

  // อ่าน query param prNo (จาก notification click)
  useEffect(() => {
    const qPrNo = router.query.prNo;
    if (qPrNo && typeof qPrNo === 'string') {
      setExactPRNo(qPrNo);
      // ล้าง query param จาก URL (ไม่ให้ค้างอยู่)
      void router.replace('/pr-tracking', undefined, { shallow: true });
    }
  }, [router.query.prNo]);

  // Fetch OCR codes for tooltip (ocr_code -> ชื่อแผนก mapping)
  useEffect(() => {
    if (!user) return; // รอให้ login ก่อน

    const fetchOcrCodes = async () => {
      try {
        const response = await authFetch("/api/admin/ocr-codes");
        const data = await response.json();
        if (data.success && data.data) {
          const map = new Map<string, string>();
          // Map: name (เลข OCR เช่น "11020") -> remarks (ชื่อแผนก เช่น "ฝ่ายสารสนเทศ")
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
  }, [user]);

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

  // สร้างรายการ หน่วยงาน และ แผนก ที่มีใน PR data พร้อม cross-filtering
  const { availableDepartments, availableOcrCodes } = useMemo(() => {
    if (!data?.data) return { availableDepartments: [], availableOcrCodes: [] };

    // ถ้าเลือก แผนก (ocrCodeFilter) แล้ว จะกรองให้เหลือแต่ หน่วยงาน ที่ใช้แผนกนั้น
    let deptSourceData = data.data;
    if (ocrCodeFilter.length > 0) {
      deptSourceData = data.data.filter(pr => pr.primary_ocr_code2 && ocrCodeFilter.includes(pr.primary_ocr_code2));
    }

    // ถ้าเลือก หน่วยงาน (departmentFilter) แล้ว จะกรองให้เหลือแต่ แผนก ที่หน่วยงานนั้นใช้
    let ocrSourceData = data.data;
    if (departmentFilter.length > 0) {
      ocrSourceData = data.data.filter(pr => pr.department_name && departmentFilter.includes(pr.department_name));
    }

    // รายการ หน่วยงาน (department_name) ที่ไม่ซ้ำ
    const deptSet = new Set<string>();
    deptSourceData.forEach(pr => {
      if (pr.department_name) deptSet.add(pr.department_name);
    });
    const departments = Array.from(deptSet).sort((a, b) => a.localeCompare(b, 'th'));

    // รายการ แผนก (ocr_code2) ที่ไม่ซ้ำ พร้อมชื่อจาก ocrCodeMap
    const ocrSet = new Map<string, string>(); // code -> name
    ocrSourceData.forEach(pr => {
      if (pr.primary_ocr_code2 && !ocrSet.has(pr.primary_ocr_code2)) {
        const ocrName = ocrCodeMap.get(pr.primary_ocr_code2) || pr.primary_ocr_code2;
        ocrSet.set(pr.primary_ocr_code2, ocrName);
      }
    });
    const ocrCodes = Array.from(ocrSet.entries())
      .map(([code, name]) => ({ code, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));

    return { availableDepartments: departments, availableOcrCodes: ocrCodes };
  }, [data?.data, departmentFilter, ocrCodeFilter, ocrCodeMap]);

  // Filter ข้อมูล PR ตาม PO Status, Urgency Level และ search filters
  const filteredData = useMemo(() => {
    if (!data?.data) return [];

    let filtered = data.data;

    // ถ้าใช้ exactPRNo จะไม่ใช้ filter อื่น (เพราะ query ไปแล้วจาก backend)
    if (exactPRNo) {
      return filtered;
    }

    // Filter by หน่วยงาน (multi-select)
    if (departmentFilter.length > 0) {
      filtered = filtered.filter(pr =>
        pr.department_name && departmentFilter.includes(pr.department_name)
      );
    }

    // Filter by แผนก/OCR Code (multi-select)
    if (ocrCodeFilter.length > 0) {
      filtered = filtered.filter(pr =>
        pr.primary_ocr_code2 && ocrCodeFilter.includes(pr.primary_ocr_code2)
      );
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

    // Filter by project name (ชื่องาน)
    if (searchProject) {
      const searchLower = searchProject.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.job_name?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by project code (เลขโครงการ)
    if (searchProjectCode) {
      const searchLower = searchProjectCode.toLowerCase();
      filtered = filtered.filter(pr =>
        pr.project_code?.toLowerCase().includes(searchLower)
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

    // Filter by WO status
    if (woFilter) {
      filtered = filtered.filter(pr => {
        const woCount = pr.wo_count || 0;
        if (woFilter === 'has_wo') {
          return woCount > 0;
        } else if (woFilter === 'no_wo') {
          return woCount === 0;
        }
        return true;
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
  }, [data, poFilter, urgencyFilter, searchPRNo, searchRequester, searchDepartment, searchProject, searchProjectCode, searchTracking, trackingsMap, exactPRNo, answerStatus, sortBy, departmentFilter, ocrCodeFilter, woFilter]);

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
    setDepartmentFilter([]);
    setOcrCodeFilter([]);
    setWoFilter("");
    setSearchRequester("");
    setSearchDepartment("");
    setSearchProject("");
    setSearchPRNo("");
    setSearchTracking("");
    setSearchProjectCode("");
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {/* Date Pickers - ย่อลงให้ responsive */}
              <div className="flex gap-2 sm:gap-3 items-center flex-wrap shrink-0">
                <div className="flex items-center gap-1">
                  <label htmlFor="dateFrom" className="text-xs font-bold text-orange-600 whitespace-nowrap">จาก</label>
                  <input
                    type="date"
                    id="dateFrom"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px]"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <label htmlFor="dateTo" className="text-xs font-bold text-orange-600 whitespace-nowrap">ถึง</label>
                  <input
                    type="date"
                    id="dateTo"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="rounded-md border border-gray-300 px-1.5 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-[120px]"
                  />
                </div>
              </div>

              {/* Quick Date Filters - ย่อลง */}
              <div className="flex gap-0.5 shrink-0">
                <button
                  onClick={() => {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDateFrom(firstDay.toISOString().split('T')[0]!);
                    setDateTo(lastDay.toISOString().split('T')[0]!);
                  }}
                  className="rounded-l-md bg-blue-100 px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition whitespace-nowrap border-r border-blue-200"
                  title="เดือนปัจจุบัน"
                >
                  เดือนนี้
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDateFrom(twoMonthsAgo.toISOString().split('T')[0]!);
                    setDateTo(lastDay.toISOString().split('T')[0]!);
                  }}
                  className="bg-blue-100 px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition whitespace-nowrap border-r border-blue-200"
                  title="ย้อนหลัง 2 เดือน"
                >
                  2 เดือน
                </button>
                <button
                  onClick={() => {
                    const now = new Date();
                    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    setDateFrom(threeMonthsAgo.toISOString().split('T')[0]!);
                    setDateTo(lastDay.toISOString().split('T')[0]!);
                  }}
                  className="rounded-r-md bg-blue-100 px-1.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition whitespace-nowrap"
                  title="ย้อนหลัง 3 เดือน"
                >
                  3 เดือน
                </button>
              </div>

              {/* ปุ่ม Filter Dropdowns และ Expand/Collapse */}
              <div className="flex flex-row gap-1.5 sm:gap-2 flex-1 flex-wrap items-center">
                {/* Dropdown หน่วยงาน (Multi-select) */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowDepartmentDropdown(!showDepartmentDropdown);
                      setShowOcrCodeDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowSortDropdown(false);
                      setShowAnswerStatusDropdown(false);
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap flex items-center gap-1 min-w-[100px] ${
                      departmentFilter.length > 0
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white'
                    }`}
                    title="กรองตามหน่วยงาน"
                  >
                    {departmentFilter.length === 0 ? 'หน่วยงาน' : `หน่วยงาน (${departmentFilter.length})`}
                    <span className="text-[10px]">{showDepartmentDropdown ? '▲' : '▼'}</span>
                  </button>
                  {showDepartmentDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowDepartmentDropdown(false)}
                      />
                      <div className="absolute z-20 mt-1 left-0 w-64 max-h-64 overflow-y-auto rounded-md bg-white shadow-lg border border-gray-200 top-full">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-200 sticky top-0 bg-white">
                            หน่วยงาน ({availableDepartments.length})
                            {departmentFilter.length > 0 && (
                              <button
                                onClick={() => setDepartmentFilter([])}
                                className="ml-2 text-red-500 hover:text-red-700"
                              >
                                ล้าง
                              </button>
                            )}
                          </div>
                          {availableDepartments.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400">ไม่มีข้อมูล</div>
                          ) : (
                            availableDepartments.map((dept) => (
                              <label key={dept} className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={departmentFilter.includes(dept)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setDepartmentFilter([...departmentFilter, dept]);
                                    } else {
                                      setDepartmentFilter(departmentFilter.filter(d => d !== dept));
                                    }
                                  }}
                                  className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2 text-xs text-gray-700 truncate" title={dept}>
                                  {dept}
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Dropdown แผนก/OCR Code (Multi-select) */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowOcrCodeDropdown(!showOcrCodeDropdown);
                      setShowDepartmentDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowSortDropdown(false);
                      setShowAnswerStatusDropdown(false);
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap flex items-center gap-1 min-w-[80px] ${
                      ocrCodeFilter.length > 0
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 bg-white'
                    }`}
                    title="กรองตามแผนก (OCR Code)"
                  >
                    {ocrCodeFilter.length === 0 ? 'แผนก' : `แผนก (${ocrCodeFilter.length})`}
                    <span className="text-[10px]">{showOcrCodeDropdown ? '▲' : '▼'}</span>
                  </button>
                  {showOcrCodeDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowOcrCodeDropdown(false)}
                      />
                      <div className="absolute z-20 mt-1 left-0 w-72 max-h-64 overflow-y-auto rounded-md bg-white shadow-lg border border-gray-200 top-full">
                        <div className="py-1">
                          <div className="px-3 py-2 text-xs text-gray-500 font-medium border-b border-gray-200 sticky top-0 bg-white">
                            แผนก ({availableOcrCodes.length})
                            {ocrCodeFilter.length > 0 && (
                              <button
                                onClick={() => setOcrCodeFilter([])}
                                className="ml-2 text-red-500 hover:text-red-700"
                              >
                                ล้าง
                              </button>
                            )}
                          </div>
                          {availableOcrCodes.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400">ไม่มีข้อมูล</div>
                          ) : (
                            availableOcrCodes.map(({ code, name }) => (
                              <label key={code} className="flex items-center px-3 py-2 hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={ocrCodeFilter.includes(code)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setOcrCodeFilter([...ocrCodeFilter, code]);
                                    } else {
                                      setOcrCodeFilter(ocrCodeFilter.filter(c => c !== code));
                                    }
                                  }}
                                  className="h-3 w-3 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span className="ml-2 text-xs text-gray-700 truncate" title={`${name} (${code})`}>
                                  {name} <span className="text-gray-400">({code})</span>
                                </span>
                              </label>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Dropdown ความเร่งด่วน */}
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowUrgencyDropdown(!showUrgencyDropdown);
                      setShowDepartmentDropdown(false);
                      setShowOcrCodeDropdown(false);
                      setShowSortDropdown(false);
                      setShowAnswerStatusDropdown(false);
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap flex items-center gap-1 ${
                      urgencyFilter.length > 0
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-300 bg-white'
                    }`}
                    title="ความเร่งด่วน"
                  >
                    {urgencyFilter.length === 0 ? 'ความเร่งด่วน' : `ด่วน (${urgencyFilter.length})`}
                    <span className="text-[10px]">{showUrgencyDropdown ? '▲' : '▼'}</span>
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
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowSortDropdown(!showSortDropdown);
                      setShowDepartmentDropdown(false);
                      setShowOcrCodeDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowAnswerStatusDropdown(false);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap flex items-center gap-1"
                    title="เรียงลำดับ"
                  >
                    {sortBy === 'pr_number' ? 'เรียง: PR' : 'เรียง: วันติดตาม'}
                    <span className="text-[10px]">{showSortDropdown ? '▲' : '▼'}</span>
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
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowAnswerStatusDropdown(!showAnswerStatusDropdown);
                      setShowDepartmentDropdown(false);
                      setShowOcrCodeDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowSortDropdown(false);
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap flex items-center gap-1 ${
                      answerStatus.allAnswered || answerStatus.partiallyAnswered || answerStatus.neverAnswered
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-300 bg-white'
                    }`}
                    title="สถานะการตอบ"
                  >
                    สถานะตอบ
                    {(answerStatus.allAnswered || answerStatus.partiallyAnswered || answerStatus.neverAnswered) && (
                      <span className="ml-0.5">
                        {[
                          answerStatus.allAnswered && '✅',
                          answerStatus.partiallyAnswered && '⚠️',
                          answerStatus.neverAnswered && '❌'
                        ].filter(Boolean).join('')}
                      </span>
                    )}
                    <span className="text-[10px]">{showAnswerStatusDropdown ? '▲' : '▼'}</span>
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

                {/* WO Filter Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWoDropdown(!showWoDropdown);
                      setShowAnswerStatusDropdown(false);
                      setShowDepartmentDropdown(false);
                      setShowOcrCodeDropdown(false);
                      setShowUrgencyDropdown(false);
                      setShowSortDropdown(false);
                    }}
                    className={`rounded-md border px-2 py-1 text-xs font-medium hover:bg-gray-50 focus:border-blue-500 focus:outline-none whitespace-nowrap flex items-center gap-1 ${
                      woFilter
                        ? 'border-orange-500 bg-orange-50 text-orange-700'
                        : 'border-gray-300 bg-white'
                    }`}
                    title="กรองตาม Work Order"
                  >
                    WO
                    {woFilter && (
                      <span className="ml-0.5">
                        {woFilter === 'has_wo' ? '✓' : '✗'}
                      </span>
                    )}
                    <span className="text-[10px]">{showWoDropdown ? '▲' : '▼'}</span>
                  </button>

                  {showWoDropdown && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowWoDropdown(false)}
                      />
                      <div className="absolute z-20 mt-1 left-0 sm:right-0 sm:left-auto w-40 rounded-md bg-white shadow-lg border border-gray-200 top-full">
                        <div className="py-1">
                          <button
                            onClick={() => { setWoFilter(""); setShowWoDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${!woFilter ? 'bg-gray-100 font-medium' : ''}`}
                          >
                            ทั้งหมด
                          </button>
                          <button
                            onClick={() => { setWoFilter("has_wo"); setShowWoDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${woFilter === 'has_wo' ? 'bg-orange-100 font-medium text-orange-700' : ''}`}
                          >
                            ✓ มี WO
                          </button>
                          <button
                            onClick={() => { setWoFilter("no_wo"); setShowWoDropdown(false); }}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${woFilter === 'no_wo' ? 'bg-orange-100 font-medium text-orange-700' : ''}`}
                          >
                            ✗ ไม่มี WO
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* ค้นหาเลขโครงการ (compact) */}
                <input
                  type="text"
                  placeholder="เลขโครงการ..."
                  value={searchProjectCode}
                  onChange={(e) => setSearchProjectCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className={`rounded-md border px-2 py-1 text-xs w-[110px] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400 ${
                    searchProjectCode
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  title="ค้นหาเลขโครงการ เช่น 68022 (ไม่ต้องพิมพ์ TMKO-)"
                />

                {/* Spacer เพื่อดันปุ่มไปขวา */}
                <div className="flex-1"></div>

                {/* Reset button */}
                <button
                  onClick={handleReset}
                  className="rounded-md bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 active:bg-red-300 transition whitespace-nowrap"
                  title="รีเซ็ต filters ทั้งหมด"
                >
                  รีเซ็ต
                </button>

                {/* Expand/Collapse button - ขวาสุด */}
                <button
                  type="button"
                  onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 transition whitespace-nowrap flex items-center gap-1"
                  title={isFiltersExpanded ? "ซ่อน Filters เพิ่มเติม" : "แสดง Filters เพิ่มเติม"}
                >
                  ตัวกรองอื่นๆ
                  <span className="text-[10px]">{isFiltersExpanded ? '▲' : '▼'}</span>
                </button>
              </div>
            </div>

            {/* แถวที่ 2 และ 3: แสดงเมื่อ expanded */}
            {isFiltersExpanded && (
              <>
                {/* แถวที่ 2: Filters หลัก + Exact PR Search */}
                <div className="space-y-2">
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
                        ค้นหา PR โดยตรง
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

                    {/* ค้นหางาน */}
                    <div>
                      <label htmlFor="searchProject" className="block text-sm font-bold text-orange-600 mb-1">
                        ค้นหางาน
                      </label>
                      <input
                        type="text"
                        id="searchProject"
                        placeholder="ชื่องาน..."
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

// Export default with PageGuard wrapper
export default function PRTracking() {
  return (
    <PageGuard action="pr_tracking.read" pageName="PR Tracking">
      <PRTrackingContent />
    </PageGuard>
  );
}
