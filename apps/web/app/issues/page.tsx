'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';
import { Coins, Filter, Search, ShieldAlert, Award, Star, ExternalLink, Loader2, X, CheckCircle2, Users } from 'lucide-react';

type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

type StakableIssue = {
  id: string;
  github_issue_number: number;
  title: string;
  url: string;
  stake_amount: number;
  difficulty: Difficulty;
  trust_multiplier: number;
  is_open: boolean;
  participant_count?: number;
  repositories?: { name: string; full_name: string } | null;
  organizations?: { name: string; credibility_score: number } | null;
};

type CoinBalance = {
  earned: number;
  purchased: number;
  locked: number;
};

type UserStake = {
  id: string;
  issue_id: string;
  status: string;
};

const DIFFICULTY_RANGES: Record<Difficulty, { min: number; max: number }> = {
  EASY: { min: 10, max: 30 },
  MEDIUM: { min: 30, max: 80 },
  HARD: { min: 80, max: 200 },
};

export default function IssuesPage() {
  const router = useRouter();

  const [issues, setIssues] = useState<StakableIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);

  const [difficultyFilter, setDifficultyFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [stakedIssueIds, setStakedIssueIds] = useState<Set<string>>(new Set());
  const [selectedIssue, setSelectedIssue] = useState<StakableIssue | null>(null);
  const [balance, setBalance] = useState<CoinBalance | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState(false);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const difficultyParam = difficultyFilter ? `&difficulty=${difficultyFilter}` : '';
      const res = await apiFetch(`/api/issues?page=${page}&limit=8${difficultyParam}`);
      if (res.ok) {
        const json = await res.json();
        setIssues(json.data || []);
        setTotalPages(json.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await apiFetch('/api/coins/balance');
      if (res.ok) {
        setBalance(await res.json());
      }
    } catch (err) {
      console.error('Error fetching balance:', err);
    }
  };

  const fetchMyStakes = async () => {
    try {
      const res = await apiFetch('/api/stakes/mine');
      if (!res.ok) return;
      const stakes: UserStake[] = await res.json();
      setStakedIssueIds(
        new Set(
          stakes
            .filter((stake) => stake.status === 'LOCKED')
            .map((stake) => stake.issue_id)
        )
      );
    } catch (err) {
      console.error('Error fetching stakes:', err);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, [page, difficultyFilter]);

  useEffect(() => {
    fetchMyStakes();
    fetchBalance();
  }, []);

  const filteredIssues = issues.filter(
    (issue) =>
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.github_issue_number.toString().includes(searchQuery)
  );

  const availableBalance = (balance?.earned || 0) + (balance?.purchased || 0);

  const openStakeModal = async (issue: StakableIssue) => {
    setSelectedIssue(issue);
    setModalError(null);
    setModalSuccess(false);
    await fetchBalance();
  };

  const closeStakeModal = () => {
    setSelectedIssue(null);
    setModalError(null);
    setModalSuccess(false);
  };

  const handlePlaceStake = async () => {
    if (!selectedIssue) return;
    setModalLoading(true);
    setModalError(null);

    const amount = selectedIssue.stake_amount;
    if (availableBalance < amount) {
      setModalError('Insufficient coins in your wallet. Go to your Dashboard to purchase more.');
      setModalLoading(false);
      return;
    }

    try {
      const res = await apiFetch(`/api/issues/${selectedIssue.id}/stake`, {
        method: 'POST',
        body: JSON.stringify({ amount }),
      });

      if (res.ok) {
        setModalSuccess(true);
        fetchBalance();
        fetchIssues();
        fetchMyStakes();
      } else {
        const errorData = await res.json();
        setModalError(errorData.message || 'Staking failed. Please try again.');
      }
    } catch {
      setModalError('Connection error. Could not contact the staking server.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">Staking Feed</h1>
            <p className="text-zinc-500 text-sm mt-1">Browse open issues across repositories, commit the exact Stake-X amount, and earn trust-weighted XP rewards.</p>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs">
            <Coins className="h-4 w-4 text-amber-500" />
            <span className="text-zinc-400">Easy: <strong className="text-white">10–30 PC</strong></span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Medium: <strong className="text-white">30–80 PC</strong></span>
            <span className="text-zinc-600">•</span>
            <span className="text-zinc-400">Hard: <strong className="text-white">80–200 PC</strong></span>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search issues by title or number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-black border border-zinc-800 rounded-lg text-sm text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-zinc-500" />
            <select
              value={difficultyFilter}
              onChange={(e) => {
                setDifficultyFilter(e.target.value);
                setPage(1);
              }}
              className="w-full sm:w-44 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-sm text-zinc-300 focus:outline-none focus:border-zinc-700"
            >
              <option value="">All Difficulties</option>
              <option value="EASY">Easy</option>
              <option value="MEDIUM">Medium</option>
              <option value="HARD">Hard</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-500">Loading open issues...</span>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center gap-3">
            <ShieldAlert className="h-10 w-10 text-zinc-500" />
            <p className="text-sm text-zinc-400 font-medium">No open stakable issues found.</p>
            <p className="text-xs text-zinc-600 max-w-xs">Issues need both a difficulty label and an exact Stake-X amount to appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {filteredIssues.map((issue) => {
              const alreadyStaked = stakedIssueIds.has(issue.id);
              const range = DIFFICULTY_RANGES[issue.difficulty] ?? DIFFICULTY_RANGES.HARD;
              return (
                <div
                  key={issue.id}
                  className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-xl flex flex-col justify-between hover:border-zinc-700 transition-all group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-semibold text-zinc-500">
                        {issue.repositories?.full_name ?? 'Repository'} #{issue.github_issue_number}
                      </span>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase border ${
                        issue.difficulty === 'EASY' ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20' :
                        issue.difficulty === 'MEDIUM' ? 'bg-amber-500/5 text-amber-400 border-amber-500/20' :
                        'bg-rose-500/5 text-rose-400 border-rose-500/20'
                      }`}>
                        {issue.difficulty}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white mb-4 line-clamp-2 group-hover:text-indigo-400 transition-all">
                      {issue.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-zinc-900 mb-6 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase">Required Stake</span>
                        <div className="flex items-center gap-1.5 text-zinc-300 font-bold mt-0.5">
                          <Award className="h-4 w-4 text-amber-500" />
                          <span>{issue.stake_amount} PC</span>
                        </div>
                        <span className="text-[10px] text-zinc-600">Band {range.min}–{range.max}</span>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase">Trust Multiplier</span>
                        <div className="flex items-center gap-1.5 text-zinc-300 font-bold mt-0.5">
                          <Star className="h-4 w-4 text-indigo-400 fill-indigo-400/25" />
                          <span>{issue.trust_multiplier}x</span>
                        </div>
                        <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {issue.participant_count ?? 0} staked
                          {issue.organizations ? ` · cred ${issue.organizations.credibility_score}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => openStakeModal(issue)}
                      disabled={alreadyStaked}
                      className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:hover:bg-zinc-800 active:scale-[0.98] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-indigo-600/10 cursor-pointer disabled:cursor-not-allowed text-center"
                    >
                      {alreadyStaked ? 'Already Staked' : `Stake ${issue.stake_amount} PC`}
                    </button>
                    <a
                      href={issue.url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-[0.95] transition-all"
                      title="View on GitHub"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2">
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
      </main>

      {selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl flex flex-col relative">
            <button
              onClick={closeStakeModal}
              className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <Coins className="h-5 w-5 text-amber-500" />
              <h3 className="text-lg font-bold text-white">Place Coin Stake</h3>
            </div>

            {modalSuccess ? (
              <div className="flex flex-col items-center text-center py-6">
                <CheckCircle2 className="h-14 w-14 text-emerald-500 mb-4" />
                <h4 className="text-base font-bold text-white mb-2">Stake Placed Successfully!</h4>
                <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                  {selectedIssue.stake_amount} PC are locked. Open a PR that mentions #{selectedIssue.github_issue_number} to stay eligible.
                </p>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={closeStakeModal}
                    className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      closeStakeModal();
                      router.push('/dashboard?tab=stakes');
                    }}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl"
                  >
                    View My Stakes
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-900 text-xs">
                  <span className="text-[9px] uppercase font-bold text-indigo-400">{selectedIssue.difficulty} DIFFICULTY</span>
                  <h4 className="text-sm font-semibold text-white mt-1 mb-2 line-clamp-1">{selectedIssue.title}</h4>
                  <div className="text-zinc-400">
                    Required stake: <strong className="text-white">{selectedIssue.stake_amount} PC</strong>
                    <span className="text-zinc-600"> (exact Stake-X)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs py-1">
                  <span className="text-zinc-400">Available Balance:</span>
                  <span className="font-bold text-amber-500">{availableBalance} PC</span>
                </div>

                {availableBalance < selectedIssue.stake_amount && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 text-amber-400 text-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>You need {selectedIssue.stake_amount} PC. Signup bonus is 150 — buy coins or pick a smaller Stake-X issue.</span>
                  </div>
                )}

                {modalError && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-400 text-xs">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{modalError}</span>
                  </div>
                )}

                <button
                  onClick={handlePlaceStake}
                  disabled={modalLoading || stakedIssueIds.has(selectedIssue.id)}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 active:scale-[0.98] transition-all cursor-pointer text-sm shadow-xl disabled:opacity-50"
                >
                  {modalLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Locking coins...</span>
                    </>
                  ) : (
                    <span>Confirm Stake of {selectedIssue.stake_amount} PC</span>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
