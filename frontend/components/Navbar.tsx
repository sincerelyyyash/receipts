'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LayoutGrid, Trophy } from 'lucide-react';

import { ThemeSwitch } from './ThemeSwitch';

export const Navbar = () => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-6xl flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="text-xl font-bold hover:opacity-80 transition-opacity"
            aria-label="Receipts Home"
          >
            Receipts
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === '/dashboard'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-label="Dashboard"
            >
              <LayoutGrid className="size-4" />
              Dashboard
            </Link>
            <Link
              href="/leaderboard"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === '/leaderboard'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              aria-label="Leaderboard"
            >
              <Trophy className="size-4" />
              Leaderboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <ThemeSwitch />
        </div>
      </div>
    </header>
  );
};

