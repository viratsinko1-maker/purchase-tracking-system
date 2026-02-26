/**
 * PRPrintModal - Modal wrapper for print preview
 */
import { useRef } from "react";
import PRPrintView from "./PRPrintView";

interface PRLine {
  line_num: number;
  item_code: string | null;
  description: string | null;
  quantity: number | null;
  unit_msr: string | null;
  ocr_code2: string | null;
  ocr_code4: string | null;
  project: string | null;
}

interface PRData {
  doc_num: number;
  date: Date | string | null;
  due_date: Date | string | null;
  req_date: Date | string | null;
  create_date: Date | string | null;
  req_name: string | null;
  department: string | null;
  job_name: string | null;
  remarks: string | null;
  project_code: string | null;
  project_name: string | null;
  wo_numbers?: number[];
  lines: PRLine[];
}

interface DocumentReceipt {
  requester_approval_by: string | null;
  requester_approval_at: Date | string | null;
  line_approval_by: string | null;
  line_approval_at: Date | string | null;
  cost_center_approval_by: string | null;
  cost_center_approval_at: Date | string | null;
  procurement_approval_by: string | null;
  procurement_approval_at: Date | string | null;
  vpc_approval_by: string | null;
  vpc_approval_at: Date | string | null;
}

interface PRPrintModalProps {
  prData: PRData;
  documentReceipt: DocumentReceipt | null;
  onClose: () => void;
}

export default function PRPrintModal({ prData, documentReceipt, onClose }: PRPrintModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-white overflow-auto print:overflow-visible">
      {/* Control Bar - hidden when printing */}
      <div className="no-print sticky top-0 bg-gray-100 border-b border-gray-300 px-6 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            กลับ
          </button>
          <h2 className="text-lg font-semibold text-gray-800">
            Preview - PR #{prData.doc_num}
          </h2>
        </div>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 transition"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          พิมพ์
        </button>
      </div>

      {/* Print Content - A5 Landscape preview */}
      <div className="print-preview-container bg-gray-200 min-h-screen py-8">
        <div
          ref={printRef}
          className="pr-print-layout bg-white mx-auto shadow-lg"
          style={{
            width: '210mm',      /* A5 Landscape width */
            minHeight: '148mm',  /* A5 Landscape height */
            padding: '8mm',
          }}
        >
          <PRPrintView prData={prData} documentReceipt={documentReceipt} />
        </div>
      </div>
    </div>
  );
}
