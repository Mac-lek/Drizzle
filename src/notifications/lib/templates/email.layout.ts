export function emailLayout(heading: string, content: string): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">

          <!-- Header -->
          <tr>
            <td style="background:#0ea5e9;padding:32px 40px;">
              <div style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">Drizzle</div>
              <div style="font-size:14px;color:#bae6fd;margin-top:4px;">Smart Savings, On Schedule</div>
            </td>
          </tr>

          <!-- Heading -->
          <tr>
            <td style="padding:32px 40px 0;">
              <h1 style="margin:0;font-size:22px;font-weight:600;color:#0f172a;">${heading}</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:20px 40px 32px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:24px 40px;">
              <p style="margin:0 0 4px;font-size:14px;color:#475569;">Best regards,</p>
              <p style="margin:0;font-size:14px;font-weight:600;color:#0f172a;">The Drizzle Team</p>
              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
                &copy; ${year} Drizzle. All rights reserved.<br/>
                If you did not request this email, you can safely ignore it.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
