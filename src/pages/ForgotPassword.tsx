import { useState } from 'react';
import { Link } from 'wouter';
import { api } from '../lib/api';
import { BookOpen, Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: err } = await api.forgotPassword(email.trim());
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500/10 rounded-2xl mb-4 ring-1 ring-emerald-500/20">
            <BookOpen className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-widest">LEXICON</h1>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <CheckCircle className="w-14 h-14 text-emerald-400 mx-auto" />
              <h2 className="text-xl font-semibold text-white">Check your email</h2>
              <p className="text-slate-400 text-sm leading-relaxed">
                If an account exists for{' '}
                <span className="text-white font-medium">{email}</span>, we sent a reset
                link and code to it.
              </p>
              <p className="text-slate-500 text-xs">
                Running locally? Check the <strong>terminal</strong> for the reset link and code.
              </p>
              <div className="pt-2">
                <Link
                  href="/reset-password"
                  className="text-emerald-400 hover:text-emerald-300 transition text-sm font-medium"
                >
                  Enter reset code →
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <Link
                  href="/login"
                  className="text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Link>
                <h2 className="text-xl font-semibold text-white">Reset your password</h2>
              </div>

              <p className="text-slate-400 text-sm mb-6">
                Enter your email address and we'll send you a link and code to reset your password.
              </p>

              {error && (
                <div className="bg-red-950/60 border border-red-700/40 rounded-xl px-4 py-3 mb-5">
                  <p className="text-red-300 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      required
                      autoFocus
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition text-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
