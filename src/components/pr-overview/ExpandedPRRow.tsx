/**
 * Expanded PR Row Component
 * Shows detailed information about a PR when expanded in the overview table
 */

import { api } from "~/utils/api";
import { formatName } from "~/utils/formatters";

// PRSummary interface - 5-step approval from pr_document_receipt
interface PRSummary {
  // 5-step approval fields
  requester_approval_by?: string | null;
  requester_approval_at?: Date | string | null;
  line_approval_by?: string | null;
  line_approval_at?: Date | string | null;
  cost_center_approval_by?: string | null;
  cost_center_approval_at?: Date | string | null;
  procurement_approval_by?: string | null;
  procurement_approval_at?: Date | string | null;
  vpc_approval_by?: string | null;
  vpc_approval_at?: Date | string | null;
}

interface ExpandedPRRowProps {
  prNo: number;
  prSummary: PRSummary;
  isExpanded: boolean;
  onPOClick: (poNo: number) => void;
}

export default function ExpandedPRRow({
  prNo,
  prSummary,
  isExpanded,
  onPOClick,
}: ExpandedPRRowProps) {
  // Fetch PR detail
  const { data: prData, isLoading: isPrLoading } = api.pr.getByPRNo.useQuery(
    { prNo },
    { enabled: isExpanded }
  );

  // Fetch PR attachments
  const { data: attachments, isLoading: isAttachmentsLoading } = api.pr.getPRAttachments.useQuery(
    { prNo },
    { enabled: isExpanded }
  );

  // Get PO numbers from PR lines
  const poNumbers = prData?.lines
    .flatMap((line: any) => line.po_list.map((po: any) => po.po_doc_num))
    .filter((num: number, index: number, self: number[]) => self.indexOf(num) === index) || [];

  // Fetch PO info
  const { data: poInfoMap } = api.pr.getPOInfoBatch.useQuery(
    { poNumbers },
    { enabled: poNumbers.length > 0 && isExpanded }
  );

  // Fetch receive good data
  const { data: receiveGoodData } = api.pr.getAllReceived.useQuery(
    { search: String(prNo), limit: 100 },
    { enabled: isExpanded }
  );

  // Helper functions
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatNumber = (num: number | null | string | undefined) => {
    if (num === null || num === undefined) return "-";
    return Number(num).toLocaleString("th-TH");
  };

  if (isPrLoading) {
    return (
      <tr>
        <td colSpan={12} className="px-4 py-8 bg-blue-50">
          <div className="flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
            <span className="ml-3 text-sm text-gray-600">กำลังโหลดข้อมูล...</span>
          </div>
        </td>
      </tr>
    );
  }

  if (!prData) {
    return (
      <tr>
        <td colSpan={12} className="px-4 py-4 bg-red-50 text-center text-sm text-red-600">
          ไม่พบข้อมูล PR #{prNo}
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-blue-50">
      <td colSpan={12} className="px-6 py-4">
        <div className="space-y-4">
          {/* Section 1: Basic PR Info */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">ข้อมูล PR</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <p className="text-xs text-gray-600">ผู้เปิด PR</p>
                <p className="text-sm font-medium text-gray-900">{formatName(prData.req_name)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">หน่วยงาน</p>
                <p className="text-sm font-medium text-gray-900">{prData.department || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">System Date (วันที่คีย์ข้อมูล)</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(prData.create_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">วันที่เปิด PR</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(prData.date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">วันที่ครบกำหนด</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(prData.due_date)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">วันที่อัพเดตล่าสุด</p>
                <p className="text-sm font-medium text-gray-900">{formatDate(prData.update_date)}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-xs text-gray-600">ชื่องาน</p>
                <p className="text-sm font-medium text-gray-900">{prData.job_name || "-"}</p>
              </div>
              <div className="md:col-span-3">
                <p className="text-xs text-gray-600">หมายเหตุ</p>
                <p className="text-sm font-medium text-gray-900">{prData.remarks || "-"}</p>
              </div>
            </div>
          </div>

          {/* Section 2: PR Lines */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">รายการสินค้า</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Line</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รหัสสินค้า</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">รายละเอียด</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">จำนวน</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">สถานะ</th>
                    <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">PO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {prData.lines.map((line: any) =>
                    line.po_list && line.po_list.length > 0 ? (
                      line.po_list.map((po: any, poIndex: number) => (
                        <tr key={`${line.line_id}-${poIndex}`} className="hover:bg-gray-50">
                          {poIndex === 0 && (
                            <>
                              <td rowSpan={line.po_list.length} className="whitespace-nowrap px-2 py-2 text-xs text-gray-900">
                                #{line.line_num}
                              </td>
                              <td rowSpan={line.po_list.length} className="px-2 py-2 text-xs text-gray-600">
                                {line.item_code || "-"}
                              </td>
                              <td rowSpan={line.po_list.length} className="px-2 py-2 text-xs text-gray-600">
                                <div className="max-w-xs truncate" title={line.description}>
                                  {line.description}
                                </div>
                              </td>
                              <td rowSpan={line.po_list.length} className="whitespace-nowrap px-2 py-2 text-xs text-gray-600">
                                {formatNumber(line.quantity)}
                              </td>
                              <td rowSpan={line.po_list.length} className="whitespace-nowrap px-2 py-2 text-xs">
                                <span className={`inline-block rounded px-2 py-0.5 text-xs ${
                                  line.line_status === "O"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                                }`}>
                                  {line.line_status === "O" ? "Open" : "Closed"}
                                </span>
                              </td>
                            </>
                          )}
                          <td className="whitespace-nowrap px-2 py-2 text-xs">
                            <button
                              onClick={() => onPOClick(po.po_doc_num)}
                              className="font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition"
                            >
                              PO #{po.po_doc_num}
                            </button>
                            <div className="text-xs text-gray-500">
                              {po.po_status === "O" ? "Open" : "Closed"}
                            </div>
                            {poInfoMap && poInfoMap.get && poInfoMap.get(po.po_doc_num) && (
                              <div className="text-xs text-green-600 font-medium">
                                {formatDate(poInfoMap.get(po.po_doc_num).po_doc_date)}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr key={line.line_id} className="bg-orange-50">
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-900">
                          #{line.line_num}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          {line.item_code || "-"}
                        </td>
                        <td className="px-2 py-2 text-xs text-gray-600">
                          <div className="max-w-xs truncate" title={line.description}>
                            {line.description}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs text-gray-600">
                          {formatNumber(line.quantity)}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-xs">
                          <span className={`inline-block rounded px-2 py-0.5 text-xs ${
                            line.line_status === "O"
                              ? "bg-green-100 text-green-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {line.line_status === "O" ? "Open" : "Closed"}
                          </span>
                        </td>
                        <td colSpan={1} className="px-2 py-2 text-xs text-orange-600 font-semibold">
                          ยังไม่มี PO
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3: Attachments */}
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-900">ไฟล์แนบ</h4>
            {isAttachmentsLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
              </div>
            ) : attachments && attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment) => {
                  const originalFileUrl = `file://10.1.1.199/b1_shr/TMK/Attachments/${attachment.file_name}.${attachment.file_ext}`;
                  const apiFileUrl = `/api/attachment?path=${encodeURIComponent(originalFileUrl)}`;
                  const fullFileName = `${attachment.file_name}.${attachment.file_ext}`;

                  return (
                    <div key={attachment.id} className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 transition">
                      <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <a
                        href={apiFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition truncate flex-1"
                        title={fullFileName}
                      >
                        {fullFileName}
                      </a>
                      {attachment.uploaded_date && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {formatDate(attachment.uploaded_date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-gray-500">
                ไม่มีไฟล์แนบ
              </div>
            )}
          </div>

          {/* Section 4: Receive Good Summary & 5-Step Approval */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Receive Good Summary */}
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">สรุปการรับของ</h4>
              {receiveGoodData && receiveGoodData.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Confirmed: {receiveGoodData.filter((r: any) => r.confirm_status === 'confirmed').length}
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
                    Rejected: {receiveGoodData.filter((r: any) => r.confirm_status === 'rejected').length}
                  </span>
                  <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-medium text-yellow-700">
                    Waiting: {receiveGoodData.filter((r: any) => r.confirm_status === 'waiting' || !r.confirm_status).length}
                  </span>
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-gray-500">
                  ยังไม่มีการรับของ
                </div>
              )}
            </div>

            {/* Right: 5-Step Approval Status */}
            <div className="rounded-lg bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-semibold text-gray-900">สถานะการอนุมัติ (5 ขั้นตอน)</h4>
              <div className="space-y-2">
                {/* 1. ผู้ขอซื้อ */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">1. ผู้ขอซื้อ</span>
                  {prSummary.requester_approval_at ? (
                    <span className="text-green-600 font-medium">✅ {prSummary.requester_approval_by}</span>
                  ) : (
                    <span className="text-gray-400">รอดำเนินการ</span>
                  )}
                </div>
                {/* 2. ผู้อนุมัติตามสายงาน */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">2. ผู้อนุมัติตามสายงาน</span>
                  {prSummary.line_approval_at ? (
                    <span className="text-green-600 font-medium">✅ {prSummary.line_approval_by}</span>
                  ) : (
                    <span className="text-gray-400">รอดำเนินการ</span>
                  )}
                </div>
                {/* 3. ผู้อนุมัติตาม Cost Center */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">3. Cost Center</span>
                  {prSummary.cost_center_approval_at ? (
                    <span className="text-green-600 font-medium">✅ {prSummary.cost_center_approval_by}</span>
                  ) : (
                    <span className="text-gray-400">รอดำเนินการ</span>
                  )}
                </div>
                {/* 4. งานจัดซื้อพัสดุ */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">4. งานจัดซื้อพัสดุ</span>
                  {prSummary.procurement_approval_at ? (
                    <span className="text-green-600 font-medium">✅ {prSummary.procurement_approval_by}</span>
                  ) : (
                    <span className="text-gray-400">รอดำเนินการ</span>
                  )}
                </div>
                {/* 5. VP-C */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">5. VP-C</span>
                  {prSummary.vpc_approval_at ? (
                    <span className="text-green-600 font-medium">✅ {prSummary.vpc_approval_by}</span>
                  ) : (
                    <span className="text-gray-400">รอดำเนินการ</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
