import { useState, useEffect, useMemo, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/utils/api";

interface SelectedFile {
  id: string;
  file: File;
}

interface ConfirmItemState {
  id: number;
  line_num: number;
  item_code: string | null;
  description: string | null;
  received_qty: number;
  unit_msr: string | null;
  confirm_status: 'waiting' | 'confirmed' | 'rejected';
  confirm_remarks: string;
  current_status: string; // Original status from DB
  received_at: Date;
  confirmed_at: Date | null;
  confirmed_by: string | null;
}

export default function ConfirmGoodPage() {
  const router = useRouter();
  const { batchKey } = router.query;
  const { user } = useAuth();

  const [items, setItems] = useState<ConfirmItemState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prInfo, setPrInfo] = useState<{
    pr_doc_num: number;
    req_name: string | null;
    job_name: string | null;
    received_by: string;
    received_at: Date;
  } | null>(null);

  // Fetch items by batch key
  const { data: batchItems = [], isLoading, refetch } = api.pr.getReceivedByBatch.useQuery(
    { batchKey: batchKey as string },
    { enabled: !!batchKey }
  );

  // Update batch confirm status mutation
  const updateMutation = api.pr.updateBatchConfirmStatus.useMutation({
    onSuccess: (data) => {
      setSaveMessage({ type: 'success', text: data.message });
      // Redirect back to receive-good list after short delay
      setTimeout(() => {
        void router.push('/receive-good');
      }, 1000);
    },
    onError: (error) => {
      setSaveMessage({ type: 'error', text: error.message });
    },
  });

  // Initialize items when data loads
  useEffect(() => {
    if (batchItems.length > 0) {
      const firstItem = batchItems[0];
      setPrInfo({
        pr_doc_num: firstItem.pr_doc_num,
        req_name: firstItem.req_name,
        job_name: firstItem.job_name,
        received_by: firstItem.received_by,
        received_at: new Date(firstItem.received_at),
      });

      setItems(batchItems.map((item: any) => ({
        id: item.id,
        line_num: item.line_num,
        item_code: item.item_code,
        description: item.description,
        received_qty: Number(item.received_qty),
        unit_msr: item.unit_msr,
        confirm_status: item.confirm_status || 'waiting',
        confirm_remarks: item.confirm_remarks || '',
        current_status: item.confirm_status || 'waiting',
        received_at: new Date(item.received_at),
        confirmed_at: item.confirmed_at ? new Date(item.confirmed_at) : null,
        confirmed_by: item.confirmed_by || null,
      })));
    }
  }, [batchItems]);

  // Handle status change (only if not already confirmed/rejected)
  const handleStatusChange = (itemId: number, status: 'waiting' | 'confirmed' | 'rejected') => {
    setItems(prev => prev.map(item => {
      // Don't allow changes if already confirmed or rejected
      if (item.id === itemId && item.current_status === 'waiting') {
        return { ...item, confirm_status: status, confirm_remarks: item.confirm_remarks };
      }
      return item;
    }));
  };

  // Handle remarks change (only if not already confirmed/rejected)
  const handleRemarksChange = (itemId: number, remarks: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId && item.current_status === 'waiting') {
        return { ...item, confirm_remarks: remarks };
      }
      return item;
    }));
  };

  // Check if there are changes
  const hasChanges = useMemo(() => {
    return items.some(item =>
      item.confirm_status !== item.current_status ||
      (item.confirm_status === 'rejected' && item.confirm_remarks !== '')
    );
  }, [items]);

  // Handle save
  const handleSave = async () => {
    if (!user) return;

    // Validate rejected items have remarks
    const invalidItems = items.filter(item =>
      item.confirm_status === 'rejected' && !item.confirm_remarks.trim()
    );

    if (invalidItems.length > 0) {
      setSaveMessage({
        type: 'error',
        text: `กรุณาระบุเหตุผลสำหรับ ${invalidItems.length} รายการที่ถูกปฏิเสธ`
      });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      // Upload files first (if any)
      if (selectedFiles.length > 0) {
        setIsUploading(true);
        const uploaded = await uploadFiles();
        setIsUploading(false);
        if (!uploaded) {
          setIsSaving(false);
          return;
        }
      }

      await updateMutation.mutateAsync({
        items: items.map(item => ({
          id: item.id,
          confirm_status: item.confirm_status,
          confirm_remarks: item.confirm_remarks.trim() || undefined,
        })),
        confirmed_by: user.name || user.username || 'Unknown',
      });
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

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

  // Fetch existing attachments for this batch
  const { data: existingAttachments = [], refetch: refetchAttachments } = api.pr.getAttachmentsByBatch.useQuery(
    { batchKey: batchKey as string },
    { enabled: !!batchKey }
  );

  // File handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newFiles: SelectedFile[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
    }));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const uploadFiles = async (): Promise<boolean> => {
    if (selectedFiles.length === 0 || !prInfo) return true;
    try {
      const formData = new FormData();
      formData.append('prDocNum', String(prInfo.pr_doc_num));
      formData.append('batchKey', batchKey as string);
      formData.append('uploadedBy', user?.name || user?.username || 'Unknown');
      formData.append('uploadedByUserId', user?.id || '');
      formData.append('category', 'document');
      formData.append('source', 'confirm');
      selectedFiles.forEach(sf => formData.append('files', sf.file));

      const res = await fetch('/api/upload-receive-attachment', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      return true;
    } catch {
      setSaveMessage({ type: 'error', text: 'อัพโหลดไฟล์ไม่สำเร็จ' });
      return false;
    }
  };

  // Summary counts
  const confirmedCount = items.filter(i => i.confirm_status === 'confirmed').length;
  const rejectedCount = items.filter(i => i.confirm_status === 'rejected').length;
  const waitingCount = items.filter(i => i.confirm_status === 'waiting').length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!batchKey || items.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        <div className="rounded-lg bg-white p-6 shadow-sm text-center">
          <p className="text-gray-500">ไม่พบข้อมูล</p>
          <button
            onClick={() => router.push('/receive-good')}
            className="mt-4 text-blue-600 hover:underline"
          >
            กลับไปหน้ารายการ
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Confirm Good - PR #{prInfo?.pr_doc_num} | PR Tracking</title>
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
              <span className="text-3xl">✅</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Confirm Received Goods</h1>
                <p className="text-sm text-gray-600">ยืนยันการรับสินค้า</p>
              </div>
            </div>
          </div>
        </div>

        {/* PR Info */}
        {prInfo && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-500">PR Number</p>
                <p className="font-semibold text-green-700 text-lg">#{prInfo.pr_doc_num}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">ผู้ขอ</p>
                <p className="font-medium text-gray-900">{formatName(prInfo.req_name)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">รับของโดย</p>
                <p className="font-medium text-gray-900">{prInfo.received_by}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">วันที่รับ</p>
                <p className="font-medium text-gray-900">{formatThaiDateTime(prInfo.received_at)}</p>
              </div>
            </div>
            {prInfo.job_name && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-gray-500">Job Name</p>
                <p className="font-medium text-gray-900">{prInfo.job_name}</p>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="mb-6 rounded-lg bg-white p-4 shadow-sm">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm text-gray-600">
              ทั้งหมด: <strong>{items.length}</strong> รายการ
            </span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              Confirmed: {confirmedCount}
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              Rejected: {rejectedCount}
            </span>
            <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
              Waiting: {waitingCount}
            </span>
          </div>
        </div>

        {/* Message */}
        {saveMessage && (
          <div className={`mb-6 rounded-lg p-4 ${
            saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {saveMessage.text}
          </div>
        )}

        {/* Items List */}
        <div className="rounded-lg bg-white shadow-sm overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Line</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={
                    item.confirm_status === 'confirmed' ? 'bg-green-50' :
                    item.confirm_status === 'rejected' ? 'bg-red-50' : ''
                  }
                >
                  <td className="px-4 py-4 text-sm text-gray-900">{item.line_num}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{item.item_code || '-'}</td>
                  <td className="px-4 py-4 text-sm text-gray-900 max-w-xs">
                    <span className="block truncate" title={item.description || ''}>
                      {item.description || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-900 text-right">
                    <span className="font-medium">{item.received_qty.toLocaleString()}</span>
                    {item.unit_msr && <span className="text-gray-500 ml-1">{item.unit_msr}</span>}
                  </td>
                  <td className="px-4 py-4">
                    {item.current_status !== 'waiting' ? (
                      // Already confirmed/rejected - show status only
                      <div className="flex flex-col items-center">
                        <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                          item.current_status === 'confirmed'
                            ? 'bg-green-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}>
                          {item.current_status === 'confirmed' ? 'Confirmed' : 'Rejected'}
                        </span>
                        {item.confirmed_by && (
                          <span className="text-xs text-gray-500 mt-1">by {item.confirmed_by}</span>
                        )}
                      </div>
                    ) : (
                      // Still waiting - show buttons
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleStatusChange(item.id, 'confirmed')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            item.confirm_status === 'confirmed'
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                          }`}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.id, 'waiting')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            item.confirm_status === 'waiting'
                              ? 'bg-yellow-500 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-yellow-100 hover:text-yellow-700'
                          }`}
                        >
                          Waiting
                        </button>
                        <button
                          onClick={() => handleStatusChange(item.id, 'rejected')}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                            item.confirm_status === 'rejected'
                              ? 'bg-red-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700'
                          }`}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    {item.current_status === 'rejected' ? (
                      // Already rejected - show remarks only
                      <span className="text-sm text-red-600">{item.confirm_remarks || '-'}</span>
                    ) : item.current_status === 'confirmed' ? (
                      // Already confirmed - show remarks if any
                      item.confirm_remarks ? <span className="text-sm text-green-600">{item.confirm_remarks}</span> : null
                    ) : item.confirm_status === 'rejected' && item.current_status === 'waiting' ? (
                      // Selecting reject - show input (required)
                      <input
                        type="text"
                        value={item.confirm_remarks}
                        onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                        placeholder="ระบุเหตุผล..."
                        className="w-full rounded-lg border border-red-300 px-3 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                      />
                    ) : item.confirm_status === 'confirmed' && item.current_status === 'waiting' ? (
                      // Selecting confirm - show input (optional)
                      <input
                        type="text"
                        value={item.confirm_remarks}
                        onChange={(e) => handleRemarksChange(item.id, e.target.value)}
                        placeholder="หมายเหตุ (ไม่บังคับ)..."
                        className="w-full rounded-lg border border-green-300 px-3 py-1.5 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                      />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Existing Attachments from Warehouse (read-only) */}
        {existingAttachments.filter((a: any) => a.source !== 'confirm').length > 0 && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ไฟล์แนบจาก Warehouse ({existingAttachments.filter((a: any) => a.source !== 'confirm').length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {existingAttachments.filter((a: any) => a.source !== 'confirm').map((att: any) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_name);
                const isPdf = /\.pdf$/i.test(att.file_name);
                return (
                  <a
                    key={att.id}
                    href={`/api/serve-receive-attachment?path=${encodeURIComponent(att.file_path)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-gray-200 group-hover:border-blue-400 transition bg-white flex items-center justify-center">
                      {isImage ? (
                        <img
                          src={`/api/serve-receive-attachment?path=${encodeURIComponent(att.file_path)}`}
                          alt={att.file_name}
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
                    <p className="text-xs text-gray-600 mt-1 text-center truncate group-hover:text-blue-600" title={att.file_name}>
                      {att.file_name}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Existing Confirm Attachments (read-only) */}
        {existingAttachments.filter((a: any) => a.source === 'confirm').length > 0 && (
          <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 flex items-center gap-2">
              <svg className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ไฟล์แนบจากการยืนยัน ({existingAttachments.filter((a: any) => a.source === 'confirm').length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {existingAttachments.filter((a: any) => a.source === 'confirm').map((att: any) => {
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(att.file_name);
                const isPdf = /\.pdf$/i.test(att.file_name);
                return (
                  <a
                    key={att.id}
                    href={`/api/serve-receive-attachment?path=${encodeURIComponent(att.file_path)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden border-2 border-orange-200 group-hover:border-orange-400 transition bg-white flex items-center justify-center">
                      {isImage ? (
                        <img
                          src={`/api/serve-receive-attachment?path=${encodeURIComponent(att.file_path)}`}
                          alt={att.file_name}
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
                    <p className="text-xs text-orange-600 mt-1 text-center truncate group-hover:text-orange-800" title={att.file_name}>
                      {att.file_name}
                    </p>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload Additional Files */}
        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">แนบไฟล์เพิ่มเติม</h3>

          <div className="mb-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip"
              className="hidden"
              id="confirm-file-upload"
            />
            <label
              htmlFor="confirm-file-upload"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition"
            >
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-gray-600">เลือกไฟล์ที่ต้องการแนบ</span>
            </label>
            <p className="mt-2 text-xs text-gray-500">
              รองรับไฟล์: PDF, Word, Excel, รูปภาพ, ZIP (ขนาดสูงสุด 50MB ต่อไฟล์)
            </p>
          </div>

          {selectedFiles.length > 0 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                ไฟล์ที่เลือก ({selectedFiles.length} ไฟล์)
              </div>
              <ul className="divide-y divide-gray-200">
                {selectedFiles.map((sf) => (
                  <li key={sf.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{sf.file.name}</p>
                        <p className="text-xs text-gray-500">{formatFileSize(sf.file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(sf.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end gap-4">
          <button
            onClick={() => router.push('/receive-good')}
            className="rounded-lg bg-gray-200 px-6 py-2 font-medium text-gray-700 hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
