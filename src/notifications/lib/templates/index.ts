import { emailLayout } from "./email.layout";
import {
  adminInviteTemplate,
  adminOtpTemplate,
  otpTemplate,
  waitlistTemplate,
} from "./email.templates";

type EmailType =
  | { type: "otp"; data: { firstName?: string; otp: string } }
  | { type: "adminOtp"; data: { otp: string } }
  | { type: "adminInvite"; data: { role: string; token: string; expiresIn: string } }
  | { type: "waitlist"; data: { firstName: string } };

const headings: Record<EmailType["type"], string> = {
  otp: "Your Verification Code",
  adminOtp: "Admin Login OTP",
  adminInvite: "You're Invited to Drizzle Admin",
  waitlist: "You're on the Drizzle Waitlist!",
};

export function buildEmailHtml(template: EmailType): string {
  const heading = headings[template.type];
  let content: string;

  switch (template.type) {
    case "otp":
      content = otpTemplate(template.data);
      break;
    case "adminOtp":
      content = adminOtpTemplate(template.data);
      break;
    case "adminInvite":
      content = adminInviteTemplate(template.data);
      break;
    case "waitlist":
      content = waitlistTemplate(template.data);
      break;
  }

  return emailLayout(heading, content);
}
