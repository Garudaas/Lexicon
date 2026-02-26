import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getMyStats, getGlobalLeaderboard, getWeeklyLeaderboard } from '../lib/stats-api';
import { TrendingUp, Trophy, Award, Flame } from 'lucide-react';

type PlayerStats = {
  wins: number;
  losses: number;
  games_played: number;
  total_score: number;
  average_score: number;
  win_rate: number;
  highest_score: number;
  total_words_used: number;
};

type LeaderboardEntry = {
  user_id: string;
  wins: number;
  games_played: number;
  total_score: number;
  average_score: number;
  win_rate: number;
  highest_score: number;
};

export default function Stats() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [globalLeaderboard, setGlobalLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [weeklyLeaderboard, setWeeklyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stats' | 'global' | 'weekly'>('stats');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [statsData, globalData, weeklyData] = await Promise.all([
        getMyStats(),
        getGlobalLeaderboard(50),
        getWeeklyLeaderboard(50),
      ]);

      setStats(statsData);
      setGlobalLeaderboard(globalData);
      setWeeklyLeaderboard(weeklyData);
    } catch (err) {
      showToast('Failed to load stats', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-white">Your Stats & Leaderboards</h1>
          <p className="text-slate-400 text-sm mt-1">Track your progress and compete</p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Your Stats Section */}
        {activeTab === 'stats' && stats && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              Your Statistics
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-slate-400 text-sm mb-2">Games Played</div>
                <div className="text-3xl font-bold text-white">{stats.games_played}</div>
                <div className="text-slate-500 text-xs mt-2">
                  {stats.average_score.toFixed(1)} avg score
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-slate-400 text-sm mb-2">Wins</div>
                <div className="text-3xl font-bold text-emerald-400">{stats.wins}</div>
                <div className="text-slate-500 text-xs mt-2">{stats.win_rate.toFixed(1)}% win rate</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-slate-400 text-sm mb-2">Highest Score</div>
                <div className="text-3xl font-bold text-sky-400">{stats.highest_score}</div>
                <div className="text-slate-500 text-xs mt-2">{stats.total_score} total</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="text-slate-400 text-sm mb-2">Words Used</div>
                <div className="text-3xl font-bold text-amber-400">{stats.total_words_used}</div>
                <div className="text-slate-500 text-xs mt-2">Unique words</div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Tabs */}
        <div className="mb-8">
          <div className="flex gap-4 mb-6 border-b border-slate-800">
            {['stats', 'global', 'weekly'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-3 font-semibold transition ${
                  activeTab === tab
                    ? 'text-emerald-400 border-b-2 border-emerald-400'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                {tab === 'stats' ? 'Your Stats' : tab === 'global' ? 'Global' : 'This Week'}
              </button>
            ))}
          </div>

          {/* Global Leaderboard */}
          {activeTab === 'global' && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Global Leaderboard
              </h2>
              {globalLeaderboard.length > 0 ? (
                <div className="space-y-2">
                  {globalLeaderboard.map((entry, idx) => (
                    <div
                      key={entry.user_id}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-slate-500 font-semibold w-8 text-center">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm">Player {idx + 1}</div>
                          <div className="text-slate-500 text-xs">
                            {entry.wins}W • {entry.games_played}G • {entry.total_score} pts
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-bold">{entry.win_rate.toFixed(1)}%</div>
                        <div className="text-slate-500 text-xs">win rate</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">No data yet</div>
              )}
            </div>
          )}

          {/* Weekly Leaderboard */}
          {activeTab === 'weekly' && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                This Week's Rankings
              </h2>
              {weeklyLeaderboard.length > 0 ? (
                <div className="space-y-2">
                  {weeklyLeaderboard.map((entry, idx) => (
                    <div
                      key={entry.user_id}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3 flex items-center justify-between hover:border-slate-700 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-slate-500 font-semibold w-8 text-center">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                        </div>
                        <div>
                          <div className="text-white font-semibold text-sm">Player {idx + 1}</div>
                          <div className="text-slate-500 text-xs">
                            {entry.wins}W • {entry.games_played}G • {entry.total_score} pts
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-amber-400 font-bold">{entry.wins}</div>
                        <div className="text-slate-500 text-xs">wins</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400">No data yet</div>
              )}
            </div>
          )}
        </div>

        {loading && <div className="text-center py-8 text-slate-400">Loading...</div>}
      </main>
    </div>
  );
}
