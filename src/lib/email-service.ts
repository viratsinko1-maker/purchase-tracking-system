import nodemailer from 'nodemailer';
import { passwordResetTemplate } from './email-templates';

// Email configuration
const emailConfig = {
  from: {
    name: process.env.EMAIL_FROM_NAME || 'PR/PO Tracking System',
    address: process.env.GMAIL_USER || 'noreply@tmkpalmoil.com',
  },
  baseUrl: process.env.NEXTAUTH_URL || 'http://localhost:2025',
};

// Create Gmail transporter
const createGmailTransporter = () => {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: {
    name: string;
    address: string;
  };
}

class EmailService {
  private _transporter?: nodemailer.Transporter;

  private get transporter() {
    if (!this._transporter) {
      this._transporter = createGmailTransporter();
    }
    return this._transporter;
  }

  private async sendEmail({ to, subject, html, from }: SendEmailOptions) {
    const fromAddress = from || emailConfig.from;

    try {
      const info = await this.transporter.sendMail({
        from: `"${fromAddress.name}" <${fromAddress.address}>`,
        to,
        subject,
        html,
      });

      console.log('[EMAIL] Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('[EMAIL] Email sending failed:', error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendPasswordResetEmail(options: { to: string; userName: string; resetUrl: string }) {
    const { to, userName, resetUrl } = options;

    const html = passwordResetTemplate({
      userName,
      resetUrl,
      companyName: 'PR/PO Tracking System',
    });

    const subject = `รีเซ็ตรหัสผ่าน - PR/PO Tracking System`;

    return this.sendEmail({
      to,
      subject,
      html,
    });
  }

  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('[EMAIL] Gmail SMTP connection verified');
      return { success: true };
    } catch (error) {
      console.error('[EMAIL] Gmail SMTP connection failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const emailService = new EmailService();
export { emailConfig };
