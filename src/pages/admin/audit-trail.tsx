import { useState, useEffect } from "react";
import Head from "next/head";
import { ACTION_LABELS, ACTION_COLORS } from "~/server/api/utils/auditLog";
import { authFetch } from "~/lib/authFetch";
import PageGuard from "~/components/PageGuard";

interface AuditTrail {
  id: number;
  user_id: string | null;
  user_name: string | null;
  ip_address: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  description: string | null;
  pr_no: number | null;
  po_no: number | null;
  tracking_id: number | null;
  metadata: Record<string, unknown> | null;
  admin_note: string | null;
  created_at: string;
  created_at_epoch: number | null;
  created_at_thai: string | null;
  computer_name: string | null;
}

/**
 * Get date range for current month
 */
function getDefaultDateRange() {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: firstDay.toISOString().slice(0, 10),
    end: lastDay.toISOString().slice(0, 10),
  };
}

function AuditTrailContent() {
  const [activities, setActivities] = useState<AuditTrail[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<AuditTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userFilter, setUserFilter] = useState<string>("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const defaultDates = getDefaultDateRange();
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);

  // Load activities
  const loadActivities = async () => {
    try {
      setLoading(true);
      setError("");

      // Send dates with Thailand timezone offset (+07:00)
      const startDateTime = new Date(`${startDate}T00:00:00+07:00`);
      const endDateTime = new Date(`${endDate}T23:59:59+07:00`);

      const params = new URLSearchParams({
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        _t: Date.now().toString(), // Cache buster
      });

      const response = await authFetch(`/api/admin/audit-trail?${params.toString()}`);
      const data = await response.json();

      if (response.ok) {
        const acts = data.activities || [];
        setActivities(acts);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูลได้");
      }
    } catch (err) {
      console.error("Load activities error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadActivities();
  }, []);

  // Filter activities
  useEffect(() => {
    let filtered = activities;

    if (userFilter.trim()) {
      filtered = filtered.filter((activity) => {
        const userName = activity.user_name || activity.user_id || '';
        return userName.toLowerCase().includes(userFilter.toLowerCase());
      });
    }

    if (actionFilter) {
      filtered = filtered.filter((activity) => activity.action === actionFilter);
    }

    setFilteredActivities(filtered);
  }, [activities, userFilter, actionFilter]);

  const handleRefresh = () => {
    setUserFilter("");
    setActionFilter("");
    void loadActivities();
  };

  const toggleRowExpand = (id: number) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getActionColor = (action: string) => {
    return ACTION_COLORS[action] || "bg-gray-100 text-gray-800";
  };

  const getActionLabel = (action: string) => {
    return ACTION_LABELS[action] || action;
  };

  const formatValues = (values: Record<string, unknown> | null) => {
    if (!values || Object.keys(values).length === 0) return null;
    return values;
  };

  // Get unique actions for filters
  const uniqueActions = [...new Set(activities.map((a) => a.action))].sort();

  return (
    <>
      <Head>
        <title>Audit Trail - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <div className="mb-4">
              <h1 className="text-3xl font-bold text-gray-800">Audit Trail</h1>
              <p className="text-sm text-gray-600 mt-1">ประวัติการเปลี่ยนแปลงข้อมูลในระบบ (เวลาประเทศไทย)</p>
            </div>

            {/* Filters */}
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จากวันที่
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ถึงวันที่
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ผู้ใช้
                  </label>
                  <input
                    type="text"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    placeholder="ค้นหาผู้ใช้"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Action
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="">ทั้งหมด</option>
                    {uniqueActions.map((action) => (
                      <option key={action} value={action}>
                        {getActionLabel(action)} ({action})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleRefresh}
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {loading ? "กำลังโหลด..." : "ค้นหา"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {/* Summary */}
          <div className="mb-4 rounded-lg bg-white p-4 shadow">
            <p className="text-sm text-gray-600">
              แสดงผล: <span className="font-bold text-gray-800">{filteredActivities.length}</span> รายการ
              {(userFilter.trim() || actionFilter) && (
                <span className="ml-2 text-xs">
                  (กรองจาก {activities.length} รายการ)
                </span>
              )}
            </p>
          </div>

          {/* Activities Table */}
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      วันเวลา (ไทย)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      IP / Computer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center">
                        กำลังโหลด...
                      </td>
                    </tr>
                  ) : filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                        ไม่มีข้อมูล Audit Trail ในช่วงเวลาที่เลือก
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((activity) => {
                      const isExpanded = expandedRows.has(activity.id);
                      const hasDetails = activity.old_values || activity.new_values || activity.metadata;

                      return (
                        <>
                          <tr key={activity.id} className="hover:bg-gray-50">
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                              {activity.created_at_thai || "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 font-medium">
                              {activity.user_name || activity.user_id || "-"}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getActionColor(activity.action)}`}>
                                {getActionLabel(activity.action)}
                              </span>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {activity.action}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                              <div className="truncate" title={activity.description || ""}>
                                {activity.description || "-"}
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                              <div>{activity.ip_address || "-"}</div>
                              {activity.computer_name && (
                                <div className="text-[10px] text-gray-400">{activity.computer_name}</div>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-sm">
                              {hasDetails && (
                                <button
                                  onClick={() => toggleRowExpand(activity.id)}
                                  className="text-blue-600 hover:text-blue-800 text-xs"
                                >
                                  {isExpanded ? "ซ่อน" : "ดูรายละเอียด"}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isExpanded && hasDetails && (
                            <tr key={`${activity.id}-details`} className="bg-gray-50">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                  {activity.old_values && (
                                    <div>
                                      <h4 className="font-semibold text-red-700 mb-1">Old Values:</h4>
                                      <pre className="bg-red-50 p-2 rounded text-xs overflow-auto max-h-40">
                                        {JSON.stringify(formatValues(activity.old_values), null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {activity.new_values && (
                                    <div>
                                      <h4 className="font-semibold text-green-700 mb-1">New Values:</h4>
                                      <pre className="bg-green-50 p-2 rounded text-xs overflow-auto max-h-40">
                                        {JSON.stringify(formatValues(activity.new_values), null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                  {activity.metadata && (
                                    <div>
                                      <h4 className="font-semibold text-blue-700 mb-1">Metadata:</h4>
                                      <pre className="bg-blue-50 p-2 rounded text-xs overflow-auto max-h-40">
                                        {JSON.stringify(activity.metadata, null, 2)}
                                      </pre>
                                    </div>
                                  )}
                                </div>
                                {activity.admin_note && (
                                  <div className="mt-3 p-2 bg-yellow-50 rounded">
                                    <span className="font-semibold text-yellow-800">Admin Note: </span>
                                    <span className="text-yellow-700">{activity.admin_note}</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Export default with PageGuard wrapper
export default function AuditTrailPage() {
  return (
    <PageGuard action="admin_audit.read" pageName="Audit Trail">
      <AuditTrailContent />
    </PageGuard>
  );
}
