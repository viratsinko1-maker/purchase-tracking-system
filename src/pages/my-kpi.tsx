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

// Short month names for table display
const shortMonthNames = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// On-time rate color
const getOnTimeRateColor = (rate: number | null) => {
  if (rate === null) return 'bg-gray-100 text-gray-800';
  if (rate >= 80) return 'bg-green-100 text-green-800';
  if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

export default function MyKPIPage() {
  const { user } = useAuth();

  // Year/Quarter filter (for KPI Summary)
  const [filterType, setFilterType] = useState<'quarter' | 'year'>('quarter');
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getCurrentQuarter());

  // Session period filter (for Usage Stats)
  const [sessionPeriodType, setSessionPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [sessionYear, setSessionYear] = useState<number>(getCurrentThaiYear());
  const [sessionDay, setSessionDay] = useState<Date>(new Date());

  // Approval KPI period filter
  const [approvalPeriodType, setApprovalPeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [approvalDay, setApprovalDay] = useState<Date>(new Date());
  const [approvalYear, setApprovalYear] = useState<number>(getCurrentThaiYear());

  // Receive KPI period filter
  const [receivePeriodType, setReceivePeriodType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [receiveDay, setReceiveDay] = useState<Date>(new Date());
  const [receiveYear, setReceiveYear] = useState<number>(getCurrentThaiYear());

  // Build query params
  const queryParams = {
    year: selectedYear,
    quarter: filterType === 'quarter' ? selectedQuarter : undefined,
  };

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

  // Pre-aggregated Approval KPI queries
  const gregorianApprovalYear = approvalYear - 543;

  const { data: approvalKPIDaily, isLoading: loadingApprovalDaily } = api.kpi.getMyApprovalKPIDaily.useQuery(
    { userId: user?.id || '', date: approvalDay },
    { enabled: !!user?.id && approvalPeriodType === 'daily' }
  );
  const { data: approvalKPIWeekly, isLoading: loadingApprovalWeekly } = api.kpi.getMyApprovalKPIWeekly.useQuery(
    { userId: user?.id || '', year: gregorianApprovalYear },
    { enabled: !!user?.id && approvalPeriodType === 'weekly' }
  );
  const { data: approvalKPIMonthly, isLoading: loadingApprovalMonthly } = api.kpi.getMyApprovalKPIMonthly.useQuery(
    { userId: user?.id || '', year: gregorianApprovalYear },
    { enabled: !!user?.id && approvalPeriodType === 'monthly' }
  );
  const { data: approvalKPIYearly, isLoading: loadingApprovalYearly } = api.kpi.getMyApprovalKPIYearly.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && approvalPeriodType === 'yearly' }
  );
  const loadingApproval = loadingApprovalDaily || loadingApprovalWeekly || loadingApprovalMonthly || loadingApprovalYearly;

  // Pre-aggregated Receive KPI queries
  const gregorianReceiveYear = receiveYear - 543;

  const { data: receiveKPIDaily, isLoading: loadingReceiveDaily } = api.kpi.getMyReceiveKPIDaily.useQuery(
    { userId: user?.id || '', date: receiveDay },
    { enabled: !!user?.id && receivePeriodType === 'daily' }
  );
  const { data: receiveKPIWeekly, isLoading: loadingReceiveWeekly } = api.kpi.getMyReceiveKPIWeekly.useQuery(
    { userId: user?.id || '', year: gregorianReceiveYear },
    { enabled: !!user?.id && receivePeriodType === 'weekly' }
  );
  const { data: receiveKPIMonthly, isLoading: loadingReceiveMonthly } = api.kpi.getMyReceiveKPIMonthly.useQuery(
    { userId: user?.id || '', year: gregorianReceiveYear },
    { enabled: !!user?.id && receivePeriodType === 'monthly' }
  );
  const { data: receiveKPIYearly, isLoading: loadingReceiveYearly } = api.kpi.getMyReceiveKPIYearly.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && receivePeriodType === 'yearly' }
  );
  const loadingReceive = loadingReceiveDaily || loadingReceiveWeekly || loadingReceiveMonthly || loadingReceiveYearly;

  // Pre-aggregated usage stats queries (based on period type)
  const gregorianSessionYear = sessionYear - 543;

  const { data: usageStatsDaily, isLoading: loadingUsageDaily } = api.kpi.getMyUsageStatsDaily.useQuery(
    { userId: user?.id || '', date: sessionDay },
    { enabled: !!user?.id && sessionPeriodType === 'daily' }
  );

  const { data: usageStatsWeekly, isLoading: loadingUsageWeekly } = api.kpi.getMyUsageStatsWeekly.useQuery(
    { userId: user?.id || '', year: gregorianSessionYear },
    { enabled: !!user?.id && sessionPeriodType === 'weekly' }
  );

  const { data: usageStatsMonthly, isLoading: loadingUsageMonthly } = api.kpi.getMyUsageStatsMonthly.useQuery(
    { userId: user?.id || '', year: gregorianSessionYear },
    { enabled: !!user?.id && sessionPeriodType === 'monthly' }
  );

  const { data: usageStatsYearly, isLoading: loadingUsageYearly } = api.kpi.getMyUsageStatsYearly.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id && sessionPeriodType === 'yearly' }
  );

  const loadingUsage = loadingUsageDaily || loadingUsageWeekly || loadingUsageMonthly || loadingUsageYearly;

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
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  สถิติการเข้าใช้งาน
                </h2>

                {/* Session Period Filter */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Period Type Buttons */}
                  <div className="flex gap-1">
                    {[
                      { key: 'daily', label: 'รายวัน' },
                      { key: 'weekly', label: 'รายสัปดาห์' },
                      { key: 'monthly', label: 'รายเดือน' },
                      { key: 'yearly', label: 'รายปี' },
                    ].map((pt) => (
                      <button
                        key={pt.key}
                        onClick={() => setSessionPeriodType(pt.key as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                        className={`rounded px-3 py-1 text-xs font-medium transition ${
                          sessionPeriodType === pt.key
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>

                  {/* Date Picker (only for daily) */}
                  {sessionPeriodType === 'daily' && (
                    <input
                      type="date"
                      value={sessionDay.toISOString().split('T')[0]}
                      onChange={(e) => setSessionDay(new Date(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                    />
                  )}

                  {/* Year Select (for weekly/monthly only) */}
                  {(sessionPeriodType === 'weekly' || sessionPeriodType === 'monthly') && (
                    <select
                      value={sessionYear}
                      onChange={(e) => setSessionYear(Number(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>ปี {y}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Daily View */}
              {sessionPeriodType === 'daily' && (
                usageStatsDaily?.summary && usageStatsDaily.summary.totalSessions > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                      <div className="rounded-lg bg-indigo-50 p-4">
                        <div className="text-sm text-indigo-600">จำนวนครั้งเข้าใช้</div>
                        <div className="mt-1 text-2xl font-bold text-indigo-700">{usageStatsDaily.summary.totalSessions}</div>
                        <div className="text-xs text-indigo-500 mt-1">ครั้ง</div>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-4">
                        <div className="text-sm text-blue-600">เวลาใช้งานรวม</div>
                        <div className="mt-1 text-2xl font-bold text-blue-700">{usageStatsDaily.summary.totalHours}</div>
                        <div className="text-xs text-blue-500 mt-1">ชั่วโมง ({usageStatsDaily.summary.totalMinutes} นาที)</div>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-4">
                        <div className="text-sm text-purple-600">เฉลี่ยต่อครั้ง</div>
                        <div className="mt-1 text-2xl font-bold text-purple-700">{usageStatsDaily.summary.avgMinutesPerSession}</div>
                        <div className="text-xs text-purple-500 mt-1">นาที/ครั้ง</div>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="text-sm text-gray-600">วิธีออกจากระบบ</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-lg font-bold text-green-600">{usageStatsDaily.summary.manualLogouts}</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-lg font-bold text-yellow-600">{usageStatsDaily.summary.timeoutLogouts}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">กดออก / หมดเวลา</div>
                      </div>
                    </div>
                    {usageStatsDaily.recentSessions && usageStatsDaily.recentSessions.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">ประวัติการเข้าใช้งานวันนี้</h3>
                        <div className="max-h-64 overflow-y-auto">
                          <div className="space-y-2">
                            {usageStatsDaily.recentSessions.map((session, idx) => (
                              <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm">
                                <div className="flex items-center gap-3">
                                  <span className="text-gray-400">{idx + 1}.</span>
                                  <span className="text-gray-900">
                                    {formatDate(session.sessionStart)}
                                    <span className="text-gray-400 mx-1">&rarr;</span>
                                    {session.sessionEnd ? formatDate(session.sessionEnd) : '-'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="text-gray-700">{session.durationMinutes} นาที</span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                                    session.logoutType === 'manual' ? 'bg-green-100 text-green-700' :
                                    session.logoutType === 'timeout' ? 'bg-yellow-100 text-yellow-700' :
                                    session.logoutType === 'inactivity' ? 'bg-orange-100 text-orange-700' :
                                    'bg-red-100 text-red-700'
                                  }`}>
                                    {session.logoutType === 'manual' ? 'กดออก' :
                                     session.logoutType === 'timeout' ? 'หมดเวลา' :
                                     session.logoutType === 'inactivity' ? 'ไม่มีกิจกรรม' :
                                     session.logoutType === 'relogin' ? 'ล็อกอินใหม่' :
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
                  <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูลการเข้าใช้งานในวันนี้</div>
                )
              )}

              {/* Weekly/Monthly/Yearly Records Table */}
              {sessionPeriodType !== 'daily' && (() => {
                const records = sessionPeriodType === 'weekly' ? usageStatsWeekly?.records :
                                sessionPeriodType === 'monthly' ? usageStatsMonthly?.records :
                                usageStatsYearly?.records;
                if (!records || records.length === 0) {
                  return <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูลการเข้าใช้งานในช่วงเวลานี้</div>;
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ช่วงเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Session</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลารวม</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เฉลี่ย/ครั้ง</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">กดออก</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">หมดเวลา</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {records.map((r, idx) => {
                          const periodLabel = 'week' in r
                            ? `สัปดาห์ ${r.week} (${new Date(r.weekStart).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(r.weekEnd).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`
                            : 'month' in r
                            ? shortMonthNames[(r.month as number) - 1]
                            : `ปี ${(r as { year: number }).year + 543}`;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{periodLabel}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{r.totalSessions} ครั้ง</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{r.totalHours} ชม. ({r.totalMinutes} นาที)</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{r.avgMinutesPerSession} นาที</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">{r.manualLogouts}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-yellow-600 font-medium">{r.timeoutLogouts}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* ===== APPROVAL KPI SECTION ===== */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  KPI การอนุมัติ (แยกตามขั้นตอน)
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    {[
                      { key: 'daily', label: 'รายวัน' },
                      { key: 'weekly', label: 'รายสัปดาห์' },
                      { key: 'monthly', label: 'รายเดือน' },
                      { key: 'yearly', label: 'รายปี' },
                    ].map((pt) => (
                      <button
                        key={pt.key}
                        onClick={() => setApprovalPeriodType(pt.key as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                        className={`rounded px-3 py-1 text-xs font-medium transition ${
                          approvalPeriodType === pt.key
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                  {approvalPeriodType === 'daily' && (
                    <input type="date" value={approvalDay.toISOString().split('T')[0]}
                      onChange={(e) => setApprovalDay(new Date(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700" />
                  )}
                  {(approvalPeriodType === 'weekly' || approvalPeriodType === 'monthly') && (
                    <select value={approvalYear} onChange={(e) => setApprovalYear(Number(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700">
                      {yearOptions.map((y) => (<option key={y} value={y}>ปี {y}</option>))}
                    </select>
                  )}
                </div>
              </div>

              {/* Daily View */}
              {approvalPeriodType === 'daily' && (
                approvalKPIDaily && Object.keys(approvalKPIDaily.stages).length > 0 ? (
                  <>
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
                          {approvalKPIDaily.stageOrder.map((stage) => {
                            const stats = approvalKPIDaily.stages[stage];
                            if (!stats) return null;
                            return (
                              <tr key={stage} className="hover:bg-gray-50">
                                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                  {approvalKPIDaily.stageNames[stage as keyof typeof approvalKPIDaily.stageNames]}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{stats.count}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{formatDuration(stats.avgMinutes)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">{stats.onTimeCount}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-red-600 font-medium">{stats.lateCount}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-center">
                                  {stats.onTimeRate !== null ? (
                                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOnTimeRateColor(stats.onTimeRate)}`}>
                                      {stats.onTimeRate}%
                                    </span>
                                  ) : (<span className="text-gray-400">-</span>)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {approvalKPIDaily.details && approvalKPIDaily.details.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">รายละเอียดการอนุมัติวันนี้</h3>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {approvalKPIDaily.details.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">{idx + 1}.</span>
                                <span className="text-gray-900">PR #{d.prDocNum}</span>
                                <span className="text-gray-500">({d.stageName})</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-700">{d.durationMinutes} นาที</span>
                                {d.isOnTime !== null && (
                                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                                    d.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {d.isOnTime ? 'ตรงเวลา' : 'เกินเวลา'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูล KPI การอนุมัติในวันนี้</div>
                )
              )}

              {/* Weekly/Monthly/Yearly Records Table */}
              {approvalPeriodType !== 'daily' && (() => {
                const records = approvalPeriodType === 'weekly' ? approvalKPIWeekly?.records :
                                approvalPeriodType === 'monthly' ? approvalKPIMonthly?.records :
                                approvalKPIYearly?.records;
                if (!records || records.length === 0) {
                  return <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูล KPI การอนุมัติในช่วงเวลานี้</div>;
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ช่วงเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ขั้นอนุมัติ</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จำนวน</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลาเฉลี่ย</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ตรงเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เกินเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">On-time Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {records.map((r, idx) => {
                          const periodLabel = 'week' in r
                            ? `สัปดาห์ ${r.week} (${new Date(r.weekStart).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(r.weekEnd).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`
                            : 'month' in r
                            ? shortMonthNames[(r.month as number) - 1]
                            : `ปี ${(r as { year: number }).year + 543}`;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{periodLabel}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">ขั้น {r.approvalStage}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{r.totalCount}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{formatDuration(r.avgMinutes)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">{r.onTimeCount}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-red-600 font-medium">{r.lateCount}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center">
                                {r.onTimeRate !== null ? (
                                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOnTimeRateColor(r.onTimeRate)}`}>
                                    {r.onTimeRate}%
                                  </span>
                                ) : (<span className="text-gray-400">-</span>)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* ===== RECEIVE CONFIRM KPI SECTION ===== */}
            <div className="rounded-lg bg-white p-6 shadow">
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  KPI การยืนยันรับของ
                </h2>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex gap-1">
                    {[
                      { key: 'daily', label: 'รายวัน' },
                      { key: 'weekly', label: 'รายสัปดาห์' },
                      { key: 'monthly', label: 'รายเดือน' },
                      { key: 'yearly', label: 'รายปี' },
                    ].map((pt) => (
                      <button
                        key={pt.key}
                        onClick={() => setReceivePeriodType(pt.key as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                        className={`rounded px-3 py-1 text-xs font-medium transition ${
                          receivePeriodType === pt.key
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {pt.label}
                      </button>
                    ))}
                  </div>
                  {receivePeriodType === 'daily' && (
                    <input type="date" value={receiveDay.toISOString().split('T')[0]}
                      onChange={(e) => setReceiveDay(new Date(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700" />
                  )}
                  {(receivePeriodType === 'weekly' || receivePeriodType === 'monthly') && (
                    <select value={receiveYear} onChange={(e) => setReceiveYear(Number(e.target.value))}
                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700">
                      {yearOptions.map((y) => (<option key={y} value={y}>ปี {y}</option>))}
                    </select>
                  )}
                </div>
              </div>

              {/* Daily View */}
              {receivePeriodType === 'daily' && (
                receiveKPIDaily?.summary && receiveKPIDaily.summary.totalCount > 0 ? (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-gray-50 p-4">
                        <div className="text-sm text-gray-500">จำนวนครั้งทั้งหมด</div>
                        <div className="mt-1 text-2xl font-bold text-gray-900">{receiveKPIDaily.summary.totalCount}</div>
                      </div>
                      <div className="rounded-lg bg-blue-50 p-4">
                        <div className="text-sm text-blue-600">เวลาเฉลี่ย</div>
                        <div className="mt-1 text-2xl font-bold text-blue-700">{formatDuration(receiveKPIDaily.summary.avgMinutes)}</div>
                      </div>
                      <div className="rounded-lg bg-green-50 p-4">
                        <div className="text-sm text-green-600">On-time Rate</div>
                        <div className="mt-1 text-2xl font-bold text-green-700">
                          {receiveKPIDaily.summary.onTimeRate !== null ? `${receiveKPIDaily.summary.onTimeRate}%` : '-'}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {receiveKPIDaily.summary.onTimeCount} ตรงเวลา / {receiveKPIDaily.summary.lateCount} เกินเวลา
                        </div>
                      </div>
                      <div className="rounded-lg bg-purple-50 p-4">
                        <div className="text-sm text-purple-600">สถานะการยืนยัน</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-xl font-bold text-green-600">{receiveKPIDaily.summary.confirmedCount}</span>
                          <span className="text-gray-400">/</span>
                          <span className="text-xl font-bold text-red-600">{receiveKPIDaily.summary.rejectedCount}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">ยืนยัน / ปฏิเสธ</div>
                      </div>
                    </div>
                    {receiveKPIDaily.details && receiveKPIDaily.details.length > 0 && (
                      <div className="mt-4">
                        <h3 className="text-sm font-medium text-gray-700 mb-3">รายละเอียดการยืนยันรับของวันนี้</h3>
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {receiveKPIDaily.details.map((d, idx) => (
                            <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm">
                              <div className="flex items-center gap-3">
                                <span className="text-gray-400">{idx + 1}.</span>
                                <span className="text-gray-900">PR #{d.prDocNum}</span>
                                <span className="text-gray-500">({d.itemsCount} รายการ)</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-gray-700">{d.durationMinutes} นาที</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs ${
                                  d.confirmStatus === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {d.confirmStatus === 'confirmed' ? 'ยืนยัน' : 'ปฏิเสธ'}
                                </span>
                                {d.isOnTime !== null && (
                                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                                    d.isOnTime ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {d.isOnTime ? 'ตรงเวลา' : 'เกินเวลา'}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูล KPI การยืนยันรับของในวันนี้</div>
                )
              )}

              {/* Weekly/Monthly/Yearly Records Table */}
              {receivePeriodType !== 'daily' && (() => {
                const records = receivePeriodType === 'weekly' ? receiveKPIWeekly?.records :
                                receivePeriodType === 'monthly' ? receiveKPIMonthly?.records :
                                receiveKPIYearly?.records;
                if (!records || records.length === 0) {
                  return <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูล KPI การยืนยันรับของในช่วงเวลานี้</div>;
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ช่วงเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จำนวน</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลาเฉลี่ย</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ตรงเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เกินเวลา</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">On-time Rate</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ยืนยัน/ปฏิเสธ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {records.map((r, idx) => {
                          const periodLabel = 'week' in r
                            ? `สัปดาห์ ${r.week} (${new Date(r.weekStart).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${new Date(r.weekEnd).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`
                            : 'month' in r
                            ? shortMonthNames[(r.month as number) - 1]
                            : `ปี ${(r as { year: number }).year + 543}`;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{periodLabel}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{r.totalCount}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">{formatDuration(r.avgMinutes)}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">{r.onTimeCount}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-red-600 font-medium">{r.lateCount}</td>
                              <td className="whitespace-nowrap px-4 py-3 text-center">
                                {r.onTimeRate !== null ? (
                                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOnTimeRateColor(r.onTimeRate)}`}>
                                    {r.onTimeRate}%
                                  </span>
                                ) : (<span className="text-gray-400">-</span>)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                <span className="text-green-600">{r.confirmedCount}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className="text-red-600">{r.rejectedCount}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
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
