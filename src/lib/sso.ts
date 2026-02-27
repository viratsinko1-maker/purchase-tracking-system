/**
 * SSO Token Verification/Generation
 * ใช้ JWT signed ด้วย shared secret ระหว่าง App อื่น กับ PR-PO
 */

import jwt from "jsonwebtoken";

const SSO_SHARED_SECRET = process.env.SSO_SHARED_SECRET;

export interface SsoPayload {
  sub: string;   // user email
  name: string;  // display name
  iat: number;
  exp: number;
}

/**
 * Verify SSO JWT token จาก App อื่น
 * Return payload ถ้า valid, null ถ้า invalid/expired
 */
export function verifySsoToken(token: string): SsoPayload | null {
  if (!SSO_SHARED_SECRET) {
    console.error("[SSO] SSO_SHARED_SECRET is not configured");
    return null;
  }

  try {
    return jwt.verify(token, SSO_SHARED_SECRET) as SsoPayload;
  } catch (error) {
    console.error("[SSO] Token verification failed:", error);
    return null;
  }
}

/**
 * Generate SSO token (สำหรับทดสอบ หรือถ้า PR-PO ต้อง redirect กลับไป App อื่น)
 */
export function generateSsoToken(email: string, name: string): string {
  if (!SSO_SHARED_SECRET) {
    throw new Error("SSO_SHARED_SECRET is not configured");
  }

  return jwt.sign(
    { sub: email, name },
    SSO_SHARED_SECRET,
    { expiresIn: "60s" }
  );
}
