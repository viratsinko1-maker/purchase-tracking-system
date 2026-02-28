/**
 * PR Print Page - Dedicated page for printing PR
 * Opens in new tab for clean printing
 */
import { useRouter } from "next/router";
import Head from "next/head";
import { api } from "~/utils/api";
import { useAuth } from "~/hooks/useAuth";
import PRPrintView from "~/components/PRPrintView";

export default function PRPrintPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { prNo } = router.query;
  const prNoNum = prNo ? parseInt(prNo as string, 10) : 0;

  // Fetch PR data
  const { data: prData, isLoading: prLoading } = api.pr.getByPRNo.useQuery(
    { prNo: prNoNum },
    { enabled: prNoNum > 0 }
  );

  // Fetch document receipt
  const { data: documentReceipt, isLoading: receiptLoading } = api.pr.getDocumentReceipt.useQuery(
    { prNo: prNoNum },
    { enabled: prNoNum > 0 }
  );

  const isLoading = prLoading || receiptLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!prData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-xl">ไม่พบข้อมูล PR #{prNo}</p>
          <button
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            ปิดหน้านี้
          </button>
        </div>
      </div>
    );
  }

  const prDataForPrint = {
    doc_num: prData.doc_num,
    date: prData.date,
    due_date: prData.due_date,
    req_date: prData.req_date,
    create_date: prData.create_date,
    req_name: prData.req_name,
    department: prData.department,
    job_name: prData.job_name,
    remarks: prData.remarks,
    project_code: prData.project_code,
    project_name: prData.project_name,
    wo_numbers: prData.wo_numbers,
    lines: prData.lines.map((line: any) => ({
      line_num: line.line_num,
      item_code: line.item_code,
      description: line.description,
      quantity: line.quantity,
      unit_msr: line.unit_msr,
      ocr_code2: line.ocr_code2,
      ocr_code4: line.ocr_code4,
      project: line.project,
    })),
  };

  const receiptForPrint = documentReceipt ? {
    requester_approval_by: documentReceipt.requester_approval_by,
    requester_approval_at: documentReceipt.requester_approval_at,
    line_approval_by: documentReceipt.line_approval_by,
    line_approval_at: documentReceipt.line_approval_at,
    cost_center_approval_by: documentReceipt.cost_center_approval_by,
    cost_center_approval_at: documentReceipt.cost_center_approval_at,
    procurement_approval_by: documentReceipt.procurement_approval_by,
    procurement_approval_at: documentReceipt.procurement_approval_at,
    vpc_approval_by: documentReceipt.vpc_approval_by,
    vpc_approval_at: documentReceipt.vpc_approval_at,
  } : null;

  return (
    <>
      <Head>
        <title>Print PR #{prData.doc_num}</title>
        <style>{`
          @media print {
            @page {
              size: A5 landscape;
              margin: 8mm 10mm;
            }
            body {
              margin: 0;
              padding: 0;
            }
            .no-print {
              display: none !important;
            }
          }
        `}</style>
      </Head>

      {/* Control bar - hidden when printing */}
      <div className="no-print bg-gray-100 border-b border-gray-300 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.close()}
            className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 transition"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            ปิด
          </button>
          <h2 className="text-lg font-semibold text-gray-800">
            Preview - PR #{prData.doc_num} ({prData.lines.length} รายการ)
          </h2>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-white font-medium hover:bg-blue-700 transition"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          พิมพ์
        </button>
      </div>

      {/* Single PRPrintView - used for both preview and print */}
      <div className="bg-gray-200 min-h-screen py-8 print:bg-white print:py-0 print:min-h-0">
        <PRPrintView
          prData={prDataForPrint}
          documentReceipt={receiptForPrint}
          printedBy={user?.name || user?.username || undefined}
        />
      </div>
    </>
  );
}
