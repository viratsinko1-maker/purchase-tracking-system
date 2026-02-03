import { useState, useMemo } from "react";
import Head from "next/head";
import PageGuard from "~/components/PageGuard";
import { api } from "~/utils/api";

// Helper: format date
function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Helper: get default date range (current month)
function getDefaultDateRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().split("T")[0]!,
    to: to.toISOString().split("T")[0]!,
  };
}

function WCContent() {
  const defaultDates = useMemo(() => getDefaultDateRange(), []);
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  // Fetch WC list
  const { data, isLoading } = api.wSeries.getWCList.useQuery({
    dateFrom,
    dateTo,
    search: search || undefined,
  });

  const handleSearch = () => {
    setSearch(searchInput);
  };

  const handleReset = () => {
    setDateFrom(defaultDates.from);
    setDateTo(defaultDates.to);
    setSearch("");
    setSearchInput("");
  };

  return (
    <>
      <Head>
        <title>WC - Work Complete | W Series</title>
      </Head>

      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900">WC - Work Complete</h1>
            <p className="mt-1 text-sm text-gray-600">รายการปิดงาน (Work Complete) จากระบบ SAP</p>
          </div>

          {/* Filter Bar */}
          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <div className="flex flex-wrap items-end gap-3">
              {/* Date From */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">จากวันที่</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ถึงวันที่</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                />
              </div>

              {/* Search */}
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-medium text-gray-600 mb-1">ค้นหา</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="เลข WC, WO, ผู้ขอ, เครื่องจักร..."
                    className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                  >
                    ค้นหา
                  </button>
                </div>
              </div>

              {/* Reset */}
              <button
                onClick={handleReset}
                className="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                รีเซ็ต
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="mb-4 text-sm text-gray-600">
            พบ {data?.total || 0} รายการ
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-green-600"></div>
            </div>
          )}

          {/* Cards */}
          {!isLoading && data?.data && (
            <div className="space-y-3">
              {data.data.length === 0 ? (
                <div className="rounded-lg bg-white p-8 text-center shadow">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-gray-500">ไม่พบข้อมูล</p>
                </div>
              ) : (
                data.data.map((wc: any) => (
                  <div key={wc.wc_doc_num} className="rounded-lg bg-white p-4 shadow hover:shadow-md transition">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-green-700">WC #{wc.wc_doc_num}</span>
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            {wc.wc_series_name}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 mt-0.5">
                          อ้างอิง WO: <span className="font-medium text-teal-600">#{wc.wo_doc_num}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        ✓ ปิดงานแล้ว
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">ผู้ขอ:</span>
                        <span className="ml-1 font-medium">{wc.req_name || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">หน่วยงาน:</span>
                        <span className="ml-1 font-medium">{wc.dept_name || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">เครื่องจักร:</span>
                        <span className="ml-1 font-medium">{wc.pr_mac || "-"}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">ชื่อเครื่อง:</span>
                        <span className="ml-1 font-medium">{wc.item_name || "-"}</span>
                      </div>
                    </div>

                    {/* Order Description */}
                    {wc.wo_order_1 && (
                      <div className="mt-2 text-sm bg-gray-50 rounded p-2">
                        <span className="text-gray-500">รายละเอียดงาน:</span>
                        <span className="ml-1">{wc.wo_order_1}</span>
                      </div>
                    )}

                    {/* Closure Info */}
                    <div className="mt-3 space-y-2">
                      {/* Reason */}
                      {wc.wc_reason_1 && (
                        <div className="text-sm p-2 bg-blue-50 rounded border border-blue-100">
                          <span className="text-blue-600 font-medium">เหตุผลปิดงาน:</span>
                          <span className="ml-1">{wc.wc_reason_1}</span>
                        </div>
                      )}

                      {/* Work Commitment */}
                      {wc.wc_work_commit_1 && (
                        <div className="text-sm p-2 bg-green-50 rounded border border-green-100">
                          <span className="text-green-600 font-medium">บันทึกการทำงาน:</span>
                          <span className="ml-1">{wc.wc_work_commit_1}</span>
                        </div>
                      )}
                    </div>

                    {/* Machine Downtime & Dates */}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                      <div>
                        <span>วันที่ขอ:</span>
                        <span className="ml-1 text-gray-700">{formatDate(wc.doc_date)}</span>
                      </div>
                      {wc.wc_close_date && (
                        <div>
                          <span>วันปิดงาน:</span>
                          <span className="ml-1 text-green-600 font-medium">{formatDate(wc.wc_close_date)}</span>
                        </div>
                      )}
                      {wc.due_mc_stop !== null && wc.due_mc_stop !== undefined && (
                        <div className="px-2 py-0.5 bg-red-50 rounded">
                          <span className="text-red-600">เวลาเครื่องหยุดรวม:</span>
                          <span className="ml-1 font-medium text-red-700">{wc.due_mc_stop} ชั่วโมง</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function WCPage() {
  return (
    <PageGuard action="w_series_wc.read" pageName="WC - Work Complete">
      <WCContent />
    </PageGuard>
  );
}
