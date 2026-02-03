/**
 * My KPI Page - Personal KPI Dashboard
 * Note: AuthGuard is already provided by _app.tsx, do not add AuthGuard here
 */
import { useState } from "react";
import Head from "next/head";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";

// Helper function to format minutes
const formatDuration = (minutes: number | null): string => {
  if (minutes === null) return "-";
  if (minutes < 60) return `${Math.round(minutes)} นาที`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours} ชม. ${mins} นาที`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days} วัน ${remainingHours} ชม.`;
};

// Helper function to format date
const formatDate = (date: Date | string | null): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Get current Thai year
const getCurrentThaiYear = () => new Date().getFullYear() + 543;

// Get current quarter (1-4)
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);

// On-time rate color
const getOnTimeRateColor = (rate: number | null) => {
  if (rate === null) return 'bg-gray-100 text-gray-800';
  if (rate >= 80) return 'bg-green-100 text-green-800';
  if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

export default function MyKPIPage() {
  const { user } = useAuth();

  // Year/Quarter filter
  const [filterType, setFilterType] = useState<'quarter' | 'year'>('quarter');
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getCurrentQuarter());

  // Build query params
  const queryParams = {
    year: selectedYear,
    quarter: filterType === 'quarter' ? selectedQuarter : undefined,
  };

  // For detail sections (Approval by stage, Recent Sessions) - use date range based on filter
  const getDateRange = () => {
    const gregorianYear = selectedYear - 543;
    if (filterType === 'quarter') {
      const startMonth = (selectedQuarter - 1) * 3;
      const dateFrom = new Date(gregorianYear, startMonth, 1);
      const dateTo = new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59);
      return { dateFrom, dateTo };
    } else {
      const dateFrom = new Date(gregorianYear, 0, 1);
      const dateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
      return { dateFrom, dateTo };
    }
  };

  const { dateFrom, dateTo } = getDateRange();

  // Fetch Summary KPI (new endpoints with year/quarter)
  const { data: approvalSummary, isLoading: loadingApprovalSummary } = api.kpi.getMyApprovalKPISummary.useQuery(
    queryParams,
    { enabled: !!user?.id }
  );

  const { data: receiveSummary, isLoading: loadingReceiveSummary } = api.kpi.getMyReceiveConfirmKPISummary.useQuery(
    queryParams,
    { enabled: !!user?.id }
  );

  const { data: usageSummary, isLoading: loadingUsageSummary } = api.kpi.getMyUsageKPISummary.useQuery(
    queryParams,
    { enabled: !!user?.id }
  );

  // Fetch detail data (existing endpoints)
  const { data: approvalKPI, isLoading: loadingApproval } = api.kpi.getMyApprovalKPI.useQuery(
    { userId: user?.id || '', dateFrom, dateTo },
    { enabled: !!user?.id }
  );

  const { data: receiveKPI, isLoading: loadingReceive } = api.kpi.getMyReceiveConfirmKPI.useQuery(
    { userId: user?.id || '', dateFrom, dateTo },
    { enabled: !!user?.id }
  );

  const { data: usageStats, isLoading: loadingUsage } = api.kpi.getMyUsageStats.useQuery(
    { userId: user?.id || '', dateFrom, dateTo },
    { enabled: !!user?.id }
  );

  const isLoading = loadingApprovalSummary || loadingReceiveSummary || loadingUsageSummary ||
                   loadingApproval || loadingReceive || loadingUsage;

  // Generate year options (last 3 years)
  const yearOptions = Array.from({ length: 3 }, (_, i) => getCurrentThaiYear() - i);

  return (
    <>
      <Head>
        <title>KPI ของฉัน | PR-PO Tracking</title>
      </Head>

      <main className="min-h-screen bg-gray-100 p-6">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">KPI ของฉัน</h1>
            <p className="text-gray-600">ดูประสิทธิภาพการทำงานของคุณ</p>
          </div>

          {/* Year/Quarter Filter */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Type */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterType('quarter')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filterType === 'quarter'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                รายไตรมาส
              </button>
              <button
                onClick={() => setFilterType('year')}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  filterType === 'year'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                รายปี
              </button>
            </div>

            {/* Year Select */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>ปี {y}</option>
              ))}
            </select>

            {/* Quarter Select */}
            {filterType === 'quarter' && (
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700"
              >
                <option value={1}>Q1 (ม.ค. - มี.ค.)</option>
                <option value={2}>Q2 (เม.ย. - มิ.ย.)</option>
                <option value={3}>Q3 (ก.ค. - ก.ย.)</option>
                <option value={4}>Q4 (ต.ค. - ธ.ค.)</option>
              </select>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">กำลังโหลด...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* ===== SUMMARY CARDS (TOP) ===== */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
              {/* Approval Total */}
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-500">Approve ครั้ง</p>
                <p className="text-2xl font-bold text-gray-800">{approvalSummary?.total ?? 0}</p>
              </div>

              {/* Approval On-time Rate */}
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-500">On-time (Approve)</p>
                <p className={`text-2xl font-bold ${
                  (approvalSummary?.onTimeRate ?? 0) >= 80 ? 'text-green-600' :
                  (approvalSummary?.onTimeRate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {approvalSummary?.onTimeRate !== null && approvalSummary?.onTimeRate !== undefined
                    ? `${approvalSummary.onTimeRate}%`
                    : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {approvalSummary?.onTime ?? 0} / {(approvalSummary?.onTime ?? 0) + (approvalSummary?.late ?? 0)}
                </p>
              </div>

              {/* Receive Total */}
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-500">Receive ครั้ง</p>
                <p className="text-2xl font-bold text-gray-800">{receiveSummary?.total ?? 0}</p>
              </div>

              {/* Receive On-time Rate */}
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-500">On-time (Receive)</p>
                <p className={`text-2xl font-bold ${
                  (receiveSummary?.onTimeRate ?? 0) >= 80 ? 'text-green-600' :
                  (receiveSummary?.onTimeRate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {receiveSummary?.onTimeRate !== null && receiveSummary?.onTimeRate !== undefined
                    ? `${receiveSummary.onTimeRate}%`
                    : '-'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {receiveSummary?.onTime ?? 0} / {(receiveSummary?.onTime ?? 0) + (receiveSummary?.late ?? 0)}
                </p>
              </div>

              {/* Usage: Login Count */}
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-500">เข้าใช้งาน</p>
                <p className="text-2xl font-bold text-indigo-600">{usageSummary?.totalLogins ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">ครั้ง</p>
              </div>

              {/* Usage: Total Hours */}
              <div className="rounded-lg bg-white p-4 shadow">
                <p className="text-sm text-gray-500">เวลารวม</p>
                <p className="text-2xl font-bold text-gray-800">{usageSummary?.totalHours ?? 0}</p>
                <p className="text-xs text-gray-400 mt-1">ชั่วโมง</p>
              </div>
            </div>

            {/* ===== USAGE STATS SECTION ===== */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                สถิติการเข้าใช้งาน
              </h2>

              {usageStats && usageStats.summary.totalSessions > 0 ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                    <div className="rounded-lg bg-indigo-50 p-4">
                      <div className="text-sm text-indigo-600">จำนวนครั้งเข้าใช้</div>
                      <div className="mt-1 text-2xl font-bold text-indigo-700">{usageStats.summary.totalSessions}</div>
                      <div className="text-xs text-indigo-500 mt-1">ครั้ง</div>
                    </div>

                    <div className="rounded-lg bg-blue-50 p-4">
                      <div className="text-sm text-blue-600">เวลาใช้งานรวม</div>
                      <div className="mt-1 text-2xl font-bold text-blue-700">{usageStats.summary.totalHours}</div>
                      <div className="text-xs text-blue-500 mt-1">ชั่วโมง ({usageStats.summary.totalMinutes} นาที)</div>
                    </div>

                    <div className="rounded-lg bg-purple-50 p-4">
                      <div className="text-sm text-purple-600">เฉลี่ยต่อครั้ง</div>
                      <div className="mt-1 text-2xl font-bold text-purple-700">{usageStats.summary.avgMinutesPerSession}</div>
                      <div className="text-xs text-purple-500 mt-1">นาที/ครั้ง</div>
                    </div>

                    <div className="rounded-lg bg-gray-50 p-4">
                      <div className="text-sm text-gray-600">วิธีออกจากระบบ</div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-green-600">{usageStats.summary.manualLogouts}</span>
                        <span className="text-gray-400">/</span>
                        <span className="text-lg font-bold text-yellow-600">{usageStats.summary.timeoutLogouts}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">กดออก / หมดเวลา</div>
                    </div>
                  </div>

                  {/* Recent Sessions */}
                  {usageStats.recentSessions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">ประวัติการเข้าใช้งานล่าสุด</h3>
                      <div className="max-h-64 overflow-y-auto">
                        <div className="space-y-2">
                          {usageStats.recentSessions.slice(0, 10).map((session, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">{idx + 1}.</span>
                                <span className="text-gray-900">{formatDate(session.sessionStart)}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-700">{session.durationMinutes} นาที</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs ${
                                  session.logoutType === 'manual' ? 'bg-green-100 text-green-700' :
                                  session.logoutType === 'timeout' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {session.logoutType === 'manual' ? 'กดออก' :
                                   session.logoutType === 'timeout' ? 'หมดเวลา' :
                                   session.logoutType}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  ยังไม่มีข้อมูลการเข้าใช้งานในช่วงเวลานี้
                </div>
              )}
            </div>

            {/* ===== APPROVAL KPI SECTION ===== */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                KPI การอนุมัติ (แยกตามขั้นตอน)
              </h2>

              {approvalKPI && Object.keys(approvalKPI.stages).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ขั้นตอน</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จำนวนครั้ง</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลาเฉลี่ย</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ตรงเวลา</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เกินเวลา</th>
                        <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">On-time Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {approvalKPI.stageOrder.map((stage) => {
                        const stats = approvalKPI.stages[stage];
                        if (!stats) return null;
                        return (
                          <tr key={stage} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                              {approvalKPI.stageNames[stage as keyof typeof approvalKPI.stageNames]}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                              {stats.count}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                              {formatDuration(stats.avgMinutes)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">
                              {stats.onTimeCount}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-red-600 font-medium">
                              {stats.lateCount}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-center">
                              {stats.onTimeRate !== null ? (
                                <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOnTimeRateColor(stats.onTimeRate)}`}>
                                  {stats.onTimeRate}%
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  ยังไม่มีข้อมูล KPI การอนุมัติในช่วงเวลานี้
                </div>
              )}
            </div>

            {/* ===== RECEIVE CONFIRM KPI SECTION ===== */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
                <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                KPI การยืนยันรับของ
              </h2>

              {receiveKPI && receiveKPI.totalCount > 0 ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {/* Total Count */}
                  <div className="rounded-lg bg-gray-50 p-4">
                    <div className="text-sm text-gray-500">จำนวนครั้งทั้งหมด</div>
                    <div className="mt-1 text-2xl font-bold text-gray-900">{receiveKPI.totalCount}</div>
                  </div>

                  {/* Average Time */}
                  <div className="rounded-lg bg-blue-50 p-4">
                    <div className="text-sm text-blue-600">เวลาเฉลี่ย</div>
                    <div className="mt-1 text-2xl font-bold text-blue-700">
                      {formatDuration(receiveKPI.avgMinutes)}
                    </div>
                  </div>

                  {/* On-time Rate */}
                  <div className="rounded-lg bg-green-50 p-4">
                    <div className="text-sm text-green-600">On-time Rate</div>
                    <div className="mt-1 text-2xl font-bold text-green-700">
                      {receiveKPI.onTimeRate !== null ? `${receiveKPI.onTimeRate}%` : '-'}
                    </div>
                    <div className="text-xs text-green-600 mt-1">
                      {receiveKPI.onTimeCount} ตรงเวลา / {receiveKPI.lateCount} เกินเวลา
                    </div>
                  </div>

                  {/* Confirmed/Rejected */}
                  <div className="rounded-lg bg-purple-50 p-4">
                    <div className="text-sm text-purple-600">สถานะการยืนยัน</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-xl font-bold text-green-600">{receiveKPI.confirmedCount}</span>
                      <span className="text-gray-400">/</span>
                      <span className="text-xl font-bold text-red-600">{receiveKPI.rejectedCount}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">ยืนยัน / ปฏิเสธ</div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  ยังไม่มีข้อมูล KPI การยืนยันรับของในช่วงเวลานี้
                </div>
              )}
            </div>

            {/* ===== INFO BOX ===== */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 text-blue-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-700">
                  <p className="font-medium">เกี่ยวกับ KPI</p>
                  <ul className="mt-1 list-disc pl-4 space-y-1">
                    <li><strong>สถิติการเข้าใช้งาน</strong> - จำนวนครั้งและเวลาที่คุณเข้าใช้ระบบ</li>
                    <li><strong>เวลาเฉลี่ย</strong> - ระยะเวลาเฉลี่ยที่ใช้ในการดำเนินการ (จาก step ก่อนหน้า)</li>
                    <li><strong>On-time Rate</strong> - เปอร์เซ็นต์ที่ดำเนินการได้ภายใน SLA ที่กำหนด (บันทึก ณ ตอน approve)</li>
                    <li><strong>ตรงเวลา/เกินเวลา</strong> - จำนวนครั้งที่ทำได้ตาม/เกิน SLA target</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
