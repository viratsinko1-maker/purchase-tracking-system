import { useState, useEffect } from "react";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";

interface PRDocumentReceiptModalProps {
  prNo: number;
  prCreateDate: Date | string | null; // วันที่สร้าง PR (สำหรับ validate)
  isOpen: boolean;
  onClose: () => void;
}

export default function PRDocumentReceiptModal({
  prNo,
  prCreateDate,
  isOpen,
  onClose
}: PRDocumentReceiptModalProps) {
  const { user } = useAuth();

  // State
  const [error, setError] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState(false);

  const utils = api.useUtils();

  // ดึงข้อมูลการรับเอกสารล่าสุด
  const { data: existingReceipt, isLoading, refetch: refetchReceipt } = api.pr.getDocumentReceipt.useQuery(
    { prNo },
    { enabled: isOpen && prNo > 0 }
  );

  // ดึง preview ผู้อนุมัติ (แสดงทั้งก่อนและหลังบันทึก)
  const { data: approversPreview, isLoading: isLoadingPreview } = api.pr.getApproversPreview.useQuery(
    { prNo },
    { enabled: isOpen && prNo > 0 }
  );

  // Reset error when modal opens
  useEffect(() => {
    if (isOpen) {
      setError('');
      setShowSuccess(false);
    }
  }, [isOpen]);

  // Mutation สำหรับอนุมัติรายบุคคล (ตามสายงาน/Cost Center)
  const approveIndividualMutation = api.pr.approveIndividual.useMutation({
    onSuccess: async () => {
      await utils.pr.getDocumentReceipt.invalidate({ prNo });
      await utils.pr.getAllSummary.invalidate();
      await refetchReceipt();
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Mutation สำหรับล้างการอนุมัติ (Admin only)
  const clearApprovalMutation = api.pr.clearIndividualApproval.useMutation({
    onSuccess: async () => {
      await utils.pr.getDocumentReceipt.invalidate({ prNo });
      await refetchReceipt();
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.message);
    },
  });

  // Handle individual approval
  const handleIndividualApproval = (approvalType: 'requester' | 'line' | 'cost_center' | 'procurement' | 'vpc') => {
    if (!user?.name) {
      setError('กรุณาล็อกอินก่อนอนุมัติ');
      return;
    }
    approveIndividualMutation.mutate({
      prNo,
      approvalType,
      approverName: user.name,
      approverUserId: user.id,
      approverRole: user.role || undefined,  // ส่ง role สำหรับตรวจสอบสิทธิ์
    });
  };

  // Handle clear approval (Admin only)
  const handleClearApproval = (approvalType: 'requester' | 'line' | 'cost_center' | 'procurement' | 'vpc') => {
    if (user?.role !== 'Admin') {
      setError('เฉพาะ Admin เท่านั้นที่สามารถล้างการอนุมัติได้');
      return;
    }
    clearApprovalMutation.mutate({
      prNo,
      approvalType,
      clearedByRole: user!.role!,
    });
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // 🔒 Sequential Approval Helper - ตรวจสอบว่าสามารถ approve ขั้นนี้ได้หรือยัง
  const canApproveStep = (step: 'requester' | 'line' | 'cost_center' | 'procurement' | 'vpc'): { allowed: boolean; reason?: string } => {
    const approvalOrder = ['requester', 'line', 'cost_center', 'procurement', 'vpc'] as const;
    const approvalNames: Record<string, string> = {
      requester: 'ผู้ขอซื้อ',
      line: 'ผู้อนุมัติตามสายงาน',
      cost_center: 'ผู้อนุมัติตาม Cost Center',
      procurement: 'งานจัดซื้อพัสดุ',
      vpc: 'VP-C',
    };

    const currentIndex = approvalOrder.indexOf(step);

    // ตรวจสอบว่า approval ก่อนหน้าทั้งหมดต้อง approve แล้ว
    for (let i = 0; i < currentIndex; i++) {
      const prevType = approvalOrder[i]!;
      const prevApprovalAt = existingReceipt?.[`${prevType}_approval_at` as keyof typeof existingReceipt];
      if (!prevApprovalAt) {
        return {
          allowed: false,
          reason: `ต้อง approve ${approvalNames[prevType]} ก่อน`,
        };
      }
    }
    return { allowed: true };
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="w-full max-w-4xl rounded-lg bg-white shadow-xl pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                บันทึกการรับเอกสาร PR
              </h2>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-600">PR #{prNo}</p>
          </div>

          {/* Body */}
          <div className="px-6 py-4">
            {(isLoading || isLoadingPreview) ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Error message */}
                {error && (
                  <div className="rounded-md bg-red-50 p-3">
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                )}

                {/* แสดงผู้อนุมัติ (แสดงทั้งก่อนและหลังบันทึก) */}
                <div className="rounded-md border border-gray-200 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 border-b pb-2">
                    ผู้อนุมัติสำหรับ PR นี้
                  </h4>

                  {isLoadingPreview ? (
                    <div className="flex justify-center py-4">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    </div>
                  ) : (
                    <>
                      {/* OCR Code2 และชื่อแผนก */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-700">รหัสแผนก:</span>
                        <span className="text-gray-900">
                          {existingReceipt?.ocr_code2 || approversPreview?.ocrCode2 || '-'}
                          {approversPreview?.ocrCodeName && (
                            <span className="ml-1 text-gray-500">({approversPreview.ocrCodeName})</span>
                          )}
                        </span>
                      </div>

                      {/* ผู้ขอซื้อ (ใครก็ได้สามารถ approve ได้) */}
                      <div className="border rounded-md p-3 bg-purple-50">
                        <span className="text-sm font-medium text-gray-700">ผู้ขอซื้อ:</span>
                        <span className="ml-2 text-xs text-gray-500">(ใครก็ได้สามารถอนุมัติได้)</span>

                        {/* แสดงสถานะการอนุมัติ - เมื่ออนุมัติแล้ว */}
                        {existingReceipt?.requester_approval_at && (
                          <div className="mt-2 p-2 bg-green-100 rounded text-sm">
                            <span className="text-green-800">✅ อนุมัติแล้วโดย: </span>
                            <span className="font-medium text-green-900">{existingReceipt.requester_approval_by}</span>
                            <span className="ml-2 text-xs text-green-700">
                              เมื่อ: {new Date(existingReceipt.requester_approval_at).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </span>
                            {/* ปุ่มล้างการอนุมัติสำหรับ Admin เท่านั้น */}
                            {user?.role === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleClearApproval('requester')}
                                disabled={clearApprovalMutation.isPending}
                                className="ml-3 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:bg-gray-400"
                              >
                                {clearApprovalMutation.isPending ? 'กำลังล้าง...' : '🗑️ ล้าง'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* ปุ่มอนุมัติ - แสดงเมื่อยังไม่ได้อนุมัติ และผู้ใช้ล็อกอินแล้ว */}
                        {!existingReceipt?.requester_approval_at && user?.name && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() => handleIndividualApproval('requester')}
                              disabled={approveIndividualMutation.isPending}
                              className="rounded-md bg-purple-500 px-3 py-1 text-sm font-medium text-white hover:bg-purple-600 transition disabled:bg-gray-400"
                            >
                              {approveIndividualMutation.isPending ? 'กำลังอนุมัติ...' : 'กดเพื่ออนุมัติ'}
                            </button>
                          </div>
                        )}

                        {/* แสดงข้อความถ้ายังไม่ได้ล็อกอิน */}
                        {!existingReceipt?.requester_approval_at && !user?.name && (
                          <div className="mt-2 text-sm text-gray-500">
                            กรุณาล็อกอินเพื่ออนุมัติ
                          </div>
                        )}
                      </div>

                      {/* ผู้อนุมัติตามสายงาน */}
                      <div className="border rounded-md p-3 bg-blue-50">
                        <span className="text-sm font-medium text-gray-700">ผู้อนุมัติตามสายงาน:</span>

                        {/* แสดงสถานะการอนุมัติ - เมื่ออนุมัติแล้ว */}
                        {existingReceipt?.line_approval_at && (
                          <div className="mt-2 p-2 bg-green-100 rounded text-sm">
                            <span className="text-green-800">✅ อนุมัติแล้วโดย: </span>
                            <span className="font-medium text-green-900">{existingReceipt.line_approval_by}</span>
                            <span className="ml-2 text-xs text-green-700">
                              เมื่อ: {new Date(existingReceipt.line_approval_at).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </span>
                            {/* ปุ่มล้างการอนุมัติสำหรับ Admin เท่านั้น */}
                            {user?.role === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleClearApproval('line')}
                                disabled={clearApprovalMutation.isPending}
                                className="ml-3 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:bg-gray-400"
                              >
                                {clearApprovalMutation.isPending ? 'กำลังล้าง...' : '🗑️ ล้าง'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* รายชื่อผู้อนุมัติ พร้อมปุ่มอนุมัติข้างๆ ชื่อตัวเอง */}
                        {(() => {
                          const lineApprovers = existingReceipt?.line_approvers
                            ? (existingReceipt.line_approvers as Array<{userId: string; username: string; email?: string; priority: number}>)
                            : approversPreview?.lineApprovers || [];

                          const stepCheck = canApproveStep('line');

                          return lineApprovers.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2 items-center">
                              {lineApprovers.map((approver, idx) => {
                                const isCurrentUser = approver.username === user?.name || approver.userId === user?.id;
                                // Allow approve even without existingReceipt (auto-create) + sequential check
                                const canApprove = !existingReceipt?.line_approval_at && isCurrentUser && stepCheck.allowed;

                                return (
                                  <div key={idx} className="flex items-center gap-1">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        isCurrentUser
                                          ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                                          : 'bg-blue-100 text-blue-800'
                                      }`}
                                      title={approver.email || approver.userId}
                                    >
                                      {approver.username}
                                      {isCurrentUser && ' (คุณ)'}
                                    </span>
                                    {/* ปุ่มอนุมัติ - แสดงข้างๆ ชื่อตัวเอง */}
                                    {!existingReceipt?.line_approval_at && isCurrentUser && (
                                      stepCheck.allowed ? (
                                        <button
                                          type="button"
                                          onClick={() => handleIndividualApproval('line')}
                                          disabled={approveIndividualMutation.isPending}
                                          className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-600 transition disabled:bg-gray-400"
                                        >
                                          {approveIndividualMutation.isPending ? '...' : 'กดเพื่ออนุมัติ'}
                                        </button>
                                      ) : (
                                        <span className="text-xs text-orange-600 ml-1" title={stepCheck.reason}>
                                          🔒 {stepCheck.reason}
                                        </span>
                                      )
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="block mt-1 text-sm text-gray-500">ยังไม่ได้กำหนด (กำหนดได้ที่หน้า Workflow)</span>
                          );
                        })()}
                      </div>

                      {/* ผู้อนุมัติตาม Cost Center */}
                      <div className="border rounded-md p-3 bg-green-50">
                        <span className="text-sm font-medium text-gray-700">ผู้อนุมัติตาม Cost Center:</span>

                        {/* แสดงสถานะการอนุมัติ - เมื่ออนุมัติแล้ว */}
                        {existingReceipt?.cost_center_approval_at && (
                          <div className="mt-2 p-2 bg-green-100 rounded text-sm">
                            <span className="text-green-800">✅ อนุมัติแล้วโดย: </span>
                            <span className="font-medium text-green-900">{existingReceipt.cost_center_approval_by}</span>
                            <span className="ml-2 text-xs text-green-700">
                              เมื่อ: {new Date(existingReceipt.cost_center_approval_at).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </span>
                            {/* ปุ่มล้างการอนุมัติสำหรับ Admin เท่านั้น */}
                            {user?.role === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleClearApproval('cost_center')}
                                disabled={clearApprovalMutation.isPending}
                                className="ml-3 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:bg-gray-400"
                              >
                                {clearApprovalMutation.isPending ? 'กำลังล้าง...' : '🗑️ ล้าง'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* รายชื่อผู้อนุมัติ พร้อมปุ่มอนุมัติข้างๆ ชื่อตัวเอง */}
                        {(() => {
                          const costCenterApprovers = existingReceipt?.cost_center_approvers
                            ? (existingReceipt.cost_center_approvers as Array<{userId: string; username: string; email?: string; priority: number}>)
                            : approversPreview?.costCenterApprovers || [];

                          const stepCheck = canApproveStep('cost_center');

                          return costCenterApprovers.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2 items-center">
                              {costCenterApprovers.map((approver, idx) => {
                                const isCurrentUser = approver.username === user?.name || approver.userId === user?.id;
                                // Allow approve even without existingReceipt (auto-create) + sequential check
                                const canApprove = !existingReceipt?.cost_center_approval_at && isCurrentUser && stepCheck.allowed;

                                return (
                                  <div key={idx} className="flex items-center gap-1">
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                        isCurrentUser
                                          ? 'bg-green-600 text-white ring-2 ring-green-300'
                                          : 'bg-green-100 text-green-800'
                                      }`}
                                      title={approver.email || approver.userId}
                                    >
                                      {approver.username}
                                      {isCurrentUser && ' (คุณ)'}
                                    </span>
                                    {/* ปุ่มอนุมัติ - แสดงข้างๆ ชื่อตัวเอง */}
                                    {!existingReceipt?.cost_center_approval_at && isCurrentUser && (
                                      stepCheck.allowed ? (
                                        <button
                                          type="button"
                                          onClick={() => handleIndividualApproval('cost_center')}
                                          disabled={approveIndividualMutation.isPending}
                                          className="rounded-md bg-amber-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-amber-600 transition disabled:bg-gray-400"
                                        >
                                          {approveIndividualMutation.isPending ? '...' : 'กดเพื่ออนุมัติ'}
                                        </button>
                                      ) : (
                                        <span className="text-xs text-orange-600 ml-1" title={stepCheck.reason}>
                                          🔒 {stepCheck.reason}
                                        </span>
                                      )
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="block mt-1 text-sm text-gray-500">ยังไม่ได้กำหนด (กำหนดได้ที่หน้า Workflow)</span>
                          );
                        })()}
                      </div>

                      {/* งานจัดซื้อพัสดุ (เฉพาะ role Manager) */}
                      <div className="border rounded-md p-3 bg-orange-50">
                        <span className="text-sm font-medium text-gray-700">งานจัดซื้อพัสดุ:</span>
                        <span className="ml-2 text-xs text-gray-500">(เฉพาะ Manager)</span>

                        {/* แสดงสถานะการอนุมัติ - เมื่ออนุมัติแล้ว */}
                        {existingReceipt?.procurement_approval_at && (
                          <div className="mt-2 p-2 bg-green-100 rounded text-sm">
                            <span className="text-green-800">✅ อนุมัติแล้วโดย: </span>
                            <span className="font-medium text-green-900">{existingReceipt.procurement_approval_by}</span>
                            <span className="ml-2 text-xs text-green-700">
                              เมื่อ: {new Date(existingReceipt.procurement_approval_at).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </span>
                            {/* ปุ่มล้างการอนุมัติสำหรับ Admin เท่านั้น */}
                            {user?.role === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleClearApproval('procurement')}
                                disabled={clearApprovalMutation.isPending}
                                className="ml-3 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:bg-gray-400"
                              >
                                {clearApprovalMutation.isPending ? 'กำลังล้าง...' : '🗑️ ล้าง'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* ปุ่มอนุมัติ - แสดงเมื่อยังไม่ได้อนุมัติ และเป็น Manager */}
                        {!existingReceipt?.procurement_approval_at && user?.role === 'Manager' && (() => {
                          const stepCheck = canApproveStep('procurement');
                          return stepCheck.allowed ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => handleIndividualApproval('procurement')}
                                disabled={approveIndividualMutation.isPending}
                                className="rounded-md bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 transition disabled:bg-gray-400"
                              >
                                {approveIndividualMutation.isPending ? 'กำลังอนุมัติ...' : 'กดเพื่ออนุมัติ'}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-orange-600">
                              🔒 {stepCheck.reason}
                            </div>
                          );
                        })()}

                        {/* แสดงข้อความถ้ายังไม่ได้อนุมัติและไม่ใช่ Manager */}
                        {!existingReceipt?.procurement_approval_at && user?.role !== 'Manager' && (
                          <div className="mt-2 text-sm text-gray-500">
                            รอการอนุมัติจาก Manager
                          </div>
                        )}
                      </div>

                      {/* VP-C (เฉพาะ role Approval) */}
                      <div className="border rounded-md p-3 bg-indigo-50">
                        <span className="text-sm font-medium text-gray-700">VP-C:</span>
                        <span className="ml-2 text-xs text-gray-500">(เฉพาะ Approval)</span>

                        {/* แสดงสถานะการอนุมัติ - เมื่ออนุมัติแล้ว */}
                        {existingReceipt?.vpc_approval_at && (
                          <div className="mt-2 p-2 bg-green-100 rounded text-sm">
                            <span className="text-green-800">✅ อนุมัติแล้วโดย: </span>
                            <span className="font-medium text-green-900">{existingReceipt.vpc_approval_by}</span>
                            <span className="ml-2 text-xs text-green-700">
                              เมื่อ: {new Date(existingReceipt.vpc_approval_at).toLocaleString('th-TH', {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </span>
                            {/* ปุ่มล้างการอนุมัติสำหรับ Admin เท่านั้น */}
                            {user?.role === 'Admin' && (
                              <button
                                type="button"
                                onClick={() => handleClearApproval('vpc')}
                                disabled={clearApprovalMutation.isPending}
                                className="ml-3 rounded-md bg-red-500 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-600 transition disabled:bg-gray-400"
                              >
                                {clearApprovalMutation.isPending ? 'กำลังล้าง...' : '🗑️ ล้าง'}
                              </button>
                            )}
                          </div>
                        )}

                        {/* ปุ่มอนุมัติ - แสดงเมื่อยังไม่ได้อนุมัติ และเป็น Approval */}
                        {!existingReceipt?.vpc_approval_at && user?.role === 'Approval' && (() => {
                          const stepCheck = canApproveStep('vpc');
                          return stepCheck.allowed ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => handleIndividualApproval('vpc')}
                                disabled={approveIndividualMutation.isPending}
                                className="rounded-md bg-indigo-500 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-600 transition disabled:bg-gray-400"
                              >
                                {approveIndividualMutation.isPending ? 'กำลังอนุมัติ...' : 'กดเพื่ออนุมัติ'}
                              </button>
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-orange-600">
                              🔒 {stepCheck.reason}
                            </div>
                          );
                        })()}

                        {/* แสดงข้อความถ้ายังไม่ได้อนุมัติและไม่ใช่ Approval */}
                        {!existingReceipt?.vpc_approval_at && user?.role !== 'Approval' && (
                          <div className="mt-2 text-sm text-gray-500">
                            รอการอนุมัติจาก Approval (VP-C)
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* ปุ่มปิด */}
                <div className="flex justify-end gap-2 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 transition"
                  >
                    ปิด
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="rounded-lg bg-white p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto h-12 w-12 text-green-600">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-2 text-lg font-bold text-green-600">บันทึกสำเร็จ</h3>
              <p className="mt-1 text-sm text-gray-600">บันทึกการรับเอกสารเรียบร้อยแล้ว</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
