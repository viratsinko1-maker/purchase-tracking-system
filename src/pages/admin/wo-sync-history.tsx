import { useState, useEffect } from "react";
import Head from "next/head";
import { authFetch } from "~/lib/authFetch";
import PageGuard from "~/components/PageGuard";

interface WOSyncStats {
  woSummary: {
    count: number;
    lastSync: string | null;
  };
  woGIDetail: {
    count: number;
    lastSync: string | null;
  };
  woPODetail: {
    count: number;
    lastSync: string | null;
  };
  prWOLink: {
    count: number;
    lastSync: string | null;
  };
}

function WOSyncHistoryContent() {
  const [stats, setStats] = useState<WOSyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const loadStats = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authFetch("/api/admin/wo-sync-stats");
      const data = await response.json();

      if (response.ok) {
        setStats(data);
      } else {
        setError(data.error || "ไม่สามารถโหลดข้อมูลได้");
      }
    } catch (err) {
      console.error("Load stats error:", err);
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStats();
  }, []);

  const handleManualSync = async () => {
    if (syncing) return;

    try {
      setSyncing(true);
      setError("");

      const response = await authFetch("/api/admin/trigger-wo-sync", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        alert("WO Sync สำเร็จ!");
        void loadStats();
      } else {
        setError(data.error || "ไม่สามารถ Sync ได้");
      }
    } catch (err) {
      console.error("Sync error:", err);
      setError("เกิดข้อผิดพลาดในการ Sync");
    } finally {
      setSyncing(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <>
      <Head>
        <title>WO Sync History - Admin</title>
      </Head>

      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ประวัติ WO Sync</h1>
              <p className="mt-1 text-sm text-gray-600">
                สถานะการ Sync ข้อมูล Work Order จาก SAP
              </p>
            </div>
            <button
              onClick={handleManualSync}
              disabled={syncing || loading}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:bg-purple-300"
            >
              {syncing ? "กำลัง Sync..." : "🔄 Manual Sync"}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-600">
              {error}
            </div>
          )}

          {/* Info Box */}
          <div className="mb-6 rounded-lg bg-blue-50 p-4">
            <h3 className="font-semibold text-blue-800">ข้อมูล WO Sync</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-blue-700">
              <li>WO Sync รวมอยู่ใน Auto-Sync ที่ทำงานทุก 2 ชั่วโมง</li>
              <li>ข้อมูลจะถูกล้างและดึงใหม่ทั้งหมดทุกครั้งที่ sync (Full Refresh)</li>
              <li>ประกอบด้วย: WO Summary, WO GI Detail, WO PO Detail, PR-WO Link</li>
            </ul>
          </div>

          {/* Stats Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-gray-600">กำลังโหลด...</div>
            </div>
          ) : stats ? (
            <div className="grid gap-4 md:grid-cols-2">
              {/* WO Summary Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                    <span className="text-2xl">🔧</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">WO Summary</h3>
                    <p className="text-sm text-gray-500">ข้อมูลสรุป Work Order</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวน Records:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.woSummary.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.woSummary.lastSync)}
                    </span>
                  </div>
                </div>
              </div>

              {/* WO GI Detail Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <span className="text-2xl">📤</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">WO GI Detail</h3>
                    <p className="text-sm text-gray-500">รายละเอียดการเบิกของ</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวน Records:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.woGIDetail.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.woGIDetail.lastSync)}
                    </span>
                  </div>
                </div>
              </div>

              {/* WO PO Detail Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-2xl">📦</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">WO PO Detail</h3>
                    <p className="text-sm text-gray-500">รายละเอียด PO ที่เชื่อมกับ WO</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวน Records:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.woPODetail.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.woPODetail.lastSync)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PR-WO Link Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PR-WO Link</h3>
                    <p className="text-sm text-gray-500">ความสัมพันธ์ PR กับ WO</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวน Links:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.prWOLink.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.prWOLink.lastSync)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-white px-6 py-12 text-center shadow">
              <p className="text-gray-500">ไม่พบข้อมูล</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

// Export default with PageGuard wrapper
export default function WOSyncHistoryPage() {
  return (
    <PageGuard action="admin_sync_wo.read" pageName="WO Sync History">
      <WOSyncHistoryContent />
    </PageGuard>
  );
}
