import { useState, useMemo } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/utils/api";

interface GroupedRecord {
  pr_doc_num: number;
  job_name: string | null;
  req_name: string | null;
  received_at: Date;
  received_by: string;
  item_count: number;
  batch_key: string | null;
  remarks: string | null;
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
  // Summary counts
  confirmedCount: number;
  rejectedCount: number;
  waitingCount: number;
}

interface Attachment {
  id: number;
  category: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_at: Date;
}

export default function ReceiveGoodList() {
  const router = useRouter();
  const { user } = useAuth();

  const [searchText, setSearchText] = useState("");
  const [expandedPRs, setExpandedPRs] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<string, Attachment[]>>({});
  const [itemToDelete, setItemToDelete] = useState<{ id: number; description: string } | null>(null);

  // Check if user can add receive goods (Admin or Warehouse only)
  const canAddReceiveGoods = user?.role === "Admin" || user?.role === "Warehouse";
  const isAdmin = user?.role === "Admin";

  // Fetch all received records
  const { data: records = [], isLoading, refetch } = api.pr.getAllReceived.useQuery(
    { search: searchText || undefined, limit: 500 },
    { enabled: true }
  );

  // Group records by PR and received_at (same batch)
  const groupedRecords = useMemo(() => {
    const groups: Map<string, GroupedRecord> = new Map();

    records.forEach((record: any) => {
      // Create a key based on PR number and received_at timestamp (rounded to second)
      const receivedAt = new Date(record.received_at);
      const timeKey = `${receivedAt.getFullYear()}-${receivedAt.getMonth()}-${receivedAt.getDate()}-${receivedAt.getHours()}-${receivedAt.getMinutes()}-${receivedAt.getSeconds()}`;
      const key = `${record.pr_doc_num}-${timeKey}`;

      if (!groups.has(key)) {
        groups.set(key, {
          pr_doc_num: record.pr_doc_num,
          job_name: record.job_name,
          req_name: record.req_name,
          received_at: receivedAt,
          received_by: record.received_by,
          item_count: 0,
          batch_key: record.batch_key || null,
          remarks: record.remarks || null,
          items: [],
          confirmedCount: 0,
          rejectedCount: 0,
          waitingCount: 0,
        });
      }

      const group = groups.get(key)!;
      group.item_count++;

      const confirmStatus = record.confirm_status || 'waiting';
      if (confirmStatus === 'confirmed') group.confirmedCount++;
      else if (confirmStatus === 'rejected') group.rejectedCount++;
      else group.waitingCount++;

      group.items.push({
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
    });

    // Convert to array and sort by received_at descending
    return Array.from(groups.entries())
      .sort((a, b) => b[1].received_at.getTime() - a[1].received_at.getTime());
  }, [records]);

  // Delete mutation (multiple items)
  const deleteMutation = api.pr.deleteMultipleReceived.useMutation({
    onSuccess: (data) => {
      setDeleteMessage({ type: 'success', text: data.message });
      setSelectedGroups(new Set());
      setShowDeleteConfirm(false);
      void refetch();
    },
    onError: (error) => {
      setDeleteMessage({ type: 'error', text: error.message });
    },
  });

  // Delete mutation (single item)
  const deleteSingleMutation = api.pr.deleteReceived.useMutation({
    onSuccess: (data) => {
      setDeleteMessage({ type: 'success', text: data.message });
      setItemToDelete(null);
      void refetch();
    },
    onError: (error) => {
      setDeleteMessage({ type: 'error', text: error.message });
    },
  });

  const handleDeleteSingleItem = () => {
    if (!itemToDelete || !user) return;
    deleteSingleMutation.mutate({
      id: itemToDelete.id,
      deletedBy: user.name || user.username || 'Unknown',
    });
  };

  const handleAddNew = () => {
    void router.push("/receive-good/new");
  };

  // Fetch attachments utility
  const utils = api.useUtils();

  const fetchAttachments = async (batchKey: string) => {
    if (!batchKey || attachmentsMap[batchKey]) return;

    try {
      const attachments = await utils.pr.getAttachmentsByBatch.fetch({ batchKey });
      setAttachmentsMap(prev => ({
        ...prev,
        [batchKey]: attachments as Attachment[],
      }));
    } catch (error) {
      console.error('Failed to fetch attachments:', error);
    }
  };

  const toggleExpand = (key: string) => {
    const group = groupedRecords.find(([k]) => k === key);

    setExpandedPRs(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Fetch attachments when expanding
        if (group && group[1].batch_key) {
          void fetchAttachments(group[1].batch_key);
        }
      }
      return next;
    });
  };

  const handleSelectGroup = (key: string, checked: boolean) => {
    setSelectedGroups(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedGroups(new Set(groupedRecords.map(([key]) => key)));
    } else {
      setSelectedGroups(new Set());
    }
  };

  const handleDelete = () => {
    // Collect all item IDs from selected groups
    const idsToDelete: number[] = [];
    selectedGroups.forEach(key => {
      const group = groupedRecords.find(([k]) => k === key);
      if (group) {
        group[1].items.forEach(item => idsToDelete.push(item.id));
      }
    });

    if (idsToDelete.length === 0) return;

    deleteMutation.mutate({
      ids: idsToDelete,
      deletedBy: user?.name || user?.username || 'Unknown',
    });
  };

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
    if (!name) return null;
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      return parts.reverse().join(' ');
    }
    return name;
  };

  // Format time difference between received and confirmed (only for confirmed/rejected)
  const formatTimeDiff = (receivedAt: Date, confirmedAt: Date | null) => {
    if (!confirmedAt) return '-';
    const diffMs = confirmedAt.getTime() - receivedAt.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remainingHours = diffHours % 24;
      return `${diffDays} วัน ${remainingHours} ชม.`;
    } else if (diffHours > 0) {
      const remainingMins = diffMins % 60;
      return `${diffHours} ชม. ${remainingMins} นาที`;
    } else {
      return `${diffMins} นาที`;
    }
  };

  const selectedItemCount = useMemo(() => {
    let count = 0;
    selectedGroups.forEach(key => {
      const group = groupedRecords.find(([k]) => k === key);
      if (group) {
        count += group[1].items.length;
      }
    });
    return count;
  }, [selectedGroups, groupedRecords]);

  return (
    <>
      <Head>
        <title>Receive Good | PR Tracking</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📥</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Receive Good</h1>
                <p className="text-sm text-gray-600">รายการรับสินค้า</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Report button */}
              <button
                onClick={() => router.push('/receive-good/report')}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Report
              </button>

              {/* Add button - only for Warehouse/Admin */}
              {canAddReceiveGoods && (
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition hover:bg-green-700"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Receive
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {/* Search and Actions */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="relative">
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search PR, item, requester..."
                className="w-full md:w-80 rounded-lg border border-gray-300 px-4 py-2 pl-10"
              />
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Admin delete button */}
            {isAdmin && selectedGroups.size > 0 && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white transition hover:bg-red-700"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete ({selectedGroups.size} groups, {selectedItemCount} items)
              </button>
            )}
          </div>

          {/* Message */}
          {deleteMessage && (
            <div className={`mb-4 rounded-lg p-3 ${deleteMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {deleteMessage.text}
            </div>
          )}

          {/* Admin select all */}
          {isAdmin && groupedRecords.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedGroups.size === groupedRecords.length && groupedRecords.length > 0}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Select All</span>
            </div>
          )}

          {/* Grouped Records */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">Loading...</div>
          ) : groupedRecords.length > 0 ? (
            <div className="space-y-4">
              {groupedRecords.map(([key, group]) => {
                // Determine border color based on confirm status
                const allConfirmed = group.waitingCount === 0 && group.rejectedCount === 0 && group.confirmedCount > 0;
                const hasRejected = group.rejectedCount > 0;
                const borderClass = selectedGroups.has(key)
                  ? 'border-red-300 bg-red-50'
                  : allConfirmed
                    ? 'border-green-400 bg-green-50'
                    : hasRejected
                      ? 'border-red-400 bg-red-50'
                      : 'border-gray-200 bg-white';

                return (
                <div
                  key={key}
                  className={`rounded-lg border-2 ${borderClass} overflow-hidden`}
                >
                  {/* Group Header */}
                  <div
                    className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpand(key)}
                  >
                    {/* Admin checkbox */}
                    {isAdmin && (
                      <input
                        type="checkbox"
                        checked={selectedGroups.has(key)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleSelectGroup(key, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    )}

                    {/* Expand/Collapse Icon */}
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform ${expandedPRs.has(key) ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>

                    {/* PR Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-semibold text-green-700 text-lg">PR #{group.pr_doc_num}</span>
                        {group.req_name && (
                          <span className="text-gray-600 text-sm">({formatName(group.req_name)})</span>
                        )}
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                          {group.item_count} items
                        </span>
                      </div>
                      {/* Confirm status badges */}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {group.confirmedCount > 0 && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Confirmed: {group.confirmedCount}
                          </span>
                        )}
                        {group.rejectedCount > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            Rejected: {group.rejectedCount}
                          </span>
                        )}
                        {group.waitingCount > 0 && (
                          <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Waiting: {group.waitingCount}
                          </span>
                        )}
                      </div>
                      {group.job_name && (
                        <p className="text-sm text-gray-600 mt-1 truncate max-w-lg">{group.job_name}</p>
                      )}
                    </div>

                    {/* Confirm Good Button */}
                    {group.batch_key && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void router.push(`/receive-good/confirm/${group.batch_key}`);
                        }}
                        className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-indigo-700"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Confirm
                      </button>
                    )}

                    {/* Received Info */}
                    <div className="text-right text-sm">
                      <p className="text-gray-900 font-medium">{formatThaiDateTime(group.received_at)}</p>
                      <p className="text-gray-500">by {group.received_by}</p>
                    </div>
                  </div>

                  {/* Expanded Items */}
                  {expandedPRs.has(key) && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
                      {/* Items Table */}
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase text-gray-500">
                            <th className="pb-2 pr-4">Line</th>
                            <th className="pb-2 pr-4">Item Code</th>
                            <th className="pb-2 pr-4">Description</th>
                            <th className="pb-2 pr-4 text-right">Qty</th>
                            <th className="pb-2 pr-4 text-center">Status</th>
                            <th className="pb-2 pr-4 text-center">Time</th>
                            {isAdmin && <th className="pb-2 pr-4 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {group.items.map((item) => (
                            <tr key={item.id} className={
                              item.confirm_status === 'confirmed' ? 'bg-green-50' :
                              item.confirm_status === 'rejected' ? 'bg-red-50' : ''
                            }>
                              <td className="py-2 pr-4 text-gray-900">{item.line_num}</td>
                              <td className="py-2 pr-4 text-gray-600">{item.item_code || "-"}</td>
                              <td className="py-2 pr-4 text-gray-900 max-w-xs truncate" title={item.description || ""}>
                                {item.description || "-"}
                              </td>
                              <td className="py-2 pr-4 text-right text-gray-900">
                                <span className="font-medium">{item.received_qty.toLocaleString()}</span>
                                {item.unit_msr && <span className="text-gray-500 ml-1">{item.unit_msr}</span>}
                              </td>
                              <td className="py-2 pr-4 text-center">
                                {item.confirm_status === 'confirmed' ? (
                                  <div className="flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                      Confirmed
                                    </span>
                                    {item.confirmed_at && (
                                      <span className="text-xs text-gray-500 mt-0.5">
                                        {formatThaiDateTime(item.confirmed_at)} by {item.confirmed_by}
                                      </span>
                                    )}
                                  </div>
                                ) : item.confirm_status === 'rejected' ? (
                                  <div className="flex flex-col items-center">
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                                      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                      </svg>
                                      Rejected
                                    </span>
                                    {item.confirm_remarks && (
                                      <span className="text-xs text-red-600 mt-0.5" title={item.confirm_remarks}>
                                        {item.confirm_remarks.length > 30 ? item.confirm_remarks.substring(0, 30) + '...' : item.confirm_remarks}
                                      </span>
                                    )}
                                    {item.confirmed_at && (
                                      <span className="text-xs text-gray-500 mt-0.5">
                                        {formatThaiDateTime(item.confirmed_at)} by {item.confirmed_by}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                    </svg>
                                    Waiting
                                  </span>
                                )}
                              </td>
                              <td className="py-2 pr-4 text-center text-gray-600">
                                {formatTimeDiff(group.received_at, item.confirmed_at)}
                              </td>
                              {isAdmin && (
                                <td className="py-2 pr-4 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setItemToDelete({ id: item.id, description: item.description || `Line ${item.line_num}` });
                                    }}
                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                    title="Delete item"
                                  >
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Remarks */}
                      {group.remarks && (
                        <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <p className="text-sm font-medium text-yellow-800">หมายเหตุ:</p>
                          <p className="text-sm text-yellow-700 mt-1">{group.remarks}</p>
                        </div>
                      )}

                      {/* Attachments */}
                      {group.batch_key && attachmentsMap[group.batch_key] && (
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Documents */}
                          {(() => {
                            const docs = attachmentsMap[group.batch_key]?.filter(a => a.category === 'document') || [];
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

                          {/* Photos */}
                          {(() => {
                            const photos = attachmentsMap[group.batch_key]?.filter(a => a.category === 'photo') || [];
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
                        </div>
                      )}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <span className="mb-4 text-6xl">📋</span>
              <h2 className="mb-2 text-xl font-semibold text-gray-600">No Records</h2>
              <p className="text-center text-gray-500">
                {searchText ? `No records found for "${searchText}"` : "No receive records yet."}
                <br />
                {canAddReceiveGoods && (
                  <span>Click <strong>+ Add Receive</strong> to record new goods receipt.</span>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal (Multiple) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <strong>{selectedGroups.size}</strong> group(s) ({selectedItemCount} items)?
              <br />
              <span className="text-red-600 text-sm">This action cannot be undone.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Item Confirmation Modal */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="rounded-lg bg-white p-6 shadow-xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Item</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this item?
              <br />
              <span className="font-medium text-gray-900">{itemToDelete.description}</span>
              <br />
              <span className="text-red-600 text-sm">This action cannot be undone.</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setItemToDelete(null)}
                className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSingleItem}
                disabled={deleteSingleMutation.isPending}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteSingleMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
