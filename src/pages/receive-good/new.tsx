import { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useAuth } from "~/hooks/useAuth";
import { api } from "~/utils/api";
import PageGuard from "~/components/PageGuard";

interface ReceiveLineState {
  lineId: number;
  lineNum: number;
  itemCode: string | null;
  description: string | null;
  originalQty: number;
  alreadyReceived: number;
  remainingQty: number;
  receiveQty: number;
  unitMsr: string | null;
  isChecked: boolean;
  error: string | null;
}

interface SelectedFile {
  file: File;
  id: string; // unique id for UI
}

function ReceiveGoodNewContent() {
  const router = useRouter();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Requester search
  const [requesterSearchText, setRequesterSearchText] = useState("");
  const [showRequesterDropdown, setShowRequesterDropdown] = useState(false);
  const [selectedRequester, setSelectedRequester] = useState<string | null>(null);
  const requesterDropdownRef = useRef<HTMLDivElement>(null);

  // PR Number search
  const [prSearchText, setPrSearchText] = useState("");
  const [showPrDropdown, setShowPrDropdown] = useState(false);
  const prDropdownRef = useRef<HTMLDivElement>(null);

  // Job Name search
  const [jobSearchText, setJobSearchText] = useState("");
  const [showJobDropdown, setShowJobDropdown] = useState(false);
  const jobDropdownRef = useRef<HTMLDivElement>(null);

  // Selected PR
  const [selectedPR, setSelectedPR] = useState<{
    doc_num: number;
    req_name: string | null;
    job_name: string | null;
    doc_date: Date | null;
  } | null>(null);

  // Receive lines state
  const [receiveLines, setReceiveLines] = useState<ReceiveLineState[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // File attachments state (documents)
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  // Photo attachments state
  const [selectedPhotos, setSelectedPhotos] = useState<SelectedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Remarks state
  const [remarks, setRemarks] = useState("");

  // Check if user can receive goods (Admin or Warehouse only)
  const canReceiveGoods = user?.role === "Admin" || user?.role === "Warehouse";

  // Search requesters query
  const { data: requesterResults = [], isLoading: isRequesterLoading } = api.pr.searchRequesters.useQuery(
    { search: requesterSearchText },
    { enabled: requesterSearchText.length >= 2 && !selectedRequester }
  );

  // Search PR by number query
  const { data: prSearchResults = [], isLoading: isPrLoading } = api.pr.searchPRForReceive.useQuery(
    { search: prSearchText, requester: selectedRequester || undefined },
    { enabled: prSearchText.length >= 1 && !selectedPR }
  );

  // Search PR by job name query
  const { data: jobSearchResults = [], isLoading: isJobLoading } = api.pr.searchPRByJobName.useQuery(
    { search: jobSearchText, requester: selectedRequester || undefined },
    { enabled: jobSearchText.length >= 2 && !selectedPR }
  );

  // Fetch PR details when selected
  const { data: prDetails, isLoading: isPrDetailsLoading } = api.pr.getByPRNo.useQuery(
    { prNo: selectedPR?.doc_num ?? 0 },
    { enabled: !!selectedPR?.doc_num }
  );

  // Fetch already received quantities
  const { data: receivedQtyMap = {} } = api.pr.getReceivedQtyByLines.useQuery(
    { prDocNum: selectedPR?.doc_num ?? 0 },
    { enabled: !!selectedPR?.doc_num }
  );

  // Save mutation
  const saveMutation = api.pr.saveReceiveGoods.useMutation({
    onSuccess: () => {
      // Redirect to receive-good list page after successful save
      void router.push("/receive-good");
    },
    onError: (error) => {
      setSaveMessage({ type: 'error', text: error.message });
      setIsSaving(false);
    },
  });

  // Initialize receive lines when PR details load
  useEffect(() => {
    if (prDetails?.lines) {
      const lines: ReceiveLineState[] = prDetails.lines
        .map(line => {
          const qty = Number(line.quantity) || 0;
          const alreadyReceived = receivedQtyMap[line.line_id] || 0;
          const remaining = qty - alreadyReceived;
          return {
            lineId: line.line_id,
            lineNum: line.line_num,
            itemCode: line.item_code,
            description: line.description,
            originalQty: qty,
            alreadyReceived,
            remainingQty: remaining,
            receiveQty: remaining, // Default to remaining
            unitMsr: line.unit_msr,
            isChecked: false,
            error: null,
          };
        })
        .filter(line => line.alreadyReceived === 0); // Hide lines that have been received (even partially)

      setReceiveLines(lines);
    }
  }, [prDetails, receivedQtyMap]);

  // Redirect if not authorized
  useEffect(() => {
    if (user && !canReceiveGoods) {
      void router.push("/receive-good");
    }
  }, [user, canReceiveGoods, router]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (requesterDropdownRef.current && !requesterDropdownRef.current.contains(event.target as Node)) {
        setShowRequesterDropdown(false);
      }
      if (prDropdownRef.current && !prDropdownRef.current.contains(event.target as Node)) {
        setShowPrDropdown(false);
      }
      if (jobDropdownRef.current && !jobDropdownRef.current.contains(event.target as Node)) {
        setShowJobDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectRequester = (requester: { req_name: string; pr_count: number }) => {
    setSelectedRequester(requester.req_name);
    setRequesterSearchText(requester.req_name);
    setShowRequesterDropdown(false);
    setPrSearchText("");
    setJobSearchText("");
    setSelectedPR(null);
  };

  const handleRequesterSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRequesterSearchText(value);
    if (value === "") {
      setSelectedRequester(null);
    } else {
      setShowRequesterDropdown(value.length >= 2);
    }
  };

  const handleClearRequester = () => {
    setSelectedRequester(null);
    setRequesterSearchText("");
    setPrSearchText("");
    setJobSearchText("");
    setSelectedPR(null);
  };

  const handleSelectPR = (pr: typeof prSearchResults[0]) => {
    setSelectedPR(pr);
    setPrSearchText(pr.doc_num.toString());
    setJobSearchText(pr.job_name || "");
    if (pr.req_name && !selectedRequester) {
      setSelectedRequester(pr.req_name);
      setRequesterSearchText(pr.req_name);
    }
    setShowPrDropdown(false);
    setShowJobDropdown(false);
    setSaveMessage(null);
  };

  const handlePrSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setPrSearchText(value);
      setSelectedPR(null);
      setShowPrDropdown(value.length >= 1);
    }
  };

  const handleJobSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setJobSearchText(value);
    setSelectedPR(null);
    setShowJobDropdown(value.length >= 2);
  };

  const handleClearSelection = () => {
    setSelectedPR(null);
    setPrSearchText("");
    setJobSearchText("");
    setReceiveLines([]);
    setSaveMessage(null);
    setSelectedFiles([]);
    setSelectedPhotos([]);
    setRemarks("");
  };

  const handleBack = () => {
    void router.push("/receive-good");
  };

  const handleReceiveQtyChange = (lineId: number, value: string) => {
    const numValue = value === "" ? 0 : parseFloat(value);

    setReceiveLines(prev => prev.map(line => {
      if (line.lineId !== lineId) return line;

      let error: string | null = null;
      if (numValue > line.remainingQty) {
        error = `รับได้ไม่เกิน ${line.remainingQty}`;
      } else if (numValue < 0) {
        error = "ต้องมากกว่า 0";
      }

      return {
        ...line,
        receiveQty: numValue,
        error,
        isChecked: error ? false : line.isChecked, // Uncheck if error
      };
    }));
  };

  const handleCheckChange = (lineId: number, checked: boolean) => {
    setReceiveLines(prev => prev.map(line => {
      if (line.lineId !== lineId) return line;
      // Cannot check if error or receiveQty is 0 or > remainingQty
      if (checked && (line.error || line.receiveQty <= 0 || line.receiveQty > line.remainingQty)) {
        return line;
      }
      return { ...line, isChecked: checked };
    }));
  };

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: SelectedFile[] = Array.from(files).map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== id));
  };

  // Photo handling
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newPhotos: SelectedFile[] = Array.from(files).map(file => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
    }));

    setSelectedPhotos(prev => [...prev, ...newPhotos]);

    // Reset input
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (id: string) => {
    setSelectedPhotos(prev => prev.filter(f => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const uploadFiles = async (batchKey: string, files: SelectedFile[], category: 'document' | 'photo'): Promise<boolean> => {
    if (files.length === 0) return true;

    try {
      const formData = new FormData();
      formData.append('prDocNum', selectedPR!.doc_num.toString());
      formData.append('batchKey', batchKey);
      formData.append('uploadedBy', user?.name || user?.username || 'Unknown');
      formData.append('uploadedByUserId', user?.id || '');
      formData.append('category', category);

      files.forEach(sf => {
        formData.append('files', sf.file);
      });

      const response = await fetch('/api/upload-receive-attachment', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      return true;
    } catch (error) {
      console.error('Upload error:', error);
      setSaveMessage({
        type: 'error',
        text: `อัพโหลดไฟล์ไม่สำเร็จ: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      return false;
    }
  };

  const handleSave = async () => {
    const itemsToSave = receiveLines.filter(line => line.isChecked && line.receiveQty > 0 && !line.error);

    if (itemsToSave.length === 0) {
      setSaveMessage({ type: 'error', text: 'กรุณาเลือกรายการที่ต้องการรับของ' });
      return;
    }

    setIsSaving(true);
    setIsUploading(true);
    setSaveMessage(null);

    // Generate batch key for linking files
    const batchKey = `${selectedPR!.doc_num}-${Date.now()}`;

    // Upload document files if any
    if (selectedFiles.length > 0) {
      const uploadSuccess = await uploadFiles(batchKey, selectedFiles, 'document');
      if (!uploadSuccess) {
        setIsSaving(false);
        setIsUploading(false);
        return;
      }
    }

    // Upload photo files if any
    if (selectedPhotos.length > 0) {
      const uploadSuccess = await uploadFiles(batchKey, selectedPhotos, 'photo');
      if (!uploadSuccess) {
        setIsSaving(false);
        setIsUploading(false);
        return;
      }
    }

    setIsUploading(false);

    // Save receive goods
    saveMutation.mutate({
      prDocNum: selectedPR!.doc_num,
      items: itemsToSave.map(line => ({
        prLineId: line.lineId,
        lineNum: line.lineNum,
        itemCode: line.itemCode,
        description: line.description,
        originalQty: line.originalQty,
        receivedQty: line.receiveQty,
        unitMsr: line.unitMsr,
      })),
      receivedBy: user?.name || user?.username || 'Unknown',
      receivedByUserId: user?.id,
      remarks: remarks.trim() || undefined,
      batchKey: batchKey,
    });
  };

  const checkedCount = receiveLines.filter(l => l.isChecked).length;

  // If user not loaded yet or not authorized, show loading
  if (!user || !canReceiveGoods) {
    return (
      <>
        <Head>
          <title>Receive Good | PR Tracking</title>
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6 flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Receive Good - New | PR Tracking</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="rounded-lg bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-3xl">📥</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Receive Good</h1>
                <p className="text-sm text-gray-600">บันทึกรับสินค้า</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-lg font-semibold text-gray-800">ค้นหา PR</h2>

          {/* Search Form */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {/* Requester Search */}
            <div className="relative" ref={requesterDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">ผู้เปิด PR</label>
              <div className="relative">
                <input
                  type="text"
                  value={requesterSearchText}
                  onChange={handleRequesterSearchChange}
                  placeholder="พิมพ์ชื่อผู้เปิด..."
                  className={`w-full rounded-lg border px-4 py-3 focus:outline-none focus:ring-2 ${
                    selectedRequester ? "border-blue-300 bg-blue-50" : "border-gray-300"
                  }`}
                />
                {selectedRequester && (
                  <button onClick={handleClearRequester} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {showRequesterDropdown && requesterSearchText.length >= 2 && !selectedRequester && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {isRequesterLoading ? (
                    <div className="px-4 py-3 text-gray-500">Loading...</div>
                  ) : requesterResults.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500">ไม่พบ</div>
                  ) : (
                    <ul className="max-h-60 overflow-auto">
                      {requesterResults.map((req) => (
                        <li key={req.req_name} onClick={() => handleSelectRequester(req)} className="cursor-pointer px-4 py-3 hover:bg-blue-50">
                          <span className="font-medium">{req.req_name}</span>
                          <span className="ml-2 text-xs text-gray-400">({req.pr_count} PR)</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* PR Number Search */}
            <div className="relative" ref={prDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">เลข PR</label>
              <input
                type="text"
                value={prSearchText}
                onChange={handlePrSearchChange}
                placeholder="พิมพ์เลข PR..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
              {showPrDropdown && prSearchText.length >= 1 && !selectedPR && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {isPrLoading ? (
                    <div className="px-4 py-3 text-gray-500">Loading...</div>
                  ) : prSearchResults.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500">ไม่พบ</div>
                  ) : (
                    <ul className="max-h-60 overflow-auto">
                      {prSearchResults.map((pr) => (
                        <li key={pr.doc_num} onClick={() => handleSelectPR(pr)} className="cursor-pointer px-4 py-3 hover:bg-green-50">
                          <span className="font-semibold text-green-700">PR #{pr.doc_num}</span>
                          {pr.job_name && <p className="text-sm text-gray-600 truncate">{pr.job_name}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Job Name Search */}
            <div className="relative" ref={jobDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">Job (Project Name)</label>
              <input
                type="text"
                value={jobSearchText}
                onChange={handleJobSearchChange}
                placeholder="พิมพ์ชื่องาน..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3"
              />
              {showJobDropdown && jobSearchText.length >= 2 && !selectedPR && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow-lg">
                  {isJobLoading ? (
                    <div className="px-4 py-3 text-gray-500">Loading...</div>
                  ) : jobSearchResults.length === 0 ? (
                    <div className="px-4 py-3 text-gray-500">ไม่พบ</div>
                  ) : (
                    <ul className="max-h-60 overflow-auto">
                      {jobSearchResults.map((pr) => (
                        <li key={pr.doc_num} onClick={() => handleSelectPR(pr)} className="cursor-pointer px-4 py-3 hover:bg-green-50">
                          <span className="font-semibold text-green-700">PR #{pr.doc_num}</span>
                          {pr.job_name && <p className="text-sm text-gray-600 truncate">{pr.job_name}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected PR Info */}
          {selectedPR && (
            <div className="mt-6 rounded-lg bg-green-50 p-4 border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-600 text-xl">✓</span>
                  <span className="font-semibold text-green-700 text-lg">PR #{selectedPR.doc_num}</span>
                </div>
                <button onClick={handleClearSelection} className="text-gray-400 hover:text-gray-600 text-sm">Clear</button>
              </div>
              {selectedPR.req_name && <p className="text-gray-700"><span className="font-medium">ผู้เปิด:</span> {selectedPR.req_name}</p>}
              {selectedPR.job_name && <p className="text-gray-600 text-sm"><span className="font-medium">Job:</span> {selectedPR.job_name}</p>}
            </div>
          )}

          {/* Save Message */}
          {saveMessage && (
            <div className={`mt-4 rounded-lg p-3 ${saveMessage.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {saveMessage.text}
            </div>
          )}

          {/* PR Lines Table */}
          {selectedPR && (
            <div className="mt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">รายการสินค้า</h3>
              {isPrDetailsLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">Loading...</div>
              ) : receiveLines.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Line</th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Item Code</th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                        <th className="px-3 py-3 text-right text-xs font-medium uppercase text-gray-500">Qty (คงเหลือ)</th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase text-gray-500">จำนวนที่รับ</th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase text-gray-500">รับของ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {receiveLines.map((line) => (
                        <tr key={line.lineId} className={line.isChecked ? "bg-green-50" : "hover:bg-gray-50"}>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-900">{line.lineNum}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-gray-600">{line.itemCode || "-"}</td>
                          <td className="px-3 py-3 text-sm text-gray-900 max-w-xs truncate" title={line.description || ""}>{line.description || "-"}</td>
                          <td className="whitespace-nowrap px-3 py-3 text-sm text-right text-gray-900">
                            <div>
                              <span className="font-medium">{line.remainingQty.toLocaleString()}</span>
                              {line.unitMsr && <span className="text-gray-500 ml-1">{line.unitMsr}</span>}
                            </div>
                            {line.alreadyReceived > 0 && (
                              <div className="text-xs text-gray-400">
                                (รับแล้ว {line.alreadyReceived.toLocaleString()} / {line.originalQty.toLocaleString()})
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            <div className="flex flex-col items-center">
                              <input
                                type="number"
                                value={line.receiveQty}
                                onChange={(e) => handleReceiveQtyChange(line.lineId, e.target.value)}
                                min="0"
                                max={line.remainingQty}
                                step="0.01"
                                className={`w-24 rounded border px-2 py-1 text-center text-sm ${
                                  line.error ? "border-red-500 bg-red-50" : "border-gray-300"
                                }`}
                              />
                              {line.error && <span className="text-xs text-red-500 mt-1">{line.error}</span>}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={line.isChecked}
                              onChange={(e) => handleCheckChange(line.lineId, e.target.checked)}
                              disabled={!!line.error || line.receiveQty <= 0 || line.receiveQty > line.remainingQty}
                              className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : prDetails?.lines && prDetails.lines.length > 0 ? (
                <div className="rounded-lg bg-green-100 p-4 text-center text-green-700">
                  <span className="text-2xl">✓</span>
                  <p className="mt-2 font-medium">รับของครบทุกรายการแล้ว</p>
                </div>
              ) : (
                <div className="rounded-lg bg-gray-50 p-4 text-center text-gray-500">
                  No items found for this PR
                </div>
              )}
            </div>
          )}

          {/* File Attachments Section */}
          {selectedPR && receiveLines.length > 0 && (
            <div className="mt-6 border-t pt-6">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">แนบไฟล์ (Packing List, Invoice, อื่นๆ)</h3>

              {/* File Input */}
              <div className="mb-4">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.zip"
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
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

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                    เอกสารที่เลือก ({selectedFiles.length} ไฟล์)
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

              {/* Photo Attachments Section */}
              <h3 className="mt-6 mb-4 text-lg font-semibold text-gray-800">รูปภาพการรับของ (สภาพสินค้า)</h3>

              {/* Photo Input */}
              <div className="mb-4">
                <input
                  type="file"
                  ref={photoInputRef}
                  onChange={handlePhotoSelect}
                  multiple
                  accept="image/*"
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className="inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-green-300 px-4 py-3 cursor-pointer hover:border-green-400 hover:bg-green-50 transition"
                >
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-green-700">เลือกรูปภาพ</span>
                </label>
                <p className="mt-2 text-xs text-gray-500">
                  รองรับรูปภาพ: JPG, PNG, GIF, WEBP (ขนาดสูงสุด 50MB ต่อไฟล์)
                </p>
              </div>

              {/* Selected Photos List */}
              {selectedPhotos.length > 0 && (
                <div className="rounded-lg border border-green-200 overflow-hidden">
                  <div className="bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
                    รูปภาพที่เลือก ({selectedPhotos.length} รูป)
                  </div>
                  <ul className="divide-y divide-gray-200">
                    {selectedPhotos.map((sf) => (
                      <li key={sf.id} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{sf.file.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(sf.file.size)}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemovePhoto(sf.id)}
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

              {/* Remarks Section */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  หมายเหตุ (ถ้ามี)
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="ระบุหมายเหตุ เช่น ของไม่ครบ, มีปัญหา, อื่นๆ..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {selectedPR && receiveLines.length > 0 && (
            <div className="mt-6 flex items-center justify-between border-t pt-6">
              <div className="text-sm text-gray-600">
                เลือก {checkedCount} รายการ
                {selectedFiles.length > 0 && ` | เอกสาร ${selectedFiles.length} ไฟล์`}
                {selectedPhotos.length > 0 && ` | รูป ${selectedPhotos.length} รูป`}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleClearSelection}
                  className="rounded-lg bg-gray-200 px-6 py-3 font-medium text-gray-700 hover:bg-gray-300"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSave}
                  disabled={checkedCount === 0 || isSaving || isUploading}
                  className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSaving || isUploading ? "กำลังบันทึก..." : `บันทึกรับของ (${checkedCount} รายการ)`}
                </button>
              </div>
            </div>
          )}

          {/* Instruction */}
          {!selectedPR && (
            <div className="mt-8 flex flex-col items-center justify-center py-8 text-gray-400 border-t">
              <span className="mb-2 text-4xl">🔍</span>
              <p className="text-sm">Select PR to proceed with receiving goods</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Export default with PageGuard wrapper
export default function ReceiveGoodNew() {
  return (
    <PageGuard action="receive_good.create" pageName="บันทึกรับของ">
      <ReceiveGoodNewContent />
    </PageGuard>
  );
}
