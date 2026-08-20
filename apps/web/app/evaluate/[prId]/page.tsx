'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '../../../components/Navbar';
import { apiFetch } from '../../../lib/api';
import { ArrowLeft, Loader2, Star, Trophy, CheckCircle2, AlertTriangle } from 'lucide-react';

type ScoreKey =
  | 'code_quality_score'
  | 'complexity_score'
  | 'test_coverage_score'
  | 'documentation_score'
  | 'overall_score';

const CRITERIA: Array<{ key: ScoreKey; label: string; hint: string }> = [
  { key: 'code_quality_score', label: 'Code quality', hint: 'Readability, structure, and correctness' },
  { key: 'complexity_score', label: 'Complexity handled', hint: 'How well the contributor handled the difficulty' },
  { key: 'test_coverage_score', label: 'Tests', hint: 'Automated or manual verification of the change' },
  { key: 'documentation_score', label: 'Documentation', hint: 'Comments, PR description, and usage notes' },
  { key: 'overall_score', label: 'Overall', hint: 'Would you merge this again at this quality?' },
];

type XpPreview = {
  difficulty: string;
  xpCap: number;
  trustMultiplier: number;
  formula: string;
  maxXp: number;
};

export default function EvaluatePRPage() {
  const { prId } = useParams<{ prId: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneXp, setDoneXp] = useState<number | null>(null);

  const [prTitle, setPrTitle] = useState('');
  const [prNumber, setPrNumber] = useState<number | null>(null);
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [repoName, setRepoName] = useState('');
  const [preview, setPreview] = useState<XpPreview | null>(null);

  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    code_quality_score: 4,
    complexity_score: 4,
    test_coverage_score: 4,
    documentation_score: 4,
    overall_score: 4,
  });
  const [comments, setComments] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/prs/${prId}`);
        if (!res.ok) {
          setError('Pull request not found.');
          return;
        }
        const body = await res.json();
        setPrTitle(body.pr?.title ?? '');
        setPrNumber(body.pr?.github_pr_number ?? null);
        setPrUrl(body.pr?.url ?? null);
        setRepoName(body.repo?.full_name ?? '');
        setPreview(body.xpPreview ?? null);
        if (body.evaluation) {
          setDoneXp(body.xpLog?.xp_awarded ?? 0);
        }
        if (body.pr?.status && body.pr.status !== 'AWAITING_EVALUATION' && !body.evaluation) {
          setError('This pull request is not awaiting evaluation.');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load pull request.');
      } finally {
        setLoading(false);
      }
    };
    if (prId) load();
  }, [prId]);

  const average = useMemo(() => {
    const total = CRITERIA.reduce((sum, item) => sum + scores[item.key], 0);
    return Math.round((total / CRITERIA.length) * 100) / 100;
  }, [scores]);

  const predictedXp = useMemo(() => {
    if (!preview) return 0;
    return Math.max(0, Math.floor(preview.xpCap * (average / 5) * preview.trustMultiplier));
  }, [average, preview]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/prs/${prId}/evaluate`, {
        method: 'POST',
        body: JSON.stringify({ ...scores, comments: comments.trim() || undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message || 'Evaluation failed.');
        return;
      }
      setDoneXp(body.xpLog?.xp_awarded ?? predictedXp);
    } catch (err) {
      console.error(err);
      setError('Evaluation failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans">
      <Navbar />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to dashboard
        </Link>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            <span className="text-sm text-zinc-500">Loading evaluation…</span>
          </div>
        ) : doneXp !== null ? (
          <div className="p-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <h1 className="text-xl font-bold text-white">XP awarded</h1>
            <p className="text-sm text-zinc-400">
              {doneXp} XP applied from Cap × (Eval / 5) × Trust Multiplier.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 px-4 py-2 rounded-xl bg-white text-black text-xs font-bold"
            >
              Return to dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-zinc-500">
                Maintainer evaluation
              </p>
              <h1 className="text-2xl font-black text-white mt-1">
                {prNumber != null ? `PR #${prNumber}` : 'Pull request'} — {prTitle}
              </h1>
              <p className="text-xs text-zinc-500 mt-1">
                {repoName}
                {prUrl ? (
                  <>
                    {' · '}
                    <a href={prUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-white">
                      View on GitHub
                    </a>
                  </>
                ) : null}
              </p>
            </div>

            {preview && (
              <div className="p-5 rounded-2xl border border-zinc-800 bg-zinc-950/60 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Trophy className="h-4 w-4 text-indigo-400" />
                  XP preview
                </div>
                <p className="text-xs text-zinc-400">
                  {preview.formula}. {preview.difficulty} cap {preview.xpCap} · trust {preview.trustMultiplier}×
                </p>
                <p className="text-lg font-black text-white">
                  {predictedXp} XP
                  <span className="text-xs font-semibold text-zinc-500 ml-2">
                    (max {preview.maxXp} at 5.0)
                  </span>
                </p>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-300 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {CRITERIA.map((item) => (
              <label key={item.key} className="flex flex-col gap-2 p-4 rounded-2xl border border-zinc-800 bg-zinc-950/40">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-bold text-white">{item.label}</span>
                    <p className="text-[11px] text-zinc-500">{item.hint}</p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-black text-white">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    {scores[item.key].toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  step={0.5}
                  value={scores[item.key]}
                  onChange={(event) =>
                    setScores((prev) => ({ ...prev, [item.key]: Number(event.target.value) }))
                  }
                  className="w-full accent-indigo-500"
                />
              </label>
            ))}

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-white">Comments (optional)</span>
              <textarea
                value={comments}
                onChange={(event) => setComments(event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500"
                placeholder="What should the contributor keep or improve?"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || Boolean(error && error.includes('not awaiting'))}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {submitting ? 'Awarding XP…' : `Submit evaluation · ${predictedXp} XP`}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
