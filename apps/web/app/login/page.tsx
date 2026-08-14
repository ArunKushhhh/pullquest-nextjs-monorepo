'use client';

import { createClient } from '../../lib/supabase/client';
import { useState } from 'react';
import { GitBranch, Shield, Zap, Coins } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async () => {
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    const next = params.get('installation_id')
      ? `/dashboard?${params.toString()}`
      : '/dashboard';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-center items-center bg-black overflow-hidden font-sans text-zinc-100 selection:bg-indigo-500 selection:text-white">
      {/* Dynamic glow overlays */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/20 blur-[120px] pointer-events-none" />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none opacity-40" />

      {/* Glassmorphic Container */}
      <div className="w-full max-w-md p-8 md:p-10 rounded-2xl border border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl shadow-2xl z-10 flex flex-col items-center">
        
        {/* Branding Logo */}
        <div className="flex items-center gap-2 mb-6">
          <div className="p-3 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl shadow-lg shadow-indigo-500/20 flex items-center justify-center">
            <GitBranch className="h-6 w-6 text-white stroke-[2.5]" />
          </div>
          <span className="text-2xl font-black tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            PullQuest
          </span>
        </div>

        {/* Title and Tagline */}
        <h1 className="text-xl md:text-2xl font-bold text-center text-white mb-2 tracking-tight">
          Level Up Your Contributions
        </h1>
        <p className="text-zinc-400 text-sm text-center mb-8 max-w-xs leading-relaxed">
          Stake coins, submit pull requests, earn trust-weighted XP, and climb the seasonal rankings.
        </p>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/50 flex flex-col gap-1.5">
            <Coins className="h-5 w-5 text-amber-500" />
            <span className="text-xs font-semibold text-zinc-300">Staking System</span>
            <span className="text-[10px] text-zinc-500">Back your work with economic skin-in-the-game.</span>
          </div>
          <div className="p-4 rounded-xl border border-zinc-900 bg-zinc-950/50 flex flex-col gap-1.5">
            <Zap className="h-5 w-5 text-indigo-400" />
            <span className="text-xs font-semibold text-zinc-300">Trust Multiplier</span>
            <span className="text-[10px] text-zinc-500">Earn higher XP based on repository authority.</span>
          </div>
        </div>

        {/* Auth Trigger Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-white text-black font-semibold rounded-xl hover:bg-zinc-200 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer shadow-xl shadow-white/5"
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.48 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.479C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
          {loading ? 'Connecting...' : 'Continue with GitHub'}
        </button>

        {/* Bottom Security Assurance */}
        <div className="flex items-center gap-1.5 text-zinc-600 text-[10px] mt-6">
          <Shield className="h-3 w-3" />
          <span>Vercel-style secure verification via GitHub App</span>
        </div>

      </div>

      {/* Footer */}
      <span className="mt-8 text-zinc-600 text-xs tracking-tight z-10">
        © 2026 PullQuest. All rights reserved.
      </span>
    </div>
  );
}
