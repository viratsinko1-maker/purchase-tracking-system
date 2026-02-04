/**
 * PR Overview Page
 * แสดงข้อมูล PR แบบตาราง เพื่อให้เห็นภาพรวมและสถานะของ PR แต่ละรายการ
 */

import { useState, useRef } from "react";
import { api } from "~/utils/api";
import Head from "next/head";
import PRDetailModal from "~/components/PRDetailModal";
import PRDocumentReceiptModal from "~/components/PRDocumentReceiptModal";
import PODetailModal from "~/components/PODetailModal";
import WODetailModal from "~/components/WODetailModal";

// Import shared utils
import { formatName } from "~/utils/formatters";
import { useClickOutside } from "~/hooks/useClickOutside";
import { ExpandedPRRow } from "~/components/pr-overview";

export default function PROverviewPage() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // ย้อนหลัง 30 วัน
    return date.toISOString().split("T")[0] as string;
  });

  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split("T")[0] as string;
  });

  const [jobNameSearch, setJobNameSearch] = useState("");
  const [createdBySearch, setCreatedBySearch] = useState("");
  const [status, setStatus] = useState<string>(""); // "" = All, "O" = Open, "C" = Closed
  const [poFilters, setPoFilters] = useState<string[]>([]); // Array: "complete", "partial", "none"
  const [isPoDropdownOpen, setIsPoDropdownOpen] = useState(false);
  const poDropdownRef = useRef<HTMLDivElement>(null);
  const [selectedPR, setSelectedPR] = useState<number | null>(null);
  const [selectedPRForReceipt, setSelectedPRForReceipt] = useState<number | null>(null);
  const [selectedPRData, setSelectedPRData] = useState<any>(null);
  const [selectedPO, setSelectedPO] = useState<number | null>(null); // สำหรับเปิด PO Modal จาก expanded row
  const [selectedWO, setSelectedWO] = useState<number | null>(null); // สำหรับเปิด WO Modal
  const [delayFilters, setDelayFilters] = useState<string[]>([]); // Array: "0-7", "7-14", "14-30", "30-90", "90-180"
  const [isDelayDropdownOpen, setIsDelayDropdownOpen] = useState(false);
  const delayDropdownRef = useRef<HTMLDivElement>(null);
  const [delaySortOrder, setDelaySortOrder] = useState<"asc" | "desc">("asc"); // State สำหรับการ sort คอลัมน์ล่าช้า (default: asc)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set()); // State สำหรับเก็บ PR ที่ expand อยู่

  // Close dropdown when clicking outside (using custom hook)
  useClickOutside([
    { ref: poDropdownRef, callback: () => setIsPoDropdownOpen(false) },
    { ref: delayDropdownRef, callback: () => setIsDelayDropdownOpen(false) },
  ]);

  // Query data
  const { data, isLoading, refetch } = api.pr.getAllSummary.useQuery({
    dateFrom,
    dateTo,
    status: status || undefined,
  });

  const handleDateChange = () => {
    void refetch();
  };

  const handlePOFilterToggle = (value: string) => {
    setPoFilters((prev) => {
      if (prev.includes(value)) {
        return prev.filter((v) => v !== value);
      } else {
        return [...prev, value];
      }
    });
  };

  const handleDelayFilterToggle = (value: string) => {
    setDelayFilters((prev) => {
      const newFilters = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];

      // ปรับ date range ตาม delay filters ที่เลือก
      if (newFilters.length > 0) {
        adjustDateRangeForDelay(newFilters);
      }

      return newFilters;
    });
  };

  const adjustDateRangeForDelay = (filters: string[]) => {
    if (filters.length === 0) return;

    // หา delay range สูงสุดที่เลือก
    const maxDelay = filters.reduce((max, filter) => {
      const [, end] = filter.split("-").map(Number);
      return Math.max(max, end || 180);
    }, 0);

    const today = new Date();
    const fromDate = new Date();
    // เพิ่ม 10 วันเพื่อให้ตรงกับการคำนวณ delay ที่ลบ 10 ออก
    fromDate.setDate(today.getDate() - (maxDelay + 10));

    setDateFrom(fromDate.toISOString().split("T")[0] as string);
    setDateTo(today.toISOString().split("T")[0] as string);
  };

  // ฟังก์ชันจัดการการ sort คอลัมน์ล่าช้า (สลับระหว่าง asc กับ desc)
  const handleDelaySort = () => {
    setDelaySortOrder(delaySortOrder === "asc" ? "desc" : "asc");
  };

  // คำนวณจำนวนวันล่าช้า
  const calculateDelayDays = (createDate: Date, receiptDate: Date | null) => {
    const today = new Date();
    let baseDate: Date;

    // ถ้ามีวันรับเอกสารแล้ว ใช้วันรับเอกสาร ถ้าไม่มีใช้ System Date
    if (receiptDate) {
      baseDate = new Date(receiptDate);
    } else {
      baseDate = new Date(createDate);
    }

    const diffTime = today.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // ถ้าผลต่าง > 10 วัน ให้แสดง (ผลต่าง - 10) ถ้าไม่เกิน 10 วัน แสดง 0
    return diffDays > 10 ? diffDays - 10 : 0;
  };

  // คำนวณสถานะ PO จาก mv_pr_summary
  const calculatePOStatus = (totalLines: number, linesWithPO: number) => {
    if (totalLines === 0) return { total: 0, withPO: 0, percentage: 0 };

    const percentage = (linesWithPO / totalLines) * 100;
    return { total: totalLines, withPO: linesWithPO, percentage };
  };

  // ตรวจสอบว่า PR ปิดแล้วหรือยัง
  const isPRClosed = (status: string) => {
    return status === "C";
  };

  // Toggle expand/collapse row
  const toggleExpandRow = (prNo: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(prNo)) {
        newSet.delete(prNo);
      } else {
        newSet.add(prNo);
      }
      return newSet;
    });
  };

  return (
    <>
      <Head>
        <title>PR Overview - PR & PO Tracking</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-[98%]">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">PR Overview</h1>
            <p className="mt-2 text-gray-600">
              ภาพรวมสถานะ Purchase Request ทั้งหมด
            </p>
          </div>

          {/* Filters */}
          <div className="mb-6 rounded-lg bg-white p-4 shadow">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-7">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  วันที่เริ่มต้น
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  onBlur={handleDateChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  วันที่สิ้นสุด
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  onBlur={handleDateChange}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  สถานะ PR
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">ทั้งหมด</option>
                  <option value="O">Open</option>
                  <option value="C">Closed</option>
                </select>
              </div>

              <div className="relative" ref={poDropdownRef}>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  สถานะ PO
                </label>
                <button
                  type="button"
                  onClick={() => setIsPoDropdownOpen(!isPoDropdownOpen)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">
                      {poFilters.length === 0
                        ? "ทั้งหมด"
                        : `เลือกแล้ว ${poFilters.length} รายการ`}
                    </span>
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isPoDropdownOpen ? "rotate-180" : ""
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </button>

                {isPoDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
                    <div className="space-y-2 p-3">
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={poFilters.includes("complete")}
                          onChange={() => handlePOFilterToggle("complete")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>ออก PO ครบแล้ว</span>
                      </label>
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={poFilters.includes("partial")}
                          onChange={() => handlePOFilterToggle("partial")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>ยังไม่ครบ</span>
                      </label>
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={poFilters.includes("none")}
                          onChange={() => handlePOFilterToggle("none")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>ยังไม่ได้ออกเลย</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={delayDropdownRef}>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  ล่าช้า (วัน)
                </label>
                <button
                  type="button"
                  onClick={() => setIsDelayDropdownOpen(!isDelayDropdownOpen)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-gray-700">
                      {delayFilters.length === 0
                        ? "ทั้งหมด"
                        : `เลือกแล้ว ${delayFilters.length} ช่วง`}
                    </span>
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isDelayDropdownOpen ? "rotate-180" : ""
                      }`}
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </button>

                {isDelayDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white shadow-lg">
                    <div className="space-y-2 p-3">
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delayFilters.includes("0-7")}
                          onChange={() => handleDelayFilterToggle("0-7")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>0-7 วัน</span>
                      </label>
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delayFilters.includes("7-14")}
                          onChange={() => handleDelayFilterToggle("7-14")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>7-14 วัน</span>
                      </label>
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delayFilters.includes("14-30")}
                          onChange={() => handleDelayFilterToggle("14-30")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>14-30 วัน</span>
                      </label>
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delayFilters.includes("30-90")}
                          onChange={() => handleDelayFilterToggle("30-90")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>30-90 วัน</span>
                      </label>
                      <label className="flex items-center text-sm hover:bg-gray-50 rounded px-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={delayFilters.includes("90-180")}
                          onChange={() => handleDelayFilterToggle("90-180")}
                          className="mr-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>90-180 วัน</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  ค้นหาชื่องาน
                </label>
                <input
                  type="text"
                  value={jobNameSearch}
                  onChange={(e) => setJobNameSearch(e.target.value)}
                  placeholder="ค้นหาชื่องาน..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  ค้นหาชื่อผู้เปิด
                </label>
                <input
                  type="text"
                  value={createdBySearch}
                  onChange={(e) => setCreatedBySearch(e.target.value)}
                  placeholder="ค้นหาชื่อผู้เปิด..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : !data || !data.data || data.data.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <p className="text-gray-500">ไม่พบข้อมูล PR</p>
            </div>
          ) : (() => {
            // Filter ข้อมูลตาม poFilters และ delayFilters
            let filteredData = data.data.filter((pr: any) => {
              // Filter ตาม PO status
              if (poFilters.length > 0) {
                const poStatus = calculatePOStatus(pr.total_lines, pr.lines_with_po);
                const poMatch = poFilters.some((filter) => {
                  if (filter === "complete") {
                    return poStatus.percentage === 100; // ออก PO ครบแล้ว
                  } else if (filter === "partial") {
                    return poStatus.percentage > 0 && poStatus.percentage < 100; // ยังไม่ครบ
                  } else if (filter === "none") {
                    return poStatus.percentage === 0; // ยังไม่ได้ออกเลย
                  }
                  return false;
                });

                if (!poMatch) return false;
              }

              // Filter ตาม delay range
              if (delayFilters.length > 0) {
                const delayDays = calculateDelayDays(pr.create_date, pr.receipt_date);
                const delayMatch = delayFilters.some((filter) => {
                  const [start, end] = filter.split("-").map(Number);
                  return delayDays >= (start ?? 0) && delayDays <= (end ?? 180);
                });

                if (!delayMatch) return false;
              }

              // Filter ตามชื่องาน
              if (jobNameSearch.trim()) {
                const jobName = pr.job_name || "";
                if (!jobName.toLowerCase().includes(jobNameSearch.toLowerCase().trim())) {
                  return false;
                }
              }

              // Filter ตามชื่อผู้เปิด
              if (createdBySearch.trim()) {
                const reqName = pr.req_name || "";
                if (!reqName.toLowerCase().includes(createdBySearch.toLowerCase().trim())) {
                  return false;
                }
              }

              return true;
            });

            // Sort ข้อมูลตามคอลัมน์ล่าช้า
            filteredData = [...filteredData].sort((a: any, b: any) => {
              const delayA = calculateDelayDays(a.create_date, a.receipt_date);
              const delayB = calculateDelayDays(b.create_date, b.receipt_date);

              if (delaySortOrder === "asc") {
                return delayA - delayB; // น้อยไปมาก (ลูกศรขึ้น)
              } else {
                return delayB - delayA; // มากไปน้อย (ลูกศรลง)
              }
            });

            if (filteredData.length === 0) {
              return (
                <div className="rounded-lg bg-white p-12 text-center shadow">
                  <p className="text-gray-500">ไม่พบข้อมูลที่ตรงกับเงื่อนไข</p>
                </div>
              );
            }

            return (
              <div className="overflow-x-auto rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500 w-12">
                        {/* คอลัมน์ลูกศร */}
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        เลข PR
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        ชื่องาน
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        ชื่อผู้เปิด
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        โครงการ
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        วันที่เปิด PR
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        วันที่รับเอกสาร
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        สถานะ
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        <button
                          onClick={handleDelaySort}
                          className="flex items-center justify-center w-full hover:text-gray-700 transition-colors"
                        >
                          <span>ล่าช้า (วัน)</span>
                          <svg
                            className="ml-1 h-4 w-4"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            {delaySortOrder === "asc" ? (
                              <path
                                fillRule="evenodd"
                                d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z"
                                clipRule="evenodd"
                              />
                            ) : (
                              <path
                                fillRule="evenodd"
                                d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            )}
                          </svg>
                        </button>
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        PO
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        WO
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredData.map((pr: any) => {
                    const isClosed = isPRClosed(pr.doc_status);
                    const delayDays = calculateDelayDays(pr.create_date, pr.receipt_date);
                    const poStatus = calculatePOStatus(pr.total_lines, pr.lines_with_po);
                    const isExpanded = expandedRows.has(pr.doc_num);

                    // กำหนดสี PO status
                    let poStatusColor = "bg-red-100 text-red-800"; // ไม่มี PO เลย
                    if (poStatus.percentage === 100) {
                      poStatusColor = "bg-green-100 text-green-800"; // ครบ
                    } else if (poStatus.percentage > 0) {
                      poStatusColor = "bg-orange-100 text-orange-800"; // มีบางส่วน
                    }

                    return (
                      <>
                        <tr
                          key={pr.doc_num}
                          className={isClosed ? "bg-gray-100" : "hover:bg-gray-50"}
                        >
                          {/* คอลัมน์ลูกศร */}
                          <td className="whitespace-nowrap px-2 py-3 text-center">
                            <button
                              onClick={() => toggleExpandRow(pr.doc_num)}
                              className="inline-flex items-center justify-center w-6 h-6 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title={isExpanded ? "ย่อ" : "ขยาย"}
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                          <button
                            onClick={() => setSelectedPR(pr.doc_num)}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                          >
                            {pr.doc_num}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {pr.job_name || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatName(pr.req_name)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {pr.project_code ? (
                            <span
                              className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800 cursor-help"
                              title={pr.project_name || pr.project_code}
                            >
                              {pr.project_code}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {new Date(pr.create_date).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {pr.receipt_date
                            ? new Date(pr.receipt_date).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              isClosed
                                ? "bg-gray-200 text-gray-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {isClosed ? "Closed" : "Open"}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm font-semibold text-gray-900">
                          {delayDays}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center text-sm">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${poStatusColor}`}
                          >
                            {poStatus.withPO}/{poStatus.total}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">
                          {pr.wo_numbers_arr && pr.wo_numbers_arr.length > 0 ? (
                            <div className="flex flex-wrap gap-1 justify-center">
                              {pr.wo_numbers_arr.map((wo: number) => (
                                <button
                                  key={wo}
                                  onClick={() => setSelectedWO(wo)}
                                  className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-800 hover:bg-teal-200 hover:text-teal-900 cursor-pointer transition"
                                  title="คลิกเพื่อดูรายละเอียด WO"
                                >
                                  WO-{wo}
                                </button>
                              ))}
                            </div>
                          ) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedPRForReceipt(pr.doc_num);
                              setSelectedPRData(pr);
                            }}
                            className={`inline-flex items-center rounded-md px-3 py-1.5 text-xs font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              pr.receipt_date && (!pr.approval_status || pr.approval_status === 'Waiting')
                                ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 focus:ring-yellow-500'
                                : pr.receipt_date && pr.approval_status === 'Approve'
                                ? 'bg-green-200 text-green-800 hover:bg-green-300 focus:ring-green-500'
                                : pr.receipt_date && pr.approval_status === 'Reject'
                                ? 'bg-red-100 text-red-800 hover:bg-red-200 focus:ring-red-500'
                                : 'bg-green-50 text-green-700 hover:bg-green-100 focus:ring-green-500'
                            }`}
                            title={
                              pr.receipt_date && (!pr.approval_status || pr.approval_status === 'Waiting')
                                ? `รอยืนยัน - รับเอกสารเมื่อ: ${new Date(pr.receipt_date).toLocaleDateString('th-TH')}${pr.received_by ? ` โดย ${pr.received_by}` : ''}`
                                : pr.receipt_date && pr.approval_status === 'Approve'
                                ? `อนุมัติแล้ว - รับเอกสารเมื่อ: ${new Date(pr.receipt_date).toLocaleDateString('th-TH')}${pr.received_by ? ` โดย ${pr.received_by}` : ''}`
                                : pr.receipt_date && pr.approval_status === 'Reject'
                                ? `ปฏิเสธ - รับเอกสารเมื่อ: ${new Date(pr.receipt_date).toLocaleDateString('th-TH')}${pr.received_by ? ` โดย ${pr.received_by}` : ''}`
                                : 'บันทึกการรับเอกสาร'
                            }
                          >
                            {pr.receipt_date && (!pr.approval_status || pr.approval_status === 'Waiting')
                              ? '⏳ รอยืนยัน'
                              : pr.receipt_date && pr.approval_status === 'Approve'
                              ? '✓ รับแล้ว'
                              : pr.receipt_date && pr.approval_status === 'Reject'
                              ? '❌ ปฏิเสธ'
                              : '📋 รับเอกสาร'}
                          </button>
                        </td>
                      </tr>
                      {/* Expanded Row */}
                      {isExpanded && (
                        <ExpandedPRRow
                          prNo={pr.doc_num}
                          prSummary={pr}
                          isExpanded={isExpanded}
                          onPOClick={setSelectedPO}
                        />
                      )}
                    </>
                    );
                  })}
                </tbody>
              </table>
              {/* Summary */}
              <div className="mt-4 px-4 pb-4 text-sm text-gray-600">
                แสดง {filteredData.length} รายการ
                {poFilters.length > 0 && ` (กรองจากทั้งหมด ${data.data.length} รายการ)`}
              </div>
            </div>
            );
          })()}
        </div>
      </div>

      {/* PR Detail Modal */}
      {selectedPR && (
        <PRDetailModal
          prNo={selectedPR}
          isOpen={true}
          onClose={() => setSelectedPR(null)}
        />
      )}

      {/* PR Document Receipt Modal */}
      {selectedPRForReceipt && selectedPRData && (
        <PRDocumentReceiptModal
          prNo={selectedPRForReceipt}
          prCreateDate={selectedPRData?.create_date ? (new Date(selectedPRData.create_date).toISOString().split('T')[0] ?? null) : null}
          isOpen={true}
          onClose={() => {
            setSelectedPRForReceipt(null);
            setSelectedPRData(null);
            void refetch(); // Refresh data after closing modal
          }}
        />
      )}

      {/* PO Detail Modal (from expanded row) */}
      {selectedPO && (
        <PODetailModal
          poNo={selectedPO}
          isOpen={true}
          onClose={() => setSelectedPO(null)}
          hideTrackingButtons={false}
        />
      )}

      {/* WO Detail Modal */}
      {selectedWO && (
        <WODetailModal
          woNo={selectedWO}
          isOpen={true}
          onClose={() => setSelectedWO(null)}
        />
      )}
    </>
  );
}
