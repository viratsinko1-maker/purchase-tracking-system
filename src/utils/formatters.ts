/**
 * Text formatting utility functions
 */

/**
 * Format name from "Lastname, Firstname" to "Firstname Lastname"
 */
export const formatName = (name: string | null) => {
  if (!name) return "-";
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
  }
  return name;
};

/**
 * Get first name only (remove lastname)
 */
export const getFirstName = (name: string | null) => {
  if (!name) return "-";
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    return parts.length >= 2 ? parts[1]! : name;
  }
  // If no comma, get first word
  const words = name.trim().split(/\s+/);
  return words[0] || name;
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (value: number | null | undefined, decimals = 0) => {
  if (value == null) return "-";
  return value.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Format currency (Thai Baht)
 */
export const formatCurrency = (value: number | null | undefined) => {
  if (value == null) return "-";
  return value.toLocaleString('th-TH', {
    style: 'currency',
    currency: 'THB',
  });
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string | null, maxLength: number) => {
  if (!text) return "-";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
};
