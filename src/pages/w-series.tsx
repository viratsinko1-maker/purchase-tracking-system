import { useState, useEffect } from "react";
import Head from "next/head";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";

export default function WSeriesTracking() {
  const { requireRole } = useAuth();

  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [onlyWithPOPR, setOnlyWithPOPR] = useState(false);
  const pageSize = 100;

  // Check role access - Admin, Manager, POPR can access
  useEffect(() => {
    requireRole(['Admin', 'Manager', 'POPR', 'PR']);
  }, [requireRole]);

  // ดึงข้อมูล W Series
  const { data, isLoading, refetch } = api.wSeries.getAll.useQuery({
    page: currentPage,
    pageSize,
    onlyWithPOPR,
  });

  // ดึงข้อมูล sync log ล่าสุด
  const { data: lastSync } = api.wSeries.getLastSyncLog.useQuery();

  const wSeriesData = data?.data || [];
  const pagination = data?.pagination;

  // ฟังก์ชันเปลี่ยนหน้า
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // ฟังก์ชันเปลี่ยน filter
  const handleFilterChange = (checked: boolean) => {
    setOnlyWithPOPR(checked);
    setCurrentPage(1); // Reset to first page
  };

  // สร้าง page numbers สำหรับ pagination
  const renderPageNumbers = () => {
    if (!pagination) return null;

    const { totalPages, page } = pagination;
    const maxPagesToShow = 5;
    const pages: number[] = [];

    let startPage = Math.max(1, page - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center gap-2">
        {/* First Page */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => handlePageChange(1)}
              className="px-3 py-1 border rounded hover:bg-gray-100"
            >
              1
            </button>
            {startPage > 2 && <span>...</span>}
          </>
        )}

        {/* Page Numbers */}
        {pages.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => handlePageChange(pageNum)}
            className={`px-3 py-1 border rounded ${
              pageNum === page
                ? "bg-blue-500 text-white"
                : "hover:bg-gray-100"
            }`}
          >
            {pageNum}
          </button>
        ))}

        {/* Last Page */}
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span>...</span>}
            <button
              onClick={() => handlePageChange(totalPages)}
              className="px-3 py-1 border rounded hover:bg-gray-100"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>W Series Tracking</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-4">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">W Series Tracking</h1>
            <div className="text-sm text-gray-600">
              {lastSync?.data && (
                <div>
                  Last Sync:{" "}
                  {new Date(lastSync.data.sync_date).toLocaleString("th-TH", {
                    timeZone: "Asia/Bangkok",
                  })}
                  {" "}
                  ({lastSync.data.records_synced} records)
                </div>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={onlyWithPOPR}
                onChange={(e) => handleFilterChange(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-gray-700">
                แสดงเฉพาะแถวที่มีทั้ง PO และ PR
              </span>
            </label>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-600">กำลังโหลดข้อมูล...</div>
            </div>
          )}

          {/* Data Table */}
          {!isLoading && wSeriesData.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg bg-white shadow">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        PO No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        PR No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        WO No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        WR No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        WA No.
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        WC No.
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {wSeriesData.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {item.po_doc_num || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {item.pr_no || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                          {item.wo_doc_num}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {item.wr_doc_num || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {item.wa_doc_num || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {item.wc_doc_num || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between rounded-lg bg-white p-4 shadow">
                  <div className="text-sm text-gray-700">
                    แสดง {((pagination.page - 1) * pageSize) + 1} -{" "}
                    {Math.min(pagination.page * pageSize, pagination.totalCount)}{" "}
                    จาก {pagination.totalCount} รายการ
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className={`rounded px-4 py-2 ${
                        pagination.hasPrev
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "cursor-not-allowed bg-gray-300 text-gray-500"
                      }`}
                    >
                      ← ก่อนหน้า
                    </button>

                    {renderPageNumbers()}

                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className={`rounded px-4 py-2 ${
                        pagination.hasNext
                          ? "bg-blue-500 text-white hover:bg-blue-600"
                          : "cursor-not-allowed bg-gray-300 text-gray-500"
                      }`}
                    >
                      ถัดไป →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* No Data */}
          {!isLoading && wSeriesData.length === 0 && (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <p className="text-gray-600">ไม่พบข้อมูล</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
