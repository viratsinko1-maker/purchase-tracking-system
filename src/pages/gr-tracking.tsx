import { useState } from "react";
import Head from "next/head";
import { api } from "~/utils/api";
import GRDetailModal, { type GrpoGroup } from "~/components/GRDetailModal";

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

// ==================== GR Card ====================
function GRCard({
  group,
  onClick,
}: {
  group: GrpoGroup;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg bg-white p-4 shadow transition hover:shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-teal-700">{group.grpo_doc_num}</h3>
        <span className="text-xs text-gray-400">{formatDate(group.doc_date)}</span>
      </div>

      {/* Supplier */}
      <p className="mt-1 text-sm text-gray-700 truncate">
        <span className="font-medium text-gray-800">{group.card_name}</span>
        {group.card_code && <span className="text-xs text-gray-400"> | {group.card_code}</span>}
      </p>

      {/* User + Item count */}
      <p className="mt-1 text-xs text-gray-500">
        {group.user_name ?? "-"}
        <span className="ml-2 text-gray-400">({group.item_count} รายการ)</span>
      </p>

      {/* PO / PR badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        {group.po_numbers.map((po) => (
          <span key={po} className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-600">
            PO {po}
          </span>
        ))}
        {group.pr_numbers.map((pr) => (
          <span key={pr} className="rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
            PR {pr}
          </span>
        ))}
      </div>
    </div>
  );
}

// ==================== Main Page ====================
function getDefaultDates() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0]!,
    to: now.toISOString().split("T")[0]!,
  };
}

function GRTrackingContent() {
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<GrpoGroup | null>(null);

  const { data, isLoading, refetch } = api.grpo.getAllGrouped.useQuery({
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const syncMutation = api.grpo.sync.useMutation({
    onSuccess: () => {
      void refetch();
    },
  });

  const handleReset = () => {
    const d = getDefaultDates();
    setDateFrom(d.from);
    setDateTo(d.to);
    setSearch("");
  };

  const setThisMonth = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateFrom(firstDay.toISOString().split("T")[0]!);
    setDateTo(now.toISOString().split("T")[0]!);
  };

  const groups = data ?? [];

  return (
    <>
      <Head>
        <title>GR Tracking</title>
      </Head>
      <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
        {/* Title */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">GR Tracking</h1>
            <p className="text-sm text-gray-500">ใบรับสินค้า (Goods Receipt PO)</p>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? "Syncing..." : "Sync จาก SAP"}
          </button>
        </div>

        {/* Sync result */}
        {syncMutation.isSuccess && syncMutation.data && (
          <div className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            Sync สำเร็จ: {syncMutation.data.records} records ({syncMutation.data.duration_seconds.toFixed(1)}s)
          </div>
        )}
        {syncMutation.isError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            Sync ผิดพลาด: {syncMutation.error.message}
          </div>
        )}

        {/* Filter Section */}
        <div className="sticky top-0 z-10 mb-4 rounded-lg bg-white p-4 shadow">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500">วันที่เริ่ม</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={setThisMonth}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              เดือนนี้
            </button>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500">ค้นหา</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="เลข GRPO, Supplier, สินค้า, PO, PR..."
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-1 text-sm"
              />
            </div>
            <button
              onClick={handleReset}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
            >
              ล้าง
            </button>
          </div>
          {/* Summary */}
          <div className="mt-2 text-xs text-gray-400">
            {isLoading ? "กำลังโหลด..." : `${groups.length} รายการ GRPO`}
          </div>
        </div>

        {/* Cards Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-600"></div>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-400">ไม่พบข้อมูล GRPO</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => (
              <GRCard
                key={group.grpo_doc_num}
                group={group}
                onClick={() => setSelectedGroup(group)}
              />
            ))}
          </div>
        )}

        {/* Detail Modal */}
        {selectedGroup && (
          <GRDetailModal
            group={selectedGroup}
            isOpen={!!selectedGroup}
            onClose={() => setSelectedGroup(null)}
          />
        )}
      </div>
    </>
  );
}

export default function GRTracking() {
  return <GRTrackingContent />;
}
