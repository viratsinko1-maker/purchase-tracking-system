-- สร้าง Materialized View สำหรับข้อมูล PR-PO
-- ใช้เมื่อต้องการ query ที่เร็วกว่าและซับซ้อน

-- ลบ Materialized View เก่า (ถ้ามี)
DROP MATERIALIZED VIEW IF EXISTS pr_po_summary;

-- สร้าง Materialized View ใหม่
CREATE MATERIALIZED VIEW pr_po_summary AS
SELECT
    "prDocEntry",
    "prNo",
    "prDate",
    "prDueDate",
    "seriesName",
    "prRequester",
    "prDepartment",
    "prJobName",
    "prRemarks",
    "prStatus",
    COUNT("poNo") FILTER (WHERE "poNo" IS NOT NULL) as po_count,
    ARRAY_AGG("poNo") FILTER (WHERE "poNo" IS NOT NULL) as po_numbers,
    SUM("poQuantity") as total_quantity,
    MAX("updatedAt") as last_updated
FROM
    "PurchaseRequestPO"
GROUP BY
    "prDocEntry",
    "prNo",
    "prDate",
    "prDueDate",
    "seriesName",
    "prRequester",
    "prDepartment",
    "prJobName",
    "prRemarks",
    "prStatus";

-- สร้าง Index สำหรับ Materialized View
CREATE UNIQUE INDEX ON pr_po_summary ("prDocEntry", "prNo");
CREATE INDEX ON pr_po_summary ("prDate");
CREATE INDEX ON pr_po_summary ("prStatus");

-- คำสั่ง Refresh Materialized View
-- REFRESH MATERIALIZED VIEW pr_po_summary;

-- คำสั่ง Refresh แบบ Concurrent (ไม่ lock table)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY pr_po_summary;
