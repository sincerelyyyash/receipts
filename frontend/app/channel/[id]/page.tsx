import { ChannelContent } from '@/components/channel/ChannelContent';
import type { Metadata } from 'next';

interface ChannelPageProps {
  params: Promise<{ id: string }>;
}

export const generateMetadata = async ({
  params,
}: ChannelPageProps): Promise<Metadata> => {
  const { id } = await params;

  // Fetch channel data for metadata
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    try {
    const response = await fetch(`${API_BASE_URL}/channels/${id}`, {
      next: { revalidate: 0 }, // No cache - always fetch fresh data
      cache: 'no-store', // Disable Next.js caching
    });

    if (!response.ok) {
      return {
        title: 'Channel Not Found',
        description: 'The requested channel could not be found.',
      };
    }

    const data = await response.json();
    const channel = data.data;

    const accuracyText =
      channel.totalPredictions > 0
        ? `${channel.accuracyPercent.toFixed(1)}% accuracy`
        : 'No predictions yet';

    return {
      title: channel.name,
      description: `${channel.name}'s financial prediction track record. ${accuracyText} across ${channel.totalPredictions} predictions.`,
      openGraph: {
        title: `${channel.name} - Receipts`,
        description: `${channel.name}'s financial prediction track record. ${accuracyText} across ${channel.totalPredictions} predictions.`,
        images: channel.thumbnailUrl ? [{ url: channel.thumbnailUrl }] : [],
      },
      twitter: {
        card: 'summary',
        title: `${channel.name} - Receipts`,
        description: `${channel.name}'s financial prediction track record. ${accuracyText}.`,
        images: channel.thumbnailUrl ? [channel.thumbnailUrl] : [],
      },
    };
  } catch {
    return {
      title: 'Channel',
      description: 'View YouTuber prediction accuracy and analysis.',
    };
  }
};

const ChannelPage = async ({ params }: ChannelPageProps) => {
  const { id } = await params;

  return <ChannelContent channelId={id} />;
};

export default ChannelPage;
