'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatNumber, getAccuracyBgColor } from '@/lib/utils';
import type { YouTuberWithAnalysis } from '@/types';
import { ArrowLeft, ExternalLink, Users, Video } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

interface YouTuberProfileProps {
  youtuber: YouTuberWithAnalysis;
}

export const YouTuberProfile = ({ youtuber }: YouTuberProfileProps) => {
  const channelUrl = `https://www.youtube.com/channel/${youtuber.channelId}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Back Button */}
      <Link href="/">
        <Button variant="ghost" size="sm" className="gap-2">
          <ArrowLeft className="size-4" />
          Back to Receipts
        </Button>
      </Link>

      {/* Profile Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Avatar */}
        {youtuber.thumbnailUrl ? (
          <Image
            src={youtuber.thumbnailUrl}
            alt={youtuber.name}
            width={120}
            height={120}
            className="size-24 shrink-0 rounded-full object-cover sm:size-28"
          />
        ) : (
          <div className="flex size-24 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-3xl font-bold sm:size-28">
            {youtuber.name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Info */}
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <h1 className="text-2xl font-bold sm:text-3xl">{youtuber.name}</h1>
            <a
              href={channelUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-4" />
              YouTube Channel
            </a>
          </div>

          {youtuber.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {youtuber.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="size-4" />
              <span className="font-medium text-foreground">
                {formatNumber(youtuber.subscriberCount)}
              </span>
              subscribers
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Video className="size-4" />
              <span className="font-medium text-foreground">
                {youtuber.videoCount}
              </span>
              videos
            </div>
          </div>

          {/* Prediction Stats */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge
              variant="outline"
              className={
                youtuber.totalPredictions > 0
                  ? getAccuracyBgColor(youtuber.accuracyPercent)
                  : ''
              }
            >
              {youtuber.totalPredictions > 0
                ? `${youtuber.accuracyPercent.toFixed(1)}% Accuracy`
                : 'No predictions yet'}
            </Badge>
            <Badge variant="secondary">
              {youtuber.totalPredictions} predictions
            </Badge>
            <Badge variant="secondary">
              {youtuber.correctPredictions} correct
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
};

