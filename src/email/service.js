import nodemailer from "nodemailer";
import { env } from "../config/env.js";

/**
 * Creates a nodemailer transporter if SMTP is configured.
 * Returns null otherwise — all callers handle null gracefully.
 */
function createTransporter() {
  if (!env.smtpHost || !env.smtpUser || !env.smtpPass) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.smtpHost,
    port: Number(env.smtpPort || 587),
    secure: Number(env.smtpPort || 587) === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass,
    },
  });
}

/**
 * Sends a 6-digit OTP verification email.
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.otp
 * @param {"EMAIL_VERIFY"|"PASSWORD_RESET"} opts.purpose
 */
export async function sendOtpEmail({ to, otp, purpose }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log(`[Email] SMTP not configured — OTP for ${to}: ${otp}`);
    return;
  }

  const isReset = purpose === "PASSWORD_RESET";
  const subject = isReset ? "Reset your Orderzi password" : "Verify your email — Orderzi";
  const heading = isReset ? "Password Reset Code" : "Email Verification Code";
  const bodyText = isReset
    ? "Use the code below to reset your Orderzi account password. This code expires in <strong>10 minutes</strong>."
    : "Use the code below to verify your email address and complete your Orderzi account setup. This code expires in <strong>10 minutes</strong>.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subject}</title>
  <style>
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:0;background:#f5f5f5;color:#333}
    .container{max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#6d28d9 0%,#4f46e5 100%);padding:32px 36px}
    .header h1{color:#fff;margin:0;font-size:22px;letter-spacing:-.5px}
    .header p{color:rgba(255,255,255,.8);margin:6px 0 0;font-size:13px}
    .body{padding:32px 36px}
    .otp-box{background:#f5f3ff;border:2px dashed #7c3aed;border-radius:12px;padding:28px 20px;text-align:center;margin:24px 0}
    .otp-code{font-size:42px;font-weight:800;letter-spacing:10px;color:#6d28d9;font-family:monospace}
    .note{font-size:13px;color:#6b7280;line-height:1.6;margin-top:20px}
    .footer{background:#f9fafb;padding:16px 36px;text-align:center}
    .footer p{color:#9ca3af;font-size:12px;margin:0}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order<span style="color:#a78bfa">zi</span></h1>
      <p>${heading}</p>
    </div>
    <div class="body">
      <p style="font-size:15px;margin-bottom:4px;">${bodyText}</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
      </div>
      <p class="note">
        If you didn't request this, you can safely ignore this email.<br/>
        Do not share this code with anyone.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Orderzi · <a href="https://orderzi.com" style="color:#6d28d9;text-decoration:none">orderzi.com</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: env.smtpFrom || "Orderzi <noreply@orderzi.com>",
      to,
      subject,
      html,
    });
    console.log(`[Email] OTP sent to ${to} (${purpose})`);
  } catch (err) {
    console.error(`[Email] Failed to send OTP to ${to}:`, err.message);
  }
}


/**
 * Sends a subscription invoice email after a successful payment.
 * Fire-and-forget: logs errors but never throws (so payment flow is unaffected).
 *
 * @param {object} opts
 * @param {string} opts.to - Recipient email address
 * @param {string} opts.restaurantName - Restaurant name for personalisation
 * @param {string} opts.plan - Plan name e.g. "PRO"
 * @param {number} opts.amount - Amount paid in INR
 * @param {Date|string} opts.validUntil - Subscription expiry date
 * @param {string} [opts.paymentId] - Razorpay payment ID
 * @param {boolean} [opts.isRenewal] - True if renewing an existing plan
 */
export async function sendSubscriptionInvoice({
  to,
  restaurantName,
  plan,
  amount,
  validUntil,
  paymentId,
  isRenewal = false,
}) {
  const transporter = createTransporter();
  if (!transporter) {
    console.log("[Email] SMTP not configured — skipping invoice email to:", to);
    return;
  }

  const validUntilDate = new Date(validUntil);
  const formattedDate = validUntilDate.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const invoiceDate = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = isRenewal
    ? `Your Orderzi PRO has been renewed — Invoice`
    : `Welcome to Orderzi ${plan}! — Invoice`;

  const fromName = env.smtpFrom || "Orderzi <noreply@orderzi.com>";

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #f5f5f5; color: #333; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%); padding: 36px 40px; }
    .header h1 { color: #fff; margin: 0; font-size: 24px; letter-spacing: -0.5px; }
    .header p { color: rgba(255,255,255,0.8); margin: 6px 0 0; font-size: 14px; }
    .body { padding: 36px 40px; }
    .greeting { font-size: 16px; color: #333; margin-bottom: 24px; }
    .invoice-box { border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 28px; }
    .invoice-header { background: #f9fafb; padding: 14px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
    .invoice-header span { font-weight: 600; color: #6d28d9; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .invoice-row { display: flex; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
    .invoice-row:last-child { border-bottom: none; }
    .invoice-row .label { color: #6b7280; }
    .invoice-row .value { font-weight: 600; color: #111; }
    .invoice-row .value.amount { color: #6d28d9; font-size: 18px; }
    .invoice-row .value.status { color: #16a34a; }
    .valid-until { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 14px 20px; margin-bottom: 24px; font-size: 14px; }
    .valid-until strong { color: #16a34a; }
    .footer-note { font-size: 13px; color: #9ca3af; line-height: 1.6; border-top: 1px solid #f3f4f6; padding-top: 24px; margin-top: 8px; }
    .footer { background: #f9fafb; padding: 20px 40px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; }
    .footer a { color: #6d28d9; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Order<span style="color:#a78bfa">zi</span></h1>
      <p>${isRenewal ? "Subscription Renewed" : "Subscription Activated"} — Tax Invoice</p>
    </div>
    <div class="body">
      <p class="greeting">Hi <strong>${restaurantName}</strong>,</p>
      <p style="font-size:15px;color:#555;margin-bottom:28px;">
        ${isRenewal
          ? `Your <strong>Orderzi ${plan}</strong> subscription has been successfully renewed. Your restaurant can continue using all premium features without interruption.`
          : `Thank you for subscribing to <strong>Orderzi ${plan}</strong>! Your restaurant is now fully activated with all premium features.`
        }
      </p>

      <div class="invoice-box">
        <div class="invoice-header">
          <span>Invoice Details</span>
          <span style="color:#6b7280;font-weight:400;text-transform:none;letter-spacing:0;">${invoiceDate}</span>
        </div>
        <div class="invoice-row">
          <span class="label">Plan</span>
          <span class="value">Orderzi ${plan}</span>
        </div>
        <div class="invoice-row">
          <span class="label">Restaurant</span>
          <span class="value">${restaurantName}</span>
        </div>
        ${paymentId ? `<div class="invoice-row">
          <span class="label">Payment ID</span>
          <span class="value" style="font-size:12px;font-family:monospace;">${paymentId}</span>
        </div>` : ""}
        <div class="invoice-row">
          <span class="label">Amount Paid</span>
          <span class="value amount">₹${amount.toFixed ? amount.toFixed(2) : amount}</span>
        </div>
        <div class="invoice-row">
          <span class="label">Payment Status</span>
          <span class="value status">✓ Paid</span>
        </div>
      </div>

      <div class="valid-until">
        🗓️ Your subscription is active until <strong>${formattedDate}</strong>
      </div>

      <p class="footer-note">
        This is an automated invoice. Please keep it for your records. If you have any questions about your subscription, contact us at 
        <a href="mailto:support@orderzi.com">support@orderzi.com</a>.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} Orderzi · <a href="https://orderzi.com">orderzi.com</a></p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: fromName,
      to,
      subject,
      html: htmlBody,
    });
    console.log(`[Email] Invoice sent to ${to} for ${plan} plan`);
  } catch (err) {
    console.error("[Email] Failed to send invoice to", to, ":", err.message);
    // Intentionally not re-throwing — email failure must never block payment flow
  }
}
