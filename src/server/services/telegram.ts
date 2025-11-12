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
