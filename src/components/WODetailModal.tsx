import { Fragment, useState } from "react";
import { api } from "~/utils/api";

interface WODetailModalProps {
  woNo: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function WODetailModal({ woNo, isOpen, onClose }: WODetailModalProps) {
  // State สำหรับ collapse/expand รายการ WA/WC ทั้งหมด
  const [showAllRecords, setShowAllRecords] = useState(false);

  // ดึงข้อมูล WO detail
  const { data: woData, isLoading } = api.pr.getWODetail.useQuery(
    { woNo },
    { enabled: isOpen && woNo > 0 }
  );

  // Format date เป็น DD.MM.YY (Buddhist Era) - ใช้ UTC เพื่อแสดงเวลาตามจริงใน database
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = (d.getUTCFullYear() + 543).toString().slice(-2);
    return `${day}.${month}.${year}`;
  };

  // Format date เป็น DD.MM.YYYY (Buddhist Era - full year) - ใช้ UTC
  const formatDateFull = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = (d.getUTCFullYear() + 543);
    return `${day}.${month}.${year}`;
  };

  // Format datetime เป็น DD.MM.YY HH:MM - ใช้ UTC เพื่อแสดงเวลาตามจริงใน database
  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = (d.getUTCFullYear() + 543).toString().slice(-2);
    const hours = d.getUTCHours().toString().padStart(2, '0');
    const mins = d.getUTCMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${mins}`;
  };

  // Format name: "LastName, FirstName" -> "FirstName LastName"
  const formatName = (name: string | null) => {
    if (!name) return "";
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
    }
    return name;
  };

  // Format number with Thai locale
  const formatNumber = (num: number | string | null | undefined) => {
    if (num === null || num === undefined) return "";
    const n = typeof num === 'string' ? parseFloat(num) : num;
    if (isNaN(n)) return "";
    return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format GI Doc Number (e.g., 250310038 -> GI250310038)
  const formatGIDocNum = (docNum: number | null) => {
    if (!docNum) return "";
    return `GI${docNum}`;
  };

  // Format PO Doc Number (e.g., 250700176 -> PO 250700176)
  const formatPODocNum = (docNum: number | null) => {
    if (!docNum) return "";
    return `PO ${docNum}`;
  };

  // คำนวณระยะเวลาระหว่างสองวันที่ และแสดงเป็น ชั่วโมง:นาที
  const calculateDuration = (startDate: Date | string | null, endDate: Date | string | null): string => {
    if (!startDate || !endDate) return "-";
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return "-";

    const diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) return "-"; // วันที่ไม่ถูกต้อง

    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <Fragment>
      {/* Horizontal/Landscape Modal */}
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-2 z-[70]">
        <div className="relative w-[98vw] max-w-[1600px] max-h-[95vh] overflow-hidden rounded-lg bg-white shadow-2xl">
          {/* Header Bar */}
          <div className="sticky top-0 z-10 bg-gray-100 border-b px-6 py-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              รายงานสรุปการดำเนินการใบสั่งงาน Work Order
            </h2>
            <button
              onClick={onClose}
              className="rounded-full p-2 hover:bg-gray-200 transition text-gray-600"
              title="ปิด"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(95vh - 56px)' }}>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-teal-600"></div>
              </div>
            ) : !woData ? (
              <div className="text-center py-20 text-gray-600">
                <p className="text-lg mb-2">ไม่พบข้อมูล WO</p>
                <p className="text-sm text-gray-500">เลขที่ระบุอาจไม่ใช่เลข WO (อาจเป็นเลข PR หรืออื่นๆ)</p>
              </div>
            ) : (
              <div className="space-y-6 text-sm">
                {/* ==================== HEADER SECTION ==================== */}
                <div className="border-b pb-4">
                  {/* Row 1: เลขที่ WO | ผู้เปิด | หน่วยงานผู้เบิก | วันที่เปิด | วันที่เสร็จ */}
                  <div className="grid grid-cols-5 gap-4 mb-3">
                    <div>
                      <span className="text-gray-500">เลขที่ WO:</span>
                      <span className="ml-2 font-semibold">{woData.header.wo_doc_num}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ผู้เปิด:</span>
                      <span className="ml-2">{formatName(woData.header.req_name) || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">หน่วยงานผู้เบิก:</span>
                      <span className="ml-2">{woData.header.dept_name || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">วันที่เปิด:</span>
                      <span className="ml-2">{formatDateFull(woData.header.doc_date) || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">วันที่เสร็จ:</span>
                      <span className="ml-2 font-semibold">{formatDateFull(woData.header.wo_u_finish) || "-"}</span>
                    </div>
                  </div>

                  {/* Row 2: ชื่องาน | ผู้รับผิดชอบงาน | หน่วยงานดำเนินการ */}
                  <div className="grid grid-cols-5 gap-4 mb-3">
                    <div className="col-span-2">
                      <span className="text-gray-500">ชื่องาน:</span>
                      <span className="ml-2">{woData.header.pr_for || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ผู้รับผิดชอบงาน:</span>
                      <span className="ml-2">{woData.header.wo_order_1 || "-"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">หน่วยงานดำเนินการ:</span>
                      <span className="ml-2 font-medium">{woData.header.wo_respond_by || "-"}</span>
                    </div>
                  </div>

                  {/* Row 3: รหัสสินค้า | ชื่อเครื่องจักร */}
                  <div className="grid grid-cols-5 gap-4 mb-3">
                    <div>
                      <span className="text-gray-500">รหัสสินค้า:</span>
                      <span className="ml-2 font-mono text-teal-700">{woData.header.pr_mac || "-"}</span>
                    </div>
                    <div className="col-span-4">
                      <span className="text-gray-500">ชื่อเครื่องจักร:</span>
                      <span className="ml-2">{woData.header.item_name || "-"}</span>
                    </div>
                  </div>

                  {/* Row 4: ผู้อนุมัติ WR | ผู้อนุมัติ WO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500">ผู้อนุมัติ WR:</span>
                      <span className="ml-2">{woData.header.wr_approver || "-"}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ผู้อนุมัติ WO:</span>
                      <span className="ml-2">{woData.header.wo_approver || "-"}</span>
                    </div>
                  </div>
                </div>

                {/* ==================== DETAIL INVENTORY (GI) SECTION ==================== */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Detail Inventory</h3>
                  {woData.giRecords && woData.giRecords.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-2 py-1.5 text-left w-28">Doc. Number</th>
                            <th className="px-2 py-1.5 text-left w-24">ItemCode</th>
                            <th className="px-2 py-1.5 text-left">Description</th>
                            <th className="px-2 py-1.5 text-right w-20">จำนวน</th>
                            <th className="px-2 py-1.5 text-center w-16">หน่วย</th>
                            <th className="px-2 py-1.5 text-right w-24">มูลค่า</th>
                            <th className="px-2 py-1.5 text-left w-36">ผู้เบิก</th>
                            <th className="px-2 py-1.5 text-center w-20">วันที่เบิก</th>
                            <th className="px-2 py-1.5 text-center w-20">วันที่ Issue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group GI records by doc_num
                            const giGroups = new Map<number, typeof woData.giRecords>();
                            woData.giRecords.forEach((gi: any) => {
                              const docNum = gi.doc_num;
                              if (!giGroups.has(docNum)) {
                                giGroups.set(docNum, []);
                              }
                              giGroups.get(docNum)!.push(gi);
                            });

                            return Array.from(giGroups.entries()).map(([docNum, items], groupIdx) => (
                              <Fragment key={`gi-group-${docNum}`}>
                                {items.map((gi: any, idx: number) => (
                                  <tr key={`gi-${docNum}-${idx}`} className="border-b border-gray-100">
                                    {/* Doc Number - only show on first row of each group */}
                                    <td className="px-2 py-1 font-mono">
                                      {idx === 0 ? formatGIDocNum(gi.doc_num) : ""}
                                    </td>
                                    <td className="px-2 py-1 font-mono">{gi.item_code || ""}</td>
                                    <td className="px-2 py-1">{gi.description || ""}</td>
                                    <td className="px-2 py-1 text-right">{formatNumber(gi.quantity)}</td>
                                    <td className="px-2 py-1 text-center">{gi.unit || ""}</td>
                                    <td className="px-2 py-1 text-right">{formatNumber(gi.line_total)}</td>
                                    <td className="px-2 py-1">{formatName(gi.requester)}</td>
                                    <td className="px-2 py-1 text-center">{formatDate(gi.request_date)}</td>
                                    <td className="px-2 py-1 text-center">{formatDate(gi.issue_date)}</td>
                                  </tr>
                                ))}
                                {/* Subtotal row for each GI group */}
                                {items.length > 1 && (
                                  <tr className="border-b">
                                    <td colSpan={5} className="px-2 py-1"></td>
                                    <td className="px-2 py-1 text-right font-medium border-t">
                                      {formatNumber(items.reduce((sum: number, gi: any) => sum + (parseFloat(gi.line_total) || 0), 0))}
                                    </td>
                                    <td colSpan={3}></td>
                                  </tr>
                                )}
                              </Fragment>
                            ));
                          })()}
                        </tbody>
                        {/* Grand Total */}
                        <tfoot>
                          <tr className="font-medium">
                            <td colSpan={5} className="px-2 py-1.5 text-right"></td>
                            <td className="px-2 py-1.5 text-right border-t-2 border-gray-400">
                              {formatNumber(woData.giRecords.reduce((sum: number, gi: any) => sum + (parseFloat(gi.line_total) || 0), 0))}
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xs italic p-3 bg-gray-50 rounded">- ไม่มีข้อมูล GI (Goods Issue) -</div>
                  )}
                </div>

                {/* ==================== DETAIL PO SECTION ==================== */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-gray-700 mb-2">Detail PO</h3>
                  {woData.poRecords && woData.poRecords.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-50 border-b">
                            <th className="px-2 py-1.5 text-left w-28">Doc. Number</th>
                            <th className="px-2 py-1.5 text-left w-24">ItemCode</th>
                            <th className="px-2 py-1.5 text-left max-w-[200px]">Description</th>
                            <th className="px-2 py-1.5 text-right w-20">จำนวน</th>
                            <th className="px-2 py-1.5 text-right w-24">มูลค่า</th>
                            <th className="px-2 py-1.5 text-left w-36">ผู้สั่ง</th>
                            <th className="px-2 py-1.5 text-center w-20">วันที่อนุมัติ</th>
                            <th className="px-2 py-1.5 text-center w-24">วันที่รับของเข้า</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Group PO records by po_doc_num
                            const poGroups = new Map<number, typeof woData.poRecords>();
                            woData.poRecords.forEach((po: any) => {
                              const docNum = po.po_doc_num;
                              if (!poGroups.has(docNum)) {
                                poGroups.set(docNum, []);
                              }
                              poGroups.get(docNum)!.push(po);
                            });

                            return Array.from(poGroups.entries()).map(([docNum, items], groupIdx) => (
                              <Fragment key={`po-group-${docNum}`}>
                                {items.map((po: any, idx: number) => (
                                  <tr key={`po-${docNum}-${idx}`} className="border-b border-gray-100">
                                    {/* Doc Number - only show on first row of each group */}
                                    <td className="px-2 py-1 font-mono">
                                      {idx === 0 ? formatPODocNum(po.po_doc_num) : ""}
                                    </td>
                                    <td className="px-2 py-1 font-mono">{po.item_code || ""}</td>
                                    <td className="px-2 py-1 max-w-[200px] truncate" title={po.description || ""}>{po.description || ""}</td>
                                    <td className="px-2 py-1 text-right">{formatNumber(po.quantity)}</td>
                                    <td className="px-2 py-1 text-right">{formatNumber(po.line_total)}</td>
                                    <td className="px-2 py-1 w-36">{formatName(po.requester)}</td>
                                    <td className="px-2 py-1 text-center">{formatDate(po.approve_date)}</td>
                                    <td className="px-2 py-1 text-center">{formatDate(po.receive_date)}</td>
                                  </tr>
                                ))}
                              </Fragment>
                            ));
                          })()}
                        </tbody>
                        {/* Grand Total */}
                        <tfoot>
                          <tr className="font-medium">
                            <td colSpan={4} className="px-2 py-1.5 text-right"></td>
                            <td className="px-2 py-1.5 text-right border-t-2 border-gray-400">
                              {formatNumber(woData.poRecords.reduce((sum: number, po: any) => sum + (parseFloat(po.line_total) || 0), 0))}
                            </td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xs italic p-3 bg-gray-50 rounded">- ไม่มีข้อมูล PO -</div>
                  )}
                </div>

                {/* ==================== WORK DETAIL SECTION ==================== */}
                <div className="border-b pb-4">
                  <h3 className="font-semibold text-gray-700 mb-3">Work Detail</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <tbody>
                        {/* WR Row */}
                        <tr className="border-b">
                          <td className="px-3 py-2 font-medium w-20">WR No.</td>
                          <td className="px-3 py-2 font-mono w-24">{woData.header.wr_doc_num || "-"}</td>
                          <td className="px-3 py-2 w-36">
                            <span className="text-gray-500 text-[10px] block">วันที่แจ้ง - เวลา</span>
                            <span>{formatDateTime(woData.header.wo_u_date) || "-"}</span>
                          </td>
                          <td className="px-3 py-2 w-36">
                            <span className="text-gray-500 text-[10px] block">วันที่คาดหวัง - เวลา</span>
                            <span>{formatDateTime(woData.header.wo_u_finish) || "-"}</span>
                          </td>
                          <td className="px-3 py-2 w-28">
                            <span className="text-gray-500 text-[10px] block">วันที่ ปิด WR</span>
                            <span>{formatDate(woData.header.wr_close_date) || "-"}</span>
                          </td>
                          <td className="px-3 py-2 text-right w-28">
                            <span className="text-gray-500 text-[10px] block">ระยะเวลาทั้งหมด</span>
                            <span>{calculateDuration(woData.header.wo_u_date, woData.header.wo_u_finish)}</span>
                          </td>
                        </tr>

                        {/* WO Row */}
                        <tr className="border-b">
                          <td className="px-3 py-2 font-medium">WO No.</td>
                          <td className="px-3 py-2 font-mono">{woData.header.wo_doc_num}</td>
                          <td className="px-3 py-2">
                            <span className="text-gray-500 text-[10px] block">วันที่แผน - เวลา</span>
                            <span>
                              {woData.waRecords && woData.waRecords.length > 0
                                ? formatDateTime(woData.waRecords[0].wa_plan_to_work) || "-"
                                : "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-gray-500 text-[10px] block">วันที่เข้าจริง - เวลา</span>
                            <span>
                              {woData.waRecords && woData.waRecords.length > 0
                                ? formatDateTime(woData.waRecords[0].wa_start_work) || "-"
                                : "-"}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-gray-500 text-[10px] block">วันที่ ปิด WO</span>
                            <span>{formatDate(woData.header.wo_close_date) || "-"}</span>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span className="text-gray-500 text-[10px] block">ระยะรอเข้า</span>
                            <span>
                              {woData.waRecords && woData.waRecords.length > 0
                                ? calculateDuration(woData.waRecords[0].wa_plan_to_work, woData.waRecords[0].wa_start_work)
                                : "-"}
                            </span>
                          </td>
                        </tr>

                        {/* WA Row - show only the latest WA (last one) to match Crystal Report */}
                        {(() => {
                          const latestWA = woData.waRecords && woData.waRecords.length > 0
                            ? woData.waRecords[woData.waRecords.length - 1]
                            : null;
                          return latestWA ? (
                            <tr className="border-b">
                              <td className="px-3 py-2 font-medium">WA No.</td>
                              <td className="px-3 py-2 font-mono">{latestWA.wa_doc_num || "-"}</td>
                              <td className="px-3 py-2">
                                <span className="text-gray-500 text-[10px] block">วันที่เข้าจริง - เวลา</span>
                                <span>{formatDateTime(latestWA.wa_start_work) || "-"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-gray-500 text-[10px] block">วันที่เสร็จจริง - เวลา</span>
                                <span>{formatDateTime(latestWA.wa_finish_date) || "-"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-gray-500 text-[10px] block">วันที่ ปิด WA</span>
                                <span>{formatDate(latestWA.wa_close_date) || "-"}</span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="text-gray-500 text-[10px] block">ระยะเวลางาน</span>
                                <span>{calculateDuration(latestWA.wa_start_work, latestWA.wa_finish_date)}</span>
                              </td>
                            </tr>
                          ) : (
                            <tr className="border-b">
                              <td className="px-3 py-2 font-medium">WA No.</td>
                              <td className="px-3 py-2 text-gray-400" colSpan={5}>- ไม่มีข้อมูล -</td>
                            </tr>
                          );
                        })()}

                        {/* WC Row - show only the latest WC (last one) to match Crystal Report */}
                        {(() => {
                          const latestWC = woData.wcRecords && woData.wcRecords.length > 0
                            ? woData.wcRecords[woData.wcRecords.length - 1]
                            : null;
                          return latestWC ? (
                            <tr className="border-b">
                              <td className="px-3 py-2 font-medium">WC No.</td>
                              <td className="px-3 py-2 font-mono">{latestWC.wc_doc_num || "-"}</td>
                              <td className="px-3 py-2">
                                <span className="text-gray-500 text-[10px] block">วันที่เครื่องจักรหยุด-เวลา</span>
                                <span>{formatDateTime(latestWC.wa_mc_stop) || "-"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-gray-500 text-[10px] block">วันที่เครื่องจักเดิน - เวลา</span>
                                <span>{formatDateTime(latestWC.wa_mc_start) || "-"}</span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-gray-500 text-[10px] block">วันที่ ปิด WC</span>
                                <span>{formatDate(latestWC.wc_close_date) || "-"}</span>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="text-gray-500 text-[10px] block">ระยะเครื่องหยุด</span>
                                <span>{calculateDuration(latestWC.wa_mc_stop, latestWC.wa_mc_start)}</span>
                              </td>
                            </tr>
                          ) : (
                            <tr className="border-b">
                              <td className="px-3 py-2 font-medium">WC No.</td>
                              <td className="px-3 py-2 text-gray-400" colSpan={5}>- ไม่มีข้อมูล -</td>
                            </tr>
                          );
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* Collapsible: แสดงรายการ WA/WC ทั้งหมด */}
                  {((woData.waRecords && woData.waRecords.length > 1) || (woData.wcRecords && woData.wcRecords.length > 1)) && (
                    <div className="mt-3">
                      <button
                        onClick={() => setShowAllRecords(!showAllRecords)}
                        className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 transition"
                      >
                        <svg
                          className={`w-4 h-4 transition-transform ${showAllRecords ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                        <span>
                          {showAllRecords ? 'ซ่อนรายการ WA/WC ทั้งหมด' : 'แสดงรายการ WA/WC ทั้งหมด'}
                          {woData.waRecords && woData.waRecords.length > 1 && ` (WA: ${woData.waRecords.length})`}
                          {woData.wcRecords && woData.wcRecords.length > 1 && ` (WC: ${woData.wcRecords.length})`}
                        </span>
                      </button>

                      {showAllRecords && (
                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs space-y-3">
                          {/* All WA Records */}
                          {woData.waRecords && woData.waRecords.length > 0 && (
                            <div>
                              <p className="font-medium text-gray-700 mb-1">รายการ WA ทั้งหมด ({woData.waRecords.length} รายการ)</p>
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 text-[10px]">
                                    <th className="px-2 py-1 text-left">WA No.</th>
                                    <th className="px-2 py-1 text-left">วันที่เข้าจริง</th>
                                    <th className="px-2 py-1 text-left">วันที่เสร็จจริง</th>
                                    <th className="px-2 py-1 text-left">วันที่ปิด WA</th>
                                    <th className="px-2 py-1 text-right">ระยะเวลางาน</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {woData.waRecords.map((wa: any, idx: number) => (
                                    <tr key={`all-wa-${wa.wa_doc_num || idx}`} className="border-b border-gray-200">
                                      <td className="px-2 py-1 font-mono">{wa.wa_doc_num || "-"}</td>
                                      <td className="px-2 py-1">{formatDateTime(wa.wa_start_work) || "-"}</td>
                                      <td className="px-2 py-1">{formatDateTime(wa.wa_finish_date) || "-"}</td>
                                      <td className="px-2 py-1">{formatDate(wa.wa_close_date) || "-"}</td>
                                      <td className="px-2 py-1 text-right">{calculateDuration(wa.wa_start_work, wa.wa_finish_date)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* All WC Records */}
                          {woData.wcRecords && woData.wcRecords.length > 0 && (
                            <div>
                              <p className="font-medium text-gray-700 mb-1">รายการ WC ทั้งหมด ({woData.wcRecords.length} รายการ)</p>
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 text-[10px]">
                                    <th className="px-2 py-1 text-left">WC No.</th>
                                    <th className="px-2 py-1 text-left">วันที่เครื่องหยุด</th>
                                    <th className="px-2 py-1 text-left">วันที่เครื่องเดิน</th>
                                    <th className="px-2 py-1 text-left">วันที่ปิด WC</th>
                                    <th className="px-2 py-1 text-right">ระยะเครื่องหยุด</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {woData.wcRecords.map((wc: any, idx: number) => (
                                    <tr key={`all-wc-${wc.wc_doc_num || idx}`} className="border-b border-gray-200">
                                      <td className="px-2 py-1 font-mono">{wc.wc_doc_num || "-"}</td>
                                      <td className="px-2 py-1">{formatDateTime(wc.wa_mc_stop) || "-"}</td>
                                      <td className="px-2 py-1">{formatDateTime(wc.wa_mc_start) || "-"}</td>
                                      <td className="px-2 py-1">{formatDate(wc.wc_close_date) || "-"}</td>
                                      <td className="px-2 py-1 text-right">{calculateDuration(wc.wa_mc_stop, wc.wa_mc_start)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ==================== ผู้ดำเนินการ SECTION ==================== */}
                <div className="pb-4">
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <span className="text-gray-500">ผู้ดำเนินการ 1:</span>
                      <span className="ml-2">{woData.header.wo_respond_1 || ""}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ผู้ดำเนินการ 2:</span>
                      <span className="ml-2">{woData.header.wo_respond_2 || ""}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">ผู้ดำเนินการ 3:</span>
                      <span className="ml-2">{woData.header.wo_respond_3 || ""}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">รวม Man-Hour:</span>
                      <span className="ml-2">ชม.</span>
                    </div>
                  </div>
                </div>

                {/* WC Details - ซ่อนไว้เพราะ PDF ไม่มี section นี้ */}

                {/* หมายเหตุ - if exists */}
                {woData.header.wo_note_order && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold text-gray-700 mb-2">หมายเหตุ</h3>
                    <p className="text-gray-800 whitespace-pre-wrap bg-amber-50 p-3 rounded">
                      {woData.header.wo_note_order}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Fragment>
  );
}
