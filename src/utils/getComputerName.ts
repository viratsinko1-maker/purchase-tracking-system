/**
 * Get computer/hostname from browser
 * Note: Browser cannot access actual computer name for security reasons
 * This returns a combination of browser info and user agent
 */
export function getComputerName(): string {
  if (typeof window === 'undefined') return 'server';

  try {
    // Try to get from localStorage (user can set it manually)
    const saved = localStorage.getItem('computerName');
    if (saved) return saved;

    // Generate a name from browser info
    const platform = navigator.platform || 'Unknown';
    const browserName = getBrowserName();

    // Create a simple identifier
    return `${browserName}-${platform}`;
  } catch (error) {
    return 'Unknown';
  }
}

function getBrowserName(): string {
  const ua = navigator.userAgent;

  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';

  return 'Browser';
}

/**
 * Set custom computer name (stored in localStorage)
 */
export function setComputerName(name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('computerName', name);
}
