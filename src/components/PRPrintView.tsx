/**
 * PRPrintView - Print layout component ตามฟอร์ม F-SPP-01 Rev.07
 * แต่ละหน้ามี Header + Items + Footer (Approval Section) ครบ
 */

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

interface PRPrintViewProps {
  prData: PRData;
  documentReceipt: DocumentReceipt | null;
}

export default function PRPrintView({ prData, documentReceipt }: PRPrintViewProps) {
  // Format date to dd.mm.yyyy
  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // Format datetime to Thai locale (date only)
  const formatDateThai = (date: Date | string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Format time (HH:mm)
  const formatTime = (date: Date | string | null) => {
    if (!date) return "";
    const d = new Date(date);
    return d.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format name (convert "Last, First" to "First Last")
  const formatName = (name: string | null) => {
    if (!name) return "";
    if (name.includes(',')) {
      const parts = name.split(',').map(p => p.trim());
      return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
    }
    return name;
  };

  // Format number
  const formatNumber = (num: number | null | string) => {
    if (num === null || num === undefined) return "-";
    return Number(num).toLocaleString("th-TH");
  };

  // Get primary OCR code2 from first line
  const primaryOcrCode2 = prData.lines?.[0]?.ocr_code2 || "-";

  // Get WO numbers - แสดงเป็น comma-separated (เอาเฉพาะตัวเลข ไม่ใส่ WO- prefix)
  const woNumber = prData.wo_numbers && prData.wo_numbers.length > 0
    ? prData.wo_numbers.join(", ")
    : "-";

  // Pagination
  const ITEMS_PER_PAGE = 12;
  const lines = prData.lines || [];
  const totalPages = Math.ceil(lines.length / ITEMS_PER_PAGE) || 1;

  // Header Component (reusable)
  const PageHeader = ({ pageNum, totalPages }: { pageNum: number; totalPages: number }) => {
    // Get current datetime for print
    const printDateTime = new Date().toLocaleString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <>
        {/* Header - Logo left, Company info next to it */}
        <div className="flex justify-between items-start mb-2 pt-1">
          {/* Left side - Logo and Company Info in row */}
          <div className="flex items-start">
            {/* Logo - height matches company info */}
            <img
              src="/logo-tmk.png"
              alt="TMK Group Logo"
              className="h-[50px] w-auto flex-shrink-0"
            />
            {/* Spacer */}
            <div className="w-[20px]"></div>
            {/* Company info */}
            <div className="text-[10px] leading-tight">
              <p className="font-bold text-xs">บริษัท ทองมงคลอุตสาหกรรมน้ำมันปาล์ม จำกัด (สำนักงานใหญ่)</p>
              <p>เลขที่ 21 ม.3 ต.ทองมงคล อ.บางสะพาน จ.ประจวบคีรีขันธ์ 77230</p>
              <p>โทร 032-818-567, 032-906-163 (อัตโนมัติ) Email: Contact@tmkpalmoil.com</p>
              <p>เลขประจำตัวผู้เสียภาษี 077555500197</p>
            </div>
          </div>

          {/* Right side - Print datetime and page number */}
          <div className="text-right text-[8px] flex-shrink-0">
            <p>พิมพ์: {printDateTime}</p>
            {totalPages > 1 && <p>หน้า {pageNum}/{totalPages}</p>}
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-2">
          <h1 className="text-base font-bold">ใบขออนุมัติซื้อ / Purchase Request</h1>
        </div>

        {/* 2-Column Layout: Requester Info (Left) + PR Info Box (Right) */}
        <div className="flex justify-between items-start mb-2">
          {/* Left Column - Requester & Department Info */}
          <div className="text-[10px]">
            <p><span className="font-semibold">ผู้ขอซื้อ:</span> {formatName(prData.req_name) || "-"}</p>
            <p><span className="font-semibold">แผนกต้นสังกัด:</span> {prData.department || "-"}</p>
            <p><span className="font-semibold">แผนกค่าใช้จ่าย:</span> {primaryOcrCode2}</p>
            <p><span className="font-semibold">เพื่อใช้:</span> {prData.job_name || "-"}</p>
            <p><span className="font-semibold">โครงการ:</span> {prData.project_name || "-"} <span className="font-semibold ml-2">เลขโครงการ:</span> {prData.project_code || "-"}</p>
          </div>

          {/* Right Column - PR Info Box */}
          <div className="border border-black p-1 text-[10px]">
            <table className="border-collapse">
              <tbody>
                <tr>
                  <td className="pr-2 py-0">เลขที่ PR</td>
                  <td className="font-bold">: PR{prData.doc_num}</td>
                </tr>
                <tr>
                  <td className="pr-2 py-0">วันที่เปิด PR</td>
                  <td>: {formatDate(prData.date)}</td>
                </tr>
                <tr>
                  <td className="pr-2 py-0">วันที่ต้องการ</td>
                  <td>: {formatDate(prData.due_date)}</td>
                </tr>
                <tr>
                  <td className="pr-2 py-0">เลข WO</td>
                  <td>: {woNumber}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </>
    );
  };

  // Items Table Component
  const ItemsTable = ({ items, startIndex }: { items: PRLine[]; startIndex: number }) => (
    <table className="w-full border-collapse text-[9px]">
      <thead>
        <tr className="bg-gray-100">
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-8">ลำดับ</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-20">รหัสสินค้า</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-left">รายการ</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-12">จำนวน</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-12">หน่วย</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-12">แผนก</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-14">เครื่องจักร</th>
          <th className="border-[0.5px] border-black px-1 py-0.5 text-center w-24">โครงการ</th>
        </tr>
      </thead>
      <tbody>
        {items.map((line, index) => (
          <tr key={line.line_num}>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">{startIndex + index + 1}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center text-[8px]">{line.item_code || "-"}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-[8px]">{line.description || "-"}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">{formatNumber(line.quantity)}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">{line.unit_msr || "-"}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">{line.ocr_code2 || "-"}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">{line.ocr_code4 || "-"}</td>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">{line.project || "-"}</td>
          </tr>
        ))}
        {/* Empty rows if less than 3 items */}
        {items.length < 3 && Array.from({ length: 3 - items.length }).map((_, i) => (
          <tr key={`empty-${i}`}>
            <td className="border-[0.5px] border-black px-1 py-0.5 text-center">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
            <td className="border-[0.5px] border-black px-1 py-0.5">&nbsp;</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // Footer Component (Approval Section only)
  const PageFooter = () => (
    <>
      {/* Approval Signatures */}
      <div className="flex justify-between text-[8px] text-black mt-auto pt-2">
        {/* Requester */}
        <div className="flex-1 text-center mx-0.5">
          <div className="font-semibold mb-1">ผู้ขอซื้อ</div>
          {documentReceipt?.requester_approval_by ? (
            <div>
              <div>{formatName(documentReceipt.requester_approval_by)}</div>
              <div>{formatDateThai(documentReceipt.requester_approval_at)} {formatTime(documentReceipt.requester_approval_at)}</div>
            </div>
          ) : (
            <div className="h-6">-</div>
          )}
        </div>

        {/* Line Approver */}
        <div className="flex-1 text-center mx-0.5">
          <div className="font-semibold mb-1">ผู้อนุมัติตามสายงาน</div>
          {documentReceipt?.line_approval_by ? (
            <div>
              <div>{formatName(documentReceipt.line_approval_by)}</div>
              <div>{formatDateThai(documentReceipt.line_approval_at)} {formatTime(documentReceipt.line_approval_at)}</div>
            </div>
          ) : (
            <div className="h-6">-</div>
          )}
        </div>

        {/* Cost Center Approver */}
        <div className="flex-1 text-center mx-0.5">
          <div className="font-semibold mb-1">ผู้อนุมัติตาม Cost Center</div>
          {documentReceipt?.cost_center_approval_by ? (
            <div>
              <div>{formatName(documentReceipt.cost_center_approval_by)}</div>
              <div>{formatDateThai(documentReceipt.cost_center_approval_at)} {formatTime(documentReceipt.cost_center_approval_at)}</div>
            </div>
          ) : (
            <div className="h-6">-</div>
          )}
        </div>

        {/* Procurement */}
        <div className="flex-1 text-center mx-0.5">
          <div className="font-semibold mb-1">งานจัดซื้อพัสดุ</div>
          {documentReceipt?.procurement_approval_by ? (
            <div>
              <div>{formatName(documentReceipt.procurement_approval_by)}</div>
              <div>{formatDateThai(documentReceipt.procurement_approval_at)} {formatTime(documentReceipt.procurement_approval_at)}</div>
            </div>
          ) : (
            <div className="h-6">-</div>
          )}
        </div>

        {/* VP-C */}
        <div className="flex-1 text-center mx-0.5">
          <div className="font-semibold mb-1">VP-C</div>
          {documentReceipt?.vpc_approval_by ? (
            <div>
              <div>{formatName(documentReceipt.vpc_approval_by)}</div>
              <div>{formatDateThai(documentReceipt.vpc_approval_at)} {formatTime(documentReceipt.vpc_approval_at)}</div>
            </div>
          ) : (
            <div className="h-6">-</div>
          )}
        </div>
      </div>
    </>
  );

  // Render pages
  return (
    <>
      {Array.from({ length: totalPages }).map((_, pageIndex) => {
        const startIndex = pageIndex * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, lines.length);
        const pageItems = lines.slice(startIndex, endIndex);
        const isLastPage = pageIndex === totalPages - 1;

        return (
          <div
            key={pageIndex}
            className={`pr-print-page ${!isLastPage ? 'page-break-after' : ''}`}
          >
            {/* Watermark */}
            <div className="pr-print-watermark"></div>

            {/* Header */}
            <PageHeader pageNum={pageIndex + 1} totalPages={totalPages} />

            {/* Items Table with Remarks */}
            <div className="mb-2 flex-grow">
              <ItemsTable items={pageItems} startIndex={startIndex} />
              {/* Remarks - only on last page, inside table container */}
              {isLastPage && (
                <div className="text-[9px] mt-1">
                  <p><span className="font-semibold">หมายเหตุ:</span> {prData.remarks || "-"}</p>
                </div>
              )}
            </div>

            {/* Footer - Approval Section */}
            <PageFooter />
          </div>
        );
      })}
    </>
  );
}
