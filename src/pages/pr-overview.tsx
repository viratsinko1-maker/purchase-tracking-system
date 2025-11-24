/**
 * PR Overview Page
 * แสดงข้อมูล PR แบบตาราง เพื่อให้เห็นภาพรวมและสถานะของ PR แต่ละรายการ
 */

import { useState, useEffect, useRef } from "react";
import { api } from "~/utils/api";
import Head from "next/head";
import PRDetailModal from "~/components/PRDetailModal";

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
  const [delayFilters, setDelayFilters] = useState<string[]>([]); // Array: "0-7", "7-14", "14-30", "30-90", "90-180"
  const [isDelayDropdownOpen, setIsDelayDropdownOpen] = useState(false);
  const delayDropdownRef = useRef<HTMLDivElement>(null);
  const [delaySortOrder, setDelaySortOrder] = useState<"asc" | "desc">("asc"); // State สำหรับการ sort คอลัมน์ล่าช้า (default: asc)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (poDropdownRef.current && !poDropdownRef.current.contains(event.target as Node)) {
        setIsPoDropdownOpen(false);
      }
      if (delayDropdownRef.current && !delayDropdownRef.current.contains(event.target as Node)) {
        setIsDelayDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
    fromDate.setDate(today.getDate() - maxDelay);

    setDateFrom(fromDate.toISOString().split("T")[0] as string);
    setDateTo(today.toISOString().split("T")[0] as string);
  };

  // ฟังก์ชันจัดการการ sort คอลัมน์ล่าช้า (สลับระหว่าง asc กับ desc)
  const handleDelaySort = () => {
    setDelaySortOrder(delaySortOrder === "asc" ? "desc" : "asc");
  };

  // คำนวณจำนวนวันล่าช้า
  const calculateDelayDays = (prDate: Date) => {
    const today = new Date();
    const pr = new Date(prDate);
    const diffTime = today.getTime() - pr.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
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

  // สลับชื่อ-นามสกุล จาก "นามสกุล, ชื่อ" เป็น "ชื่อ นามสกุล"
  const formatName = (name: string) => {
    if (!name) return "-";
    if (name.includes(",")) {
      const parts = name.split(",").map(part => part.trim());
      if (parts.length === 2) {
        return `${parts[1]} ${parts[0]}`; // สลับจาก "นามสกุล, ชื่อ" เป็น "ชื่อ นามสกุล"
      }
    }
    return name;
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
                const delayDays = calculateDelayDays(pr.doc_date);
                const delayMatch = delayFilters.some((filter) => {
                  const [start, end] = filter.split("-").map(Number);
                  return delayDays >= (start ?? 0) && delayDays <= (end ?? 180);
                });

                if (!delayMatch) return false;
              }

              return true;
            });

            // Sort ข้อมูลตามคอลัมน์ล่าช้า
            filteredData = [...filteredData].sort((a: any, b: any) => {
              const delayA = calculateDelayDays(a.doc_date);
              const delayB = calculateDelayDays(b.doc_date);

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
                        วันที่เปิด PR
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
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        PO ล่าสุด
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        วันที่ PO ออก
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredData.map((pr: any) => {
                    const isClosed = isPRClosed(pr.doc_status);
                    const delayDays = calculateDelayDays(pr.doc_date);
                    const poStatus = calculatePOStatus(pr.total_lines, pr.lines_with_po);

                    // กำหนดสี PO status
                    let poStatusColor = "bg-red-100 text-red-800"; // ไม่มี PO เลย
                    if (poStatus.percentage === 100) {
                      poStatusColor = "bg-green-100 text-green-800"; // ครบ
                    } else if (poStatus.percentage > 0) {
                      poStatusColor = "bg-orange-100 text-orange-800"; // มีบางส่วน
                    }

                    return (
                      <tr
                        key={pr.doc_num}
                        className={isClosed ? "bg-gray-100" : "hover:bg-gray-50"}
                      >
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
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {new Date(pr.doc_date).toLocaleDateString("th-TH", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
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
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {pr.latest_po_num || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {pr.latest_po_date
                            ? new Date(pr.latest_po_date).toLocaleDateString("th-TH", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "-"}
                        </td>
                      </tr>
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
    </>
  );
}
