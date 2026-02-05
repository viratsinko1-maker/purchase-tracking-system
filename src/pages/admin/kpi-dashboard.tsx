/**
 * Admin KPI Dashboard - View all users' KPI and SLA configuration
 * - Approval KPI Summary
 * - Receive Confirm KPI Summary
 * - Usage Analytics Summary
 * - SLA Config
 */
import { useState } from "react";
import Head from "next/head";
import PageGuard from "~/components/PageGuard";
import { api } from "~/utils/api";

// Helper function to format minutes
const formatDuration = (minutes: number | null | undefined): string => {
  if (minutes === null || minutes === undefined) return "-";
  if (minutes < 60) return `${Math.round(minutes)} นาที`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `${hours} ชม. ${mins} นาที`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days} วัน ${remainingHours} ชม.`;
};

// Stage names mapping
const stageNames: Record<string, string> = {
  requester: 'ผู้ขอซื้อ',
  line: 'ผู้อนุมัติตามสายงาน',
  cost_center: 'ผู้อนุมัติตาม Cost Center',
  procurement: 'งานจัดซื้อพัสดุ',
  vpc: 'VP-C',
};

// On-time rate color
const getOnTimeRateColor = (rate: number | null) => {
  if (rate === null) return 'bg-gray-100 text-gray-800';
  if (rate >= 80) return 'bg-green-100 text-green-800';
  if (rate >= 50) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

type TabType = 'approval' | 'receive_confirm' | 'usage' | 'individual' | 'sla_config';

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

// Get current month (1-12)
const getCurrentMonth = () => new Date().getMonth() + 1;

// Get current week of year (matches getWeeksInYear calculation)
const getWeekOfYear = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  // Calculate days since start of year
  const diffTime = date.getTime() - startOfYear.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  // Week number = floor(days / 7) + 1
  return Math.floor(diffDays / 7) + 1;
};

// Generate weeks for a year (Thai year)
const getWeeksInYear = (thaiYear: number) => {
  const gregorianYear = thaiYear - 543;
  const weeks: { week: number; start: Date; end: Date; label: string }[] = [];
  const startOfYear = new Date(gregorianYear, 0, 1);
  const endOfYear = new Date(gregorianYear, 11, 31);

  let currentDate = new Date(startOfYear);
  let weekNum = 1;

  while (currentDate <= endOfYear && weekNum <= 53) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    // Clamp to end of year
    if (weekEnd > endOfYear) {
      weekEnd.setTime(endOfYear.getTime());
    }

    weeks.push({
      week: weekNum,
      start: weekStart,
      end: weekEnd,
      label: `สัปดาห์ ${weekNum} (${weekStart.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`,
    });

    currentDate.setDate(currentDate.getDate() + 7);
    weekNum++;
  }

  return weeks;
};

// Month names
const monthNames = [
  { value: 1, label: 'มกราคม' },
  { value: 2, label: 'กุมภาพันธ์' },
  { value: 3, label: 'มีนาคม' },
  { value: 4, label: 'เมษายน' },
  { value: 5, label: 'พฤษภาคม' },
  { value: 6, label: 'มิถุนายน' },
  { value: 7, label: 'กรกฎาคม' },
  { value: 8, label: 'สิงหาคม' },
  { value: 9, label: 'กันยายน' },
  { value: 10, label: 'ตุลาคม' },
  { value: 11, label: 'พฤศจิกายน' },
  { value: 12, label: 'ธันวาคม' },
];

function KPIDashboardContent() {
  const [activeTab, setActiveTab] = useState<TabType>('approval');

  // Year/Quarter filter
  const [filterType, setFilterType] = useState<'quarter' | 'year'>('quarter');
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getCurrentQuarter());

  // Individual KPI State
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Session period filter (for Individual Usage Stats)
  const [sessionPeriodType, setSessionPeriodType] = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [sessionYear, setSessionYear] = useState<number>(getCurrentThaiYear());
  const [sessionWeek, setSessionWeek] = useState<number>(getWeekOfYear());
  const [sessionMonth, setSessionMonth] = useState<number>(getCurrentMonth());

  // SLA Config Form State
  const [slaForm, setSlaForm] = useState({
    kpiType: 'approval' as 'approval' | 'receive_confirm',
    stage: '' as string,
    targetHours: 1,
    description: '',
  });
  const [slaFormError, setSlaFormError] = useState('');

  // Build query params
  const queryParams = {
    year: selectedYear,
    quarter: filterType === 'quarter' ? selectedQuarter : undefined,
  };

  // Fetch KPI Summary data
  const { data: approvalSummary, isLoading: loadingApproval } = api.kpi.getApprovalKPISummary.useQuery(
    queryParams,
    { enabled: activeTab === 'approval' }
  );

  const { data: receiveSummary, isLoading: loadingReceive } = api.kpi.getReceiveConfirmKPISummary.useQuery(
    queryParams,
    { enabled: activeTab === 'receive_confirm' }
  );

  const { data: usageSummary, isLoading: loadingUsage } = api.kpi.getUsageKPISummary.useQuery(
    queryParams,
    { enabled: activeTab === 'usage' }
  );

  const { data: slaConfigs, isLoading: loadingSLA, refetch: refetchSLA } = api.kpi.getSLAConfigs.useQuery(
    undefined,
    { enabled: activeTab === 'sla_config' }
  );

  // Fetch all users for Individual KPI tab
  const { data: allUsersData, isLoading: loadingUsers } = api.kpi.getAdminUsersList.useQuery(
    undefined,
    { enabled: activeTab === 'individual' }
  );

  // Get users list
  const usersList = allUsersData || [];

  // Filter users by search query
  const filteredUsers = userSearchQuery.trim()
    ? usersList.filter(u =>
        u.name.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(userSearchQuery.toLowerCase())
      )
    : usersList;

  // Get date range for individual KPI detail queries
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

  // Get date range for session period filter
  const getSessionDateRange = () => {
    const gregorianYear = sessionYear - 543;
    if (sessionPeriodType === 'weekly') {
      const weeks = getWeeksInYear(sessionYear);
      const week = weeks.find(w => w.week === sessionWeek);
      if (week) {
        return {
          sessionDateFrom: week.start,
          sessionDateTo: new Date(week.end.getFullYear(), week.end.getMonth(), week.end.getDate(), 23, 59, 59),
        };
      }
      // Fallback to first week
      return {
        sessionDateFrom: new Date(gregorianYear, 0, 1),
        sessionDateTo: new Date(gregorianYear, 0, 7, 23, 59, 59),
      };
    } else if (sessionPeriodType === 'monthly') {
      const sessionDateFrom = new Date(gregorianYear, sessionMonth - 1, 1);
      const sessionDateTo = new Date(gregorianYear, sessionMonth, 0, 23, 59, 59);
      return { sessionDateFrom, sessionDateTo };
    } else {
      // yearly
      const sessionDateFrom = new Date(gregorianYear, 0, 1);
      const sessionDateTo = new Date(gregorianYear, 11, 31, 23, 59, 59);
      return { sessionDateFrom, sessionDateTo };
    }
  };

  const { sessionDateFrom, sessionDateTo } = getSessionDateRange();
  const weeksInYear = getWeeksInYear(sessionYear);

  // Individual User KPI queries (Admin APIs)
  const { data: individualApprovalSummary, isLoading: loadingIndApprovalSummary } = api.kpi.getAdminUserApprovalKPISummary.useQuery(
    { userId: selectedUserId, ...queryParams },
    { enabled: activeTab === 'individual' && !!selectedUserId }
  );

  const { data: individualReceiveSummary, isLoading: loadingIndReceiveSummary } = api.kpi.getAdminUserReceiveConfirmKPISummary.useQuery(
    { userId: selectedUserId, ...queryParams },
    { enabled: activeTab === 'individual' && !!selectedUserId }
  );

  const { data: individualUsageSummary, isLoading: loadingIndUsageSummary } = api.kpi.getAdminUserUsageKPISummary.useQuery(
    { userId: selectedUserId, ...queryParams },
    { enabled: activeTab === 'individual' && !!selectedUserId }
  );

  const { data: individualApprovalKPI, isLoading: loadingIndApproval } = api.kpi.getMyApprovalKPI.useQuery(
    { userId: selectedUserId, dateFrom, dateTo },
    { enabled: activeTab === 'individual' && !!selectedUserId }
  );

  const { data: individualReceiveKPI, isLoading: loadingIndReceive } = api.kpi.getMyReceiveConfirmKPI.useQuery(
    { userId: selectedUserId, dateFrom, dateTo },
    { enabled: activeTab === 'individual' && !!selectedUserId }
  );

  const { data: individualUsageStats, isLoading: loadingIndUsage } = api.kpi.getMyUsageStats.useQuery(
    { userId: selectedUserId, dateFrom: sessionDateFrom, dateTo: sessionDateTo },
    { enabled: activeTab === 'individual' && !!selectedUserId }
  );

  const loadingIndividual = loadingIndApprovalSummary || loadingIndReceiveSummary || loadingIndUsageSummary ||
                           loadingIndApproval || loadingIndReceive || loadingIndUsage;

  // Mutations
  const upsertSLA = api.kpi.upsertSLAConfig.useMutation({
    onSuccess: () => {
      void refetchSLA();
      setSlaForm({ kpiType: 'approval', stage: '', targetHours: 1, description: '' });
      setSlaFormError('');
    },
    onError: (error) => setSlaFormError(error.message),
  });

  const deleteSLA = api.kpi.deleteSLAConfig.useMutation({
    onSuccess: () => void refetchSLA(),
  });

  const toggleSLA = api.kpi.toggleSLAConfigActive.useMutation({
    onSuccess: () => void refetchSLA(),
  });

  const handleSLASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSlaFormError('');

    if (slaForm.targetHours < 0.5) {
      setSlaFormError('Target ต้องมากกว่า 0.5 ชั่วโมง (30 นาที)');
      return;
    }

    const targetMinutes = Math.round(slaForm.targetHours * 60);

    upsertSLA.mutate({
      kpiType: slaForm.kpiType,
      stage: slaForm.stage || null,
      targetMinutes,
      description: slaForm.description || undefined,
    });
  };

  // Navigate to Individual KPI tab with selected user
  const handleUserClick = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('individual');
  };

  const isLoading = loadingApproval || loadingReceive || loadingUsage || loadingSLA;

  // Generate year options (last 3 years)
  const yearOptions = Array.from({ length: 3 }, (_, i) => getCurrentThaiYear() - i);

  return (
    <PageGuard action="admin_kpi.read">
      <Head>
        <title>KPI Dashboard | Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-100 p-6">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">KPI Dashboard</h1>
              <p className="text-gray-600">สรุป KPI รายคน - ดู On-time Rate รวมทุก stage</p>
            </div>

            {/* Tabs */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="-mb-px flex gap-4">
                {[
                  { key: 'approval', label: 'Approval KPI', icon: '✅' },
                  { key: 'receive_confirm', label: 'Receive Confirm KPI', icon: '📦' },
                  { key: 'usage', label: 'Usage Analytics', icon: '📊' },
                  { key: 'individual', label: 'Individual KPI', icon: '👤' },
                  { key: 'sla_config', label: 'SLA Config', icon: '⚙️' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as TabType)}
                    className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition ${
                      activeTab === tab.key
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Year/Quarter Filter (not for SLA Config) */}
            {activeTab !== 'sla_config' && (
              <div className="mb-4 flex flex-wrap items-center gap-4">
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

                {/* Quarter Select (only if filterType is quarter) */}
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

                {/* Period Display */}
                <span className="text-sm text-gray-500">
                  {filterType === 'quarter'
                    ? `Q${selectedQuarter} ปี ${selectedYear}`
                    : `ทั้งปี ${selectedYear}`}
                </span>
              </div>
            )}

            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <div className="text-gray-500">กำลังโหลด...</div>
              </div>
            ) : (
              <>
                {/* ===== APPROVAL KPI TAB ===== */}
                {activeTab === 'approval' && approvalSummary && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">จำนวนครั้งทั้งหมด</p>
                        <p className="text-2xl font-bold text-gray-800">{approvalSummary.overall.total}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">ตรงเวลา</p>
                        <p className="text-2xl font-bold text-green-600">{approvalSummary.overall.onTime}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">เกินเวลา</p>
                        <p className="text-2xl font-bold text-red-600">{approvalSummary.overall.late}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">On-time Rate</p>
                        <p className={`text-2xl font-bold ${
                          (approvalSummary.overall.onTimeRate ?? 0) >= 80 ? 'text-green-600' :
                          (approvalSummary.overall.onTimeRate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {approvalSummary.overall.onTimeRate !== null ? `${approvalSummary.overall.onTimeRate}%` : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Table by User */}
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h2 className="mb-4 text-lg font-semibold text-gray-800">Approval KPI - รายคน (รวมทุก Stage)</h2>
                      {approvalSummary.byUser.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ผู้ใช้</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จำนวนครั้ง</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ตรงเวลา</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เกินเวลา</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">On-time %</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลาเฉลี่ย</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {approvalSummary.byUser.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                    <button
                                      onClick={() => handleUserClick(row.userId)}
                                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                      title="ดู KPI รายบุคคล"
                                    >
                                      {row.userName}
                                    </button>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {row.total}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">
                                    {row.onTime}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-red-600 font-medium">
                                    {row.late}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center">
                                    {row.onTimeRate !== null ? (
                                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOnTimeRateColor(row.onTimeRate)}`}>
                                        {row.onTimeRate}%
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {formatDuration(row.avgMinutes)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== RECEIVE CONFIRM KPI TAB ===== */}
                {activeTab === 'receive_confirm' && receiveSummary && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">จำนวนครั้งทั้งหมด</p>
                        <p className="text-2xl font-bold text-gray-800">{receiveSummary.overall.total}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">ตรงเวลา</p>
                        <p className="text-2xl font-bold text-green-600">{receiveSummary.overall.onTime}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">เกินเวลา</p>
                        <p className="text-2xl font-bold text-red-600">{receiveSummary.overall.late}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">On-time Rate</p>
                        <p className={`text-2xl font-bold ${
                          (receiveSummary.overall.onTimeRate ?? 0) >= 80 ? 'text-green-600' :
                          (receiveSummary.overall.onTimeRate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {receiveSummary.overall.onTimeRate !== null ? `${receiveSummary.overall.onTimeRate}%` : '-'}
                        </p>
                      </div>
                    </div>

                    {/* Table by User */}
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h2 className="mb-4 text-lg font-semibold text-gray-800">Receive Confirm KPI - รายคน</h2>
                      {receiveSummary.byUser.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ผู้ใช้</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จำนวนครั้ง</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">ตรงเวลา</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เกินเวลา</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">On-time %</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลาเฉลี่ย</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {receiveSummary.byUser.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                    <button
                                      onClick={() => handleUserClick(row.userId)}
                                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                      title="ดู KPI รายบุคคล"
                                    >
                                      {row.userName}
                                    </button>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {row.total}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">
                                    {row.onTime}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-red-600 font-medium">
                                    {row.late}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center">
                                    {row.onTimeRate !== null ? (
                                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getOnTimeRateColor(row.onTimeRate)}`}>
                                        {row.onTimeRate}%
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {formatDuration(row.avgMinutes)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== USAGE ANALYTICS TAB ===== */}
                {activeTab === 'usage' && usageSummary && (
                  <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">จำนวนครั้งเข้าใช้งาน</p>
                        <p className="text-2xl font-bold text-gray-800">{usageSummary.overall.totalLogins}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">จำนวน Users</p>
                        <p className="text-2xl font-bold text-indigo-600">{usageSummary.overall.uniqueUsers}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">เวลารวม (ชั่วโมง)</p>
                        <p className="text-2xl font-bold text-gray-800">{usageSummary.overall.totalHours}</p>
                      </div>
                      <div className="rounded-lg bg-white p-4 shadow">
                        <p className="text-sm text-gray-500">เฉลี่ย/ครั้ง</p>
                        <p className="text-2xl font-bold text-gray-800">{usageSummary.overall.avgMinutesPerSession} นาที</p>
                      </div>
                    </div>

                    {/* Logout Type Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="rounded-lg bg-green-50 p-4 shadow">
                        <p className="text-sm text-green-600">กดออกจากระบบ (Manual)</p>
                        <p className="text-2xl font-bold text-green-700">{usageSummary.overall.manualLogouts}</p>
                      </div>
                      <div className="rounded-lg bg-orange-50 p-4 shadow">
                        <p className="text-sm text-orange-600">หมดเวลา (Timeout)</p>
                        <p className="text-2xl font-bold text-orange-700">{usageSummary.overall.timeoutLogouts}</p>
                      </div>
                    </div>

                    {/* Table by User */}
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h2 className="mb-4 text-lg font-semibold text-gray-800">Usage Analytics - รายคน</h2>
                      {usageSummary.byUser.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ผู้ใช้</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">จำนวนครั้ง</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลารวม</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เฉลี่ย/ครั้ง</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">กดออก</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">หมดเวลา</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {usageSummary.byUser.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50">
                                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                    <button
                                      onClick={() => handleUserClick(row.userId)}
                                      className="text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                                      title="ดู KPI รายบุคคล"
                                    >
                                      {row.userName}
                                    </button>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {row.loginCount}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {row.totalHours} ชม.
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    {row.avgMinutes} นาที
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-green-600 font-medium">
                                    {row.manualLogouts}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-orange-600 font-medium">
                                    {row.timeoutLogouts}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูลในช่วงเวลานี้</div>
                      )}
                    </div>
                  </div>
                )}

                {/* ===== INDIVIDUAL KPI TAB ===== */}
                {activeTab === 'individual' && (
                  <div className="space-y-6">
                    {/* User Selection */}
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h2 className="mb-4 text-lg font-semibold text-gray-800">เลือกผู้ใช้</h2>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            placeholder="ค้นหาชื่อผู้ใช้..."
                            className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                          />
                        </div>
                        <div className="flex-1">
                          <select
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900"
                            disabled={loadingUsers}
                          >
                            <option value="">{loadingUsers ? 'กำลังโหลด...' : '-- เลือกผู้ใช้ --'}</option>
                            {filteredUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} [{user.role}]
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      {!loadingUsers && usersList.length === 0 && (
                        <p className="mt-2 text-sm text-gray-500">
                          ไม่พบผู้ใช้ที่ active ในระบบ
                        </p>
                      )}
                    </div>

                    {selectedUserId && (
                      <>
                        {loadingIndividual ? (
                          <div className="flex h-64 items-center justify-center">
                            <div className="text-gray-500">กำลังโหลด...</div>
                          </div>
                        ) : (
                          <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                              <div className="rounded-lg bg-white p-4 shadow">
                                <p className="text-sm text-gray-500">Approve ครั้ง</p>
                                <p className="text-2xl font-bold text-gray-800">{individualApprovalSummary?.total ?? 0}</p>
                              </div>
                              <div className="rounded-lg bg-white p-4 shadow">
                                <p className="text-sm text-gray-500">On-time (Approve)</p>
                                <p className={`text-2xl font-bold ${
                                  (individualApprovalSummary?.onTimeRate ?? 0) >= 80 ? 'text-green-600' :
                                  (individualApprovalSummary?.onTimeRate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {individualApprovalSummary?.onTimeRate !== null && individualApprovalSummary?.onTimeRate !== undefined
                                    ? `${individualApprovalSummary.onTimeRate}%` : '-'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {individualApprovalSummary?.onTime ?? 0} / {(individualApprovalSummary?.onTime ?? 0) + (individualApprovalSummary?.late ?? 0)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-white p-4 shadow">
                                <p className="text-sm text-gray-500">Receive ครั้ง</p>
                                <p className="text-2xl font-bold text-gray-800">{individualReceiveSummary?.total ?? 0}</p>
                              </div>
                              <div className="rounded-lg bg-white p-4 shadow">
                                <p className="text-sm text-gray-500">On-time (Receive)</p>
                                <p className={`text-2xl font-bold ${
                                  (individualReceiveSummary?.onTimeRate ?? 0) >= 80 ? 'text-green-600' :
                                  (individualReceiveSummary?.onTimeRate ?? 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {individualReceiveSummary?.onTimeRate !== null && individualReceiveSummary?.onTimeRate !== undefined
                                    ? `${individualReceiveSummary.onTimeRate}%` : '-'}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {individualReceiveSummary?.onTime ?? 0} / {(individualReceiveSummary?.onTime ?? 0) + (individualReceiveSummary?.late ?? 0)}
                                </p>
                              </div>
                              <div className="rounded-lg bg-white p-4 shadow">
                                <p className="text-sm text-gray-500">เข้าใช้งาน</p>
                                <p className="text-2xl font-bold text-indigo-600">{individualUsageSummary?.totalLogins ?? 0}</p>
                                <p className="text-xs text-gray-400 mt-1">ครั้ง</p>
                              </div>
                              <div className="rounded-lg bg-white p-4 shadow">
                                <p className="text-sm text-gray-500">เวลารวม</p>
                                <p className="text-2xl font-bold text-gray-800">{individualUsageSummary?.totalHours ?? 0}</p>
                                <p className="text-xs text-gray-400 mt-1">ชั่วโมง</p>
                              </div>
                            </div>

                            {/* Usage Stats */}
                            <div className="rounded-lg bg-white p-6 shadow">
                              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                  <span>🕐</span> สถิติการเข้าใช้งาน
                                </h2>

                                {/* Session Period Filter */}
                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Period Type Buttons */}
                                  <div className="flex gap-1">
                                    {[
                                      { key: 'weekly', label: 'รายสัปดาห์' },
                                      { key: 'monthly', label: 'รายเดือน' },
                                      { key: 'yearly', label: 'รายปี' },
                                    ].map((pt) => (
                                      <button
                                        key={pt.key}
                                        onClick={() => setSessionPeriodType(pt.key as 'weekly' | 'monthly' | 'yearly')}
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

                                  {/* Year Select */}
                                  <select
                                    value={sessionYear}
                                    onChange={(e) => setSessionYear(Number(e.target.value))}
                                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                                  >
                                    {yearOptions.map((y) => (
                                      <option key={y} value={y}>ปี {y}</option>
                                    ))}
                                  </select>

                                  {/* Week Select (only for weekly) */}
                                  {sessionPeriodType === 'weekly' && (
                                    <select
                                      value={sessionWeek}
                                      onChange={(e) => setSessionWeek(Number(e.target.value))}
                                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                                    >
                                      {weeksInYear.map((w) => (
                                        <option key={w.week} value={w.week}>{w.label}</option>
                                      ))}
                                    </select>
                                  )}

                                  {/* Month Select (only for monthly) */}
                                  {sessionPeriodType === 'monthly' && (
                                    <select
                                      value={sessionMonth}
                                      onChange={(e) => setSessionMonth(Number(e.target.value))}
                                      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700"
                                    >
                                      {monthNames.map((m) => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                              {individualUsageStats && individualUsageStats.summary.totalSessions > 0 ? (
                                <>
                                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                                    <div className="rounded-lg bg-indigo-50 p-4">
                                      <div className="text-sm text-indigo-600">จำนวนครั้งเข้าใช้</div>
                                      <div className="mt-1 text-2xl font-bold text-indigo-700">{individualUsageStats.summary.totalSessions}</div>
                                    </div>
                                    <div className="rounded-lg bg-blue-50 p-4">
                                      <div className="text-sm text-blue-600">เวลาใช้งานรวม</div>
                                      <div className="mt-1 text-2xl font-bold text-blue-700">{individualUsageStats.summary.totalHours} ชม.</div>
                                    </div>
                                    <div className="rounded-lg bg-purple-50 p-4">
                                      <div className="text-sm text-purple-600">เฉลี่ยต่อครั้ง</div>
                                      <div className="mt-1 text-2xl font-bold text-purple-700">{individualUsageStats.summary.avgMinutesPerSession} นาที</div>
                                    </div>
                                    <div className="rounded-lg bg-gray-50 p-4">
                                      <div className="text-sm text-gray-600">วิธีออกจากระบบ</div>
                                      <div className="mt-1 flex items-baseline gap-2">
                                        <span className="text-lg font-bold text-green-600">{individualUsageStats.summary.manualLogouts}</span>
                                        <span className="text-gray-400">/</span>
                                        <span className="text-lg font-bold text-yellow-600">{individualUsageStats.summary.timeoutLogouts}</span>
                                      </div>
                                      <div className="text-xs text-gray-500 mt-1">กดออก / หมดเวลา</div>
                                    </div>
                                  </div>

                                  {individualUsageStats.recentSessions.length > 0 && (
                                    <div>
                                      <h3 className="text-sm font-medium text-gray-700 mb-3">ประวัติการเข้าใช้งานล่าสุด</h3>
                                      <div className="max-h-48 overflow-y-auto">
                                        <div className="space-y-2">
                                          {individualUsageStats.recentSessions.slice(0, 10).map((session, idx) => (
                                            <div key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-2 text-sm">
                                              <div className="flex items-center gap-3">
                                                <span className="text-gray-400">{idx + 1}.</span>
                                                <span className="text-gray-900">
                                                  {formatDate(session.sessionStart)}
                                                  <span className="text-gray-400 mx-1">→</span>
                                                  {session.sessionEnd ? formatDate(session.sessionEnd) : '-'}
                                                </span>
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
                                <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูลการเข้าใช้งานในช่วงเวลานี้</div>
                              )}
                            </div>

                            {/* Approval KPI by Stage */}
                            <div className="rounded-lg bg-white p-6 shadow">
                              <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span>✅</span> KPI การอนุมัติ (แยกตามขั้นตอน)
                              </h2>
                              {individualApprovalKPI && Object.keys(individualApprovalKPI.stages).length > 0 ? (
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
                                      {individualApprovalKPI.stageOrder.map((stage) => {
                                        const stats = individualApprovalKPI.stages[stage];
                                        if (!stats) return null;
                                        return (
                                          <tr key={stage} className="hover:bg-gray-50">
                                            <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                              {individualApprovalKPI.stageNames[stage as keyof typeof individualApprovalKPI.stageNames]}
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
                                <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูล KPI การอนุมัติในช่วงเวลานี้</div>
                              )}
                            </div>

                            {/* Receive Confirm KPI */}
                            <div className="rounded-lg bg-white p-6 shadow">
                              <h2 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <span>📦</span> KPI การยืนยันรับของ
                              </h2>
                              {individualReceiveKPI && individualReceiveKPI.totalCount > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                  <div className="rounded-lg bg-gray-50 p-4">
                                    <div className="text-sm text-gray-500">จำนวนครั้งทั้งหมด</div>
                                    <div className="mt-1 text-2xl font-bold text-gray-900">{individualReceiveKPI.totalCount}</div>
                                  </div>
                                  <div className="rounded-lg bg-blue-50 p-4">
                                    <div className="text-sm text-blue-600">เวลาเฉลี่ย</div>
                                    <div className="mt-1 text-2xl font-bold text-blue-700">
                                      {formatDuration(individualReceiveKPI.avgMinutes)}
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-green-50 p-4">
                                    <div className="text-sm text-green-600">On-time Rate</div>
                                    <div className="mt-1 text-2xl font-bold text-green-700">
                                      {individualReceiveKPI.onTimeRate !== null ? `${individualReceiveKPI.onTimeRate}%` : '-'}
                                    </div>
                                    <div className="text-xs text-green-600 mt-1">
                                      {individualReceiveKPI.onTimeCount} ตรงเวลา / {individualReceiveKPI.lateCount} เกินเวลา
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-purple-50 p-4">
                                    <div className="text-sm text-purple-600">สถานะการยืนยัน</div>
                                    <div className="mt-1 flex items-baseline gap-2">
                                      <span className="text-xl font-bold text-green-600">{individualReceiveKPI.confirmedCount}</span>
                                      <span className="text-gray-400">/</span>
                                      <span className="text-xl font-bold text-red-600">{individualReceiveKPI.rejectedCount}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1">ยืนยัน / ปฏิเสธ</div>
                                  </div>
                                </div>
                              ) : (
                                <div className="py-8 text-center text-gray-500">ยังไม่มีข้อมูล KPI การยืนยันรับของในช่วงเวลานี้</div>
                              )}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {!selectedUserId && (
                      <div className="rounded-lg bg-blue-50 border border-blue-200 p-6 text-center">
                        <span className="text-4xl">👤</span>
                        <p className="mt-2 text-blue-700">กรุณาเลือกผู้ใช้เพื่อดู KPI รายบุคคล</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== SLA CONFIG TAB ===== */}
                {activeTab === 'sla_config' && (
                  <div className="space-y-6">
                    {/* Add/Edit SLA Form */}
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h2 className="mb-4 text-lg font-semibold text-gray-800">เพิ่ม/แก้ไข SLA Target</h2>

                      {slaFormError && (
                        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
                          {slaFormError}
                        </div>
                      )}

                      <form onSubmit={handleSLASubmit} className="grid gap-4 md:grid-cols-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">ประเภท KPI</label>
                          <select
                            value={slaForm.kpiType}
                            onChange={(e) => setSlaForm({ ...slaForm, kpiType: e.target.value as 'approval' | 'receive_confirm', stage: '' })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                          >
                            <option value="approval">Approval</option>
                            <option value="receive_confirm">Receive Confirm</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            ขั้นตอน {slaForm.kpiType === 'approval' ? '' : '(ไม่ใช้)'}
                          </label>
                          <select
                            value={slaForm.stage}
                            onChange={(e) => setSlaForm({ ...slaForm, stage: e.target.value })}
                            disabled={slaForm.kpiType === 'receive_confirm'}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
                          >
                            <option value="">ทุกขั้นตอน (Default)</option>
                            {slaForm.kpiType === 'approval' && (
                              <>
                                <option value="requester">ผู้ขอซื้อ</option>
                                <option value="line">ผู้อนุมัติตามสายงาน</option>
                                <option value="cost_center">ผู้อนุมัติตาม Cost Center</option>
                                <option value="procurement">งานจัดซื้อพัสดุ</option>
                                <option value="vpc">VP-C</option>
                              </>
                            )}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Target (ชั่วโมง)</label>
                          <input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={slaForm.targetHours}
                            onChange={(e) => setSlaForm({ ...slaForm, targetHours: parseFloat(e.target.value) || 0 })}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
                            placeholder="เช่น 48 = 2 วัน"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            = {Math.round(slaForm.targetHours * 60)} นาที ({(slaForm.targetHours / 24).toFixed(1)} วัน)
                          </p>
                        </div>

                        <div className="flex items-end">
                          <button
                            type="submit"
                            disabled={upsertSLA.isPending}
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {upsertSLA.isPending ? 'กำลังบันทึก...' : 'บันทึก SLA'}
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* SLA List */}
                    <div className="rounded-lg bg-white p-6 shadow">
                      <h2 className="mb-4 text-lg font-semibold text-gray-800">SLA Config ที่มีอยู่</h2>

                      {slaConfigs && slaConfigs.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ประเภท</th>
                                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">ขั้นตอน</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Target</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {slaConfigs.map((config) => (
                                <tr key={config.id} className="hover:bg-gray-50">
                                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                                    {config.kpi_type === 'approval' ? 'Approval' : 'Receive Confirm'}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                                    {config.stage ? (stageNames[config.stage] || config.stage) : 'ทุกขั้นตอน'}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center text-sm text-gray-700">
                                    <span className="font-medium">{Number(config.target_hours).toFixed(1)} ชม.</span>
                                    <span className="ml-1 text-gray-400">
                                      ({config.target_minutes} นาที / {(config.target_minutes / 60 / 24).toFixed(1)} วัน)
                                    </span>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center">
                                    <button
                                      onClick={() => toggleSLA.mutate({ id: config.id, isActive: !config.is_active })}
                                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                        config.is_active
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {config.is_active ? 'Active' : 'Inactive'}
                                    </button>
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-3 text-center">
                                    <button
                                      onClick={() => {
                                        if (confirm('ต้องการลบ SLA Config นี้?')) {
                                          deleteSLA.mutate({ id: config.id });
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      ลบ
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-gray-500">
                          ยังไม่มี SLA Config - เพิ่มด้านบนเพื่อเริ่มใช้งาน
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
      </div>
    </PageGuard>
  );
}

export default function KPIDashboardPage() {
  return <KPIDashboardContent />;
}
