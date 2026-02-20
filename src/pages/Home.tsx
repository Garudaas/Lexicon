import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLocation } from 'wouter';
import { BookOpen, LogOut, Shield, Wifi, Plus, Hash } from 'lucide-react';

export default function Home() {
  const { user, isActiveDevice, logout } = useAuth();
  const { showToast } = useToast();
  const [, navigate] = useLocation();

  async function handleLogout() {
    await logout();
    showToast('You have been signed out.', 'info');
    navigate('/login');
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl ring-1 ring-emerald-500/20">
              <BookOpen className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-lg font-bold text-white tracking-widest">LEXICON</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition px-3 py-1.5 rounded-lg hover:bg-red-950/30 text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-slate-800 rounded-full mb-5 ring-2 ring-slate-700">
            <span className="text-3xl font-bold text-emerald-400">
              {user.username.charAt(0).toUpperCase()}
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            Welcome back, <span className="text-emerald-400">{user.username}</span>!
          </h2>
          <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        </div>

        {/* Active device badge */}
        <div className="flex justify-center mb-10">
          {isActiveDevice ? (
            <div className="inline-flex items-center gap-2.5 bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 px-5 py-2.5 rounded-full text-sm font-medium">
              <Wifi className="w-4 h-4 text-emerald-400" />
              Active Player Device
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            </div>
          ) : (
            <div className="inline-flex items-center gap-2.5 bg-amber-950/60 border border-amber-700/40 text-amber-300 px-5 py-2.5 rounded-full text-sm font-medium">
              <Shield className="w-4 h-4 text-amber-400" />
              Spectator Only
              <span className="w-2 h-2 bg-amber-400 rounded-full" />
            </div>
          )}
        </div>

        {!isActiveDevice && (
          <div className="bg-amber-950/30 border border-amber-700/30 rounded-xl px-5 py-4 mb-8 text-center">
            <p className="text-amber-300 text-sm leading-relaxed">
              You are signed in on another device as the active player. This device is in
              spectator-only mode. To become the active player here, sign out and sign in again.
            </p>
          </div>
        )}

        {/* Game buttons (disabled placeholder) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            disabled
            className="flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-7 cursor-not-allowed opacity-50"
          >
            <div className="bg-emerald-500/10 p-4 rounded-2xl">
              <Plus className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">Create Room</p>
              <p className="text-slate-500 text-xs mt-1">Coming soon</p>
            </div>
          </button>

          <button
            disabled
            className="flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-7 cursor-not-allowed opacity-50"
          >
            <div className="bg-sky-500/10 p-4 rounded-2xl">
              <Hash className="w-7 h-7 text-sky-400" />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold">Join Room</p>
              <p className="text-slate-500 text-xs mt-1">Coming soon</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
