'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatNumber, getAccuracyBgColor } from '@/lib/utils';
import type { LeaderboardEntry, YouTuber } from '@/types';
import { Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

interface YouTuberCardProps {
  youtuber: YouTuber | LeaderboardEntry;
}

export const YouTuberCard = ({ youtuber }: YouTuberCardProps) => {
  const subscriberCount =
    'subscriberCount' in youtuber ? youtuber.subscriberCount : 0;

  return (
    <Link
      href={`/channel/${youtuber.id}`}
      className="group block"
      tabIndex={0}
      aria-label={`View ${youtuber.name}'s channel`}
    >
      <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="flex flex-col items-center gap-4 p-6">
          {/* Avatar */}
          {youtuber.thumbnailUrl ? (
            <Image
              src={youtuber.thumbnailUrl}
              alt={youtuber.name}
              width={80}
              height={80}
              className="size-20 rounded-full object-cover ring-2 ring-border transition-transform duration-200 group-hover:ring-primary/50"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl font-bold ring-2 ring-border transition-transform duration-200 group-hover:ring-primary/50">
              {youtuber.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* Name */}
          <h3 className="text-center font-semibold text-lg line-clamp-1 group-hover:text-primary transition-colors">
            {youtuber.name}
          </h3>

          {/* Subscriber Count */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Users className="size-4" />
            <span>{formatNumber(subscriberCount)} subscribers</span>
          </div>

          {/* Accuracy Badge */}
          <Badge
            variant="outline"
            className={cn(
              'font-mono text-sm',
              youtuber.totalPredictions > 0 &&
                getAccuracyBgColor(youtuber.accuracyPercent)
            )}
          >
            {youtuber.totalPredictions > 0
              ? `${youtuber.accuracyPercent.toFixed(1)}% Accuracy`
              : 'No predictions yet'}
          </Badge>
        </CardContent>
      </Card>
    </Link>
  );
};

