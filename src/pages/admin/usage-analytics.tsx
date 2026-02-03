/**
 * Usage Analytics Page - สถิติการใช้งานระบบ
 * แสดงข้อมูลจาก session_history ที่เก็บจาก heartbeat system
 */
import { useState } from "react";
import Head from "next/head";
import { api } from "~/utils/api";
import PageGuard from "~/components/PageGuard";

// Helper function to format duration
const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
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

// Helper to format date short
const formatDateShort = (dateStr: string): string => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric' });
};

type TabType = 'summary' | 'daily' | 'weekly' | 'monthly' | 'users';

export default function UsageAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  // Calculate date range
  const getDateRange = () => {
    if (dateRange === 'all') return { dateFrom: undefined, dateTo: undefined };
    const now = new Date();
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const dateFrom = new Date(now);
    dateFrom.setDate(dateFrom.getDate() - days);
    return { dateFrom, dateTo: now };
  };

  const { dateFrom, dateTo } = getDateRange();

  // Fetch data
  const { data: summary, isLoading: loadingSummary } = api.kpi.getUsageSummary.useQuery(
    { dateFrom, dateTo },
    { enabled: activeTab === 'summary' }
  );

  const { data: dailyStats, isLoading: loadingDaily } = api.kpi.getDailyUsageWithUsers.useQuery(
    { dateFrom, dateTo },
    { enabled: activeTab === 'daily' }
  );

  const { data: weeklyStats, isLoading: loadingWeekly } = api.kpi.getWeeklyUsageStats.useQuery(
    { dateFrom, dateTo },
    { enabled: activeTab === 'weekly' }
  );

  const { data: monthlyStats, isLoading: loadingMonthly } = api.kpi.getMonthlyUsageStats.useQuery(
    { dateFrom, dateTo },
    { enabled: activeTab === 'monthly' }
  );

  const { data: userStats, isLoading: loadingUsers } = api.kpi.getUserUsageStats.useQuery(
    { dateFrom, dateTo },
    { enabled: activeTab === 'users' }
  );

  const { data: userHistory } = api.kpi.getUserSessionHistory.useQuery(
    { userId: selectedUser ?? '', limit: 20 },
    { enabled: !!selectedUser }
  );

  const isLoading = loadingSummary || loadingDaily || loadingWeekly || loadingMonthly || loadingUsers;

  return (
    <PageGuard action="admin_usage.read">
      <Head>
        <title>สถิติการใช้งาน | Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-100 p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">สถิติการใช้งานระบบ</h1>
            <p className="text-gray-600">ข้อมูลจาก Session History (Heartbeat System)</p>
          </div>

          {/* Date Range Filter */}
          <div className="flex gap-2">
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                  dateRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {range === '7d' ? '7 วัน' : range === '30d' ? '30 วัน' : range === '90d' ? '90 วัน' : 'ทั้งหมด'}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-4 overflow-x-auto">
            {[
              { key: 'summary', label: 'ภาพรวม', icon: '📊' },
              { key: 'daily', label: 'รายวัน', icon: '📅' },
              { key: 'weekly', label: 'รายสัปดาห์', icon: '📆' },
              { key: 'monthly', label: 'รายเดือน', icon: '🗓️' },
              { key: 'users', label: 'รายคน', icon: '👥' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
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

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">กำลังโหลด...</div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Tab */}
            {activeTab === 'summary' && summary && (
              <>
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-white p-6 shadow">
                    <div className="text-sm text-gray-500">จำนวนครั้งเข้าใช้งาน</div>
                    <div className="mt-2 text-3xl font-bold text-indigo-600">{summary.totalSessions}</div>
                    <div className="mt-1 text-xs text-gray-400">sessions</div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow">
                    <div className="text-sm text-gray-500">จำนวน Users</div>
                    <div className="mt-2 text-3xl font-bold text-green-600">{summary.uniqueUsers}</div>
                    <div className="mt-1 text-xs text-gray-400">unique users</div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow">
                    <div className="text-sm text-gray-500">เวลาใช้งานรวม</div>
                    <div className="mt-2 text-3xl font-bold text-blue-600">{summary.totalHours}</div>
                    <div className="mt-1 text-xs text-gray-400">ชั่วโมง ({summary.totalMinutes} นาที)</div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow">
                    <div className="text-sm text-gray-500">เฉลี่ยต่อ Session</div>
                    <div className="mt-2 text-3xl font-bold text-purple-600">{summary.avgMinutesPerSession}</div>
                    <div className="mt-1 text-xs text-gray-400">นาที/session</div>
                  </div>
                </div>

                {/* Additional Stats */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-800">วิธีออกจากระบบ</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">กดออกจากระบบ (Manual)</span>
                        <span className="font-medium text-green-600">{summary.logoutTypes.manual}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">หมดเวลา (Timeout)</span>
                        <span className="font-medium text-yellow-600">{summary.logoutTypes.timeout}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">ถูก Force Logout</span>
                        <span className="font-medium text-red-600">{summary.logoutTypes.forceLogout}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">ถูก Kick (Admin)</span>
                        <span className="font-medium text-red-600">{summary.logoutTypes.kicked}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold text-gray-800">สถานะปัจจุบัน</h3>
                    <div className="flex items-center gap-4">
                      <div className="rounded-full bg-green-100 p-4">
                        <span className="text-3xl">🟢</span>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-green-600">{summary.currentActiveSessions}</div>
                        <div className="text-sm text-gray-500">Active Sessions ตอนนี้</div>
                      </div>
                    </div>
                    <div className="mt-4 text-sm text-gray-500">
                      เฉลี่ย {summary.avgSessionsPerUser} ครั้ง/คน ในช่วงเวลาที่เลือก
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Daily Stats Tab */}
            {activeTab === 'daily' && dailyStats && (
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold text-gray-800">
                  สถิติรายวัน
                  <span className="ml-2 text-sm font-normal text-gray-500">(คลิกแถวเพื่อดูรายคน)</span>
                </h3>
                {dailyStats.length > 0 ? (
                  <div className="space-y-2">
                    {dailyStats.map((day) => (
                      <div key={day.date} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Day Row - Clickable */}
                        <button
                          onClick={() => setExpandedDate(expandedDate === day.date ? null : day.date)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition ${
                            expandedDate === day.date ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-lg">{expandedDate === day.date ? '🔽' : '▶️'}</span>
                            <span className="font-medium text-gray-900">{formatDateShort(day.date)}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <span className="font-semibold text-indigo-600">{day.totalLogins}</span>
                              <span className="text-gray-500 ml-1">ครั้ง</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-green-600">{day.uniqueUsers}</span>
                              <span className="text-gray-500 ml-1">คน</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-blue-600">{formatDuration(day.totalMinutes)}</span>
                              <span className="text-gray-500 ml-1">รวม</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-purple-600">{day.avgMinutesPerSession}</span>
                              <span className="text-gray-500 ml-1">นาที/ครั้ง</span>
                            </div>
                          </div>
                        </button>

                        {/* Expanded User List */}
                        {expandedDate === day.date && (
                          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                            <table className="min-w-full">
                              <thead>
                                <tr className="text-xs text-gray-500 uppercase">
                                  <th className="text-left py-2">ชื่อผู้ใช้</th>
                                  <th className="text-center py-2">เข้าใช้ (ครั้ง)</th>
                                  <th className="text-center py-2">เวลารวม</th>
                                  <th className="text-center py-2">เฉลี่ย/ครั้ง</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {day.users.map((user) => (
                                  <tr key={user.userId} className="text-sm">
                                    <td className="py-2 font-medium text-gray-900">{user.userName}</td>
                                    <td className="py-2 text-center text-indigo-600">{user.loginCount}</td>
                                    <td className="py-2 text-center text-gray-700">{formatDuration(user.totalMinutes)}</td>
                                    <td className="py-2 text-center text-gray-700">{user.avgMinutes} นาที</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">ไม่มีข้อมูลในช่วงเวลานี้</div>
                )}
              </div>
            )}

            {/* Weekly Stats Tab */}
            {activeTab === 'weekly' && weeklyStats && (
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold text-gray-800">
                  สถิติรายสัปดาห์
                  <span className="ml-2 text-sm font-normal text-gray-500">(คลิกแถวเพื่อดูรายคน)</span>
                </h3>
                {weeklyStats.length > 0 ? (
                  <div className="space-y-2">
                    {weeklyStats.map((week) => (
                      <div key={week.weekStart} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Week Row - Clickable */}
                        <button
                          onClick={() => setExpandedWeek(expandedWeek === week.weekStart ? null : week.weekStart)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition ${
                            expandedWeek === week.weekStart ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-lg">{expandedWeek === week.weekStart ? '🔽' : '▶️'}</span>
                            <span className="font-medium text-gray-900">
                              {formatDateShort(week.weekStart)} - {formatDateShort(week.weekEnd)}
                            </span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <span className="font-semibold text-indigo-600">{week.totalLogins}</span>
                              <span className="text-gray-500 ml-1">ครั้ง</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-green-600">{week.uniqueUsers}</span>
                              <span className="text-gray-500 ml-1">คน</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-blue-600">{formatDuration(week.totalMinutes)}</span>
                              <span className="text-gray-500 ml-1">รวม</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-purple-600">{week.avgMinutesPerSession}</span>
                              <span className="text-gray-500 ml-1">นาที/ครั้ง</span>
                            </div>
                          </div>
                        </button>

                        {/* Expanded User List */}
                        {expandedWeek === week.weekStart && (
                          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                            <table className="min-w-full">
                              <thead>
                                <tr className="text-xs text-gray-500 uppercase">
                                  <th className="text-left py-2">ชื่อผู้ใช้</th>
                                  <th className="text-center py-2">เข้าใช้ (ครั้ง)</th>
                                  <th className="text-center py-2">เวลารวม</th>
                                  <th className="text-center py-2">เฉลี่ย/ครั้ง</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {week.users.map((user) => (
                                  <tr key={user.userId} className="text-sm">
                                    <td className="py-2 font-medium text-gray-900">{user.userName}</td>
                                    <td className="py-2 text-center text-indigo-600">{user.loginCount}</td>
                                    <td className="py-2 text-center text-gray-700">{formatDuration(user.totalMinutes)}</td>
                                    <td className="py-2 text-center text-gray-700">{user.avgMinutes} นาที</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">ไม่มีข้อมูลในช่วงเวลานี้</div>
                )}
              </div>
            )}

            {/* Monthly Stats Tab */}
            {activeTab === 'monthly' && monthlyStats && (
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-semibold text-gray-800">
                  สถิติรายเดือน
                  <span className="ml-2 text-sm font-normal text-gray-500">(คลิกแถวเพื่อดูรายคน)</span>
                </h3>
                {monthlyStats.length > 0 ? (
                  <div className="space-y-2">
                    {monthlyStats.map((month) => (
                      <div key={month.month} className="border border-gray-200 rounded-lg overflow-hidden">
                        {/* Month Row - Clickable */}
                        <button
                          onClick={() => setExpandedMonth(expandedMonth === month.month ? null : month.month)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition ${
                            expandedMonth === month.month ? 'bg-indigo-50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <span className="text-lg">{expandedMonth === month.month ? '🔽' : '▶️'}</span>
                            <span className="font-medium text-gray-900">{month.monthDisplay}</span>
                          </div>
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <span className="font-semibold text-indigo-600">{month.totalLogins}</span>
                              <span className="text-gray-500 ml-1">ครั้ง</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-green-600">{month.uniqueUsers}</span>
                              <span className="text-gray-500 ml-1">คน</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-blue-600">{month.totalHours} ชม.</span>
                              <span className="text-gray-500 ml-1">รวม</span>
                            </div>
                            <div className="text-center">
                              <span className="font-semibold text-purple-600">{month.avgMinutesPerSession}</span>
                              <span className="text-gray-500 ml-1">นาที/ครั้ง</span>
                            </div>
                          </div>
                        </button>

                        {/* Expanded User List */}
                        {expandedMonth === month.month && (
                          <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                            <table className="min-w-full">
                              <thead>
                                <tr className="text-xs text-gray-500 uppercase">
                                  <th className="text-left py-2">ชื่อผู้ใช้</th>
                                  <th className="text-center py-2">เข้าใช้ (ครั้ง)</th>
                                  <th className="text-center py-2">เวลารวม</th>
                                  <th className="text-center py-2">เฉลี่ย/ครั้ง</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {month.users.map((user) => (
                                  <tr key={user.userId} className="text-sm">
                                    <td className="py-2 font-medium text-gray-900">{user.userName}</td>
                                    <td className="py-2 text-center text-indigo-600">{user.loginCount}</td>
                                    <td className="py-2 text-center text-gray-700">{formatDuration(user.totalMinutes)}</td>
                                    <td className="py-2 text-center text-gray-700">{user.avgMinutes} นาที</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-500">ไม่มีข้อมูลในช่วงเวลานี้</div>
                )}
              </div>
            )}

            {/* User Stats Tab */}
            {activeTab === 'users' && userStats && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* User List */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">สถิติรายคน</h3>
                  <div className="mb-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <strong>เวลารวม</strong> = ผลรวมเวลาทุก session | <strong>เฉลี่ย</strong> = เวลารวม ÷ จำนวนครั้ง
                  </div>
                  {userStats.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                            <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เข้าใช้</th>
                            <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เวลารวม</th>
                            <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider text-gray-500">เฉลี่ย</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                          {userStats.map((user) => (
                            <tr
                              key={user.userId}
                              className={`cursor-pointer hover:bg-gray-50 ${selectedUser === user.userId ? 'bg-indigo-50' : ''}`}
                              onClick={() => setSelectedUser(user.userId)}
                            >
                              <td className="whitespace-nowrap px-3 py-2 text-sm">
                                <div className="font-medium text-gray-900">{user.userName}</div>
                                <div className="text-xs text-gray-500">Last: {formatDate(user.lastLogin)}</div>
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-center text-sm font-medium text-indigo-600">
                                {user.loginCount}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-700">
                                {formatDuration(user.totalMinutes)}
                              </td>
                              <td className="whitespace-nowrap px-3 py-2 text-center text-sm text-gray-700">
                                {user.avgMinutesPerSession} นาที
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-500">ไม่มีข้อมูลในช่วงเวลานี้</div>
                  )}
                </div>

                {/* User Session History */}
                <div className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-semibold text-gray-800">
                    {selectedUser ? `ประวัติ Session` : 'เลือก User เพื่อดูประวัติ'}
                  </h3>
                  {selectedUser && userHistory && userHistory.length > 0 ? (
                    <div className="max-h-96 overflow-y-auto">
                      <div className="space-y-2">
                        {userHistory.map((session) => (
                          <div key={session.id} className="rounded-lg border border-gray-200 p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">
                                {formatDate(session.sessionStart)}
                              </span>
                              <span className={`rounded-full px-2 py-0.5 text-xs ${
                                session.logoutType === 'manual' ? 'bg-green-100 text-green-700' :
                                session.logoutType === 'timeout' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {session.logoutType === 'manual' ? 'Manual' :
                                 session.logoutType === 'timeout' ? 'Timeout' :
                                 session.logoutType}
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-500">
                              ใช้งาน {session.durationMinutes} นาที
                              {session.ipAddress && ` | IP: ${session.ipAddress}`}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-gray-400">
                      {selectedUser ? 'ไม่มีประวัติ' : 'คลิกที่ User ด้านซ้าย'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="text-sm text-blue-700">
              <p className="font-medium">เกี่ยวกับข้อมูลนี้</p>
              <ul className="mt-1 list-disc pl-4 space-y-1">
                <li>ข้อมูลมาจาก <strong>Heartbeat System</strong> ที่ส่ง ping ทุก 30 วินาที</li>
                <li>Session จะถูกบันทึกเมื่อ user ออกจากระบบ (manual หรือ timeout)</li>
                <li>หาก user ปิดหน้าต่างโดยไม่ logout จะถูกนับเป็น <strong>timeout</strong> หลังจาก 3 นาที</li>
                <li><strong>เวลารวม</strong> = ผลรวมเวลาทุก session ของ user (เช่น 3 ครั้ง x 30 นาที = 90 นาที)</li>
                <li><strong>เฉลี่ย</strong> = เวลารวม ÷ จำนวนครั้งที่เข้าใช้ (เช่น 90 ÷ 3 = 30 นาที/ครั้ง)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </PageGuard>
  );
}
