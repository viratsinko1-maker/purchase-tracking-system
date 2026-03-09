/**
 * PR Card Component
 * Displays a single PR card with tracking information
 */

import { useState } from "react";
import { formatName } from "~/utils/formatters";
import { getUrgencyStyle, getUrgencyBgStyle, getUrgencyBorderStyle } from "~/utils/urgencyStyles";

// Type for tracking data
interface TrackingData {
  urgency_level: string;
  tracked_at: string | null;
  note: string | null;
  tracked_by: string | null;
  total_questions: number;
  answered_questions: number;
  latest_response?: {
    response_note: string | null;
    responded_at: string | null;
    responded_by: string | null;
  } | null;
}

// Type for PR data
interface PRData {
  doc_num: number;
  doc_status: string;
  create_date: string | Date | null;
  doc_due_date: string | Date | null;
  req_date: string | Date | null;
  job_name: string | null;
  req_name: string | null;
  department_name: string | null;
  total_lines: number;
  lines_with_po: number;
  pending_lines: number;
  primary_ocr_code2?: string | null;
  // Approval fields - all 5 stages
  requester_approval_at?: string | null;
  requester_approval_by?: string | null;
  line_approval_at?: string | null;
  line_approval_by?: string | null;
  cost_center_approval_at?: string | null;
  cost_center_approval_by?: string | null;
  procurement_approval_at?: string | null;
  procurement_approval_by?: string | null;
  vpc_approval_at?: string | null;
  vpc_approval_by?: string | null;
  // Rejection fields
  rejection_status?: string | null;
  rejection_step?: number | null;
  rejection_reason?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  po_numbers?: number[];
  wo_numbers_arr?: number[];
  receive_waiting?: number;
  receive_confirmed?: number;
  receive_rejected?: number;
  gr_lines_received?: number;
}

interface PRCardProps {
  pr: PRData;
  tracking?: TrackingData;
  ocrCodeMap: Map<string, string>;
  onCardClick: (prNo: number) => void;
  onReceiptClick: (prNo: number, createDate: Date | string | null, e: React.MouseEvent) => void;
}

