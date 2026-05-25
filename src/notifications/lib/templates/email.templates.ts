const p = (text: string) =>
  `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">${text}</p>`;

const otpBox = (otp: string) =>
  `<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:20px;text-align:center;margin:24px 0;">
    <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0369a1;">${otp}</span>
  </div>`;

export function otpTemplate(data: { firstName?: string; otp: string }): string {
  return [
    p(data.firstName ? `Hi ${data.firstName},` : "Hi there,"),
    p("Use the verification code below to complete your action. It is valid for <strong>10 minutes</strong>."),
    otpBox(data.otp),
    p("Do not share this code with anyone. The Drizzle team will never ask for your OTP."),
  ].join("");
}

export function adminOtpTemplate(data: { otp: string }): string {
  return [
    p("Hi,"),
    p("Use the one-time code below to sign into the Drizzle Admin panel. It is valid for <strong>10 minutes</strong>."),
    otpBox(data.otp),
    p("If you did not attempt to log in, please contact the team immediately."),
  ].join("");
}

export function adminInviteTemplate(data: {
  role: string;
  token: string;
  expiresIn: string;
}): string {
  return [
    p("Hi,"),
    p(`You have been invited to join the <strong>Drizzle Admin</strong> panel as a <strong>${data.role}</strong>.`),
    p("Use the token below to accept your invite:"),
    `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px 20px;margin:16px 0;word-break:break-all;">
      <span style="font-size:14px;font-weight:600;color:#166534;font-family:monospace;">${data.token}</span>
    </div>`,
    p(`This invite expires in <strong>${data.expiresIn}</strong>.`),
    p("If you were not expecting this invitation, you can ignore this email."),
  ].join("");
}

export function passwordResetTemplate(data: { otp: string }): string {
  return [
    p("Hi there,"),
    p("We received a request to reset your Kolowise password. Use the code below — it is valid for <strong>10 minutes</strong>."),
    otpBox(data.otp),
    p("If you did not request a password reset, you can safely ignore this email. Your password will not change."),
    p("Do not share this code with anyone."),
  ].join("");
}

export function waitlistTemplate(data: { firstName: string }): string {
  return [
    p(`Hi ${data.firstName},`),
    p("Thank you for joining the <strong>Drizzle waitlist</strong>! We're building a smarter way to save, and you'll be among the first to know when we launch."),
    p("We'll reach out as soon as a spot opens up. Stay tuned!"),
  ].join("");
}
