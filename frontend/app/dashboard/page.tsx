import { Dashboard } from '@/components/dashboard/Dashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description:
    'Overview of YouTubers and their prediction performance',
  openGraph: {
    title: 'Dashboard | Receipts',
    description:
      'Overview of YouTubers and their prediction performance',
  },
  twitter: {
    title: 'Dashboard | Receipts',
    description:
      'Overview of YouTubers and their prediction performance',
  },
};

const DashboardPage = () => {
  return <Dashboard />;
};

export default DashboardPage;

