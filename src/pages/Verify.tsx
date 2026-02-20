import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import { BookOpen, Mail, KeyRound, CheckCircle, RefreshCw } from 'lucide-react';

function OTPInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(6, '').split('').slice(0, 6);

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const digit = e.target.value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = digit;
    onChange(next.join('').replace(/ /g, ''));
    if (digit && i < 5) refs.current[i + 1]?.focus();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted);
    const next = Math.min(pasted.length, 5);
    refs.current[next]?.focus();
  }

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d === ' ' ? '' : d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className="w-12 h-14 text-center text-2xl font-bold bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition"
        />
      ))}
    </div>
  );
}

export default function Verify() {
  const [tab, setTab] = useState<'link' | 'otp'>('link');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const { markVerified, user } = useAuth();
  const { showToast } = useToast();
  const [, navigate] = useLocation();

  // Auto-verify when arriving with ?token= in the URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (!token) return;

    setVerifying(true);
    api.verifyByLink(token).then(({ error: err }) => {
      setVerifying(false);
      if (err) {
        setError(err);
        showToast(err, 'error');
      } else {
        markVerified();
        setDone(true);
        showToast('Email verified! Welcome to LEXICON.', 'success');
        setTimeout(() => navigate('/home'), 1500);
      }
    });
  }, []);

  async function handleOTPSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) {
      setError('Please enter all 6 digits.');
      return;
    }
    setError('');
    setLoading(true);
    const { error: err } = await api.verifyByOTP(otp);
    setLoading(false);
    if (err) {
      setError(err);
      showToast(err, 'error');
    } else {
      markVerified();
      setDone(true);
      showToast('Email verified! Welcome to LEXICON.', 'success');
      setTimeout(() => navigate('/home'), 1500);
    }
  }

  async function handleResend(type: 'link' | 'otp') {
    setLoading(true);
    const { error: err } = type === 'link' ? await api.sendVerifyLink() : await api.sendOTP();
    setLoading(false);
    if (err) {
      showToast(err, 'error');
    } else {
      showToast(
        type === 'link' ? 'Verification link sent!' : 'Code sent!',
        'success'
      );
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Verifying your email…</p>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">All verified!</h2>
          <p className="text-slate-400">Taking you to the game…</p>
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
          <p className="text-slate-400 mt-2 text-sm">
            Verify your email to start playing
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="flex border-b border-slate-800">
            <button
              onClick={() => { setTab('link'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition ${
                tab === 'link'
                  ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Mail className="w-4 h-4" />
              Email Link
            </button>
            <button
              onClick={() => { setTab('otp'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition ${
                tab === 'otp'
                  ? 'text-emerald-400 bg-emerald-500/10 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              Enter Code
            </button>
          </div>

          <div className="p-7">
            {error && (
              <div className="bg-red-950/60 border border-red-700/40 rounded-xl px-4 py-3 mb-5">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {tab === 'link' ? (
              <div className="text-center space-y-5">
                <div className="bg-slate-800/60 rounded-xl p-5">
                  <Mail className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-300 text-sm leading-relaxed">
                    We sent a verification link to{' '}
                    <span className="text-white font-medium">{user?.email}</span>.
                    Click the link in that email to verify your account.
                  </p>
                  <p className="text-slate-500 text-xs mt-3">
                    Running locally? Check the <strong>terminal</strong> where your server is
                    running — the link will appear there.
                  </p>
                </div>
                <button
                  onClick={() => handleResend('link')}
                  disabled={loading}
                  className="flex items-center gap-2 mx-auto text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Resend link
                </button>
              </div>
            ) : (
              <form onSubmit={handleOTPSubmit} className="space-y-6">
                <div className="text-center">
                  <p className="text-slate-300 text-sm mb-1">
                    Enter the 6-digit code from your email.
                  </p>
                  <p className="text-slate-500 text-xs">
                    Running locally? Check the <strong>terminal</strong> for the code.
                  </p>
                </div>

                <OTPInput value={otp} onChange={setOtp} />

                <button
                  type="submit"
                  disabled={loading || otp.replace(/ /g, '').length !== 6}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Verify Code'
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleResend('otp')}
                  disabled={loading}
                  className="flex items-center gap-2 mx-auto text-sm text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Send a new code
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
