'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { syncChannelVideos } from '@/lib/api';
import { RefreshCw } from 'lucide-react';
import React, { useState } from 'react';

interface SyncVideosFormProps {
  channelId: string;
  onSuccess?: () => void;
}

export const SyncVideosForm = ({
  channelId,
  onSuccess,
}: SyncVideosFormProps) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSync = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const response = await syncChannelVideos(
        channelId,
        fromDate || undefined,
        toDate || undefined,
      );

      if (response.success) {
        const count = response.data?.length || 0;
        setSuccessMessage(
          `Successfully synced ${count} video${count !== 1 ? 's' : ''}`,
        );
        onSuccess?.();
      } else {
        setError(response.error || 'Failed to sync videos');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync videos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <RefreshCw className="size-4" />
          Sync Videos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="fromDate" className="text-sm text-muted-foreground">
              From Date
            </label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <label htmlFor="toDate" className="text-sm text-muted-foreground">
              To Date
            </label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button
            onClick={handleSync}
            disabled={isLoading}
            className="sm:w-auto"
          >
            {isLoading ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="size-4" />
                Sync
              </>
            )}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        {successMessage && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            {successMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

