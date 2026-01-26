import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { api } from "~/utils/api";

// Import shared utils
import { getDefaultDateRange } from "~/utils/dateUtils";

export default function Home() {
  const router = useRouter();
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  // Redirect ไปหน้า PR Tracking ทันทีเมื่อเปิดหน้าแรก
  useEffect(() => {
    void router.push('/pr-tracking');
  }, [router]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [seriesFilter, setSeriesFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [isSyncing, setIsSyncing] = useState(false);
  const [shouldFetch, setShouldFetch] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // ดึงข้อมูล PR-PO (จะไม่ fetch จนกว่า shouldFetch = true)
  const { data, isLoading, refetch } = api.prpo.getAll.useQuery(
    {
      search: search || undefined,
      status: statusFilter || undefined,
      series: seriesFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    },
    {
      enabled: shouldFetch, // จะ fetch เมื่อ shouldFetch = true เท่านั้น
    }
  );

  // ฟังก์ชันค้นหา
  const handleSearch = () => {
    setShouldFetch(true);
    if (shouldFetch) {
      void refetch();
    }
  };

  // Sync mutation
  const syncMutation = api.prpo.sync.useMutation({
    onSuccess: async (data) => {
      setIsSyncing(false);

      // แสดง message พร้อม warning ถ้ามี
      if (data?.message) {
        alert(data.message);
      } else {
        alert('Sync สำเร็จ!');
      }

      // หลัง sync เสร็จ ให้ผู้ใช้ค้นหาใหม่
      if (shouldFetch) {
        await refetch();
      }
    },
    onError: (error) => {
      setIsSyncing(false);
      alert(`เกิดข้อผิดพลาด: ${error.message}`);
    },
  });

  const handleSync = () => {
    if (isSyncing) return;

    const confirmSync = confirm(
      "คุณต้องการซิงค์ข้อมูลจาก SQL Server ใช่หรือไม่?\n\nการซิงค์จะใช้เวลา 1-2 นาที และจะลบข้อมูลเก่าทั้งหมดแล้วดึงข้อมูลใหม่"
    );

    if (confirmSync) {
      setIsSyncing(true);
      syncMutation.mutate();
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatNumber = (num: number | null) => {
    if (num === null) return "-";
    return num.toLocaleString("th-TH");
  };

  return (
    <>
      <Head>
        <title>PR-PO Management System</title>
        <meta name="description" content="Purchase Request & Purchase Order Management" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Loading Overlay */}
      {isSyncing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
          <div className="rounded-lg bg-white p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              <h3 className="text-xl font-semibold text-gray-900">กำลังซิงค์ข้อมูล...</h3>
              <p className="text-sm text-gray-600">กรุณารอสักครู่ ใช้เวลาประมาณ 1-2 นาที</p>
              <p className="text-xs text-gray-500">โปรดอย่าปิดหน้าต่างนี้</p>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-gray-50">
        <div className="px-4 py-4 sm:px-6 lg:px-8">
          {/* Filters */}
          <div className="mb-4 rounded-lg bg-white p-3 shadow">
            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
                <div>
                  <label htmlFor="dateFrom" className="block text-xs font-medium text-gray-700">
                    วันที่เปิด PR (จาก) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="dateFrom"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="dateTo" className="block text-xs font-medium text-gray-700">
                    วันที่เปิด PR (ถึง) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    id="dateTo"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="series" className="block text-xs font-medium text-gray-700">
                    Series
                  </label>
                  <select
                    id="series"
                    value={seriesFilter}
                    onChange={(e) => setSeriesFilter(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="PM">PM</option>
                    <option value="PMA">PMA</option>
                    <option value="PR">PR</option>
                    <option value="WA">WA</option>
                    <option value="WC">WC</option>
                    <option value="WO">WO</option>
                    <option value="WR">WR</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="status" className="block text-xs font-medium text-gray-700">
                    สถานะ
                  </label>
                  <select
                    id="status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">ทั้งหมด</option>
                    <option value="O">Open</option>
                    <option value="C">Closed</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="search" className="block text-xs font-medium text-gray-700">
                    ค้นหา
                  </label>
                  <input
                    type="text"
                    id="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="PR No, PO No, ชื่อ..."
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isLoading ? "กำลังค้นหา..." : "🔍 ค้นหา"}
                </button>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSyncing ? "กำลังซิงค์..." : "🔄 ซิงค์"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const defaults = getDefaultDateRange();
                    setDateFrom(defaults.from);
                    setDateTo(defaults.to);
                    setSearch("");
                    setStatusFilter("");
                    setSeriesFilter("");
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  รีเซ็ต
                </button>
                {shouldFetch && (
                  <span className="text-xs text-gray-600">
                    📅 {dateFrom} ถึง {dateTo}
                  </span>
                )}
              </div>
            </form>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
              <table className="w-full table-fixed divide-y divide-gray-200 text-xs">
                <thead className="sticky top-0 bg-gray-50 z-10">
                  <tr>
                    <th className="w-16 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      PR No
                    </th>
                    <th className="w-16 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      Series
                    </th>
                    <th className="w-20 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      วันที่
                    </th>
                    <th className="w-20 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      Due Date
                    </th>
                    <th className="w-32 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      ผู้เปิด
                    </th>
                    <th className="w-24 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      หน่วยงาน
                    </th>
                    <th className="w-28 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      ชื่องาน
                    </th>
                    <th className="w-32 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      หมายเหตุ
                    </th>
                    <th className="w-14 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      สถานะ
                    </th>
                    <th className="w-16 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      PO No
                    </th>
                    <th className="w-28 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      รายละเอียด PO
                    </th>
                    <th className="w-16 px-1 py-2 text-right text-[10px] font-medium uppercase text-gray-500">
                      จำนวน
                    </th>
                    <th className="w-12 px-1 py-2 text-left text-[10px] font-medium uppercase text-gray-500">
                      หน่วย
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {!shouldFetch ? (
                    <tr>
                      <td colSpan={13} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="rounded-full bg-blue-100 p-4">
                            <svg className="h-12 w-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">เลือกช่วงวันที่และค้นหาข้อมูล</h3>
                            <p className="mt-1 text-sm text-gray-600">
                              กรุณาเลือกวันที่เปิด PR (จาก-ถึง) แล้วกดปุ่ม "🔍 ค้นหา"
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : isLoading ? (
                    <tr>
                      <td colSpan={13} className="px-6 py-12 text-center">
                        <div className="flex justify-center">
                          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">กำลังโหลดข้อมูล...</p>
                      </td>
                    </tr>
                  ) : data?.data.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                        ไม่พบข้อมูลในช่วงวันที่ที่เลือก
                      </td>
                    </tr>
                  ) : (
                    data?.data.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedItem(item)}
                      >
                        <td className="px-1 py-1.5 text-xs font-medium text-gray-900 truncate">
                          {item.prNo}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 truncate">
                          {item.seriesName || "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500">
                          {new Date(item.prDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500">
                          {new Date(item.prDueDate).toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-900 truncate" title={item.prRequester || ""}>
                          {item.prRequester || "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 truncate" title={item.prDepartment || ""}>
                          {item.prDepartment || "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 truncate" title={item.prJobName || ""}>
                          {item.prJobName || "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 truncate" title={item.prRemarks || ""}>
                          {item.prRemarks || "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs">
                          <span
                            className={`inline-flex rounded px-1 py-0.5 text-[10px] font-semibold ${
                              item.prStatus === "O"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.prStatus === "O" ? "Open" : "Close"}
                          </span>
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-900 truncate">
                          {item.poNo ? (
                            <span className="font-medium text-blue-600">{item.poNo}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 truncate" title={item.poDescription || ""}>
                          {item.poDescription || "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 text-right">
                          {item.poQuantity ? formatNumber(Number(item.poQuantity)) : "-"}
                        </td>
                        <td className="px-1 py-1.5 text-xs text-gray-500 truncate">
                          {item.poUnit || "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Info */}
            {shouldFetch && data && data.data.length > 0 && (
              <div className="border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
                <p className="text-sm text-gray-700">
                  แสดง <span className="font-medium">{data.total}</span> รายการ (เรียงตามวันที่เปิด PR จากเก่าไปใหม่)
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">รายละเอียด PR-PO</h2>
                <p className="text-sm text-blue-100 mt-1">PR No: {selectedItem.prNo}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-white hover:bg-white/20 rounded-full p-2 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* PR Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500">
                  ข้อมูล Purchase Request
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">PR DocEntry</label>
                    <p className="text-sm text-gray-900 font-medium">{selectedItem.prDocEntry}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">PR No</label>
                    <p className="text-sm text-gray-900 font-medium">{selectedItem.prNo}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Series Name</label>
                    <p className="text-sm text-gray-900">{selectedItem.seriesName || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">สถานะ</label>
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                        selectedItem.prStatus === "O"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {selectedItem.prStatus === "O" ? "Open" : "Closed"}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">วันที่เปิด PR</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedItem.prDate)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">วันครบกำหนด</label>
                    <p className="text-sm text-gray-900">{formatDate(selectedItem.prDueDate)}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">ผู้เปิด PR</label>
                    <p className="text-sm text-gray-900">{selectedItem.prRequester || "-"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">หน่วยงาน</label>
                    <p className="text-sm text-gray-900">{selectedItem.prDepartment || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">ชื่องาน</label>
                    <p className="text-sm text-gray-900">{selectedItem.prJobName || "-"}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">หมายเหตุ PR</label>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                      {selectedItem.prRemarks || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* PO Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b-2 border-green-500">
                  ข้อมูล Purchase Order
                </h3>
                {selectedItem.poNo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">PO No</label>
                      <p className="text-sm font-medium text-blue-600">{selectedItem.poNo}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">PO Line Number</label>
                      <p className="text-sm text-gray-900">{selectedItem.poLineNum ?? "-"}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">รายละเอียด PO</label>
                      <p className="text-sm text-gray-900 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                        {selectedItem.poDescription || "-"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">จำนวน</label>
                      <p className="text-sm text-gray-900 font-medium">
                        {selectedItem.poQuantity ? formatNumber(Number(selectedItem.poQuantity)) : "-"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">หน่วย</label>
                      <p className="text-sm text-gray-900">{selectedItem.poUnit || "-"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">ยังไม่มี PO สำหรับ PR นี้</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t">
              <button
                onClick={() => setSelectedItem(null)}
                className="w-full md:w-auto px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
