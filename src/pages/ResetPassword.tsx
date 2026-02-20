import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { api } from '../lib/api';
import { BookOpen, Eye, EyeOff, CheckCircle, KeyRound } from 'lucide-react';

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  return (
    <div className="flex gap-3 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d === ' ' ? '' : d}
          onChange={(e) => {
            const digit = e.target.value.replace(/\D/g, '').slice(-1);
            const next = [...digits];
            next[i] = digit;
            onChange(next.join('').replace(/ /g, ''));
            if (digit && i < 5) {
              const nextInput = e.currentTarget.parentElement?.children[i + 1] as HTMLInputElement;
              nextInput?.focus();
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !digits[i] && i > 0) {
              const prev = e.currentTarget.parentElement?.children[i - 1] as HTMLInputElement;
              prev?.focus();
            }
          }}
          className="w-12 h-14 text-center text-2xl font-bold bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
        />
      ))}
    </div>
  );
}

export default function ResetPassword() {
  const [tab, setTab] = useState<'link' | 'code'>('code');
  const [tokenFromUrl, setTokenFromUrl] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setTokenFromUrl(token);
      setTab('link');
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const params =
      tab === 'link'
        ? { token: tokenFromUrl, newPassword }
        : { otp: otp.trim(), email: email.trim(), newPassword };

    const { error: err } = await api.resetPassword(params);
    setLoading(false);

    if (err) {
      setError(err);
    } else {
      setDone(true);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
          <h2 className="text-2xl font-bold text-white">Password updated!</h2>
          <p className="text-slate-400 text-sm">You can now sign in with your new password.</p>
          <Link
            href="/login"
            className="inline-block mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition text-sm"
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4 ring-1 ring-emerald-500/20">
            <BookOpen className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest">LEXICON</h1>
          <p className="text-slate-400 mt-2 text-sm">Set your new password</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          {!tokenFromUrl && (
            <div className="flex border-b border-slate-800">
              <button
                onClick={() => { setTab('code'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition ${
                  tab === 'code'
                    ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <KeyRound className="w-4 h-4" />
                Use Code
              </button>
              <button
                onClick={() => { setTab('link'); setError(''); }}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition ${
                  tab === 'link'
                    ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Use Link Token
              </button>
            </div>
          )}

          <div className="p-7">
            {error && (
              <div className="bg-red-950/60 border border-red-700/40 rounded-xl px-4 py-3 mb-5">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === 'code' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Your email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoFocus
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-3">
                      Reset code from email
                    </label>
                    <OTPInput value={otp} onChange={setOtp} />
                  </div>
                </>
              )}

              {tab === 'link' && tokenFromUrl && (
                <div className="bg-emerald-950/40 border border-emerald-700/30 rounded-xl px-4 py-3 text-sm text-emerald-300">
                  Reset link verified. Set your new password below.
                </div>
              )}

              {tab === 'link' && !tokenFromUrl && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Token from email link
                  </label>
                  <input
                    type="text"
                    value={tokenFromUrl}
                    onChange={(e) => setTokenFromUrl(e.target.value)}
                    placeholder="Paste token here"
                    required
                    autoFocus
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirm new password
                </label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Type new password again"
                  required
                  minLength={6}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Set New Password'
                )}
              </button>
            </form>

            <p className="text-center text-slate-400 text-sm mt-5">
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 transition">
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
