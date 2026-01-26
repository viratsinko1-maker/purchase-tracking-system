/**
 * Telegram Notification Service
 * ส่งการแจ้งเตือนไปยัง Telegram Group เมื่อมีการบันทึกข้อมูล
 */

// Helper function สำหรับ format วันที่เวลา
const formatDateTime = (date: Date | string | null): string => {
  if (!date) return "-";
  return new Date(date).toLocaleString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Helper function สำหรับ format ชื่อ (จาก "นามสกุล, ชื่อ" เป็น "ชื่อ นามสกุล")
const formatName = (name: string | null): string => {
  if (!name) return "-";
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    return parts.length >= 2 ? `${parts[1]} ${parts[0]}` : name;
  }
  return name;
};

// Helper function สำหรับ icon ความเร่งด่วน
const getUrgencyIcon = (level: string): string => {
  switch (level) {
    case 'ด่วนที่สุด':
      return '🔴';
    case 'ด่วน':
      return '🟠';
    case 'ปกติ':
      return '🔵';
    default:
      return '⚪';
  }
};

// Helper function สำหรับ icon สถานะการส่งของ
const getDeliveryStatusIcon = (status: string): string => {
  switch (status) {
    case 'ปกติ':
      return '🟢';
    case 'ไม่ปกติ':
      return '🔴';
    case 'อื่นๆ':
      return '⚪';
    default:
      return '⚪';
  }
};

interface PRTrackingData {
  prNo: number;
  jobName: string | null;
  prRemarks: string | null;
  requesterName: string | null;
  departmentName: string | null;
  urgencyLevel: string;
  trackingNote: string | null;
  trackedBy: string | null;
  trackedAt: Date;
}

interface PRTrackingResponseData extends PRTrackingData {
  responseNote: string;
  respondedBy: string | null;
  respondedAt: Date;
}

interface PODeliveryTrackingData {
  poNo: number;
  docDate: Date | string | null;
  docDueDate: Date | string | null;
  docStatus: string;
  prNumbers: number[] | null;
  deliveryStatus: string;
  note: string | null;
  trackedBy: string | null;
  trackedAt: Date;
}

/**
 * ส่งข้อความไปยัง Telegram
 */
async function sendTelegramMessage(message: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('[Telegram] Bot token or chat ID not configured');
    console.warn('[Telegram] Bot Token:', botToken ? 'SET' : 'NOT SET');
    console.warn('[Telegram] Chat ID:', chatId ? 'SET' : 'NOT SET');
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Telegram] Failed to send message:', error);
    } else {
      console.log('[Telegram] Message sent successfully');
    }
  } catch (error) {
    console.error('[Telegram] Error sending message:', error);
  }
}

/**
 * ส่งข้อความไปยัง Telegram ของ user โดยตรง (ใช้ telegramChatId ของแต่ละคน)
 */
export async function sendTelegramMessageToUser(
  chatId: string,
  message: string
): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn('[Telegram] Bot token not configured');
    return false;
  }

  if (!chatId) {
    console.warn('[Telegram] No chat ID provided');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Telegram] Failed to send message to ${chatId}:`, error);
      return false;
    }

    console.log(`[Telegram] Message sent successfully to user ${chatId}`);
    return true;
  } catch (error) {
    console.error(`[Telegram] Error sending message to ${chatId}:`, error);
    return false;
  }
}

/**
 * ส่งตัวคั่นข้อความ (divider) ไปยัง Telegram
 */
async function sendDivider(): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return;
  }

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: '━━━━━━━━━━━━━━━━━━',
      }),
    });
  } catch (error) {
    console.error('[Telegram] Error sending divider:', error);
  }
}

/**
 * Format message สำหรับการติดตาม PR
 */
function formatPRTrackingMessage(data: PRTrackingData): string {
  const urgencyIcon = getUrgencyIcon(data.urgencyLevel);

  return `📝 <b>การติดตาม PR</b>
