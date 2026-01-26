/**
 * Delivery status styling utility functions
 */

export type DeliveryStatus = 'ปกติ' | 'ไม่ปกติ' | 'อื่นๆ' | string;

/**
 * Get badge style for delivery status
 */
export const getDeliveryStatusStyle = (status: DeliveryStatus) => {
  switch (status) {
    case 'ปกติ':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'ไม่ปกติ':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'อื่นๆ':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Get background style for delivery status (lighter)
 */
export const getDeliveryBgStyle = (status: DeliveryStatus) => {
  switch (status) {
    case 'ปกติ':
      return 'bg-green-50 text-green-900';
    case 'ไม่ปกติ':
      return 'bg-red-50 text-red-900';
    case 'อื่นๆ':
      return 'bg-gray-50 text-gray-900';
    default:
      return 'bg-gray-50 text-gray-900';
  }
};

/**
 * Get border style for delivery status
 */
export const getDeliveryBorderStyle = (status: DeliveryStatus) => {
  switch (status) {
    case 'ปกติ':
      return 'border-2 border-green-500';
    case 'ไม่ปกติ':
      return 'border-2 border-red-500';
    case 'อื่นๆ':
      return 'border-2 border-gray-500';
    default:
      return '';
  }
};

/**
 * Get delivery color (for charts, icons, etc.)
 */
export const getDeliveryColor = (status: DeliveryStatus) => {
  switch (status) {
    case 'ปกติ':
      return '#22c55e'; // green-500
    case 'ไม่ปกติ':
      return '#ef4444'; // red-500
    case 'อื่นๆ':
      return '#6b7280'; // gray-500
    default:
      return '#9ca3af'; // gray-400
  }
};
