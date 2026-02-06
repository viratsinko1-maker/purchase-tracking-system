/**
 * Session Cleanup Scheduler
 *
 * ตรวจสอบ active sessions ที่ไม่มี heartbeat มานาน
 * และบันทึก logout ใน audit trail
 *
 * รันทุก 2 นาที ตรวจสอบ session ที่ไม่มี heartbeat มานาน 3 นาที
 */

import { db } from "~/server/db";
import { createAuditLog, AuditAction } from "~/server/api/utils/auditLog";
import { updateKpiUsageSummary } from "~/server/kpi-usage-aggregator";

// Configuration
const CHECK_INTERVAL = 2 * 60 * 1000; // Check every 2 minutes
const SESSION_TIMEOUT = 3 * 60 * 1000; // Consider stale after 3 minutes of no heartbeat

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

async function cleanupStaleSessions() {
  if (isRunning) {
    console.log('[SESSION-CLEANUP] Already running, skipping...');
    return;
  }

  isRunning = true;

  try {
    const cutoffTime = new Date(Date.now() - SESSION_TIMEOUT);

    // Find stale sessions
    const staleSessions = await db.active_session.findMany({
      where: {
        last_heartbeat: {
          lt: cutoffTime,
        },
      },
    });

    if (staleSessions.length === 0) {
      return;
    }

    console.log(`[SESSION-CLEANUP] Found ${staleSessions.length} stale session(s)`);

    // Process each stale session
    for (const session of staleSessions) {
      try {
        const sessionEnd = new Date();
        const sessionStart = session.session_start;
        const durationSeconds = Math.floor((sessionEnd.getTime() - sessionStart.getTime()) / 1000);
        const durationMinutes = durationSeconds / 60;

        // Log session history for usage analytics
        await db.session_history.create({
          data: {
            user_id: session.user_id,
            user_name: session.user_name,
            ip_address: session.ip_address,
            computer_name: session.computer_name,
            session_start: sessionStart,
            session_end: sessionEnd,
            duration_seconds: durationSeconds,
            duration_minutes: durationMinutes,
            logout_type: 'timeout',
          },
        });

        // Update KPI usage summary tables (pre-aggregation)
        await updateKpiUsageSummary({
          userId: session.user_id,
          userName: session.user_name ?? session.user_id,
          sessionEnd,
          durationMinutes,
          logoutType: 'timeout',
        });

        // Log logout in audit trail
        await createAuditLog(db, {
          userId: session.user_id,
          userName: session.user_name ?? undefined,
          action: AuditAction.LOGOUT,
          tableName: "User",
          recordId: session.user_id,
          description: `ออกจากระบบ (หมดเวลา) - ใช้งาน ${Math.round(durationMinutes)} นาที`,
          ipAddress: session.ip_address ?? undefined,
          computerName: session.computer_name ?? undefined,
        });

        // Delete the stale session
        await db.active_session.delete({
          where: { id: session.id },
        });

        console.log(`[SESSION-CLEANUP] Logged out user: ${session.user_name || session.user_id} (duration: ${Math.round(durationMinutes)} min)`);
      } catch (error) {
        console.error(`[SESSION-CLEANUP] Error processing session ${session.id}:`, error);
      }
    }

    console.log(`[SESSION-CLEANUP] Cleanup completed`);
  } catch (error) {
    console.error('[SESSION-CLEANUP] Error during cleanup:', error);
  } finally {
    isRunning = false;
  }
}

export function startSessionCleanupScheduler() {
  if (intervalId) {
    console.log('[SESSION-CLEANUP] Scheduler already running');
    return;
  }

  console.log('[SESSION-CLEANUP] Starting session cleanup scheduler');
  console.log(`[SESSION-CLEANUP] Check interval: ${CHECK_INTERVAL / 1000}s, Session timeout: ${SESSION_TIMEOUT / 1000}s`);

  // Run immediately
  void cleanupStaleSessions();

  // Set up interval
  intervalId = setInterval(() => {
    void cleanupStaleSessions();
  }, CHECK_INTERVAL);
}

export function stopSessionCleanupScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[SESSION-CLEANUP] Scheduler stopped');
  }
}