PR #${data.prNo}

📋 <b>ข้อมูล PR:</b>
🏗️ โครงการ: ${data.jobName || '-'}
💬 หมายเหตุ: ${data.prRemarks || '-'}
👤 ผู้ขอ PR: ${formatName(data.requesterName)}
🏢 แผนก: ${data.departmentName || '-'}

⚡ <b>การติดตาม:</b>
${urgencyIcon} ความเร่งด่วน: ${data.urgencyLevel}
💬 การติดตาม: ${data.trackingNote || '-'}
👤 ผู้ติดตาม: ${formatName(data.trackedBy)}
🕐 เวลา: ${formatDateTime(data.trackedAt)}`;
}

/**
 * Format message สำหรับการตอบกลับการติดตาม PR
 */
function formatPRTrackingResponseMessage(data: PRTrackingResponseData): string {
  const urgencyIcon = getUrgencyIcon(data.urgencyLevel);

  return `💬 <b>การตอบกลับการติดตาม PR</b>
PR #${data.prNo}

📋 <b>ข้อมูล PR:</b>
🏗️ โครงการ: ${data.jobName || '-'}
💬 หมายเหตุ: ${data.prRemarks || '-'}
👤 ผู้ขอ PR: ${formatName(data.requesterName)}
🏢 แผนก: ${data.departmentName || '-'}

📝 <b>การติดตามเดิม:</b>
${urgencyIcon} ความเร่งด่วน: ${data.urgencyLevel}
💬 การติดตาม: ${data.trackingNote || '-'}
👤 ผู้ติดตาม: ${formatName(data.trackedBy)}
🕐 เวลาติดตาม: ${formatDateTime(data.trackedAt)}

✅ <b>การตอบกลับ:</b>
💬 ตอบกลับ: ${data.responseNote}
👤 ผู้ตอบกลับ: ${formatName(data.respondedBy)}
🕐 เวลาตอบกลับ: ${formatDateTime(data.respondedAt)}`;
}

/**
 * Format message สำหรับสถานะการส่งของ PO
 */
function formatPODeliveryTrackingMessage(data: PODeliveryTrackingData): string {
  const statusIcon = getDeliveryStatusIcon(data.deliveryStatus);
  const prNumbersText = data.prNumbers && data.prNumbers.length > 0
    ? data.prNumbers.join(', ')
    : '-';

  return `📦 <b>สถานะการส่งของ PO</b>
PO #${data.poNo}

📋 <b>ข้อมูล PO:</b>
📅 วันที่สร้าง: ${formatDateTime(data.docDate)}
📅 วันครบกำหนด: ${formatDateTime(data.docDueDate)}
📊 สถานะ PO: ${data.docStatus === 'O' ? 'Open' : 'Closed'}
🔗 จาก PR: ${prNumbersText}

