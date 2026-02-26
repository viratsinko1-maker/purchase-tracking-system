import { useState, useMemo } from "react";
import { api } from "~/utils/api";

// Import shared utils
import { getTodayDateRange } from "~/utils/dateUtils";
import PageGuard from "~/components/PageGuard";

// Type สำหรับ session summary
interface SessionSummary {
  newPRs: number;
  updatedPRs: number;
  statusChangedPRs: number;
  linkedPOs: number;
}

// Alias for backward compatibility
const getDefaultDateRange = getTodayDateRange;

function SyncHistoryContent() {
  const defaultDates = useMemo(() => getDefaultDateRange(), []);

  const [dateFrom, setDateFrom] = useState(defaultDates.from);
  const [dateTo, setDateTo] = useState(defaultDates.to);
  const [expandedSessions, setExpandedSessions] = useState<Set<number>>(new Set());
  const [showFullSyncConfirm, setShowFullSyncConfirm] = useState(false);
  const [showPRRefreshConfirm, setShowPRRefreshConfirm] = useState(false);
  const [showBackfillSection, setShowBackfillSection] = useState(false);
  const [selectedBackfillPRs, setSelectedBackfillPRs] = useState<Set<number>>(new Set());

  const { data, isLoading, error, refetch } = api.pr.getSyncHistory.useQuery({
    dateFrom,
    dateTo,
  });

  const syncMutation = api.pr.sync.useMutation({
    onSuccess: () => {
      void refetch();
      setShowFullSyncConfirm(false);
      alert('Full Sync สำเร็จ! รีเฟรชหน้าเพื่อดูผลลัพธ์');
    },
    onError: (error) => {
      alert(`Full Sync ล้มเหลว: ${error.message}`);
      setShowFullSyncConfirm(false);
    },
  });

  const prRefreshMutation = api.sync.manualPRRefresh.useMutation({
    onSuccess: () => {
      void refetch();
      setShowPRRefreshConfirm(false);
      alert('PR Full Refresh สำเร็จ! ข้อมูล PR ถูกล้างและดึงใหม่แล้ว');
    },
    onError: (error) => {
      alert(`PR Full Refresh ล้มเหลว: ${error.message}`);
      setShowPRRefreshConfirm(false);
    },
  });

  const { data: unreceiptedPRs, refetch: refetchUnreceipted } = api.pr.getUnreceiptedPRs.useQuery(
    undefined,
    { enabled: showBackfillSection }
  );

  const backfillMutation = api.pr.backfillRequesterApproval.useMutation({
    onSuccess: (result) => {
      alert(`Backfill สำเร็จ! สร้าง ${result.created} รายการ, ข้าม ${result.skipped} รายการ`);
      setSelectedBackfillPRs(new Set());
      void refetchUnreceipted();
    },
    onError: (error) => {
      alert(`Backfill ล้มเหลว: ${error.message}`);
    },
  });

  const handleBackfill = () => {
    if (selectedBackfillPRs.size === 0) {
      alert('กรุณาเลือก PR ที่ต้องการ backfill');
      return;
    }
    backfillMutation.mutate({ prDocNums: Array.from(selectedBackfillPRs) });
  };

  const toggleBackfillPR = (prNo: number) => {
    setSelectedBackfillPRs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(prNo)) newSet.delete(prNo);
      else newSet.add(prNo);
      return newSet;
    });
  };

  const toggleSelectAllBackfill = () => {
    if (!unreceiptedPRs) return;
    if (selectedBackfillPRs.size === unreceiptedPRs.length) {
      setSelectedBackfillPRs(new Set());
    } else {
      setSelectedBackfillPRs(new Set(unreceiptedPRs.map(pr => pr.doc_num)));
    }
  };

  const handleFullSync = () => {
    setShowFullSyncConfirm(true);
  };

  const confirmFullSync = () => {
    syncMutation.mutate({ fullSync: true });
  };

  const handlePRRefresh = () => {
    setShowPRRefreshConfirm(true);
  };

  const confirmPRRefresh = () => {
    prRefreshMutation.mutate();
  };

  // Toggle expand/collapse
  const toggleSession = (sessionId: number) => {
    setExpandedSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  // คำนวณสรุปสำหรับแต่ละ session
  const getSessionSummary = (changes: any[]): SessionSummary => {
    return {
      newPRs: changes.filter(c => c.change_type === 'PR_NEW').length,
      updatedPRs: changes.filter(c => c.change_type === 'PR_UPDATED').length,
      statusChangedPRs: changes.filter(c => c.change_type === 'PR_STATUS_CHANGED').length,
      linkedPOs: changes.filter(c => c.change_type === 'PO_LINKED').length,
    };
  };

  // Helper: แปลงเวลา UTC เป็นเวลาไทย
  const toThaiDateTime = (date: Date) => {
    return new Date(date).toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Helper: แปลง change_type เป็นภาษาไทยและสี
  const getChangeTypeBadge = (changeType: string) => {
    const types: Record<string, { label: string; color: string }> = {
      'PR_NEW': { label: 'PR ใหม่', color: 'bg-green-100 text-green-800' },
      'PR_UPDATED': { label: 'PR อัพเดท', color: 'bg-blue-100 text-blue-800' },
      'PR_STATUS_CHANGED': { label: 'เปลี่ยนสถานะ', color: 'bg-yellow-100 text-yellow-800' },
      'PO_LINKED': { label: 'PO เชื่อมโยง', color: 'bg-purple-100 text-purple-800' },
    };
    const type = types[changeType] || { label: changeType, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${type.color}`}>
        {type.label}
      </span>
    );
  };

  // Helper: สถานะ PR
  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const isOpen = status === 'O';
    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
        isOpen ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}>
        {isOpen ? 'เปิด' : 'ปิด'}
      </span>
    );
  };

  // Handle search
  const handleSearch = () => {
    void refetch();
  };

  // Filter เฉพาะ sync ที่สำเร็จ
  const successfulSessions = data?.sessions.filter(session => session.status === 'success') || [];

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">กำลังโหลด...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-red-600">เกิดข้อผิดพลาด: {error.message}</div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">ประวัติการซิงค์</h1>
            <p className="mt-1 text-sm text-gray-600">
              รายละเอียดการซิงค์ข้อมูล PR-PO จาก SAP
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handlePRRefresh}
              disabled={prRefreshMutation.isPending}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
            >
              {prRefreshMutation.isPending ? 'กำลังล้างข้อมูล...' : '🗑️ PR Full Refresh'}
            </button>
            <button
              onClick={handleFullSync}
              disabled={syncMutation.isPending}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed"
            >
              {syncMutation.isPending ? 'กำลัง Sync...' : '🔄 Full Sync'}
            </button>
          </div>
        </div>

        {/* PR Full Refresh Confirmation Modal */}
        {showPRRefreshConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <span className="text-2xl">🗑️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">ยืนยัน PR Full Refresh</h3>
                  <p className="text-sm text-gray-600">กรุณาอ่านคำเตือนด้านล่าง</p>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-gray-700">
                <p className="mb-2 font-bold text-red-700">⚠️ คำเตือนสำคัญ:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li className="font-medium text-red-700">จะลบข้อมูล PR ทั้งหมด (TRUNCATE)</li>
                  <li>จากนั้นจะดึงข้อมูล PR ใหม่ทั้งหมดจาก SAP</li>
                  <li>อาจใช้เวลานาน 1-2 นาที</li>
                  <li className="font-medium">ใช้เมื่อพบปัญหา PR-PO link ไม่ตรงกัน</li>
                  <li>ควรใช้เฉพาะเมื่อจำเป็นเท่านั้น</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmPRRefresh}
                  disabled={prRefreshMutation.isPending}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
                >
                  {prRefreshMutation.isPending ? 'กำลังล้างข้อมูล...' : 'ยืนยัน - ล้างและดึงใหม่'}
                </button>
                <button
                  onClick={() => setShowPRRefreshConfirm(false)}
                  disabled={prRefreshMutation.isPending}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:bg-gray-100"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Full Sync Confirmation Modal */}
        {showFullSyncConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                  <span className="text-2xl">⚠️</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">ยืนยัน Full Sync</h3>
                  <p className="text-sm text-gray-600">กรุณาอ่านคำเตือนด้านล่าง</p>
                </div>
              </div>

              <div className="mb-6 rounded-lg bg-yellow-50 p-4 text-sm text-gray-700">
                <p className="mb-2 font-medium">⚠️ คำเตือน:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Full Sync จะดึงข้อมูลทั้งหมดจาก SAP</li>
                  <li>อาจใช้เวลานาน 30-60 วินาที</li>
                  <li>ควรใช้เมื่อปุ่ม Sync หน้าหลักไม่สามารถดึงข้อมูลได้</li>
                  <li>ระบบจะทำ Full Sync อัตโนมัติทุกวันตอนตี 1</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmFullSync}
                  disabled={syncMutation.isPending}
                  className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:bg-purple-300"
                >
                  {syncMutation.isPending ? 'กำลัง Sync...' : 'ยืนยัน Full Sync'}
                </button>
                <button
                  onClick={() => setShowFullSyncConfirm(false)}
                  disabled={syncMutation.isPending}
                  className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 disabled:bg-gray-100"
                >
                  ยกเลิก
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Backfill Section */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Backfill ขั้น 1 (ผู้ขอซื้อ)</h2>
              <p className="text-xs text-gray-500">สำหรับ PR เก่าที่ยังไม่มีการรับเอกสาร — auto-approve ขั้น 1 ย้อนหลัง</p>
            </div>
            <button
              onClick={() => setShowBackfillSection(!showBackfillSection)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
            >
              {showBackfillSection ? 'ซ่อน' : 'แสดง PR ที่ยังไม่มี receipt'}
            </button>
          </div>

          {showBackfillSection && (
            <div className="mt-4">
              {!unreceiptedPRs ? (
                <p className="text-sm text-gray-500">กำลังโหลด...</p>
              ) : unreceiptedPRs.length === 0 ? (
                <p className="text-sm text-green-600">ไม่มี PR ที่ต้อง backfill — ทุก PR มี receipt แล้ว</p>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      พบ <span className="font-medium">{unreceiptedPRs.length}</span> PR ที่ยังไม่มี receipt
                      {selectedBackfillPRs.size > 0 && (
                        <span className="ml-2 text-orange-600">(เลือก {selectedBackfillPRs.size} รายการ)</span>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={toggleSelectAllBackfill}
                        className="rounded bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                      >
                        {selectedBackfillPRs.size === unreceiptedPRs.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                      <button
                        onClick={handleBackfill}
                        disabled={backfillMutation.isPending || selectedBackfillPRs.size === 0}
                        className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-white hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                      >
                        {backfillMutation.isPending ? 'กำลัง backfill...' : `Backfill (${selectedBackfillPRs.size})`}
                      </button>
                    </div>
                  </div>

                  <div className="max-h-64 overflow-y-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left w-10">
                            <input
                              type="checkbox"
                              checked={selectedBackfillPRs.size === unreceiptedPRs.length && unreceiptedPRs.length > 0}
                              onChange={toggleSelectAllBackfill}
                              className="rounded"
                            />
                          </th>
                          <th className="px-3 py-2 text-left">เลข PR</th>
                          <th className="px-3 py-2 text-left">ผู้เปิด PR</th>
                          <th className="px-3 py-2 text-left">วันที่เปิด</th>
                          <th className="px-3 py-2 text-left">โครงการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {unreceiptedPRs.map(pr => (
                          <tr
                            key={pr.doc_num}
                            className={`hover:bg-gray-50 cursor-pointer ${selectedBackfillPRs.has(pr.doc_num) ? 'bg-orange-50' : ''}`}
                            onClick={() => toggleBackfillPR(pr.doc_num)}
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedBackfillPRs.has(pr.doc_num)}
                                onChange={() => toggleBackfillPR(pr.doc_num)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-3 py-2 font-medium">{pr.doc_num}</td>
                            <td className="px-3 py-2">{pr.req_name || '-'}</td>
                            <td className="px-3 py-2">
                              {pr.create_date
                                ? new Date(pr.create_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
                                : pr.doc_date
                                  ? new Date(pr.doc_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
                                  : '-'
                              }
                            </td>
                            <td className="px-3 py-2 text-gray-500">{pr.job_name || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Date Filter */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <label htmlFor="dateFrom" className="block text-sm font-medium text-gray-700">
                วันที่จาก
              </label>
              <input
                type="date"
                id="dateFrom"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="dateTo" className="block text-sm font-medium text-gray-700">
                วันที่ถึง
              </label>
              <input
                type="date"
                id="dateTo"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              🔍 ค้นหา
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 text-sm text-gray-600">
          พบ <span className="font-medium">{successfulSessions.length}</span> รายการ
        </div>

        {/* Sync Sessions */}
        {successfulSessions.length > 0 ? (
          <div className="space-y-3">
            {successfulSessions.map((session) => {
              const summary = getSessionSummary(session.changes);
              const isExpanded = expandedSessions.has(session.id);
              const hasChanges = session.changes.length > 0;

              return (
                <div key={session.id} className="overflow-hidden rounded-lg bg-white shadow">
                  {/* Session Header - Single Line with Badges */}
                  <div
                    className={`px-6 py-3 transition-colors ${hasChanges ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                    onClick={() => hasChanges && toggleSession(session.id)}
                  >
                    <div className="flex items-center gap-2 text-sm">
                      {/* Expand/Collapse Icon */}
                      {hasChanges && (
                        <span className="text-gray-400 text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </span>
                      )}

                      {/* Date/Time */}
                      <span className="font-semibold text-gray-900">
                        {toThaiDateTime(session.sync_date)}
                      </span>

                      <span className="text-gray-300">|</span>

                      {/* Sync Type Badge */}
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        session.sync_type === 'FULL'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {session.sync_type === 'FULL' ? '🌙 Full Sync' : '⚡ Incremental Sync'}
                      </span>

                      {/* Success Badge */}
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-green-100 text-green-800">
                        ✓ สำเร็จ
                      </span>

                      <span className="text-gray-300">|</span>

                      {/* Duration */}
                      <span className="text-gray-600 text-xs">
                        ⏱️ {session.duration_seconds} วินาที
                      </span>

                      <span className="text-gray-300">|</span>

                      {/* Summary Badges - แสดงเฉพาะถ้ามี changes */}
                      {hasChanges ? (
                        <div className="flex items-center gap-2">
                          {summary.newPRs > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs">
                              <span>PR ใหม่</span>
                              <span className="font-bold">{summary.newPRs}</span>
                            </span>
                          )}
                          {summary.updatedPRs > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs">
                              <span>อัพเดต</span>
                              <span className="font-bold">{summary.updatedPRs}</span>
                            </span>
                          )}
                          {summary.statusChangedPRs > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-yellow-800 text-xs">
                              <span>เปลี่ยนสถานะ</span>
                              <span className="font-bold">{summary.statusChangedPRs}</span>
                            </span>
                          )}
                          {summary.linkedPOs > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 font-medium text-purple-800 text-xs">
                              <span>PO เชื่อมโยง</span>
                              <span className="font-bold">{summary.linkedPOs}</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 text-xs">ไม่มีการเปลี่ยนแปลง</span>
                      )}
                    </div>
                  </div>

                  {/* Changes List - Collapsible */}
                  {hasChanges && isExpanded && (
                    <div className="border-t border-gray-200 divide-y divide-gray-200">
                      {session.changes.map((change) => (
                        <div key={change.id} className="px-6 py-3 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                {getChangeTypeBadge(change.change_type)}
                                <span className="font-medium text-gray-900">
                                  PR: {change.pr_no}
                                </span>
                                {change.po_no && (
                                  <span className="text-sm text-gray-600">
                                    → PO: {change.po_no}
                                  </span>
                                )}
                              </div>

                              {/* Description */}
                              <div className="mt-2 text-sm text-gray-600">
                                {change.pr_description && (
                                  <div>ผู้ขอ: {change.pr_description}</div>
                                )}
                                {change.po_description && (
                                  <div>รายการ: {change.po_description}</div>
                                )}
                              </div>

                              {/* Status Change */}
                              {change.old_status && change.new_status && change.old_status !== change.new_status && (
                                <div className="mt-2 flex items-center gap-2 text-sm">
                                  <span>สถานะ:</span>
                                  {getStatusBadge(change.old_status)}
                                  <span>→</span>
                                  {getStatusBadge(change.new_status)}
                                </div>
                              )}
                            </div>

                            <div className="text-xs text-gray-500">
                              {new Date(change.created_at).toLocaleTimeString('th-TH', {
                                timeZone: 'Asia/Bangkok',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-white px-6 py-12 text-center shadow">
            <p className="text-gray-500">ไม่พบประวัติการซิงค์ในช่วงวันที่ที่เลือก</p>
          </div>
        )}
      </div>
    </main>
  );
}

// Export default with PageGuard wrapper
export default function SyncHistoryPage() {
  return (
    <PageGuard action="admin_sync_pr.read" pageName="PR Sync History">
      <SyncHistoryContent />
    </PageGuard>
  );
}
