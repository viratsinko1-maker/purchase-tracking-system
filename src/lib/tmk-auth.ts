/**
 * TMK_PDPJ01 Direct Authentication Helper
 * ใช้ connect ตรงไปยัง TMK_PDPJ01 database สำหรับ authenticate user
 * แทนที่การ sync user มาเก็บใน user_production
 */

import pg from "pg";
import bcrypt from "bcrypt";

const { Client } = pg;

// TMK_PDPJ01 database connection (same config as users-production.ts)
function getTmkClient() {
  return new Client({
    host: "192.168.1.3",
    port: 5432,
    database: "TMK_PDPJ01",
    user: "sa",
    password: "@12345",
  });
}

export interface TmkUser {
  id: string;
  name: string;
  email: string;
  password: string | null;
  isActive: boolean;
}

/**
 * Authenticate user against TMK_PDPJ01 "User" table
 * ใช้สำหรับ login ตรง (กรอก email + password)
 */
export async function authenticateWithTmk(
  identifier: string,
  password: string
): Promise<TmkUser | null> {
  const client = getTmkClient();
  try {
    await client.connect();

    const result = await client.query(
      `SELECT id, name, email, password, "isActive"
       FROM "User"
       WHERE (LOWER(email) = LOWER($1) OR LOWER(name) = LOWER($1))
         AND "isActive" = true
       LIMIT 1`,
      [identifier]
    );

    const tmkUser = result.rows[0] as TmkUser | undefined;
    if (!tmkUser?.password) return null;

    const isValid = await bcrypt.compare(password, tmkUser.password);
    return isValid ? tmkUser : null;
  } finally {
    await client.end();
  }
}

/**
 * Find TMK user by email (no password check)
 * ใช้สำหรับ SSO — verify ว่า user มีอยู่จริงใน TMK
 */
export async function findTmkUserByEmail(email: string): Promise<TmkUser | null> {
  const client = getTmkClient();
  try {
    await client.connect();

    const result = await client.query(
      `SELECT id, name, email, password, "isActive"
       FROM "User"
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    return (result.rows[0] as TmkUser | undefined) ?? null;
  } finally {
    await client.end();
  }
}

/**
 * Fetch all active TMK users
 * ใช้สำหรับ admin role management page — แสดง dropdown เลือก user
 */
export async function fetchAllTmkUsers(): Promise<TmkUser[]> {
  const client = getTmkClient();
  try {
    await client.connect();

    const result = await client.query(
      `SELECT id, name, email, password, "isActive"
       FROM "User"
       WHERE email IS NOT NULL
         AND email != ''
         AND "isActive" = true
       ORDER BY name ASC`
    );

    return result.rows as TmkUser[];
  } finally {
    await client.end();
  }
}
