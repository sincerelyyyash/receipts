import { cn } from '@/lib/utils';
import React from 'react';

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const Container = ({ children, className }: ContainerProps) => {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-6xl px-4 animate-fade-in-blur',
        className,
      )}
    >
      {children}
    </div>
  );
};

