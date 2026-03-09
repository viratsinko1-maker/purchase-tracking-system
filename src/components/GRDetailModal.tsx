import { useState } from "react";
import PRDetailModal from "~/components/PRDetailModal";
import PODetailModal from "~/components/PODetailModal";
import { api } from "~/utils/api";

// ==================== Types ====================
export interface GrpoItem {
  id: number;
  item_code: string | null;
  description: string | null;
  quantity: string | number | null;
  unit_msr: string | null;
  price_before_disc: string | number | null;
  line_total: string | number | null;
  ocr_code: string | null;
  ocr_code2: string | null;
  ocr_code4: string | null;
  free_txt: string | null;
  po_doc_num: number | null;
  pr_base_ref: string | null;
}

export interface GrpoGroup {
  grpo_doc_num: string;
  doc_date: string | Date | null;
  user_name: string | null;
  card_code: string | null;
  card_name: string | null;
  item_count: number;
  total_amount: number;
  po_numbers: number[];
  pr_numbers: string[];
  items: GrpoItem[];
}

// ==================== Helpers ====================
function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatNumber(n: string | number | null | undefined): string {
  if (n == null) return "-";
  return Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==================== GR Detail Modal (by group data) ====================
export default function GRDetailModal({
  group,
  isOpen,
  onClose,
}: {
  group: GrpoGroup;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [selectedPrNo, setSelectedPrNo] = useState<number | null>(null);
  const [selectedPoNo, setSelectedPoNo] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="relative w-[95vw] max-h-[95vh] overflow-hidden rounded-lg bg-gray-50 shadow-2xl lg:w-[80vw]">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-gradient-to-r from-teal-600 to-teal-700 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">{group.grpo_doc_num}</h2>
                <p className="text-sm text-teal-100">
                  {formatDate(group.doc_date)} | {group.user_name ?? "-"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-white hover:bg-teal-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto p-6" style={{ maxHeight: "calc(95vh - 80px)" }}>
            {/* Supplier Info */}
            <div className="mb-4 rounded-lg bg-white p-4 shadow">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-500">Supplier :</span>{" "}
                <span className="font-bold text-gray-900">{group.card_name}</span>
                {group.card_code && (
                  <span className="text-gray-500"> | Code: {group.card_code}</span>
                )}
              </p>
            </div>

            {/* PO / PR Links */}
            <div className="mb-4 flex flex-wrap gap-2">
              {group.po_numbers.map((po) => (
                <button
                  key={po}
                  onClick={() => setSelectedPoNo(po)}
                  className="cursor-pointer inline-block rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200 transition"
                >
                  PO #{po}
                </button>
              ))}
              {group.pr_numbers.map((pr) => (
                <button
                  key={pr}
                  onClick={() => setSelectedPrNo(parseInt(pr))}
                  className="cursor-pointer inline-block rounded bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-200 transition"
                >
                  PR #{pr}
                </button>
              ))}
            </div>

            {/* Items Table */}
            <div className="rounded-lg bg-white shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">#</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">PO</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">PR</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">รหัสสินค้า</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">รายการ</th>
                    <th className="px-3 py-2 text-right font-medium text-gray-500">จำนวน</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">หน่วย</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Factory</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Dept</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">Machine</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-500">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.items.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                      <td className="px-3 py-2 text-xs">
                        {item.po_doc_num ? (
                          <button
                            onClick={() => setSelectedPoNo(item.po_doc_num!)}
                            className="cursor-pointer text-blue-600 hover:underline"
                          >
                            {item.po_doc_num}
                          </button>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {item.pr_base_ref ? (
                          <button
                            onClick={() => setSelectedPrNo(parseInt(item.pr_base_ref!))}
                            className="cursor-pointer text-purple-600 hover:underline"
                          >
                            {item.pr_base_ref}
                          </button>
                        ) : "-"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{item.item_code ?? "-"}</td>
                      <td className="px-3 py-2">{item.description ?? "-"}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(item.quantity)}</td>
                      <td className="px-3 py-2">{item.unit_msr ?? "-"}</td>
                      <td className="px-3 py-2 text-xs">{item.ocr_code ?? "-"}</td>
                      <td className="px-3 py-2 text-xs">{item.ocr_code2 ?? "-"}</td>
                      <td className="px-3 py-2 text-xs">{item.ocr_code4 ?? "-"}</td>
                      <td className="px-3 py-2 text-xs text-gray-500">{item.free_txt ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-right font-bold">รวมทั้งหมด</td>
                    <td className="px-3 py-2 font-bold text-teal-700">{group.item_count} รายการ</td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Nested PR Detail Modal */}
      {selectedPrNo && (
        <PRDetailModal
          prNo={selectedPrNo}
          isOpen={!!selectedPrNo}
          onClose={() => setSelectedPrNo(null)}
          hideTrackingButtons
        />
      )}

      {/* Nested PO Detail Modal */}
      {selectedPoNo && (
        <PODetailModal
          poNo={selectedPoNo}
          isOpen={!!selectedPoNo}
          onClose={() => setSelectedPoNo(null)}
          hideTrackingButtons
        />
      )}
    </>
  );
}

// ==================== Wrapper: fetch by doc_num ====================
export function GRDetailModalByDocNum({
  grpoDocNum,
  isOpen,
  onClose,
}: {
  grpoDocNum: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: group, isLoading } = api.grpo.getByDocNum.useQuery(
    { docNum: grpoDocNum },
    { enabled: isOpen && !!grpoDocNum }
  );

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="rounded-lg bg-white p-8 shadow-xl">
          <div className="animate-spin h-8 w-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-3 text-sm text-gray-500">กำลังโหลดข้อมูล GR...</p>
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="rounded-lg bg-white p-8 shadow-xl">
          <p className="text-sm text-gray-500">ไม่พบข้อมูล GR: {grpoDocNum}</p>
          <button onClick={onClose} className="mt-3 rounded bg-gray-200 px-4 py-2 text-sm hover:bg-gray-300">ปิด</button>
        </div>
      </div>
    );
  }

  return <GRDetailModal group={group} isOpen={isOpen} onClose={onClose} />;
}
