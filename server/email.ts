import nodemailer from 'nodemailer';

const isDev = !process.env.SMTP_HOST;

const transporter = isDev
  ? null
  : nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

const FROM = process.env.SMTP_FROM || '"LEXICON" <noreply@lexicon.app>';

export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
  otp: string,
  baseUrl: string
) {
  const verifyLink = `${baseUrl}/verify?token=${token}`;

  if (isDev) {
    console.log('\n========================================');
    console.log('DEV MODE — Verification Email');
    console.log(`To:   ${email} (${username})`);
    console.log(`Link: ${verifyLink}`);
    console.log(`OTP:  ${otp}`);
    console.log('========================================\n');
    return;
  }

  await transporter!.sendMail({
    from: FROM,
    to: email,
    subject: 'Verify your LEXICON account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2 style="color:#10b981;">Welcome to LEXICON, ${username}!</h2>
        <p>Click the button below to verify your email:</p>
        <a href="${verifyLink}"
           style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 0;">
          Verify Email
        </a>
        <p style="margin-top:24px;">Or enter this 6-digit code on the verification page:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:0.4em;color:#10b981;margin:8px 0;">
          ${otp}
        </p>
        <p style="color:#6b7280;font-size:13px;">Link and code expire in 1 hour.</p>
      </div>`,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  token: string,
  otp: string,
  baseUrl: string
) {
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  if (isDev) {
    console.log('\n========================================');
    console.log('DEV MODE — Password Reset Email');
    console.log(`To:   ${email}`);
    console.log(`Link: ${resetLink}`);
    console.log(`OTP:  ${otp}`);
    console.log('========================================\n');
    return;
  }

  await transporter!.sendMail({
    from: FROM,
    to: email,
    subject: 'Reset your LEXICON password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px;">
        <h2 style="color:#10b981;">Password Reset</h2>
        <p>Click the button below to set a new password:</p>
        <a href="${resetLink}"
           style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;
                  border-radius:8px;text-decoration:none;font-weight:bold;margin:8px 0;">
          Reset Password
        </a>
        <p style="margin-top:24px;">Or enter this 6-digit code on the reset page:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:0.4em;color:#10b981;margin:8px 0;">
          ${otp}
        </p>
        <p style="color:#6b7280;font-size:13px;">
          Link and code expire in 1 hour. If you did not request this, ignore this email.
        </p>
      </div>`,
  });
}
