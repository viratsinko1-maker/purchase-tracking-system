import { useState, useEffect } from "react";
import Head from "next/head";
import { authFetch } from "~/lib/authFetch";
import PageGuard from "~/components/PageGuard";

interface AttachmentSyncStats {
  prAttachments: {
    count: number;
    lastSync: string | null;
  };
  poAttachments: {
    count: number;
    lastSync: string | null;
  };
  prProjectLink: {
    count: number;
    lastSync: string | null;
  };
}

function AttachmentSyncHistoryContent() {
  const [stats, setStats] = useState<AttachmentSyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  const loadStats = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await authFetch("/api/admin/attachment-sync-stats");
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

      const response = await authFetch("/api/admin/trigger-attachment-sync", {
        method: "POST",
      });
      const data = await response.json();

      if (response.ok) {
        alert("Attachment Sync สำเร็จ!");
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
        <title>Attachment Sync History - Admin</title>
      </Head>

      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">ประวัติ Attachment Sync</h1>
              <p className="mt-1 text-sm text-gray-600">
                สถานะการ Sync ไฟล์แนบและ Project Links จาก SAP
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
            <h3 className="font-semibold text-blue-800">ข้อมูล Attachment Sync</h3>
            <ul className="mt-2 list-disc pl-5 text-sm text-blue-700">
              <li>Attachment Sync ทำงานอัตโนมัติทุก 2 ชั่วโมง (ที่นาที :30)</li>
              <li>Full Refresh (ลบและดึงใหม่ทั้งหมด) ทุกเที่ยงคืน (00:00)</li>
              <li>ประกอบด้วย: PR Attachments, PO Attachments, PR Project Links</li>
            </ul>
          </div>

          {/* Stats Cards */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-lg text-gray-600">กำลังโหลด...</div>
            </div>
          ) : stats ? (
            <div className="grid gap-4 md:grid-cols-3">
              {/* PR Attachments Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-2xl">📎</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PR Attachments</h3>
                    <p className="text-sm text-gray-500">ไฟล์แนบ PR</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวนไฟล์:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.prAttachments.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.prAttachments.lastSync)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PO Attachments Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    <span className="text-2xl">📎</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PO Attachments</h3>
                    <p className="text-sm text-gray-500">ไฟล์แนบ PO</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวนไฟล์:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.poAttachments.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.poAttachments.lastSync)}
                    </span>
                  </div>
                </div>
              </div>

              {/* PR Project Link Card */}
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                    <span className="text-2xl">🔗</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PR Project Link</h3>
                    <p className="text-sm text-gray-500">ความสัมพันธ์ PR กับ Project</p>
                  </div>
                </div>
                <div className="mt-4 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-600">จำนวน Links:</span>
                    <span className="font-semibold text-gray-900">
                      {stats.prProjectLink.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 flex justify-between">
                    <span className="text-gray-600">Last Sync:</span>
                    <span className="text-sm text-gray-700">
                      {formatDateTime(stats.prProjectLink.lastSync)}
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
export default function AttachmentSyncHistoryPage() {
  return (
    <PageGuard action="admin_sync_attach.read" pageName="Attachment Sync History">
      <AttachmentSyncHistoryContent />
    </PageGuard>
  );
}
