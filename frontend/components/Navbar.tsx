'use client';

import React from 'react';

import { ThemeSwitch } from './ThemeSwitch';

export const Navbar = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-6xl flex h-14 items-center justify-end px-4">
        <nav className="flex items-center gap-4">
          <ThemeSwitch />
        </nav>
      </div>
    </header>
  );
};

