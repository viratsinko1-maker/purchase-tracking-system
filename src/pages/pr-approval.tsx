/**
 * PR Approval Page (My Pending Approvals)
 * หน้าสำหรับแสดง PR ที่รอการอนุมัติของผู้ใช้ปัจจุบัน
 * เข้าถึงได้โดยคลิกที่กระดิ่งใน TopBar
 */

import { useState } from "react";
import { api } from "~/utils/api";
import Head from "next/head";
import { useAuth } from "~/hooks/useAuth";
import PRDocumentReceiptModal from "~/components/PRDocumentReceiptModal";
import PRDetailModal from "~/components/PRDetailModal";
import { useRouter } from "next/router";

// Import shared utils
import { formatThaiDate } from "~/utils/dateUtils";
import { formatName } from "~/utils/formatters";

// Alias for backward compatibility
const formatDate = formatThaiDate;

export default function PRApprovalPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [selectedPrNo, setSelectedPrNo] = useState<number | null>(null);
  const [selectedPrNoForDetail, setSelectedPrNoForDetail] = useState<number | null>(null);

  // Query pending approvals list สำหรับ user ปัจจุบัน
  const { data: pendingApprovals = [], isLoading, refetch } = api.pr.getMyPendingApprovals.useQuery(
    {
      userId: user?.id || '',
      userName: user?.name || undefined,
      userRole: user?.role || undefined,
    },
    { enabled: !!user?.id }
  );

  // Query PR summary data เพื่อแสดงรายละเอียดเพิ่มเติม
  const prNumbers = pendingApprovals.map((item) => item.prNo);
  const { data: prSummaryData } = api.pr.getAllSummary.useQuery(
    {
      dateFrom: '2020-01-01',
      dateTo: new Date().toISOString().split('T')[0] || '',
    },
    { enabled: prNumbers.length > 0 }
  );

  // สร้าง Map สำหรับ lookup PR summary
  const prSummaryMap = new Map<number, any>();
  if (prSummaryData?.data) {
    prSummaryData.data.forEach((pr: any) => {
      if (prNumbers.includes(pr.doc_num)) {
        prSummaryMap.set(pr.doc_num, pr);
      }
    });
  }

  // Get stage badge color
  const getStageBadgeColor = (stage: string) => {
    switch (stage) {
      case 'requester':
        return 'bg-purple-100 text-purple-800';
      case 'line':
        return 'bg-blue-100 text-blue-800';
      case 'cost_center':
        return 'bg-green-100 text-green-800';
      case 'procurement':
        return 'bg-orange-100 text-orange-800';
      case 'vpc':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // แสดง loading ขณะตรวจสอบสิทธิ์
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="text-gray-600">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">กรุณาเข้าสู่ระบบ</p>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>รออนุมัติของฉัน - PR & PO Tracking</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-[98%]">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.back()}
                  className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 transition"
                  title="กลับ"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                    <svg className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    รอการอนุมัติของฉัน
                  </h1>
                  <p className="mt-1 text-gray-600">
                    แสดง PR ที่รอการอนุมัติจากคุณ ({pendingApprovals.length} รายการ)
                  </p>
                </div>
              </div>
            </div>
            <div className="text-right bg-white rounded-lg px-4 py-2 shadow-sm">
              <p className="text-sm text-gray-600">ผู้ใช้: <span className="font-semibold text-gray-900">{user.name || user.username}</span></p>
              <p className="text-sm text-gray-600">Role: <span className="font-semibold text-indigo-600">{user.role}</span></p>
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
          ) : pendingApprovals.length === 0 ? (
            <div className="rounded-lg bg-white p-12 text-center shadow">
              <svg className="mx-auto h-16 w-16 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="mt-4 text-lg font-semibold text-gray-900">ไม่มี PR ที่รอการอนุมัติ</h3>
              <p className="mt-2 text-gray-500">คุณไม่มี PR ที่ต้องอนุมัติในขณะนี้</p>
            </div>
          ) : (
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
                      ผู้ขอ PR
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      วันที่สร้าง
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      ขั้นตอนที่รอ
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {pendingApprovals.map((item) => {
                    const prSummary = prSummaryMap.get(item.prNo);

                    return (
                      <tr key={`${item.prNo}-${item.stage}`} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium">
                          <button
                            onClick={() => setSelectedPrNoForDetail(item.prNo)}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer transition"
                            title="คลิกเพื่อดูรายละเอียด PR"
                          >
                            PR #{item.prNo}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="max-w-xs truncate" title={prSummary?.job_name || '-'}>
                            {prSummary?.job_name || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatName(prSummary?.req_name || '-')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {formatDate(item.createdAt)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStageBadgeColor(item.stage)}`}>
                            {item.stageName}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedPrNo(item.prNo)}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600 transition focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ดู / อนุมัติ
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Summary */}
              <div className="px-4 py-3 text-sm text-gray-600 border-t border-gray-200">
                แสดง {pendingApprovals.length} รายการ
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="mt-6 rounded-lg bg-white p-4 shadow">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">คำอธิบายขั้นตอนการอนุมัติ</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800">
                  ผู้อนุมัติตามสายงาน
                </span>
                <span className="text-xs text-gray-500">Line Approver</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-800">
                  ผู้อนุมัติตาม Cost Center
                </span>
                <span className="text-xs text-gray-500">Cost Center Approver</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-orange-100 text-orange-800">
                  งานจัดซื้อพัสดุ
                </span>
                <span className="text-xs text-gray-500">Procurement (Manager)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-800">
                  VP-C
                </span>
                <span className="text-xs text-gray-500">Vice President (Approval)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PR Document Receipt Modal */}
      {selectedPrNo && (
        <PRDocumentReceiptModal
          prNo={selectedPrNo}
          prCreateDate={null}
          isOpen={true}
          onClose={() => {
            setSelectedPrNo(null);
            void refetch(); // Refresh data after closing modal
          }}
        />
      )}

      {/* PR Detail Modal */}
      {selectedPrNoForDetail && (
        <PRDetailModal
          prNo={selectedPrNoForDetail}
          isOpen={true}
          onClose={() => setSelectedPrNoForDetail(null)}
        />
      )}
    </>
  );
}
