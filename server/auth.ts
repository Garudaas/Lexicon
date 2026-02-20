import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { supabase } from './db.js';
import { sendVerificationEmail, sendPasswordResetEmail } from './email.js';

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; email: string };
      sessionId?: string;
    }
  }
}

let activeDeviceChangedHandler: ((userId: string, activeSessionId: string) => void) | null =
  null;

export function setActiveDeviceChangedHandler(
  handler: (userId: string, activeSessionId: string) => void
) {
  activeDeviceChangedHandler = handler;
}

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
};

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const router = Router();

// ──────────────────────────────────────────
// POST /api/auth/signup
// ──────────────────────────────────────────
router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      res.status(400).json({ error: 'All fields are required.' });
      return;
    }

    const u = username.trim();
    const e = email.trim().toLowerCase();

    if (u.length < 3 || u.length > 20) {
      res.status(400).json({ error: 'Username must be 3–20 characters.' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(u)) {
      res.status(400).json({
        error: 'Username can only contain letters, numbers, and underscores.',
      });
      return;
    }
    if (!isValidEmail(e)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    if (password !== confirmPassword) {
      res.status(400).json({ error: 'Passwords do not match.' });
      return;
    }

    const { data: byUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', u)
      .maybeSingle();
    if (byUsername) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }

    const { data: byEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', e)
      .maybeSingle();
    if (byEmail) {
      res.status(409).json({ error: 'An account with that email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({ username: u, email: e, password_hash: passwordHash, verified: false })
      .select('id, username, email')
      .single();

    if (userErr || !user) {
      res.status(500).json({ error: 'Could not create account. Please try again.' });
      return;
    }

    const sessionToken = randomUUID();
    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .insert({ user_id: user.id, token: sessionToken })
      .select('id')
      .single();

    if (sessErr || !session) {
      res
        .status(500)
        .json({ error: 'Account created but could not start session. Please log in.' });
      return;
    }

    await supabase
      .from('users')
      .update({ active_session_id: session.id })
      .eq('id', user.id);

    const verifyToken = randomUUID();
    const verifyOTP = generateOTP();
    await supabase.from('verification_tokens').insert({
      user_id: user.id,
      token: verifyToken,
      otp: verifyOTP,
      type: 'email_verify',
    });

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    await sendVerificationEmail(e, u, verifyToken, verifyOTP, baseUrl);

    res.cookie('session', sessionToken, COOKIE_OPTS);
    res.json({
      user: { id: user.id, username: user.username, email: user.email, verified: false },
      sessionId: session.id,
      isActiveDevice: true,
      needsVerification: true,
    });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/login
// ──────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      res.status(400).json({ error: 'Email/username and password are required.' });
      return;
    }

    const id = identifier.trim();
    const isEmail = isValidEmail(id.toLowerCase());

    const base = supabase
      .from('users')
      .select('id, username, email, password_hash, verified, active_session_id');

    const { data: user } = await (isEmail
      ? base.eq('email', id.toLowerCase())
      : base.eq('username', id)
    ).maybeSingle();

    if (!user) {
      res.status(401).json({ error: 'No account found with those details.' });
      return;
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Incorrect password.' });
      return;
    }

    const sessionToken = randomUUID();
    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .insert({ user_id: user.id, token: sessionToken })
      .select('id')
      .single();

    if (sessErr || !session) {
      res.status(500).json({ error: 'Could not create session. Please try again.' });
      return;
    }

    await supabase
      .from('users')
      .update({ active_session_id: session.id })
      .eq('id', user.id);

    if (activeDeviceChangedHandler) {
      activeDeviceChangedHandler(user.id, session.id);
    }

    res.cookie('session', sessionToken, COOKIE_OPTS);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        verified: user.verified,
      },
      sessionId: session.id,
      isActiveDevice: true,
      needsVerification: !user.verified,
    });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/logout
// ──────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.session;
    if (token) {
      const { data: session } = await supabase
        .from('sessions')
        .select('id, user_id')
        .eq('token', token)
        .maybeSingle();

      if (session) {
        await supabase
          .from('sessions')
          .update({ revoked_at: new Date().toISOString() })
          .eq('id', session.id);

        await supabase
          .from('users')
          .update({ active_session_id: null })
          .eq('id', session.user_id)
          .eq('active_session_id', session.id);
      }
    }

    res.clearCookie('session', { path: '/' });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ──────────────────────────────────────────
// GET /api/auth/me
// ──────────────────────────────────────────
router.get('/me', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.session;
    if (!token) {
      res.status(401).json({ error: 'Not logged in' });
      return;
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('token', token)
      .is('revoked_at', null)
      .maybeSingle();

    if (!session) {
      res.clearCookie('session', { path: '/' });
      res.status(401).json({ error: 'Session expired or revoked' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, email, verified, active_session_id')
      .eq('id', session.user_id)
      .maybeSingle();

    if (!user) {
      res.clearCookie('session', { path: '/' });
      res.status(401).json({ error: 'Account not found' });
      return;
    }

    res.json({
      user: { id: user.id, username: user.username, email: user.email, verified: user.verified },
      sessionId: session.id,
      isActiveDevice: session.id === user.active_session_id,
    });
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/send-verify-link
// ──────────────────────────────────────────
router.post('/send-verify-link', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id: userId, email, username } = req.user!;
    const verifyToken = randomUUID();
    const verifyOTP = generateOTP();

    await supabase.from('verification_tokens').insert({
      user_id: userId,
      token: verifyToken,
      otp: verifyOTP,
      type: 'email_verify',
    });

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    await sendVerificationEmail(email, username, verifyToken, verifyOTP, baseUrl);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not send verification link. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/send-otp
// ──────────────────────────────────────────
router.post('/send-otp', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id: userId, email, username } = req.user!;
    const verifyToken = randomUUID();
    const verifyOTP = generateOTP();

    await supabase.from('verification_tokens').insert({
      user_id: userId,
      token: verifyToken,
      otp: verifyOTP,
      type: 'email_verify',
    });

    const baseUrl = process.env.APP_URL || 'http://localhost:5173';
    await sendVerificationEmail(email, username, verifyToken, verifyOTP, baseUrl);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not send verification code. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/verify-by-link
// ──────────────────────────────────────────
router.post('/verify-by-link', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ error: 'Verification token is required.' });
      return;
    }

    const { data: vt } = await supabase
      .from('verification_tokens')
      .select('id, user_id')
      .eq('token', token)
      .eq('type', 'email_verify')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!vt) {
      res.status(400).json({ error: 'This link is invalid or has expired.' });
      return;
    }

    await supabase.from('users').update({ verified: true }).eq('id', vt.user_id);
    await supabase.from('verification_tokens').update({ used: true }).eq('id', vt.id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/verify-by-otp
// ──────────────────────────────────────────
router.post('/verify-by-otp', requireAuth, async (req: Request, res: Response) => {
  try {
    const { otp } = req.body;
    const userId = req.user!.id;

    if (!otp || otp.toString().trim().length === 0) {
      res.status(400).json({ error: 'Please enter the 6-digit code.' });
      return;
    }

    const { data: vt } = await supabase
      .from('verification_tokens')
      .select('id')
      .eq('user_id', userId)
      .eq('otp', otp.toString().trim())
      .eq('type', 'email_verify')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!vt) {
      res.status(400).json({ error: 'That code is incorrect or has expired.' });
      return;
    }

    await supabase.from('users').update({ verified: true }).eq('id', userId);
    await supabase.from('verification_tokens').update({ used: true }).eq('id', vt.id);

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/forgot-password
// ──────────────────────────────────────────
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Email address is required.' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (user) {
      const resetToken = randomUUID();
      const resetOTP = generateOTP();

      await supabase.from('verification_tokens').insert({
        user_id: user.id,
        token: resetToken,
        otp: resetOTP,
        type: 'password_reset',
      });

      const baseUrl = process.env.APP_URL || 'http://localhost:5173';
      await sendPasswordResetEmail(user.email, resetToken, resetOTP, baseUrl);
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ──────────────────────────────────────────
// POST /api/auth/reset-password
// ──────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, otp, email, newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    let vtId: string | null = null;
    let userId: string | null = null;

    if (token) {
      const { data: vt } = await supabase
        .from('verification_tokens')
        .select('id, user_id')
        .eq('token', token)
        .eq('type', 'password_reset')
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!vt) {
        res.status(400).json({ error: 'This reset link is invalid or has expired.' });
        return;
      }
      vtId = vt.id;
      userId = vt.user_id;
    } else if (otp && email) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();

      if (!user) {
        res.status(400).json({ error: 'Invalid code.' });
        return;
      }

      const { data: vt } = await supabase
        .from('verification_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('otp', otp.toString().trim())
        .eq('type', 'password_reset')
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (!vt) {
        res.status(400).json({ error: 'That code is invalid or has expired.' });
        return;
      }
      vtId = vt.id;
      userId = user.id;
    } else {
      res.status(400).json({ error: 'A reset link token or (email + code) is required.' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await supabase.from('users').update({ password_hash: passwordHash }).eq('id', userId);
    await supabase.from('verification_tokens').update({ used: true }).eq('id', vtId);

    res.json({ success: true, message: 'Password updated. You can now log in.' });
  } catch {
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ──────────────────────────────────────────
// requireAuth middleware
// ──────────────────────────────────────────
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.session;
    if (!token) {
      res.status(401).json({ error: 'Please log in first.' });
      return;
    }

    const { data: session } = await supabase
      .from('sessions')
      .select('id, user_id')
      .eq('token', token)
      .is('revoked_at', null)
      .maybeSingle();

    if (!session) {
      res.clearCookie('session', { path: '/' });
      res.status(401).json({ error: 'Your session has expired. Please log in again.' });
      return;
    }

    const { data: user } = await supabase
      .from('users')
      .select('id, username, email')
      .eq('id', session.user_id)
      .maybeSingle();

    if (!user) {
      res.clearCookie('session', { path: '/' });
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    req.user = { id: user.id, username: user.username, email: user.email };
    req.sessionId = session.id;
    next();
  } catch {
    res.status(500).json({ error: 'Something went wrong.' });
  }
}

export const authRouter = router;
