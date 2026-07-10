'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { useEffect, useState } from 'react';
import { GitBranch, Coins, Trophy, Library, User, LogOut, Loader2, PlusCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUserProfile(data);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: Library },
    { href: '/issues', label: 'Staking Feed', icon: Coins },
    { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800 bg-black/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-lg flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-white stroke-[2.5]" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">
            PullQuest
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User Session Info / Controls */}
        <div className="flex items-center gap-4">
          {loading ? (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
              <span>Syncing...</span>
            </div>
          ) : userProfile ? (
            <div className="flex items-center gap-4">
              
              {/* Coin Counter / Purchase Trigger */}
              <Link
                href="/dashboard?tab=purchases"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 active:scale-[0.98] transition-all"
              >
                <Coins className="h-4 w-4 text-amber-500 fill-amber-500/10" />
                <span className="text-xs font-bold text-amber-400">
                  {userProfile.earned_coins + userProfile.purchased_coins} <span className="text-zinc-500 font-normal">PC</span>
                </span>
                <PlusCircle className="h-3.5 w-3.5 text-amber-500/60" />
              </Link>

              {/* User Profile Navigation */}
              <Link
                href={`/profile/${userProfile.id}`}
                className="flex items-center gap-2.5 hover:opacity-80 transition-all"
              >
                {userProfile.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile.github_username}
                    className="h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900"
                  />
                ) : (
                  <div className="p-1.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">
                    <User className="h-4 w-4" />
                  </div>
                )}
                <span className="hidden sm:inline text-xs font-semibold text-zinc-200">
                  {userProfile.github_username}
                </span>
              </Link>

              {/* Sign Out Button */}
              <button
                onClick={handleSignOut}
                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>

            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-zinc-200 transition-all"
            >
              Sign In
            </Link>
          )}
        </div>

      </div>
    </header>
  );
}
