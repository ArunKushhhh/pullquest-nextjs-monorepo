'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { apiFetch } from '../../lib/api';
import { Coins, Trophy, Zap, Clock, ShieldCheck, CheckCircle2, AlertTriangle, CreditCard, Loader2, ArrowRight, GitBranch, Landmark } from 'lucide-react';

const GITHUB_APP_SLUG = process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'pullquest-nextjs';
const GITHUB_INSTALL_URL = `https://github.com/apps/${GITHUB_APP_SLUG}/installations/new`;

type TreasuryView = {
  orgId: string;
  orgName: string;
  balance: number;
  totalCredits: number;
  totalDebits: number;
  debtCeiling: number;
  warningThreshold: number;
  isStakingDisabled: boolean;
  health: 'healthy' | 'warning' | 'breached';
};

type CoinBundleView = {
  id: string;
  name: string;
  amount: number;
  priceCents: number;
  description: string;
  purchasedThisAct: boolean;
};

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          <span className="text-sm text-zinc-500">Loading your profile dashboard...</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get('checkout');
  const setupAction = searchParams.get('setup_action');
  
  const [activeTab, setActiveTab] = useState<'overview' | 'stakes' | 'purchases'>('overview');
  const [profile, setProfile] = useState<any>(null);
  const [stakes, setStakes] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [currentAct, setCurrentAct] = useState<{
    act_number: number;
    days_remaining: number;
    duration_days: number;
  } | null>(null);
  const [bundles, setBundles] = useState<CoinBundleView[]>([]);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [installations, setInstallations] = useState<Array<{
    id: string;
    account_login: string;
    account_type: string;
    organization?: { id: string; name: string; display_name: string | null } | null;
    repositories?: Array<{ id: string; name: string; full_name: string; is_private: boolean }>;
  }>>([]);
  const [treasuries, setTreasuries] = useState<TreasuryView[]>([]);
  const [pendingEvals, setPendingEvals] = useState<Array<{
    id: string;
    title: string;
    github_pr_number: number;
    url?: string;
    issues?: { title?: string; github_issue_number?: number; difficulty?: string } | null;
    repositories?: { full_name?: string } | null;
  }>>([]);
  const [standing, setStanding] = useState<{
    rank: number | null;
    xp: number;
    tier: string;
    visible: boolean;
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [profileRes, stakesRes, historyRes, installRes, pendingRes, actRes, bundlesRes, boardRes] = await Promise.all([
        apiFetch('/api/auth/me'),
        apiFetch('/api/stakes/mine'),
        apiFetch('/api/coins/purchase-history'),
        apiFetch('/api/installations/status'),
        apiFetch('/api/prs/pending-evaluation'),
        apiFetch('/api/acts/current'),
        apiFetch('/api/coins/bundles'),
        apiFetch('/api/leaderboard/global?page=1&limit=1'),
      ]);

      if (profileRes.ok) setProfile(await profileRes.json());
      if (stakesRes.ok) setStakes(await stakesRes.json());
      if (historyRes.ok) setHistory(await historyRes.json());
      if (installRes.ok) {
        const body = await installRes.json();
        const nextInstalls = body.installations ?? [];
        setInstallations(nextInstalls);
        const orgIds = nextInstalls
          .map((inst: { organization?: { id?: string } | null }) => inst.organization?.id)
          .filter((id: string | undefined): id is string => Boolean(id));
        if (orgIds.length > 0) {
          const views = await Promise.all(
            orgIds.map(async (orgId: string) => {
              const res = await apiFetch(`/api/orgs/${orgId}/treasury`);
              if (!res.ok) return null;
              return res.json() as Promise<TreasuryView>;
            })
          );
          setTreasuries(views.filter((view): view is TreasuryView => view !== null));
        } else {
          setTreasuries([]);
        }
      }
      if (pendingRes.ok) {
        const body = await pendingRes.json();
        setPendingEvals(Array.isArray(body) ? body : []);
      }
      if (actRes.ok) setCurrentAct(await actRes.json());
      if (bundlesRes.ok) {
        const body = await bundlesRes.json();
        setBundles(Array.isArray(body.bundles) ? body.bundles : []);
      }
      if (boardRes.ok) {
        const body = await boardRes.json();
        setStanding(body.me ?? null);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const tabParam = searchParams.get('tab');
    if (tabParam === 'purchases') {
      setActiveTab('purchases');
    }
  }, []);

  const handlePurchase = async (bundleId: string) => {
    setPurchasingId(bundleId);
    setPurchaseError(null);
    try {
      const res = await apiFetch('/api/coins/create-checkout-session', {
        method: 'POST',
        body: JSON.stringify({ bundle_id: bundleId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else if (res.status === 409) {
        setPurchaseError('This pack can only be bought once per Act.');
        await loadData();
      } else {
        console.error('Purchase failed:', await res.text());
        setPurchaseError('Could not start checkout. Try again.');
      }
    } catch (err) {
      console.error('Purchase error:', err);
      setPurchaseError('Could not start checkout. Try again.');
    } finally {
      setPurchasingId(null);
    }
  };

  // Helper to resolve progress toward the next tier
  const getTierProgress = (xp: number) => {
    // Basic tier ranges for thresholds:
    // Initiator: 0-100, Commiter: 100-500, Contributor: 500-1500, Merge Master: 1500-3000, Architect: 3000-5000, Legend: 5000+
    if (xp < 100) return { current: xp, target: 100, percent: (xp / 100) * 100, next: 'Commiter' };
    if (xp < 500) return { current: xp - 100, target: 400, percent: ((xp - 100) / 400) * 100, next: 'Contributor' };
    if (xp < 1500) return { current: xp - 500, target: 1000, percent: ((xp - 500) / 1000) * 100, next: 'Merge Master' };
    if (xp < 3000) return { current: xp - 1500, target: 1500, percent: ((xp - 1500) / 1500) * 100, next: 'Architect' };
    if (xp < 5000) return { current: xp - 3000, target: 2000, percent: ((xp - 3000) / 2000) * 100, next: 'Open Source Legend' };
    return { current: xp, target: xp, percent: 100, next: 'Max Level reached!' };
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Checkout alerts */}
        {setupAction === 'install' && !loading && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 text-indigo-300 text-sm">
            <GitBranch className="h-5 w-5 shrink-0" />
            <div>
              <span className="font-semibold text-white">GitHub App installed.</span>{' '}
              {installations.length === 0
                ? 'Waiting for the installation webhook. If this stays empty, redeliver the installation event from the GitHub App’s Recent Deliveries, or save repository access again.'
                : 'Repositories are connected and webhooks can flow in.'}
            </div>
          </div>
        )}
        {checkoutStatus === 'success' && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <div>
              <span className="font-semibold text-white">Purchase completed successfully!</span> Your coin wallet balance has been updated.
            </div>
          </div>
        )}
        {checkoutStatus === 'cancel' && (
          <div className="mb-6 flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div>
              <span className="font-semibold text-white">Checkout cancelled.</span> No transactions were processed.
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-500">Loading your profile dashboard...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Sidebar Profile Card */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              
              {/* User overview block */}
              <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-xl flex flex-col items-center text-center">
                <img
                  src={profile?.avatar_url || 'https://github.com/identicons/placeholder.png'}
                  alt={profile?.github_username}
                  className="h-20 w-20 rounded-full border border-zinc-700 bg-zinc-900 mb-4"
                />
                <h2 className="text-lg font-bold text-white tracking-tight">{profile?.github_username}</h2>
                <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider mt-1 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/10">
                  {profile?.current_tier}
                </span>

                {/* Score indicators */}
                <div className="grid grid-cols-2 gap-4 w-full mt-6 pt-6 border-t border-zinc-800">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Total XP</span>
                    <span className="text-lg font-black text-white mt-0.5">{profile?.global_xp}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase">Coins Wallet</span>
                    <span className="text-lg font-black text-amber-500 mt-0.5">{profile ? profile.earned_coins + profile.purchased_coins : 0}</span>
                  </div>
                </div>
                <Link
                  href="/leaderboard"
                  className="mt-4 text-xs text-zinc-400 hover:text-white"
                >
                  {standing?.visible
                    ? `Global rank #${standing.rank} this Act`
                    : 'Unranked until first merged PR this Act'}
                </Link>
              </div>

              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-white font-bold text-sm">
                  <GitBranch className="h-4 w-4 text-indigo-400" />
                  <span>Repositories</span>
                </div>
                {installations.length === 0 ? (
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Connect the PullQuest GitHub App to a user or org so issue and PR webhooks can flow in.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-3 text-xs text-zinc-300">
                    {installations.map((inst) => {
                      const repos = inst.repositories ?? [];
                      return (
                        <li key={inst.id} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium truncate">{inst.account_login}</span>
                            <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                              {inst.account_type}
                            </span>
                          </div>
                          {repos.length === 0 ? (
                            <p className="text-[10px] text-zinc-500 leading-relaxed">
                              Account connected. Repository list has not synced yet — redeliver the installation webhook.
                            </p>
                          ) : (
                            <ul className="flex flex-col gap-1 pl-0.5">
                              {repos.map((repo) => (
                                <li key={repo.id} className="truncate text-zinc-400">
                                  {repo.full_name}
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <a
                  href={GITHUB_INSTALL_URL}
                  className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
                >
                  {installations.length === 0 ? 'Connect Repositories' : 'Manage on GitHub'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>

              {treasuries.length > 0 && (
                <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-white font-bold text-sm">
                    <Landmark className="h-4 w-4 text-indigo-400" />
                    <span>Org Treasury</span>
                  </div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">
                    Internal — not shown on public rankings
                  </p>
                  {treasuries.map((treasury) => (
                    <div key={treasury.orgId} className="flex flex-col gap-1 border-t border-zinc-800 pt-3 first:border-0 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-200 truncate">{treasury.orgName}</span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                          {treasury.health}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-black text-white">{treasury.balance} PC</span>
                        <span className="text-[10px] text-zinc-500">
                          Ceiling {treasury.debtCeiling}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500">
                        {treasury.isStakingDisabled
                          ? 'Staking disabled — debt ceiling reached'
                          : 'Staking enabled'}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Staking constraints detail */}
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/30 flex flex-col gap-4 text-xs text-zinc-400 leading-relaxed">
                <div className="flex items-center gap-2 text-white font-bold">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  <span>Staking Guidelines</span>
                </div>
                <p>Ensure that issues you stake on align with the rules: Easy labels accept 10–30 coins; Medium 30–80 coins; Hard 80–200 coins.</p>
                <p>Locked coins are returned instantly upon successful merge, along with a difficulty-based bonus!</p>
              </div>

            </div>

            {/* Main Tabs Area */}
            <div className="lg:col-span-3 flex flex-col gap-6">
              
              {/* Tab Selector */}
              <div className="flex border-b border-zinc-800">
                {(['overview', 'stakes', 'purchases'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-sm font-semibold capitalize transition-all border-b-2 cursor-pointer ${
                      activeTab === tab
                        ? 'border-indigo-500 text-white'
                        : 'border-transparent text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab === 'purchases' ? 'Coin Store' : tab}
                  </button>
                ))}
              </div>

              {/* Tab Contents */}
              <div className="min-h-[400px]">
                
                {/* 1. Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="flex flex-col gap-6 animate-fadeIn">

                    {currentAct && (
                      <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-5 w-5 text-indigo-400" />
                          <span className="text-sm font-bold text-white">
                            Act {currentAct.act_number}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400">
                          {currentAct.days_remaining} of {currentAct.duration_days} days remaining
                        </span>
                      </div>
                    )} 
                    {pendingEvals.length > 0 && (
                      <div className="p-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <Zap className="h-5 w-5 text-amber-400" />
                          <span className="text-sm font-bold text-white">PRs awaiting evaluation</span>
                        </div>
                        <p className="text-xs text-zinc-400">
                          XP is not awarded until you submit the structured questionnaire. Formula: Cap × (Eval / 5) × Trust Multiplier.
                        </p>
                        <ul className="flex flex-col gap-2">
                          {pendingEvals.map((pr) => (
                            <li key={pr.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white truncate">
                                  PR #{pr.github_pr_number} — {pr.title}
                                </p>
                                <p className="text-[11px] text-zinc-500 truncate">
                                  {pr.repositories?.full_name}
                                  {pr.issues?.difficulty ? ` · ${pr.issues.difficulty}` : ''}
                                </p>
                              </div>
                              <Link
                                href={`/evaluate/${pr.id}`}
                                className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold"
                              >
                                Evaluate
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )} 
                    {/* XP Progress Card */}
                    <div className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 flex flex-col">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-indigo-400" />
                          <span className="text-sm font-bold text-white">Tier Progress</span>
                        </div>
                        <span className="text-xs text-zinc-400">
                          {profile?.current_tier === 'UNRANKED'
                            ? 'Unranked until first merged PR this Act'
                            : <>Next Level: <span className="text-white font-semibold">{getTierProgress(profile?.global_xp || 0).next}</span></>}
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-zinc-900 rounded-full h-3.5 mb-2 overflow-hidden border border-zinc-800">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${getTierProgress(profile?.global_xp || 0).percent}%` }}
                        />
                      </div>
                      
                      <div className="flex justify-between text-xs text-zinc-500 font-semibold">
                        <span>Current XP: {profile?.global_xp}</span>
                        <span>{getTierProgress(profile?.global_xp || 0).percent.toFixed(0)}% Completed</span>
                      </div>
                    </div>

                    {/* Stats overview cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/30 flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Returned Stakes</span>
                          <span className="text-xl font-bold text-white mt-0.5">
                            {stakes.filter(s => s.status === 'RETURNED').length}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/30 flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">Active Stakes</span>
                          <span className="text-xl font-bold text-white mt-0.5">
                            {stakes.filter(s => s.status === 'LOCKED').length}
                          </span>
                        </div>
                      </div>

                      <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950/30 flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                          <Zap className="h-5 w-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500 uppercase font-bold">User Tier Status</span>
                          <span className="text-sm font-bold text-white mt-1">
                            {profile?.current_tier}
                          </span>
                        </div>
                      </div>

                    </div>

                  </div>
                )}

                {/* 2. Active Stakes Tab */}
                {activeTab === 'stakes' && (
                  <div className="flex flex-col gap-4 animate-fadeIn">
                    <h3 className="text-lg font-bold text-white mb-2">Your Stakes History</h3>
                    
                    {stakes.length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-zinc-800 rounded-2xl flex flex-col items-center gap-3">
                        <Clock className="h-8 w-8 text-zinc-600" />
                        <p className="text-sm text-zinc-400">You haven't placed any stakes yet.</p>
                        <Link
                          href="/issues"
                          className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-white"
                        >
                          Find stakable issues <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                              <th className="py-3 px-4">Issue Details</th>
                              <th className="py-3 px-4">Difficulty</th>
                              <th className="py-3 px-4">Stake Amount</th>
                              <th className="py-3 px-4">Status</th>
                              <th className="py-3 px-4">Created At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stakes.map((stake) => (
                              <tr key={stake.id} className="border-b border-zinc-900 hover:bg-zinc-950/20">
                                <td className="py-3.5 px-4 font-medium text-white max-w-xs truncate">
                                  #{stake.issues?.github_issue_number} — {stake.issues?.title}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    stake.issues?.difficulty === 'EASY' ? 'bg-emerald-500/10 text-emerald-400' :
                                    stake.issues?.difficulty === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400' :
                                    'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {stake.issues?.difficulty}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-mono font-bold text-zinc-300">
                                  {stake.amount} PC
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    stake.status === 'LOCKED' ? 'bg-zinc-800 text-zinc-400' :
                                    stake.status === 'RETURNED' ? 'bg-emerald-500/15 text-emerald-400' :
                                    stake.status === 'REFUNDED' ? 'bg-sky-500/15 text-sky-400' :
                                    'bg-rose-500/15 text-rose-400'
                                  }`}>
                                    {stake.status}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-xs text-zinc-500">
                                  {new Date(stake.created_at).toLocaleDateString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                  </div>
                )}

                {/* 3. Purchases Store Tab */}
                {activeTab === 'purchases' && (
                  <div className="flex flex-col gap-8 animate-fadeIn">
                    <p className="text-xs text-zinc-500">
                      Each pack can be purchased once during this Act. Purchased coins are never reset.
                    </p>
                    {purchaseError && (
                      <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-400 text-sm">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <span>{purchaseError}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {bundles.map((bundle) => (
                        <div key={bundle.id} className="p-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 backdrop-blur-xl flex flex-col justify-between hover:border-zinc-700 transition-all">
                          <div className="flex flex-col">
                            <h4 className="text-base font-bold text-white mb-1">{bundle.name}</h4>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-4">Coin Pack</span>
                            
                            <div className="flex items-baseline gap-2 mb-4">
                              <Coins className="h-6 w-6 text-amber-500" />
                              <span className="text-3xl font-black text-white">{bundle.amount}</span>
                              <span className="text-xs text-zinc-400">Coins</span>
                            </div>

                            <p className="text-zinc-400 text-xs leading-relaxed mb-6">
                              {bundle.description}
                            </p>
                          </div>

                          <button
                            onClick={() => handlePurchase(bundle.id)}
                            disabled={purchasingId !== null || bundle.purchasedThisAct}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50 transition-all"
                          >
                            {purchasingId === bundle.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Verifying...</span>
                              </>
                            ) : bundle.purchasedThisAct ? (
                              <span>Purchased this Act</span>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4" />
                                <span>Purchase for ${(bundle.priceCents / 100).toFixed(2)}</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Stripe Transaction History */}
                    <div className="mt-8 flex flex-col gap-4">
                      <h4 className="text-base font-bold text-white">Purchase History</h4>

                      {history.length === 0 ? (
                        <div className="p-6 text-center border border-zinc-900 rounded-xl text-zinc-500 text-xs">
                          No transaction records found.
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-zinc-900 rounded-xl bg-zinc-950/20">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="border-b border-zinc-900 text-zinc-500 font-semibold bg-zinc-950/40">
                                <th className="py-2.5 px-4">Transaction ID</th>
                                <th className="py-2.5 px-4">Amount</th>
                                <th className="py-2.5 px-4">Date</th>
                                <th className="py-2.5 px-4">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {history.map((tx) => (
                                <tr key={tx.id} className="border-b border-zinc-900 hover:bg-zinc-950/20">
                                  <td className="py-3 px-4 font-mono text-zinc-400">
                                    {tx.id}
                                  </td>
                                  <td className="py-3 px-4 font-bold text-emerald-400">
                                    +{tx.amount} PC
                                  </td>
                                  <td className="py-3 px-4 text-zinc-500">
                                    {new Date(tx.created_at).toLocaleString()}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase">
                                      Success
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
