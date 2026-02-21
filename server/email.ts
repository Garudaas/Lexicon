import nodemailer from "nodemailer";

function reqEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[EMAIL] Missing env: ${name}`);
  return v;
}

function toInt(v: string, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

async function getTransporter() {
  const host = reqEnv("SMTP_HOST");
  const port = toInt(process.env.SMTP_PORT || "587", 587);
  const user = reqEnv("SMTP_USER");
  const pass = reqEnv("SMTP_PASS");

  // 587 = STARTTLS (secure false), 465 = SSL (secure true)
  const secure = port === 465;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: port === 587,
    tls: { servername: host },
  });

  return { transporter, host, port, secure, user };
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const { transporter, host, port, secure, user } = await getTransporter();
  const from = process.env.SMTP_FROM || user;

  console.log("[EMAIL] sendEmail called", {
    to: params.to,
    host,
    port,
    secure,
    from,
  });

  try {
    await transporter.verify();
    console.log("[EMAIL] SMTP verify OK");

    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });

    console.log("[EMAIL] sendMail OK", {
      messageId: info.messageId,
      response: info.response,
    });

    return { ok: true, messageId: info.messageId };
  } catch (err: any) {
    console.error("[EMAIL] sendMail FAILED", {
      name: err?.name,
      code: err?.code,
      message: err?.message,
      response: err?.response,
      stack: err?.stack,
    });
    throw err;
  }
}

export async function sendVerificationEmail(params: {
  to: string;
  verifyUrl: string;
}) {
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial;">
      <h2>LEXICON verification</h2>
      <p>Click to verify:</p>
      <p><a href="${params.verifyUrl}">${params.verifyUrl}</a></p>
      <p>If you didn’t request this, ignore it.</p>
    </div>
  `;
  return sendEmail({
    to: params.to,
    subject: "LEXICON: Verify your email",
    html,
    text: `Verify: ${params.verifyUrl}`,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}) {
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial;">
      <h2>LEXICON password reset</h2>
      <p>Click to reset your password:</p>
      <p><a href="${params.resetUrl}">${params.resetUrl}</a></p>
      <p>If you didn’t request this, ignore it.</p>
    </div>
  `;
  return sendEmail({
    to: params.to,
    subject: "LEXICON: Reset your password",
    html,
    text: `Reset: ${params.resetUrl}`,
  });
}
