import { PrismaClient } from "@prisma/client";

import { env } from "~/env";

const createPrismaClient = () =>
  new PrismaClient({
    log:
      env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
  sessionCleanupInitialized?: boolean;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Initialize session cleanup scheduler (server-side only)
if (typeof window === 'undefined' && !globalForPrisma.sessionCleanupInitialized) {
  globalForPrisma.sessionCleanupInitialized = true;
  // Dynamic import to avoid bundling issues
  void import('./session-cleanup-scheduler').then(({ startSessionCleanupScheduler }) => {
    startSessionCleanupScheduler();
  }).catch((err) => {
    console.error('[DB] Failed to start session cleanup scheduler:', err);
  });
}
