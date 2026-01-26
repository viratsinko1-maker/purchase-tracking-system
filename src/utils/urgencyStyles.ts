/**
 * Urgency level styling utility functions
 */

export type UrgencyLevel = 'ด่วนที่สุด' | 'ด่วน' | 'ปกติ' | 'ปิดแล้ว' | string;

/**
 * Get badge style for urgency level
 */
export const getUrgencyStyle = (level: UrgencyLevel) => {
  switch (level) {
    case 'ด่วนที่สุด':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'ด่วน':
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'ปกติ':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ปิดแล้ว':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Get background style for urgency level (lighter)
 */
export const getUrgencyBgStyle = (level: UrgencyLevel) => {
  switch (level) {
    case 'ด่วนที่สุด':
      return 'bg-red-50 text-red-900';
    case 'ด่วน':
      return 'bg-orange-50 text-orange-900';
    case 'ปกติ':
      return 'bg-blue-50 text-blue-900';
    case 'ปิดแล้ว':
      return 'bg-gray-50 text-gray-900';
    default:
      return 'bg-gray-50 text-gray-900';
  }
};

/**
 * Get border style for urgency level
 */
export const getUrgencyBorderStyle = (level: UrgencyLevel) => {
  switch (level) {
    case 'ด่วนที่สุด':
      return 'border-2 border-red-500';
    case 'ด่วน':
      return 'border-2 border-orange-500';
    case 'ปกติ':
      return 'border-2 border-blue-500';
    case 'ปิดแล้ว':
      return 'border-2 border-black';
    default:
      return '';
  }
};

/**
 * Get urgency color (for charts, icons, etc.)
 */
export const getUrgencyColor = (level: UrgencyLevel) => {
  switch (level) {
    case 'ด่วนที่สุด':
      return '#ef4444'; // red-500
    case 'ด่วน':
      return '#f97316'; // orange-500
    case 'ปกติ':
      return '#3b82f6'; // blue-500
    case 'ปิดแล้ว':
      return '#6b7280'; // gray-500
    default:
      return '#9ca3af'; // gray-400
  }
};
