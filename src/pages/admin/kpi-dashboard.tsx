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
import AdminSidebar from "~/components/AdminSidebar";
import TopBar from "~/components/TopBar";
import { useSidebar } from "~/contexts/SidebarContext";
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

type TabType = 'approval' | 'receive_confirm' | 'usage' | 'sla_config';

// Get current Thai year
const getCurrentThaiYear = () => new Date().getFullYear() + 543;

// Get current quarter (1-4)
const getCurrentQuarter = () => Math.ceil((new Date().getMonth() + 1) / 3);

function KPIDashboardContent() {
  const { isExpanded } = useSidebar();
  const [activeTab, setActiveTab] = useState<TabType>('approval');

  // Year/Quarter filter
  const [filterType, setFilterType] = useState<'quarter' | 'year'>('quarter');
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentThaiYear());
  const [selectedQuarter, setSelectedQuarter] = useState<number>(getCurrentQuarter());

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

  const isLoading = loadingApproval || loadingReceive || loadingUsage || loadingSLA;

  // Generate year options (last 3 years)
  const yearOptions = Array.from({ length: 3 }, (_, i) => getCurrentThaiYear() - i);

  return (
    <PageGuard action="admin_kpi.read">
      <Head>
        <title>KPI Dashboard | Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-100">
        <TopBar />
        <div className="flex">
          <AdminSidebar />
          <main
            className="flex-1 p-6 transition-all duration-300"
            style={{ marginLeft: isExpanded ? "256px" : "64px" }}
          >
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
                                    {row.userName}
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
                                    {row.userName}
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
                                    {row.userName}
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
          </main>
        </div>
      </div>
    </PageGuard>
  );
}

export default function KPIDashboardPage() {
  return <KPIDashboardContent />;
}
