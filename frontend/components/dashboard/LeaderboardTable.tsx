'use client';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, getAccuracyBgColor } from '@/lib/utils';
import type { LeaderboardEntry, YouTuber } from '@/types';
import { Trophy } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

interface LeaderboardTableProps {
  entries: (LeaderboardEntry | YouTuber)[];
  isLoading?: boolean;
}

export const LeaderboardTable = ({
  entries,
  isLoading,
}: LeaderboardTableProps) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-2">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <Trophy className="size-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 font-semibold">No YouTubers yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your first YouTuber to start tracking predictions.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">Rank</TableHead>
          <TableHead>YouTuber</TableHead>
          <TableHead className="text-right">Videos</TableHead>
          <TableHead className="text-right">Predictions</TableHead>
          <TableHead className="text-right">Correct</TableHead>
          <TableHead className="text-right">Accuracy</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry, index) => {
          const rank = 'rank' in entry ? entry.rank : index + 1;
          const analyzedVideos =
            'analyzedVideos' in entry ? entry.analyzedVideos : 0;

          return (
            <TableRow
              key={entry.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
            >
              <TableCell>
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-sm font-medium',
                    rank === 1 &&
                      'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300',
                    rank === 2 &&
                      'bg-gray-300/30 text-gray-700 dark:text-gray-300',
                    rank === 3 &&
                      'bg-amber-600/20 text-amber-700 dark:text-amber-400',
                    rank > 3 && 'bg-muted text-muted-foreground',
                  )}
                >
                  {rank}
                </div>
              </TableCell>
              <TableCell>
                <Link
                  href={`/channel/${entry.id}`}
                  className="flex items-center gap-3 group"
                >
                  {entry.thumbnailUrl ? (
                    <Image
                      src={entry.thumbnailUrl}
                      alt={entry.name}
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                      {entry.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium group-hover:underline">
                    {entry.name}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right">{analyzedVideos}</TableCell>
              <TableCell className="text-right">
                {entry.totalPredictions}
              </TableCell>
              <TableCell className="text-right">
                {entry.correctPredictions}
              </TableCell>
              <TableCell className="text-right">
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono',
                    entry.totalPredictions > 0 &&
                      getAccuracyBgColor(entry.accuracyPercent),
                  )}
                >
                  {entry.totalPredictions > 0
                    ? `${entry.accuracyPercent.toFixed(1)}%`
                    : 'N/A'}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

