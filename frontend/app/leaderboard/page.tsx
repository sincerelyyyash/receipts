import { Leaderboard } from '@/components/dashboard/Leaderboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.',
  openGraph: {
    title: 'Leaderboard | Receipts',
    description:
      'Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.',
  },
  twitter: {
    title: 'Leaderboard | Receipts',
    description:
      'Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.',
  },
};

const LeaderboardPage = () => {
  return <Leaderboard />;
};

export default LeaderboardPage;

