'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '../../../components/Navbar';
import { apiFetch } from '../../../lib/api';
import { User, Trophy, Calendar, Star, GitMerge, AlertCircle, RefreshCw, BarChart3, HelpCircle, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { userId } = useParams();
  
  const [profile, setProfile] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchProfile = async () => {
    setLoadingProfile(true);
    try {
      const res = await apiFetch(`/api/users/${userId}/profile`);
      if (res.ok) {
        setProfile(await res.json());
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/users/${userId}/history?page=${page}&limit=5`);
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
        setTotal(json.total || 0);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchHistory();
    }
  }, [userId, page]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {loadingProfile ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-500">Loading user profile...</span>
          </div>
        ) : !profile ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <p className="text-sm text-zinc-450 font-medium">User profile not found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left Column Profile Header */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* Profile card details */}
              <div className="p-6 rounded-2xl border border-zinc-850 bg-zinc-950/60 backdrop-blur-xl flex flex-col items-center text-center">
                <img
                  src={profile.avatar_url || 'https://github.com/identicons/placeholder.png'}
                  alt={profile.github_username}
                  className="h-24 w-24 rounded-full border border-zinc-700 bg-zinc-900 mb-4"
                />
                
                <h2 className="text-xl font-black text-white tracking-tight">{profile.github_username}</h2>
                
                <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/10 mb-4">
                  {profile.current_tier}
                </span>

                {/* Score specs */}
                <div className="w-full flex flex-col gap-3 py-4 border-y border-zinc-900 mt-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Global Score</span>
                    <span className="font-bold text-white">{profile.global_xp} XP</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Global Rank</span>
                    <span className="font-bold text-indigo-400">
                      {profile.rank ? `#${profile.rank}` : 'Unranked'}
                    </span>
                  </div>
                </div>

                {/* Join date */}
                <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-4">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Joined {new Date(profile.created_at).toLocaleDateString()}</span>
                </div>

              </div>

            </div>

            {/* Right Column Timeline History */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              
              <div className="flex items-center gap-2 pb-4 border-b border-zinc-900">
                <GitMerge className="h-5 w-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Contribution History</h3>
              </div>

              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-750" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-zinc-900 rounded-2xl text-zinc-500 text-sm">
                  No PR histories found for this user.
                </div>
              ) : (
                <div className="flex flex-col gap-6">
                  {history.map((pr) => (
                    <div
                      key={pr.id}
                      className="p-6 rounded-2xl border border-zinc-850 bg-zinc-950/40 hover:border-zinc-800 transition-all flex flex-col gap-4"
                    >
                      
                      {/* PR Header metadata */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-900 pb-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                            {pr.repositories?.full_name}
                          </span>
                          <h4 className="text-sm font-bold text-white mt-0.5">
                            PR #{pr.github_pr_number} — {pr.title}
                          </h4>
                        </div>
                        
                        <span className={`self-start sm:self-center text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          pr.status === 'MERGED' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' :
                          pr.status === 'REJECTED' ? 'bg-rose-500/5 text-rose-400 border-rose-500/20' :
                          pr.status === 'CLOSED' ? 'bg-zinc-800 text-zinc-400 border-zinc-700' :
                          'bg-indigo-500/5 text-indigo-400 border-indigo-500/20'
                        }`}>
                          {pr.status}
                        </span>
                      </div>

                      {/* Evaluated performance values (if merged) */}
                      {pr.evaluations && (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                            <BarChart3 className="h-4 w-4 text-indigo-400" />
                            <span>Maintainer Review Rating</span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                            {[
                              { label: 'Overall Score', val: pr.evaluations.overall_score },
                              { label: 'Code Quality', val: pr.evaluations.code_quality_score },
                              { label: 'Complexity', val: pr.evaluations.complexity_score },
                              { label: 'Test Coverage', val: pr.evaluations.test_coverage_score },
                              { label: 'Documentation', val: pr.evaluations.documentation_score },
                            ].map((s) => (
                              <div key={s.label} className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900 flex flex-col items-center justify-center">
                                <span className="text-[9px] text-zinc-500 text-center uppercase tracking-tight">{s.label}</span>
                                <div className="flex items-center gap-0.5 mt-1">
                                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                  <span className="text-xs font-black text-white">{s.val || 0}</span>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Maintainer comments */}
                          {pr.evaluations.comments && (
                            <div className="text-xs leading-relaxed text-zinc-400 mt-1 border-l-2 border-zinc-800 pl-3 italic">
                              "{pr.evaluations.comments}"
                            </div>
                          )}
                        </div>
                      )}

                      {/* AI Generated structural review */}
                      {pr.ai_summary && (
                        <div className="mt-2 p-4 rounded-xl border border-zinc-900 bg-zinc-950/20 text-xs leading-relaxed flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-zinc-400">
                            <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                            <span>AI Structural Review</span>
                          </div>
                          <p className="text-zinc-500">{pr.ai_summary}</p>
                        </div>
                      )}

                    </div>
                  ))}

                  {/* Pagination control */}
                  {totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <span className="px-4 py-2 text-xs text-zinc-500">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                        className="px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-950 text-xs font-bold text-zinc-400 hover:text-white disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
