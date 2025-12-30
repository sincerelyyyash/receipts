'use client';

import { LeaderboardTable } from '@/components/dashboard/LeaderboardTable';
import { Container } from '@/components/Container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getLeaderboard } from '@/lib/api';
import type { LeaderboardEntry } from '@/types';
import { BarChart3 } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

export const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const leaderboardRes = await getLeaderboard();

      if (leaderboardRes.success && leaderboardRes.data) {
        setLeaderboard(leaderboardRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
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
          <h1 className="text-3xl font-bold">Leaderboard</h1>
          <p className="text-muted-foreground">
            Track YouTuber financial prediction accuracy. See who gets it right and who misses the mark.
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

      {/* Leaderboard Table */}
      <Card className="mt-8">
        <CardHeader className="border-b">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            YouTuber Rankings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LeaderboardTable entries={leaderboard} isLoading={isLoading} />
        </CardContent>
      </Card>
    </Container>
  );
};