🚦 <b>การติดตามการส่งของ:</b>
${statusIcon} สถานะ: ${data.deliveryStatus}
💬 หมายเหตุ: ${data.note || '-'}
👤 ผู้บันทึก: ${formatName(data.trackedBy)}
🕐 เวลา: ${formatDateTime(data.trackedAt)}`;
}

/**
 * ส่งการแจ้งเตือนการติดตาม PR
 */
export async function notifyPRTracking(data: PRTrackingData): Promise<void> {
  const message = formatPRTrackingMessage(data);
  await sendTelegramMessage(message);
  await sendDivider();
}

/**
 * ส่งการแจ้งเตือนการตอบกลับการติดตาม PR
 */
export async function notifyPRTrackingResponse(data: PRTrackingResponseData): Promise<void> {
  const message = formatPRTrackingResponseMessage(data);
  await sendTelegramMessage(message);
  await sendDivider();
}

/**
 * ส่งการแจ้งเตือนสถานะการส่งของ PO
 */
export async function notifyPODeliveryTracking(data: PODeliveryTrackingData): Promise<void> {
  const message = formatPODeliveryTrackingMessage(data);
  await sendTelegramMessage(message);
  await sendDivider();
}

/**
 * ส่งข้อความแจ้งเตือนแบบกำหนดเอง (สำหรับการอนุมัติเอกสาร)
 */
export async function sendCustomNotification(message: string): Promise<void> {
  await sendTelegramMessage(message);
  await sendDivider();
}

/**
 * Interface สำหรับข้อมูล PR ที่ล่าช้า
 */
interface DelayedPRGroup {
  delay_milestone: number;
  prs: Array<{
    doc_num: number;
    job_name: string | null;
    req_name: string | null;
    delay_days: number;
  }>;
}

/**
 * ส่งการแจ้งเตือน PR ที่ล่าช้า (Daily Report)
 */
export async function notifyDelayedPRs(groupedData: DelayedPRGroup[]): Promise<void> {
  if (!groupedData || groupedData.length === 0) {
    console.log('[Telegram] No delayed PRs to notify');
    return;
  }

  const TELEGRAM_MAX_LENGTH = 4000; // Telegram limit is 4096, use 4000 for safety

  // สร้างข้อความหัว
  const header = '⚠️ <b>รายงาน PR ที่ล่าช้า</b>\n' +
    `📅 วันที่: ${new Date().toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })}\n\n`;

  let currentMessage = header;
  const messages: string[] = [];

  // วนลูปแต่ละกลุ่ม
  groupedData.forEach((group, index) => {
    const milestone = group.delay_milestone;
    const count = group.prs.length;

    // สร้างข้อความสำหรับกลุ่มนี้
    let groupMessage = '';

    // หัวข้อของแต่ละกลุ่ม
    if (milestone === 1) {
      groupMessage += `🔔 <b>PR ที่ล่าช้าครบ 1 วัน</b> (${count} รายการ)\n`;
    } else {
      groupMessage += `🔴 <b>PR ที่ล่าช้าครบ ${milestone} วัน</b> (${count} รายการ)\n`;
    }

    // รายการ PR ในกลุ่ม
    group.prs.forEach((pr) => {
      groupMessage += `PR #${pr.doc_num}`;
      if (pr.job_name) {
        groupMessage += ` - ${pr.job_name}`;
      }
      groupMessage += '\n';
    });

    // ถ้าไม่ใช่กลุ่มสุดท้าย ให้ใส่ขีดคั่น
    if (index < groupedData.length - 1) {
      groupMessage += '\n━━━━━━━━━━━━━━━━━━\n\n';
    }

    // ตรวจสอบว่าถ้าเพิ่มกลุ่มนี้แล้วเกินความยาวสูงสุดหรือไม่
    if (currentMessage.length + groupMessage.length > TELEGRAM_MAX_LENGTH) {
      // บันทึกข้อความปัจจุบัน และเริ่มข้อความใหม่
      messages.push(currentMessage);
      currentMessage = header + groupMessage;
    } else {
      // เพิ่มกลุ่มนี้เข้าไปในข้อความปัจจุบัน
      currentMessage += groupMessage;
    }
  });

  // เพิ่มข้อความสุดท้าย
  if (currentMessage.length > header.length) {
    messages.push(currentMessage);
  }

  // ส่งข้อความทั้งหมด
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg) continue; // Skip if message is undefined

    if (messages.length > 1) {
      // ถ้ามีหลายข้อความ ให้แสดงหมายเลขข้อความ
      const suffix = `\n\n📄 ข้อความที่ ${i + 1}/${messages.length}`;
      await sendTelegramMessage(msg + suffix);
    } else {
      await sendTelegramMessage(msg);
    }

    // รอ 1 วินาทีระหว่างข้อความเพื่อไม่ให้โดน rate limit
    if (i < messages.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  await sendDivider();
  console.log(`[Telegram] Delayed PRs notification sent (${messages.length} message(s))`);
}
