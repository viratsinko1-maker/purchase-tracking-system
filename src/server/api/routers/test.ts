import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";

/**
 * Test Router สำหรับทดสอบ Telegram
 */
export const testRouter = createTRPCRouter({
  // ทดสอบส่งข้อความ Hello World ไป Telegram
  sendHelloWorld: publicProcedure.mutation(async () => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      throw new Error('Telegram configuration not found in environment variables');
    }

    try {
      const message = `🎉 Hello World from PR/PO Tracking System!

This is a test message to verify Telegram integration.

✅ Bot Token: Configured
✅ Chat ID: Configured
✅ Connection: Success

เวลา: ${new Date().toLocaleString('th-TH', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`;

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
        console.error('[Test] Telegram API Error:', error);
        throw new Error(`Telegram API Error: ${error}`);
      }

      const result = await response.json();
      console.log('[Test] Message sent successfully:', result);

      return {
        success: true,
        message: 'Hello World sent to Telegram successfully!',
        telegramResponse: result,
      };
    } catch (error: any) {
      console.error('[Test] Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }),
});
