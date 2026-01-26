/**
 * Date utility functions
 */

/**
 * Get default date range (current month)
 */
export const getDefaultDateRange = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    from: firstDay.toISOString().split('T')[0]!,
    to: lastDay.toISOString().split('T')[0]!,
  };
};

/**
 * Get date 12 months ago
 */
export const getDate12MonthsAgo = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  return date.toISOString().split('T')[0]!;
};

/**
 * Format date to Thai locale string
 */
export const formatThaiDate = (date: Date | string | null, options?: Intl.DateTimeFormatOptions) => {
  if (!date) return "-";
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', options ?? {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

/**
 * Format datetime to Thai locale string
 */
export const formatThaiDateTime = (date: Date | string | null) => {
  if (!date) return "-";
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Calculate days between two dates
 */
export const calculateDaysBetween = (startDate: Date | string, endDate: Date | string = new Date()) => {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Get today's date range (from and to are the same - today)
 */
export const getTodayDateRange = () => {
  const today = new Date().toISOString().split('T')[0]!;
  return {
    from: today,
    to: today,
  };
};

/**
 * Get empty date range (no default filter)
 */
export const getEmptyDateRange = () => {
  return {
    from: '',
    to: '',
  };
};
