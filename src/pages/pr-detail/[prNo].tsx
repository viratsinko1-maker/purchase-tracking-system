import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { api } from "~/utils/api";

// Import shared utils
import { formatThaiDate } from "~/utils/dateUtils";
import { formatName, formatNumber } from "~/utils/formatters";

// Alias for backward compatibility
const formatDate = (date: Date | string | null) => formatThaiDate(date, { year: 'numeric', month: 'long', day: 'numeric' });

export default function PRDetail() {
  const router = useRouter();
  const { prNo } = router.query;

  const prNumber = typeof prNo === "string" ? parseInt(prNo) : 0;

  // ดึงข้อมูล PR detail
  const { data: prData, isLoading } = api.pr.getByPRNo.useQuery(
    { prNo: prNumber },
    {
      enabled: prNumber > 0,
    }
  );

  // ดึงรายการ PO ทั้งหมดที่เกี่ยวข้องกับ PR นี้
  const poNumbers = prData?.lines
    .flatMap((line: any) => line.po_list.map((po: any) => po.po_doc_num))
    .filter((num: number, index: number, self: number[]) => self.indexOf(num) === index) || [];

  // ดึงข้อมูล PO Info (วันที่ออก PO)
  const { data: poInfoMap } = api.pr.getPOInfoBatch.useQuery(
    { poNumbers },
    {
      enabled: poNumbers.length > 0,
    }
  );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-sm text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!prData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">ไม่พบข้อมูล PR</h2>
          <p className="mt-2 text-gray-600">PR #{prNo} ไม่มีในระบบ</p>
          <Link
            href={{
              pathname: "/pr-tracking",
              query: router.query
            }}
            className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            กลับไปหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>PR #{prData.doc_num} - PR Tracking System</title>
        <meta name="description" content={`Purchase Request ${prData.doc_num}`} />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {/* Back Button */}
          <div className="mb-4">
            <Link
              href={{
                pathname: "/pr-tracking",
                query: router.query // preserve all filter params
              }}
              className="inline-flex items-center text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              <svg
                className="mr-2 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              กลับไปหน้าหลัก
            </Link>
          </div>

          {/* Header Card */}
          <div className="mb-6 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold">PR #{prData.doc_num}</h1>
                <p className="mt-1 text-blue-100">{prData.job_name || "-"}</p>
              </div>
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  prData.status === "O"
                    ? "bg-green-500 text-white"
                    : "bg-gray-300 text-gray-800"
                }`}
              >
                {prData.status === "O" ? "Open" : "Closed"}
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-blue-100">ผู้เปิด PR</p>
                <p className="mt-1 text-lg font-semibold">{formatName(prData.req_name)}</p>
              </div>
              <div>
                <p className="text-sm text-blue-100">หน่วยงาน</p>
                <p className="mt-1 text-lg font-semibold">{prData.department || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-blue-100">วันที่เปิด PR</p>
                <p className="mt-1 text-lg font-semibold">{formatDate(prData.date)}</p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">ข้อมูล PR</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-500">วันที่ครบกำหนด</label>
                <p className="mt-1 text-base text-gray-900">{formatDate(prData.due_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">วันที่ต้องการของ</label>
                <p className="mt-1 text-base text-gray-900">{formatDate(prData.req_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">วันที่อัปเดตล่าสุด</label>
                <p className="mt-1 text-base text-gray-900">{formatDate(prData.update_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">จำนวน Lines</label>
                <p className="mt-1 text-base text-gray-900">
                  {prData.lines?.length || 0} รายการ
                </p>
              </div>
              {prData.remarks && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500">หมายเหตุ</label>
                  <p className="mt-1 text-base text-gray-900">{prData.remarks}</p>
                </div>
              )}
            </div>
          </div>

          {/* Lines Section */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              รายการ PR Lines ({prData.lines?.length || 0})
            </h2>

            {prData.lines && prData.lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        Line
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        รหัสสินค้า
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        รายละเอียด
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        จำนวน
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        สถานะ
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        PO
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                        รายละเอียด PO
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {prData.lines.map((line: any) => {
                      const rowSpan = Math.max(line.po_list?.length || 1, 1);
                      return line.po_list && line.po_list.length > 0 ? (
                        line.po_list.map((po: any, poIdx: number) => (
                          <tr key={`${line.line_id}-${poIdx}`} className={line.has_po ? "bg-green-50" : "bg-orange-50"}>
                            {poIdx === 0 && (
                              <>
                                <td rowSpan={rowSpan} className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                                  #{line.line_num}
                                </td>
                                <td rowSpan={rowSpan} className="px-3 py-2 text-sm text-gray-600">
                                  {line.item_code || "-"}
                                </td>
                                <td rowSpan={rowSpan} className="px-3 py-2 text-sm text-gray-900">
                                  {line.description || "-"}
                                  {line.project && (
                                    <div className="text-xs text-gray-500">โครงการ: {line.project}</div>
                                  )}
                                  {line.vendor && (
                                    <div className="text-xs text-gray-500">ผู้ขาย: {line.vendor}</div>
                                  )}
                                </td>
                                <td rowSpan={rowSpan} className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                                  {formatNumber(line.quantity)}
                                </td>
                                <td rowSpan={rowSpan} className="whitespace-nowrap px-3 py-2">
                                  <span
                                    className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                      line.line_status === "O"
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {line.line_status === "O" ? "Open" : "Closed"}
                                  </span>
                                </td>
                              </>
                            )}
                            <td className="whitespace-nowrap px-3 py-2 text-sm">
                              <span className="font-semibold text-blue-600">PO #{po.po_doc_num}</span>
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
                              <div>{po.po_description || "-"}</div>
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
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {line.description || "-"}
                            {line.project && (
                              <div className="text-xs text-gray-500">โครงการ: {line.project}</div>
                            )}
                            {line.vendor && (
                              <div className="text-xs text-gray-500">ผู้ขาย: {line.vendor}</div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-900">
                            {formatNumber(line.quantity)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                line.line_status === "O"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {line.line_status === "O" ? "Open" : "Closed"}
                            </span>
                          </td>
                          <td colSpan={2} className="px-3 py-2 text-center text-sm text-orange-600">
                            <span className="font-semibold">⚠ ยังไม่มี PO</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 py-12 text-center text-gray-500">
                ไม่มีรายการ PR Lines
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
