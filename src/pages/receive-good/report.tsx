import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/utils/api";
import PageGuard from "~/components/PageGuard";

interface Attachment {
  id: number;
  category: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: Date;
  source?: string;
}

interface ReceiveBatch {
  batch_key: string | null;
  received_at: Date;
  received_by: string;
  remarks: string | null;
  item_count: number;
  confirmedCount: number;
  rejectedCount: number;
  waitingCount: number;
  items: Array<{
    id: number;
    line_num: number;
    item_code: string | null;
    description: string | null;
    received_qty: number;
    unit_msr: string | null;
    confirm_status: string;
    confirm_remarks: string | null;
    confirmed_at: Date | null;
    confirmed_by: string | null;
  }>;
}

interface PRGroup {
  pr_doc_num: number;
  req_name: string | null;
  job_name: string | null;
  total_items: number;
  total_batches: number;
  confirmedCount: number;
  rejectedCount: number;
  waitingCount: number;
  batches: ReceiveBatch[];
}

function ReceiveGoodReportContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState("");
  const [selectedPR, setSelectedPR] = useState<PRGroup | null>(null);
  const [autoOpenAttempted, setAutoOpenAttempted] = useState(false);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});

  const utils = api.useUtils();

  // Get prNo from query param
  const queryPrNo = router.query.prNo as string | undefined;

  // Fetch all received records - ถ้ามี prNo ให้ใช้เป็น search filter
  const { data: records = [], isLoading } = api.pr.getAllReceived.useQuery(
    { search: queryPrNo || searchText || undefined, limit: 1000 },
    { enabled: router.isReady }
  );

  // Group records by PR number
  const prGroups = useMemo(() => {
    const groups: Map<number, PRGroup> = new Map();

    records.forEach((record: any) => {
      const prDocNum = record.pr_doc_num;

      if (!groups.has(prDocNum)) {
        groups.set(prDocNum, {
          pr_doc_num: prDocNum,
          req_name: record.req_name,
          job_name: record.job_name,
          total_items: 0,
          total_batches: 0,
          confirmedCount: 0,
          rejectedCount: 0,
          waitingCount: 0,
          batches: [],
        });
      }

      const prGroup = groups.get(prDocNum)!;

      // Create batch key from received_at
      const receivedAt = new Date(record.received_at);
      const batchKey = record.batch_key || `${receivedAt.getTime()}`;

      // Find or create batch
      let batch = prGroup.batches.find(b => b.batch_key === batchKey);
      if (!batch) {
        batch = {
          batch_key: batchKey,
          received_at: receivedAt,
          received_by: record.received_by,
          remarks: record.remarks || null,
          item_count: 0,
          confirmedCount: 0,
          rejectedCount: 0,
          waitingCount: 0,
          items: [],
        };
        prGroup.batches.push(batch);
        prGroup.total_batches++;
      }

      // Add item to batch
      const confirmStatus = record.confirm_status || 'waiting';
      batch.item_count++;
      batch.items.push({
        id: record.id,
        line_num: record.line_num,
        item_code: record.item_code,
        description: record.description,
        received_qty: Number(record.received_qty),
        unit_msr: record.unit_msr,
        confirm_status: confirmStatus,
        confirm_remarks: record.confirm_remarks || null,
        confirmed_at: record.confirmed_at ? new Date(record.confirmed_at) : null,
        confirmed_by: record.confirmed_by || null,
      });

      // Update counts
      prGroup.total_items++;
      if (confirmStatus === 'confirmed') {
        prGroup.confirmedCount++;
        batch.confirmedCount++;
      } else if (confirmStatus === 'rejected') {
        prGroup.rejectedCount++;
        batch.rejectedCount++;
      } else {
        prGroup.waitingCount++;
        batch.waitingCount++;
      }
    });

    // Sort batches by received_at descending within each PR
    groups.forEach(prGroup => {
      prGroup.batches.sort((a, b) => b.received_at.getTime() - a.received_at.getTime());
    });

    // Convert to array and sort by PR number descending
    return Array.from(groups.values()).sort((a, b) => b.pr_doc_num - a.pr_doc_num);
  }, [records]);

  // Auto-open PR popup when prNo query param is present
  useEffect(() => {
    if (router.isReady && queryPrNo && prGroups.length > 0 && !autoOpenAttempted) {
      const prNo = parseInt(queryPrNo, 10);
      const targetPR = prGroups.find(pr => pr.pr_doc_num === prNo);
      if (targetPR) {
        setSelectedPR(targetPR);
      }
      setAutoOpenAttempted(true);
    }
  }, [router.isReady, queryPrNo, prGroups, autoOpenAttempted]);

  // Fetch attachments when PR is selected
  useEffect(() => {
    if (!selectedPR) return;
    const batchKeys = selectedPR.batches
      .map(b => b.batch_key)
      .filter((k): k is string => !!k && !attachmentsMap[k]);
    batchKeys.forEach(async (batchKey) => {
      try {
        const attachments = await utils.pr.getAttachmentsByBatch.fetch({ batchKey });
        setAttachmentsMap(prev => ({
          ...prev,
          [batchKey]: attachments as Attachment[],
        }));
      } catch (error) {
        console.error('Failed to fetch attachments:', error);
      }
    });
  }, [selectedPR]);

  // Format Thai date time
  const formatThaiDateTime = (date: Date) => {
    return date.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Format name from "LastName, FirstName" to "FirstName LastName"
  const formatName = (name: string | null) => {
    if (!name) return '-';
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      return parts.reverse().join(' ');
    }
    return name;
  };

  // Format time difference between two dates
  const formatTimeDiff = (receivedAt: Date, confirmedAt: Date | null) => {
    if (!confirmedAt) return '-';
    const diffMs = confirmedAt.getTime() - receivedAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      return `${diffDays}d ${remainingHours}h`;
    } else if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours}h ${remainingMins}m`;
    } else {
      return `${diffMins}m`;
    }
  };

  // Get status color for card
  const getCardStatusClass = (pr: PRGroup) => {
    if (pr.waitingCount === 0 && pr.rejectedCount === 0 && pr.confirmedCount > 0) {
      return 'border-green-400 bg-green-50';
    } else if (pr.rejectedCount > 0) {
      return 'border-red-400 bg-red-50';
    }
    return 'border-gray-200 bg-white';
  };

  return (
    <>
      <Head>
        <title>Receive Good Report | PR Tracking</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/receive-good')}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-3xl">📊</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Receive Good Report</h1>
                <p className="text-sm text-gray-600">สรุปการรับสินค้าตาม PR</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <div className="relative flex gap-2">
            <div className="relative flex-1 md:flex-none md:w-80">
              <input
                type="text"
                value={queryPrNo || searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  // Clear URL param when user types
                  if (queryPrNo) {
                    void router.replace('/receive-good/report', undefined, { shallow: true });
                  }
                }}
                placeholder="Search PR, requester, job name..."
                className="w-full rounded-lg border border-gray-300 px-4 py-2 pl-10"
              />
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {queryPrNo && (
              <button
                onClick={() => {
                  setSearchText('');
                  void router.replace('/receive-good/report', undefined, { shallow: true });
                }}
                className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-300"
              >
                Clear
              </button>
            )}
          </div>
          <p className="mt-2 text-sm text-gray-500">
            Total: <strong>{prGroups.length}</strong> PRs
          </p>
        </div>

        {/* PR Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
        ) : prGroups.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {prGroups.map((pr) => (
              <div
                key={pr.pr_doc_num}
                onClick={() => setSelectedPR(pr)}
                className={`rounded-lg border-2 ${getCardStatusClass(pr)} p-4 cursor-pointer hover:shadow-md transition`}
              >
                {/* PR Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-green-700 text-lg">PR #{pr.pr_doc_num}</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                    {pr.total_batches} รอบ
                  </span>
                </div>

                {/* Requester */}
                <p className="text-sm text-gray-600 mb-1">
                  <span className="font-medium">ผู้ขอ:</span> {formatName(pr.req_name)}
                </p>

                {/* Job Name */}
                {pr.job_name && (
                  <p className="text-sm text-gray-500 mb-3 truncate" title={pr.job_name}>
                    {pr.job_name}
                  </p>
                )}

                {/* Summary */}
                <div className="border-t pt-3 mt-3">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600">รวม {pr.total_items} items</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pr.confirmedCount > 0 && (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        ✓ {pr.confirmedCount}
                      </span>
                    )}
                    {pr.rejectedCount > 0 && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        ✗ {pr.rejectedCount}
                      </span>
                    )}
                    {pr.waitingCount > 0 && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        ⏳ {pr.waitingCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-lg">
            <span className="mb-4 text-6xl">📋</span>
            <h2 className="mb-2 text-xl font-semibold text-gray-600">No Records</h2>
            <p className="text-center text-gray-500">
              {searchText ? `No records found for "${searchText}"` : "No receive records yet."}
            </p>
          </div>
        )}
      </div>

      {/* PR Detail Modal */}
      {selectedPR && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={(e) => {
            // Close when clicking backdrop
            if (e.target === e.currentTarget) {
              setSelectedPR(null);
              if (queryPrNo) {
                void router.replace('/receive-good/report', undefined, { shallow: true });
              }
            }
          }}
        >
          <div className="rounded-lg bg-white shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-green-700">PR #{selectedPR.pr_doc_num}</h2>
                <p className="text-sm text-gray-600">{formatName(selectedPR.req_name)}</p>
                {selectedPR.job_name && (
                  <p className="text-sm text-gray-500 mt-1">{selectedPR.job_name}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedPR(null);
                  if (queryPrNo) {
                    void router.replace('/receive-good/report', undefined, { shallow: true });
                  }
                }}
                className="rounded-lg p-2 hover:bg-gray-100"
              >
                <svg className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Summary */}
            <div className="px-6 py-4 bg-gray-50 border-b">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm text-gray-600">
                  รับของ <strong>{selectedPR.total_batches}</strong> รอบ
                </span>
                <span className="text-sm text-gray-600">
                  รวม <strong>{selectedPR.total_items}</strong> items
                </span>
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  Confirmed: {selectedPR.confirmedCount}
                </span>
                <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                  Rejected: {selectedPR.rejectedCount}
                </span>
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                  Waiting: {selectedPR.waitingCount}
                </span>
              </div>
            </div>

            {/* Batches List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {selectedPR.batches.map((batch, index) => {
                  const allConfirmed = batch.waitingCount === 0 && batch.rejectedCount === 0 && batch.confirmedCount > 0;
                  const hasRejected = batch.rejectedCount > 0;
                  const borderClass = allConfirmed
                    ? 'border-green-400 bg-green-50'
                    : hasRejected
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 bg-white';

                  return (
                    <div key={batch.batch_key} className={`rounded-lg border-2 ${borderClass} overflow-hidden`}>
                      {/* Batch Header */}
                      <div className="p-4 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-gray-900">รอบที่ {selectedPR.total_batches - index}</span>
                          <span className="text-gray-500 ml-3">
                            {formatThaiDateTime(batch.received_at)}
                          </span>
                          <span className="text-gray-500 ml-2">
                            by {batch.received_by}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                            {batch.item_count} items
                          </span>
                          {batch.batch_key && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/receive-good/confirm/${batch.batch_key}`);
                              }}
                              className="rounded-lg bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700"
                            >
                              Confirm
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Batch Items */}
                      <div className="border-t bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Line</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Item Code</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Confirmed At</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {batch.items.map((item) => (
                              <tr
                                key={item.id}
                                className={
                                  item.confirm_status === 'confirmed' ? 'bg-green-50' :
                                  item.confirm_status === 'rejected' ? 'bg-red-50' : ''
                                }
                              >
                                <td className="px-4 py-2 text-gray-900">{item.line_num}</td>
                                <td className="px-4 py-2 text-gray-600">{item.item_code || '-'}</td>
                                <td className="px-4 py-2 text-gray-900 max-w-xs truncate" title={item.description || ''}>
                                  {item.description || '-'}
                                </td>
                                <td className="px-4 py-2 text-right text-gray-900">
                                  {item.received_qty.toLocaleString()}
                                  {item.unit_msr && <span className="text-gray-500 ml-1">{item.unit_msr}</span>}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {item.confirm_status === 'confirmed' ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                        ✓ Confirmed
                                      </span>
                                      {item.confirm_remarks && (
                                        <span className="text-xs text-green-600">{item.confirm_remarks}</span>
                                      )}
                                    </div>
                                  ) : item.confirm_status === 'rejected' ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                        ✗ Rejected
                                      </span>
                                      {item.confirm_remarks && (
                                        <span className="text-xs text-red-600">{item.confirm_remarks}</span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                                      ⏳ Waiting
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2 text-gray-600 text-xs whitespace-nowrap">
                                  {item.confirmed_at ? (
                                    <div>
                                      <div>{formatThaiDateTime(item.confirmed_at)}</div>
                                      {item.confirmed_by && (
                                        <div className="text-gray-400">by {item.confirmed_by}</div>
                                      )}
                                    </div>
                                  ) : '-'}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  {item.confirm_status !== 'waiting' && item.confirmed_at ? (
                                    <span className={`text-xs font-medium ${
                                      item.confirm_status === 'confirmed' ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {formatTimeDiff(batch.received_at, item.confirmed_at)}
                                    </span>
                                  ) : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Remarks */}
                      {batch.remarks && (
                        <div className="mx-4 my-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-sm font-medium text-yellow-800">หมายเหตุ:</p>
                          <p className="text-sm text-yellow-700 mt-1">{batch.remarks}</p>
                        </div>
                      )}

                      {/* Attachments */}
                      {batch.batch_key && attachmentsMap[batch.batch_key] && (
                        <div className="mx-4 mb-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Documents (from warehouse) */}
                          {(() => {
                            const docs = attachmentsMap[batch.batch_key!]?.filter(a => a.category === 'document' && a.source !== 'confirm') || [];
                            if (docs.length === 0) return null;
                            return (
                              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 md:col-span-2">
                                <p className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                  เอกสาร ({docs.length})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                  {docs.map(doc => {
                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.file_name);
                                    const isPdf = /\.pdf$/i.test(doc.file_name);
                                    return (
                                      <a
                                        key={doc.id}
                                        href={`/api/serve-receive-attachment?path=${encodeURIComponent(doc.file_path)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block group"
                                      >
                                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-blue-200 group-hover:border-blue-400 transition bg-white flex items-center justify-center">
                                          {isImage ? (
                                            <img
                                              src={`/api/serve-receive-attachment?path=${encodeURIComponent(doc.file_path)}`}
                                              alt={doc.file_name}
                                              className="w-full h-full object-cover group-hover:scale-105 transition"
                                            />
                                          ) : isPdf ? (
                                            <div className="flex flex-col items-center justify-center p-2 text-center">
                                              <svg className="h-10 w-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9h2v5h-2v-5zm3 0h2v5h-2v-5zm-6 0h2v5H7v-5z"/>
                                              </svg>
                                              <span className="text-xs text-red-600 font-medium mt-1">PDF</span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-center">
                                              <svg className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                              <span className="text-xs text-blue-600 font-medium mt-1">DOC</span>
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-xs text-blue-600 mt-1 text-center truncate group-hover:text-blue-800" title={doc.file_name}>
                                          {doc.file_name}
                                        </p>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Photos (from warehouse) */}
                          {(() => {
                            const photos = attachmentsMap[batch.batch_key!]?.filter(a => a.category === 'photo' && a.source !== 'confirm') || [];
                            if (photos.length === 0) return null;
                            return (
                              <div className="p-3 bg-green-50 rounded-lg border border-green-200 md:col-span-2">
                                <p className="text-sm font-medium text-green-800 mb-3 flex items-center gap-2">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  รูปภาพการรับของ ({photos.length})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                  {photos.map(photo => (
                                    <a
                                      key={photo.id}
                                      href={`/api/serve-receive-attachment?path=${encodeURIComponent(photo.file_path)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block group"
                                    >
                                      <div className="aspect-square rounded-lg overflow-hidden border-2 border-green-200 group-hover:border-green-400 transition bg-white">
                                        <img
                                          src={`/api/serve-receive-attachment?path=${encodeURIComponent(photo.file_path)}`}
                                          alt={photo.file_name}
                                          className="w-full h-full object-cover group-hover:scale-105 transition"
                                        />
                                      </div>
                                      <p className="text-xs text-green-700 mt-1 truncate text-center">{photo.file_name}</p>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Confirm Attachments */}
                          {(() => {
                            const confirmFiles = attachmentsMap[batch.batch_key!]?.filter(a => a.source === 'confirm') || [];
                            if (confirmFiles.length === 0) return null;
                            return (
                              <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 md:col-span-2">
                                <p className="text-sm font-medium text-orange-800 mb-3 flex items-center gap-2">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  ไฟล์แนบจากการยืนยัน ({confirmFiles.length})
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                  {confirmFiles.map(cf => {
                                    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(cf.file_name);
                                    const isPdf = /\.pdf$/i.test(cf.file_name);
                                    return (
                                      <a
                                        key={cf.id}
                                        href={`/api/serve-receive-attachment?path=${encodeURIComponent(cf.file_path)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block group"
                                      >
                                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-orange-200 group-hover:border-orange-400 transition bg-white flex items-center justify-center">
                                          {isImage ? (
                                            <img
                                              src={`/api/serve-receive-attachment?path=${encodeURIComponent(cf.file_path)}`}
                                              alt={cf.file_name}
                                              className="w-full h-full object-cover group-hover:scale-105 transition"
                                            />
                                          ) : isPdf ? (
                                            <div className="flex flex-col items-center justify-center p-2 text-center">
                                              <svg className="h-10 w-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zm-3 9h2v5h-2v-5zm3 0h2v5h-2v-5zm-6 0h2v5H7v-5z"/>
                                              </svg>
                                              <span className="text-xs text-red-600 font-medium mt-1">PDF</span>
                                            </div>
                                          ) : (
                                            <div className="flex flex-col items-center justify-center p-2 text-center">
                                              <svg className="h-10 w-10 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                              </svg>
                                              <span className="text-xs text-orange-600 font-medium mt-1">DOC</span>
                                            </div>
                                          )}
                                        </div>
                                        <p className="text-xs text-orange-600 mt-1 text-center truncate group-hover:text-orange-800" title={cf.file_name}>
                                          {cf.file_name}
                                        </p>
                                      </a>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setSelectedPR(null);
                  if (queryPrNo) {
                    void router.replace('/receive-good/report', undefined, { shallow: true });
                  }
                }}
                className="rounded-lg bg-gray-200 px-6 py-2 font-medium text-gray-700 hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Export default with PageGuard wrapper
export default function ReceiveGoodReport() {
  return (
    <PageGuard action="receive_report.read" pageName="รายงานการรับของ">
      <ReceiveGoodReportContent />
    </PageGuard>
  );
}
