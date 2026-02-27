/**
 * SSO Token Verification/Generation
 * ใช้ JWT signed ด้วย shared secret ระหว่าง App อื่น กับ PR-PO
 */

import jwt from "jsonwebtoken";

export interface SsoPayload {
  sub: string;   // user email
  name: string;  // display name
  iat: number;
  exp: number;
}

function getSecret(): string | undefined {
  return process.env.SSO_SHARED_SECRET;
}

/**
 * Verify SSO JWT token จาก App อื่น
 * Return payload ถ้า valid, null ถ้า invalid/expired
 */
export function verifySsoToken(token: string): SsoPayload | null {
  const secret = getSecret();
  if (!secret) {
    console.error("[SSO] SSO_SHARED_SECRET is not configured");
    return null;
  }

  try {
    return jwt.verify(token, secret) as SsoPayload;
  } catch (error) {
    console.error("[SSO] Token verification failed:", error);
    return null;
  }
}

/**
 * Generate SSO token (สำหรับทดสอบ หรือถ้า PR-PO ต้อง redirect กลับไป App อื่น)
 */
export function generateSsoToken(email: string, name: string): string {
  const secret = getSecret();
  if (!secret) {
    throw new Error("SSO_SHARED_SECRET is not configured");
  }

  return jwt.sign(
    { sub: email, name },
    secret,
    { expiresIn: "60s" }
  );
}
