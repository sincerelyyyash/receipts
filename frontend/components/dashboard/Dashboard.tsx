'use client';

import { StatsCard } from '@/components/dashboard/StatsCard';
import { YouTuberCard } from '@/components/dashboard/YouTuberCard';
import { Container } from '@/components/Container';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getChannels, getPlatformStats } from '@/lib/api';
import type { PlatformStats, YouTuber } from '@/types';
import {
  BarChart3,
  CheckCircle,
  Target,
  Users,
  Video,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

export const Dashboard = () => {
  const [channels, setChannels] = useState<YouTuber[]>([]);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [channelsRes, statsRes] = await Promise.all([
        getChannels(),
        getPlatformStats(),
      ]);

      if (channelsRes.success && channelsRes.data) {
        setChannels(channelsRes.data);
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <Container className="py-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of YouTubers and their prediction performance
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="mt-8 border-destructive">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-8">
        {isLoading ? (
          <>
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="py-4">
                <CardContent className="flex items-center gap-4">
                  <Skeleton className="size-12 rounded-lg" />
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </>
        ) : stats ? (
          <>
            <StatsCard
              title="Total YouTubers"
              value={stats.totalYouTubers}
              icon={Users}
            />
            <StatsCard
              title="Videos Analyzed"
              value={`${stats.analyzedVideos}/${stats.totalVideos}`}
              icon={Video}
            />
            <StatsCard
              title="Total Predictions"
              value={stats.totalPredictions}
              description={`${stats.verifiedPredictions} verified`}
              icon={Target}
            />
            <StatsCard
              title="Average Accuracy"
              value={
                stats.totalPredictions > 0
                  ? `${stats.avgAccuracy.toFixed(1)}%`
                  : 'N/A'
              }
              icon={CheckCircle}
            />
          </>
        ) : (
          <>
            <StatsCard title="Total YouTubers" value={0} icon={Users} />
            <StatsCard title="Videos Analyzed" value="0/0" icon={Video} />
            <StatsCard title="Total Predictions" value={0} icon={Target} />
            <StatsCard title="Average Accuracy" value="N/A" icon={BarChart3} />
          </>
        )}
      </div>

      {/* YouTuber Cards Grid */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">YouTubers</h2>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="py-6">
                <CardContent className="flex flex-col items-center gap-4">
                  <Skeleton className="size-20 rounded-full" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <Users className="size-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 font-semibold">No YouTubers yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                No YouTubers are currently being tracked.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {channels.map((channel) => (
              <YouTuberCard key={channel.id} youtuber={channel} />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
};

