'use client';

import { BarChart3 } from 'lucide-react';
import Link from 'next/link';
import React from 'react';

import { ThemeSwitch } from './ThemeSwitch';

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold transition-opacity hover:opacity-80"
        >
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BarChart3 className="size-4" />
          </div>
          <span className="hidden sm:inline-block">Receipts</span>
        </Link>

        <nav className="flex items-center gap-4">
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
};

