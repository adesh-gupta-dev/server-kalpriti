const BRAND_COLOR = "#4F46E5";
const BACKGROUND_COLOR = "#F3F4F6";

export function verificationEmailTemplate(name, otp) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; width: 100% !important; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background-color: ${BRAND_COLOR}; padding: 20px; text-align: center; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .otp-box { display: inline-block; padding: 14px 28px; background-color: #EEF2FF; color: #111827; border-radius: 8px; font-size: 28px; letter-spacing: 6px; font-weight: bold; margin: 20px 0; }
    .footer { background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; }
  </style>
</head>
<body style="background-color: ${BACKGROUND_COLOR}; padding: 40px 0;">
  <div class="email-container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">AI Builder</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Verify your email</h2>
      <p>Hi ${name || "User"},</p>
      <p>Thanks for signing up with <strong>AI Builder</strong>. Use the OTP below to verify your email address:</p>
      <div style="text-align: center;">
        <div class="otp-box">${otp}</div>
      </div>
      <p>This OTP is valid for <strong>10 minutes</strong>.</p>
      <p>If you didn't create an account, you can safely ignore this email.</p>
      <p>Best regards,<br>The AI Builder Team</p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      <p style="font-size: 13px; color: #6B7280;">Do not share this OTP with anyone. Our team will never ask for it.</p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Your AI Company Name. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}
