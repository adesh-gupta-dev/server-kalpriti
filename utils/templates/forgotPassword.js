const BRAND_COLOR = "#4F46E5";
const BACKGROUND_COLOR = "#F3F4F6";

export function forgotPasswordEmailTemplate(resetLink) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; width: 100% !important; }
    .email-container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background-color: ${BRAND_COLOR}; padding: 20px; text-align: center; }
    .content { padding: 40px 30px; color: #333333; line-height: 1.6; }
    .button { display: inline-block; padding: 12px 24px; background-color: ${BRAND_COLOR}; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; }
    .footer { background-color: #F9FAFB; padding: 20px; text-align: center; font-size: 12px; color: #6B7280; }
    .link-text { color: ${BRAND_COLOR}; word-break: break-all; }
  </style>
</head>
<body style="background-color: ${BACKGROUND_COLOR}; padding: 40px 0;">
  <div class="email-container">
    <div class="header">
      <h1 style="color: #ffffff; margin: 0; font-size: 24px;">AI Builder</h1>
    </div>
    <div class="content">
      <h2 style="margin-top: 0;">Reset your password</h2>
      <p>Hi user,</p>
      <p>We received a request to reset the password for your AI Builder account. Don't worry, it happens to the best of us!</p>
      <p>To create a new password, simply click the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" class="button" target="_blank">Reset Password</a>
      </div>
      <p>This link will expire in <strong>1 hour</strong> for your security.</p>
      <p>If you didn't ask to reset your password, you can safely ignore this email. Your account remains secure.</p>
      <p>Best regards,<br>The AI Builder Team</p>
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      <p style="font-size: 13px; color: #6B7280;">
        Having trouble clicking the button? Copy and paste the URL below into your web browser:
        <br>
        <a href="${resetLink}" class="link-text">${resetLink}</a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Your AI Company Name. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
}
