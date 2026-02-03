export interface PasswordResetTemplateProps {
  userName: string;
  resetUrl: string;
  companyName?: string;
}

export const passwordResetTemplate = ({
  resetUrl,
  userName,
  companyName = 'PR/PO Tracking System',
}: PasswordResetTemplateProps) => `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>รีเซ็ตรหัสผ่าน - ${companyName}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%);
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      color: white;
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 18px;
      color: #1f2937;
      margin-bottom: 20px;
      font-weight: 500;
    }
    .message {
      color: #4b5563;
      margin-bottom: 30px;
      font-size: 16px;
    }
    .cta-container {
      text-align: center;
      margin: 35px 0;
    }
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #4F46E5 0%, #3730A3 100%);
      color: white;
      padding: 15px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
    }
    .warning {
      background-color: #fef3c7;
      border: 1px solid #f59e0b;
      border-radius: 6px;
      padding: 15px;
      margin: 25px 0;
    }
    .warning-text {
      color: #92400e;
      font-weight: 500;
      font-size: 14px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 25px 30px;
      border-top: 1px solid #e5e7eb;
    }
    .footer-text {
      color: #6b7280;
      font-size: 12px;
      line-height: 1.5;
      margin: 0;
    }
    .divider {
      height: 1px;
      background: linear-gradient(to right, transparent, #e5e7eb, transparent);
      margin: 25px 0;
    }
    @media only screen and (max-width: 600px) {
      .container {
        margin: 10px;
        border-radius: 4px;
      }
      .header, .content, .footer {
        padding: 20px;
      }
      .cta-button {
        padding: 12px 24px;
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>รีเซ็ตรหัสผ่าน</h1>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="greeting">สวัสดี ${userName},</div>

      <div class="message">
        <p>เราได้รับคำขอรีเซ็ตรหัสผ่านสำหรับบัญชีของคุณใน <strong>${companyName}</strong></p>
        <p>คลิกปุ่มด้านล่างเพื่อสร้างรหัสผ่านใหม่:</p>
      </div>

      <div class="cta-container">
        <a href="${resetUrl}" class="cta-button">
          สร้างรหัสผ่านใหม่
        </a>
      </div>

      <p style="color: #6b7280; font-size: 13px; text-align: center; margin-top: 15px;">
        หากปุ่มไม่ทำงาน ให้คัดลอกลิงก์นี้ไปวางใน Browser:<br>
        <a href="${resetUrl}" style="color: #4F46E5; word-break: break-all;">${resetUrl}</a>
      </p>

      <div class="warning">
        <div class="warning-text">
          สำคัญ: ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง
        </div>
      </div>

      <div class="divider"></div>

      <p style="color: #6b7280; font-size: 14px;">
        หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้<br>
        รหัสผ่านของคุณจะไม่เปลี่ยนแปลงจนกว่าคุณจะคลิกลิงก์และสร้างรหัสใหม่
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        <strong>${companyName}</strong><br>
        ระบบติดตาม PR/PO<br>
        อีเมลนี้ส่งโดยอัตโนมัติ กรุณาอย่าตอบกลับ
      </p>
    </div>
  </div>
</body>
</html>`;
