/**
 * Date Utilities for KPI and other routers
 * Centralized date manipulation functions
 */

/**
 * แปลง พ.ศ. + Quarter เป็น date range
 * @param year - ปี พ.ศ. (เช่น 2569)
 * @param quarter - ไตรมาส 1-4 (null = ทั้งปี)
 * @returns { dateFrom, dateTo } หรือ {} ถ้าไม่ระบุ year
 */
export function getDateRangeFromYearQuarter(
  year?: number,
  quarter?: number
): { dateFrom?: Date; dateTo?: Date } {
  if (!year) return {};

  const gregorianYear = year - 543; // แปลง พ.ศ. เป็น ค.ศ.

  if (quarter) {
    // Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
    const startMonth = (quarter - 1) * 3; // 0, 3, 6, 9
    return {
      dateFrom: new Date(gregorianYear, startMonth, 1),
      dateTo: new Date(gregorianYear, startMonth + 3, 0, 23, 59, 59), // Last day of quarter
    };
  }

  // Full year
  return {
    dateFrom: new Date(gregorianYear, 0, 1),
    dateTo: new Date(gregorianYear, 11, 31, 23, 59, 59),
  };
}

/**
 * สร้าง Prisma date filter object
 * @param dateFrom - วันที่เริ่มต้น
 * @param dateTo - วันที่สิ้นสุด
 * @param fieldName - ชื่อ field (default: 'created_at')
 * @returns Prisma where clause หรือ {} ถ้าไม่มี date
 */
export function buildDateFilter(
  dateFrom?: Date,
  dateTo?: Date,
  fieldName: string = 'created_at'
): Record<string, any> {
  if (!dateFrom && !dateTo) return {};

  const filter: Record<string, Date> = {};
  if (dateFrom) filter.gte = dateFrom;
  if (dateTo) filter.lte = dateTo;

  return { [fieldName]: filter };
}

/**
 * คำนวณ On-time Rate
 * @param onTimeCount - จำนวนที่ตรงเวลา
 * @param lateCount - จำนวนที่เกินเวลา
 * @returns เปอร์เซ็นต์ (0-100) หรือ null ถ้าไม่มีข้อมูล
 */
export function calculateOnTimeRate(
  onTimeCount: number,
  lateCount: number
): number | null {
  const total = onTimeCount + lateCount;
  return total > 0 ? Math.round((onTimeCount / total) * 100) : null;
}

/**
 * สร้าง date filter สำหรับ dateFrom/dateTo parameters (legacy support)
 * @param dateFrom - วันที่เริ่มต้น
 * @param dateTo - วันที่สิ้นสุด
 * @returns { gte?, lte? } หรือ undefined
 */
export function buildLegacyDateFilter(
  dateFrom?: Date,
  dateTo?: Date
): { gte?: Date; lte?: Date } | undefined {
  if (!dateFrom && !dateTo) return undefined;

  const filter: { gte?: Date; lte?: Date } = {};
  if (dateFrom) filter.gte = dateFrom;
  if (dateTo) filter.lte = dateTo;

  return filter;
}