export default function PRCard({
  pr,
  tracking,
  ocrCodeMap,
  onCardClick,
  onReceiptClick,
}: PRCardProps) {
  // State สำหรับแสดง/ซ่อนส่วนผู้อนุมัติ (default: expanded)
  const [showApprovers, setShowApprovers] = useState(true);

  // Helper functions
  const formatNumber = (num: number | null | undefined) => {
    if (!num && num !== 0) return "0";
    return num.toLocaleString("th-TH");
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "-";
      return d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "-";
    }
  };

  // Calculate stats
  const totalLines = pr.total_lines || 0;
  const linesWithPO = pr.lines_with_po || 0;
  const pendingLines = pr.pending_lines || 0;

  // Closed lines without PO
  const closedWithoutPO = pr.doc_status === 'C' ? pendingLines : 0;

  return (
    <div
      onClick={() => onCardClick(pr.doc_num)}
      className={`cursor-pointer rounded-lg bg-white p-4 shadow transition hover:shadow-lg active:shadow-md ${tracking ? getUrgencyBorderStyle(tracking.urgency_level) : ''}`}
    >
      <div>
        {/* Header Row: PR #, Status, Urgency, ocr_code2, Date */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <h3 className="text-lg font-bold text-blue-600">PR #{pr.doc_num}</h3>
          <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
            pr.doc_status === "O" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
          }`}>
            {pr.doc_status === "O" ? "Open" : "Closed"}
          </span>

          {/* Urgency Level */}
          {tracking && (
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${getUrgencyStyle(tracking.urgency_level)}`}>
              {tracking.urgency_level}
            </span>
          )}

          {/* Rejection Status Badge */}
          {pr.rejection_status === 'frozen' && (
            <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 border border-blue-300">
              Frozen
            </span>
          )}
          {pr.rejection_status === 'rejected' && (
            <span className="inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-800 border border-red-300">
              Rejected
            </span>
          )}

          {/* OCR Code (Department) */}
          {pr.primary_ocr_code2 && (
            <>
              <span
                className="inline-block rounded px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200"
              >
                {pr.primary_ocr_code2}
              </span>
              {ocrCodeMap.get(pr.primary_ocr_code2) && (
                <span className="text-xs text-purple-700">
                  {ocrCodeMap.get(pr.primary_ocr_code2)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Date */}
        <p className="mt-0.5 text-xs text-gray-500">
          {formatDate(pr.create_date)} | ต้องการ: {formatDate(pr.req_date)}
          {pr.wo_numbers_arr && pr.wo_numbers_arr.length > 0 && (
            <> | WO-{pr.wo_numbers_arr.join(', WO-')}</>
          )}
        </p>

        {/* GR Count */}
        {(pr.gr_lines_received ?? 0) > 0 && (
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-700">ใบรับของ (GR):</span>
            <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700 border border-emerald-200">
              {pr.gr_lines_received}/{totalLines}
            </span>
          </div>
        )}

        {/* Receive Good Status */}
        {(pr.receive_waiting || pr.receive_confirmed || pr.receive_rejected) ? (
          <div className="mt-1.5 flex items-center gap-2 text-xs">
            <span className="font-medium text-gray-700">การรับของ:</span>
            {(pr.receive_waiting ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700 border border-amber-200">
                Waiting {pr.receive_waiting}
              </span>
            )}
            {(pr.receive_confirmed ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1.5 py-0.5 font-medium text-green-700 border border-green-200">
                Confirmed {pr.receive_confirmed}
              </span>
            )}
            {(pr.receive_rejected ?? 0) > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-700 border border-red-200">
                Rejected {pr.receive_rejected}
              </span>
            )}
          </div>
        ) : null}

        {/* Job Name */}
        {pr.job_name && (
          <p className="mt-1 text-sm text-gray-700"><span className="font-medium">งาน:</span> {pr.job_name}</p>
        )}

        {/* Requester & Department */}
        <p className="mt-0.5 text-sm text-gray-600">
          {formatName(pr.req_name)} {pr.department_name || "-"}
        </p>

        {/* Tracking Info */}
        {tracking && (tracking.tracked_at || tracking.note || tracking.tracked_by || tracking.latest_response) && (
          <div className={`mt-3 rounded-lg px-3 py-2 ${getUrgencyBgStyle(tracking.urgency_level)}`}>
            {/* Last tracked time */}
            {tracking.tracked_at && (
              <p className="text-xs font-semibold text-gray-700 mb-2">
                ถามล่าสุด: {formatDate(tracking.tracked_at)} เวลา {new Date(tracking.tracked_at).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })} น.
              </p>
            )}
            {/* Note */}
            {tracking.note && (
              <p
                className="text-sm italic break-words line-clamp-2 cursor-help"
                title={tracking.note}
              >
                {tracking.note}
              </p>
            )}
            {/* Tracked by */}
            {tracking.tracked_by && (
              <p className="mt-1 text-xs truncate">
                ติดตามโดย: {formatName(tracking.tracked_by)}
              </p>
            )}

            {/* Latest Response */}
            {tracking.latest_response && tracking.latest_response.response_note && (
              <div className="mt-2 pt-2 border-t border-gray-300">
                {tracking.latest_response.responded_at && (
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    ตอบล่าสุด: {formatDate(tracking.latest_response.responded_at)} เวลา {new Date(tracking.latest_response.responded_at).toLocaleTimeString("th-TH", { hour: '2-digit', minute: '2-digit' })} น.
                  </p>
                )}
                <p
                  className="text-sm font-medium break-words line-clamp-2 cursor-help"
                  title={tracking.latest_response.response_note}
                >
                  ตอบกลับ: {tracking.latest_response.response_note}
                </p>
                {tracking.latest_response.responded_by && (
                  <p className="mt-1 text-xs truncate">
                    ตอบโดย: {formatName(tracking.latest_response.responded_by)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 border-t border-gray-100 pt-3">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            {/* Questions - Mobile Only */}
            {tracking && tracking.total_questions > 0 && (
              <div className="md:hidden">
                <span className="text-gray-600">คำถาม:</span>{" "}
                <span className="font-medium text-green-600">{tracking.answered_questions}/{tracking.total_questions}</span>
              </div>
            )}

            <div>
              <span className="text-gray-600">รายการ:</span>{" "}
              <span className="font-medium">{formatNumber(totalLines)}</span>
            </div>
            <div>
              <span className="text-gray-600">มี PO:</span>{" "}
              <span className="font-medium text-green-600">{formatNumber(linesWithPO)}</span>
            </div>
            <div>
              <span className="text-gray-600">รอ PO:</span>{" "}
              <span className="font-medium text-orange-600">{formatNumber(pendingLines)}</span>
            </div>
            {closedWithoutPO > 0 && (
              <div>
                <span className="text-gray-600">ถูกปิด:</span>{" "}
                <span className="font-medium text-red-600">{formatNumber(closedWithoutPO)}</span>
              </div>
            )}

            {/* Receipt Button */}
            <button
              onClick={(e) => onReceiptClick(pr.doc_num, pr.create_date, e)}
              className="rounded-md px-2 py-1 text-xs font-medium transition bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer"
              title="คลิกเพื่อดูและอนุมัติเอกสาร"
            >
              กดเพื่อ Approve
            </button>

            {/* Approval Toggle Button - แสดงตลอด */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowApprovers(!showApprovers);
              }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
              title={showApprovers ? "ซ่อนสถานะการอนุมัติ" : "แสดงสถานะการอนุมัติ"}
            >
              <span>สถานะ</span>
              <svg
                className={`h-3 w-3 transition-transform duration-200 ${showApprovers ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Approval Status - Collapsible (All 5 stages) */}
          {showApprovers && (
            <div className="mt-2 text-xs space-y-1">
              {/* 1. Requester Approval */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${pr.requester_approval_at ? 'text-purple-700 bg-purple-50' : 'text-gray-500 bg-gray-50'}`}>
                <span className={pr.requester_approval_at ? 'text-green-600' : 'text-gray-400'}>{pr.requester_approval_at ? '✓' : '○'}</span>
                <span className="font-medium">ผู้ขอซื้อ:</span>
                {pr.requester_approval_at ? (
                  <>
                    <span>{pr.requester_approval_by}</span>
                    <span className="text-gray-500">
                      ({new Date(pr.requester_approval_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })})
                    </span>
                  </>
                ) : (
                  <span className="italic">รอการอนุมัติ</span>
                )}
              </div>
              {/* 2. Line Approval */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${pr.line_approval_at ? 'text-blue-700 bg-blue-50' : 'text-gray-500 bg-gray-50'}`}>
                <span className={pr.line_approval_at ? 'text-green-600' : 'text-gray-400'}>{pr.line_approval_at ? '✓' : '○'}</span>
                <span className="font-medium">สายงาน:</span>
                {pr.line_approval_at ? (
                  <>
                    <span>{pr.line_approval_by}</span>
                    <span className="text-gray-500">
                      ({new Date(pr.line_approval_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })})
                    </span>
                  </>
                ) : (
                  <span className="italic">รอการอนุมัติ</span>
                )}
              </div>
              {/* 3. Cost Center Approval */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                pr.rejection_status === 'frozen' ? 'text-red-700 bg-red-50' :
                pr.cost_center_approval_at ? 'text-green-700 bg-green-50' : 'text-gray-500 bg-gray-50'
              }`}>
                <span className={
                  pr.rejection_status === 'frozen' ? 'text-red-600' :
                  pr.cost_center_approval_at ? 'text-green-600' : 'text-gray-400'
                }>
                  {pr.rejection_status === 'frozen' ? '✕' : pr.cost_center_approval_at ? '✓' : '○'}
                </span>
                <span className="font-medium">Cost Center:</span>
                {pr.rejection_status === 'frozen' ? (
                  <span className="text-red-600">Frozen{pr.rejected_by ? ` โดย ${pr.rejected_by}` : ''}</span>
                ) : pr.cost_center_approval_at ? (
                  <>
                    <span>{pr.cost_center_approval_by}</span>
                    <span className="text-gray-500">
                      ({new Date(pr.cost_center_approval_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })})
                    </span>
                  </>
                ) : (
                  <span className="italic">รอการอนุมัติ</span>
                )}
              </div>
              {/* 4. Procurement Approval */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                pr.rejection_status === 'rejected' && pr.rejection_step === 4 ? 'text-red-700 bg-red-50' :
                pr.procurement_approval_at ? 'text-orange-700 bg-orange-50' : 'text-gray-500 bg-gray-50'
              }`}>
                <span className={
                  pr.rejection_status === 'rejected' && pr.rejection_step === 4 ? 'text-red-600' :
                  pr.procurement_approval_at ? 'text-green-600' : 'text-gray-400'
                }>
                  {pr.rejection_status === 'rejected' && pr.rejection_step === 4 ? '✕' : pr.procurement_approval_at ? '✓' : '○'}
                </span>
                <span className="font-medium">จัดซื้อ:</span>
                {pr.rejection_status === 'rejected' && pr.rejection_step === 4 ? (
                  <span className="text-red-600">ปฏิเสธ{pr.rejected_by ? ` โดย ${pr.rejected_by}` : ''}</span>
                ) : pr.procurement_approval_at ? (
                  <>
                    <span>{pr.procurement_approval_by}</span>
                    <span className="text-gray-500">
                      ({new Date(pr.procurement_approval_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })})
                    </span>
                  </>
                ) : (
                  <span className="italic">รอการอนุมัติ</span>
                )}
              </div>
              {/* 5. VPC Approval */}
              <div className={`flex items-center gap-1 px-2 py-1 rounded ${
                pr.rejection_status === 'rejected' && pr.rejection_step === 5 ? 'text-red-700 bg-red-50' :
                pr.vpc_approval_at ? 'text-indigo-700 bg-indigo-50' : 'text-gray-500 bg-gray-50'
              }`}>
                <span className={
                  pr.rejection_status === 'rejected' && pr.rejection_step === 5 ? 'text-red-600' :
                  pr.vpc_approval_at ? 'text-green-600' : 'text-gray-400'
                }>
                  {pr.rejection_status === 'rejected' && pr.rejection_step === 5 ? '✕' : pr.vpc_approval_at ? '✓' : '○'}
                </span>
                <span className="font-medium">VP-C:</span>
                {pr.rejection_status === 'rejected' && pr.rejection_step === 5 ? (
                  <span className="text-red-600">ปฏิเสธ{pr.rejected_by ? ` โดย ${pr.rejected_by}` : ''}</span>
                ) : pr.vpc_approval_at ? (
                  <>
                    <span>{pr.vpc_approval_by}</span>
                    <span className="text-gray-500">
                      ({new Date(pr.vpc_approval_at).toLocaleDateString('th-TH', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })})
                    </span>
                  </>
                ) : (
                  <span className="italic">รอการอนุมัติ</span>
                )}
              </div>
            </div>
          )}

          {/* PO Numbers */}
          {pr.po_numbers && pr.po_numbers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {pr.po_numbers.map((poNum: number) => (
                <span
                  key={poNum}
                  className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                >
                  PO #{poNum}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
