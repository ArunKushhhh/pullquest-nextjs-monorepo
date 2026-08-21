'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';
import { Trophy, Search, Loader2, Award, User, Flame, Zap } from 'lucide-react';

type LeaderboardEntry = {
  rank: number;
  userId: string;
  github_username: string;
  avatar_url: string | null;
  xp: number;
  tier: string;
};

type ViewerStanding = {
  rank: number | null;
  xp: number;
  tier: string;
  visible: boolean;
};

type OrgTab = {
  id: string;
  name: string;
};

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [me, setMe] = useState<ViewerStanding | null>(null);
  const [orgs, setOrgs] = useState<OrgTab[]>([]);
  const [scope, setScope] = useState<'global' | string>('global');
  const [actLabel, setActLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [actRes, installRes] = await Promise.all([
          apiFetch('/api/acts/current'),
          apiFetch('/api/installations/status'),
        ]);
        if (actRes.ok) {
          const act = await actRes.json();
          if (act?.act_number) setActLabel(`Act ${act.act_number}`);
        }
        if (installRes.ok) {
          const body = await installRes.json();
          const nextOrgs: OrgTab[] = [];
          for (const inst of body.installations ?? []) {
            if (inst.organization?.id) {
              nextOrgs.push({
                id: inst.organization.id,
                name: inst.organization.display_name || inst.organization.name || inst.account_login,
              });
            }
          }
          setOrgs(nextOrgs);
        }
      } catch (err) {
        console.error('Error fetching leaderboard meta:', err);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      try {
        const path =
          scope === 'global'
            ? `/api/leaderboard/global?page=${page}&limit=10`
            : `/api/leaderboard/org/${scope}?page=${page}&limit=10`;
        const res = await apiFetch(path);
        if (res.ok) {
          const json = await res.json();
          setEntries(json.data || []);
          setTotalPages(json.totalPages || 1);
          setMe(json.me ?? null);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, [page, scope]);

  const filteredEntries = useMemo(
    () =>
      entries.filter((entry) =>
        entry.github_username.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [entries, searchQuery]
  );

  const podiumEntries = filteredEntries.slice(0, 3);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 text-indigo-400" />
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Seasonal Leaderboard
            </h1>
          </div>
          <p className="text-zinc-500 text-sm">
            {actLabel ? `${actLabel} · ` : ''}
            Ranked contributors only. Unranked until the first merged pull request this Act.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            type="button"
            onClick={() => {
              setScope('global');
              setPage(1);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
              scope === 'global'
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Global
          </button>
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                setScope(org.id);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                scope === org.id
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {org.name}
            </button>
          ))}
        </div>

        {me && (
          <div className="mb-8 p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {me.visible ? (
              <>
                <p className="text-sm text-zinc-300">
                  Your rank this Act:{' '}
                  <span className="font-black text-white">#{me.rank}</span>
                </p>
                <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">
                  {me.tier} · {me.xp} XP
                </p>
              </>
            ) : (
              <p className="text-sm text-zinc-400">
                You are Unranked this Act. Merge a pull request to appear on the board.
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-500">Loading seasonal rankings...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center gap-3">
            <Award className="h-10 w-10 text-zinc-600" />
            <p className="text-sm text-zinc-400">The leaderboard is empty this Act.</p>
            <p className="text-xs text-zinc-500 max-w-xs">
              Be the first to merge a pull request to initiate the rankings!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full mb-4">
              {podiumEntries[1] && (
                <div className="order-2 md:order-1 p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 flex flex-col items-center justify-between text-center relative h-64 md:mt-6">
                  <div className="absolute top-4 left-4 text-xs font-black text-zinc-500 tracking-wider">#2</div>
                  <div className="flex flex-col items-center">
                    <img
                      src={podiumEntries[1].avatar_url || 'https://github.com/identicons/placeholder.png'}
                      alt={podiumEntries[1].github_username}
                      className="h-16 w-16 rounded-full border border-zinc-700 bg-zinc-900 mb-3"
                    />
                    <Link
                      href={`/profile/${podiumEntries[1].userId}`}
                      className="text-sm font-bold text-white hover:text-indigo-400"
                    >
                      {podiumEntries[1].github_username}
                    </Link>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                      {podiumEntries[1].tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Flame className="h-4 w-4 text-zinc-400" />
                    <span className="text-base font-black text-white">
                      {podiumEntries[1].xp} <span className="text-[10px] text-zinc-500">XP</span>
                    </span>
                  </div>
                </div>
              )}

              {podiumEntries[0] && (
                <div className="order-1 md:order-2 p-8 rounded-2xl border border-amber-500/20 bg-zinc-950/40 flex flex-col items-center justify-between text-center relative h-72">
                  <div className="absolute top-4 left-4 text-xs font-black text-amber-500 tracking-wider">#1</div>
                  <div className="flex flex-col items-center">
                    <div className="relative">
                      <img
                        src={podiumEntries[0].avatar_url || 'https://github.com/identicons/placeholder.png'}
                        alt={podiumEntries[0].github_username}
                        className="h-20 w-20 rounded-full border border-amber-500 bg-zinc-900 mb-3"
                      />
                      <Trophy className="absolute -top-3.5 -right-2 h-7 w-7 text-amber-500" />
                    </div>
                    <Link
                      href={`/profile/${podiumEntries[0].userId}`}
                      className="text-base font-bold text-white hover:text-amber-500"
                    >
                      {podiumEntries[0].github_username}
                    </Link>
                    <span className="text-[10px] text-amber-500/80 font-bold uppercase mt-1">
                      {podiumEntries[0].tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span className="text-lg font-black text-white">
                      {podiumEntries[0].xp} <span className="text-[10px] text-zinc-500">XP</span>
                    </span>
                  </div>
                </div>
              )}

              {podiumEntries[2] && (
                <div className="order-3 p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 flex flex-col items-center justify-between text-center relative h-64 md:mt-6">
                  <div className="absolute top-4 left-4 text-xs font-black text-amber-700 tracking-wider">#3</div>
                  <div className="flex flex-col items-center">
                    <img
                      src={podiumEntries[2].avatar_url || 'https://github.com/identicons/placeholder.png'}
                      alt={podiumEntries[2].github_username}
                      className="h-16 w-16 rounded-full border border-zinc-700 bg-zinc-900 mb-3"
                    />
                    <Link
                      href={`/profile/${podiumEntries[2].userId}`}
                      className="text-sm font-bold text-white hover:text-indigo-400"
                    >
                      {podiumEntries[2].github_username}
                    </Link>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase mt-1">
                      {podiumEntries[2].tier}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <Flame className="h-4 w-4 text-amber-700" />
                    <span className="text-base font-black text-white">
                      {podiumEntries[2].xp} <span className="text-[10px] text-zinc-500">XP</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 flex items-center gap-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search user rankings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-zinc-800 rounded-2xl bg-zinc-950/20">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold bg-zinc-950/40">
                    <th className="py-3 px-6 w-20">Rank</th>
                    <th className="py-3 px-6">Contributor</th>
                    <th className="py-3 px-6">Tier Status</th>
                    <th className="py-3 px-6 text-right">Seasonal XP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.userId}
                      className="border-b border-zinc-900 hover:bg-zinc-950/20 last:border-0"
                    >
                      <td className="py-4 px-6 font-bold text-zinc-400">
                        {entry.rank <= 3 ? (
                          <span
                            className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-black text-xs ${
                              entry.rank === 1
                                ? 'bg-amber-500/10 text-amber-500'
                                : entry.rank === 2
                                  ? 'bg-zinc-500/10 text-zinc-400'
                                  : 'bg-amber-700/10 text-amber-700'
                            }`}
                          >
                            {entry.rank}
                          </span>
                        ) : (
                          <span>#{entry.rank}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Link
                          href={`/profile/${entry.userId}`}
                          className="flex items-center gap-3 hover:opacity-85"
                        >
                          {entry.avatar_url ? (
                            <img
                              src={entry.avatar_url}
                              alt={entry.github_username}
                              className="h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900"
                            />
                          ) : (
                            <div className="p-1.5 bg-zinc-800 text-zinc-500 rounded-full">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                          <span className="font-bold text-white hover:text-indigo-400 transition-all">
                            {entry.github_username}
                          </span>
                        </Link>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                          {entry.tier}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-black text-white">
                        <span className="inline-flex items-center justify-end gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{entry.xp}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
      </main>
    </div>
  );
}
