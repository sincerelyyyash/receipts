'use client';

import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import React, { useEffect, useState } from 'react';

import Moon from './icons/Moon';
import Sun from './icons/Sun';
import { Button } from './ui/button';

export const ThemeSwitch = ({ className }: { className?: string }) => {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={cn('size-9', className)}
        aria-label="Toggle theme"
      >
        <span className="sr-only">Toggle theme</span>
        <div className="size-4 animate-pulse rounded-full bg-muted" />
      </Button>
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'size-9 cursor-pointer p-0 transition-all duration-300 active:scale-95',
        className,
      )}
      onClick={handleToggleTheme}
      aria-label="Toggle theme"
    >
      <span className="sr-only">Toggle theme</span>
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
};

