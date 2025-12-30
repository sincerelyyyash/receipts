import { DashboardContent } from '@/components/dashboard/DashboardContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.',
  openGraph: {
    title: 'Receipts - YouTuber Prediction Leaderboard',
    description:
      'Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.',
  },
  twitter: {
    title: 'Receipts - YouTuber Prediction Leaderboard',
    description:
      'Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.',
  },
};

const HomePage = () => {
  return <DashboardContent />;
};

export default HomePage;
