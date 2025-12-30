import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getAccuracyColor = (accuracy: number): string => {
  if (accuracy >= 70) return 'accuracy-high';
  if (accuracy >= 40) return 'accuracy-medium';
  return 'accuracy-low';
};

export const getAccuracyBgColor = (accuracy: number): string => {
  if (accuracy >= 70) return 'bg-green-500/20 text-green-700 dark:text-green-300';
  if (accuracy >= 40) return 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300';
  return 'bg-red-500/20 text-red-700 dark:text-red-300';
};

