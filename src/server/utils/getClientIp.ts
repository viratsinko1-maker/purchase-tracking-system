import type { IncomingMessage } from 'http';

/**
 * Extract client IP address from request headers
 * Checks various headers in order of priority
 */
export function getClientIp(req: IncomingMessage): string {
  // Check various headers that might contain the real IP
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    const ips = typeof forwarded === 'string' ? forwarded.split(',') : forwarded;
    const ip = ips[0]?.trim();
    if (ip) return ip;
  }

  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp;
  }

  const cfConnectingIp = req.headers['cf-connecting-ip'];
  if (cfConnectingIp && typeof cfConnectingIp === 'string') {
    return cfConnectingIp;
  }

  // Fallback to socket remote address
  const socketAddress = (req.socket as any)?.remoteAddress;
  if (socketAddress) {
    // Remove IPv6 prefix if present
    return socketAddress.replace(/^::ffff:/, '');
  }

  return 'unknown';
}
