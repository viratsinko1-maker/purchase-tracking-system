import { useState, useEffect } from "react";
import Head from "next/head";

interface ActivityTrail {
  id: number;
  user_id: string | null;
  user_name: string | null;
  ip_address: string | null;
  action: string;
  description: string | null;
  pr_no: number | null;
  po_no: number | null;
  tracking_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function ActivityTrailPage() {
  const [activities, setActivities] = useState<ActivityTrail[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<ActivityTrail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userFilter, setUserFilter] = useState<string>("");

  // Get first and last day of current month
  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return {
      start: firstDay.toISOString().slice(0, 10),
      end: lastDay.toISOString().slice(0, 10),
    };
  };

  const defaultDates = getDefaultDates();
  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);

  // Load activities
  const loadActivities = async () => {
    try {
      setLoading(true);
      setError("");

      // Convert date to start and end of day in ISO format
      const startDateTime = new Date(startDate);
      startDateTime.setHours(0, 0, 0, 0);

      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);

      const params = new URLSearchParams({
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
      });

      const response = await fetch(`/api/admin/activity-trail?${params.toString()}`);
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

  // Filter activities by user (partial match)
  useEffect(() => {
    if (!userFilter.trim()) {
      setFilteredActivities(activities);
    } else {
      const filtered = activities.filter((activity) => {
        const userName = activity.user_name || (activity.metadata as any)?.userId || activity.user_id || '';
        return userName.toLowerCase().includes(userFilter.toLowerCase());
      });
      setFilteredActivities(filtered);
    }
  }, [activities, userFilter]);

  const handleRefresh = () => {
    setUserFilter("");
    void loadActivities();
  };

  const formatMetadata = (metadata: Record<string, unknown> | null) => {
    if (!metadata || Object.keys(metadata).length === 0) return "-";

    return Object.entries(metadata)
      .map(([key, value]) => {
        if (value === null || value === undefined) return null;
        const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return `${key}: ${displayValue}`;
      })
      .filter(Boolean)
      .join(", ");
  };

  const formatDateTime = (dateString: string, action: string) => {
    const date = new Date(dateString);
    let adjustedDate: Date;

    // LOGIN and LOGOUT need to subtract 7 hours
    // Other actions display as-is
    if (action === 'LOGIN' || action === 'LOGOUT') {
      // Subtract 7 hours for LOGIN and LOGOUT
      adjustedDate = new Date(date.getTime() - (7 * 60 * 60 * 1000));
    } else {
      // Display as-is for other actions
      adjustedDate = date;
    }

    return adjustedDate.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "LOGIN":
        return "bg-green-100 text-green-800";
      case "LOGOUT":
        return "bg-gray-100 text-gray-800";
      case "VIEW_PR":
      case "VIEW_PO":
        return "bg-blue-100 text-blue-800";
      case "TRACK_PR":
      case "TRACK_DELIVERY":
        return "bg-purple-100 text-purple-800";
      case "RESPONSE_PR":
        return "bg-yellow-100 text-yellow-800";
      case "SYNC_DATA":
        return "bg-indigo-100 text-indigo-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <>
      <Head>
        <title>Activity Trail - Admin</title>
      </Head>

      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <div className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-800">
                Activity Trail
              </h1>
              <button
                onClick={() => window.location.href = '/admin/users'}
                className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
              >
                ← กลับหน้า Admin
              </button>
            </div>

            {/* Date Filter */}
            <div className="rounded-lg bg-white p-4 shadow">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จากวันที่
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ถึงวันที่
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ผู้ใช้
                  </label>
                  <input
                    type="text"
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                    className="block w-full rounded-md border border-gray-300 px-3 py-2"
                    placeholder="ค้นหาผู้ใช้"
                  />
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? "กำลังโหลด..." : "🔄 Refresh"}
                </button>
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
              {userFilter.trim() && (
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
                      วันเวลา
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      IP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      PR No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      PO No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Tracking
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      Metadata
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 text-center">
                        กำลังโหลด...
                      </td>
                    </tr>
                  ) : filteredActivities.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-4 text-center text-gray-500">
                        {userFilter.trim()
                          ? `ไม่มีข้อมูลของผู้ใช้ "${userFilter}"`
                          : "ไม่มีข้อมูล Activity Trail ในช่วงเวลาที่เลือก"}
                      </td>
                    </tr>
                  ) : (
                    filteredActivities.map((activity) => (
                      <tr key={activity.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                          {formatDateTime(activity.created_at, activity.action)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900 font-medium">
                          {activity.user_name || (activity.metadata as any)?.userId || activity.user_id || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {activity.ip_address || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getActionColor(activity.action)}`}>
                            {activity.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-md">
                          <div className="truncate" title={activity.description || ""}>
                            {activity.description || "-"}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {activity.pr_no || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {activity.po_no || "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {activity.tracking_id || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          <div className="truncate text-xs" title={formatMetadata(activity.metadata)}>
                            {formatMetadata(activity.metadata)}
                          </div>
                        </td>
                      </tr>
                    ))
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
