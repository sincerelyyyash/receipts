'use client';

import { Container } from '@/components/Container';
import { SyncVideosForm } from '@/components/channel/SyncVideosForm';
import { VideoCard } from '@/components/channel/VideoCard';
import { YouTuberProfile } from '@/components/channel/YouTuberProfile';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getChannel,
  getChannelVideos,
  getPipelineStatus,
  startPipeline,
  type PipelineStatus,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Video, YouTuberWithAnalysis } from '@/types';
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  RefreshCw,
  Video as VideoIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

interface ChannelContentProps {
  channelId: string;
}

export const ChannelContent = ({ channelId }: ChannelContentProps) => {
  const [youtuber, setYoutuber] = useState<YouTuberWithAnalysis | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(
    null
  );
  const [isStartingPipeline, setIsStartingPipeline] = useState(false);

  const fetchData = useCallback(async () => {
    if (!channelId) return;

    try {
      setIsLoading(true);
      setError(null);

      const [channelRes, videosRes] = await Promise.all([
        getChannel(channelId),
        getChannelVideos(channelId, 1, 50),
      ]);

      if (channelRes.success && channelRes.data) {
        setYoutuber(channelRes.data);
      } else {
        setError(channelRes.error || 'Failed to load channel');
      }

      if (videosRes.success && videosRes.data) {
        setVideos(videosRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

  const fetchPipelineStatus = useCallback(async () => {
    if (!channelId) return;

    try {
      const res = await getPipelineStatus(channelId);
      if (res.success && res.data) {
        setPipelineStatus(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch pipeline status:', err);
    }
  }, [channelId]);

  useEffect(() => {
    fetchData();
    fetchPipelineStatus();
  }, [fetchData, fetchPipelineStatus]);

  // Poll for pipeline status when processing
  useEffect(() => {
    const isProcessing =
      pipelineStatus &&
      ['syncing', 'fetching-transcripts', 'analyzing'].includes(
        pipelineStatus.status
      );

    if (!isProcessing) return;

    const interval = setInterval(() => {
      fetchPipelineStatus();
      fetchData(); // Also refresh data to show new videos
    }, 5000);

    return () => clearInterval(interval);
  }, [pipelineStatus, fetchPipelineStatus, fetchData]);

  const handleDataUpdate = () => {
    fetchData();
    fetchPipelineStatus();
  };

  const handleStartPipeline = async () => {
    setIsStartingPipeline(true);
    try {
      const res = await startPipeline(channelId);
      if (res.success) {
        fetchPipelineStatus();
      }
    } catch (err) {
      console.error('Failed to start pipeline:', err);
    } finally {
      setIsStartingPipeline(false);
    }
  };

  const isPipelineActive =
    pipelineStatus &&
    ['syncing', 'fetching-transcripts', 'analyzing'].includes(
      pipelineStatus.status
    );

  const getPipelineProgress = () => {
    if (!pipelineStatus || pipelineStatus.totalVideos === 0) return 0;

    const transcriptProgress =
      (pipelineStatus.transcriptsFetched / pipelineStatus.totalVideos) * 50;
    const analysisProgress =
      (pipelineStatus.videosAnalyzed / pipelineStatus.totalVideos) * 50;

    if (pipelineStatus.status === 'syncing') return 10;
    if (pipelineStatus.status === 'fetching-transcripts')
      return 10 + transcriptProgress;
    if (pipelineStatus.status === 'analyzing')
      return 60 + analysisProgress;
    if (pipelineStatus.status === 'completed') return 100;

    return 0;
  };

  if (isLoading) {
    return (
      <Container className="py-8">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-40" />
          <div className="flex gap-6">
            <Skeleton className="size-24 shrink-0 rounded-full sm:size-28" />
            <div className="flex flex-1 flex-col gap-3">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-full max-w-md" />
              <div className="flex gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-12 w-48" />
          <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        </div>
      </Container>
    );
  }

  if (error || !youtuber) {
    return (
      <Container className="py-8">
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <p className="text-destructive">{error || 'Channel not found'}</p>
          </CardContent>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-8">
      <div className="flex flex-col gap-8">
        {/* Profile Header */}
        <YouTuberProfile youtuber={youtuber} />

        {/* Pipeline Status Card */}
        {pipelineStatus && pipelineStatus.status !== 'idle' && (
          <Card
            className={cn(
              'border-l-4',
              pipelineStatus.status === 'completed' && 'border-l-green-500',
              pipelineStatus.status === 'failed' && 'border-l-red-500',
              isPipelineActive && 'border-l-blue-500'
            )}
          >
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                {isPipelineActive && (
                  <Loader2 className="size-5 animate-spin text-blue-500" />
                )}
                {pipelineStatus.status === 'completed' && (
                  <CheckCircle className="size-5 text-green-500" />
                )}
                {pipelineStatus.status === 'failed' && (
                  <AlertCircle className="size-5 text-red-500" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {pipelineStatus.status === 'syncing' && 'Syncing Videos...'}
                    {pipelineStatus.status === 'fetching-transcripts' &&
                      'Fetching Transcripts...'}
                    {pipelineStatus.status === 'analyzing' &&
                      'Analyzing Videos...'}
                    {pipelineStatus.status === 'completed' &&
                      'Analysis Complete'}
                    {pipelineStatus.status === 'failed' && 'Pipeline Failed'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {pipelineStatus.currentStep}
                  </p>
                  {pipelineStatus.error && (
                    <p className="text-sm text-destructive mt-1">
                      {pipelineStatus.error}
                    </p>
                  )}
                </div>
                <div className="text-right text-sm text-muted-foreground">
                  <p>
                    Videos: {pipelineStatus.videosAnalyzed}/
                    {pipelineStatus.totalVideos}
                  </p>
                  <p>Transcripts: {pipelineStatus.transcriptsFetched}</p>
                </div>
              </div>
              {isPipelineActive && (
                <Progress value={getPipelineProgress()} className="mt-3 h-2" />
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="py-4">
            <CardContent>
              <p className="text-sm text-muted-foreground">Total Videos</p>
              <p className="text-2xl font-bold">
                {youtuber.analysisStatus.totalVideos}
              </p>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent>
              <p className="text-sm text-muted-foreground">Analyzed</p>
              <p className="text-2xl font-bold">
                {youtuber.analysisStatus.analyzedVideos}
              </p>
            </CardContent>
          </Card>
          <Card className="py-4">
            <CardContent>
              <p className="text-sm text-muted-foreground">Avg Score</p>
              <p className="text-2xl font-bold">
                {youtuber.analysisStatus.avgScore !== null
                  ? `${youtuber.analysisStatus.avgScore.toFixed(1)}%`
                  : 'N/A'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Manual Pipeline Trigger / Sync Form */}
        {!isPipelineActive && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Button
                onClick={handleStartPipeline}
                disabled={isStartingPipeline}
                className="gap-2"
              >
                {isStartingPipeline ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="size-4" />
                    Start Auto Analysis
                  </>
                )}
              </Button>
              <p className="text-sm text-muted-foreground">
                Automatically sync videos, fetch transcripts, and analyze
                predictions
              </p>
            </div>

            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Manual sync options
              </summary>
              <div className="mt-4">
                <SyncVideosForm
                  channelId={channelId}
                  onSuccess={handleDataUpdate}
                />
              </div>
            </details>
          </div>
        )}

        {/* Videos List */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <VideoIcon className="size-5" />
              <h2 className="text-xl font-semibold">
                Videos ({videos.length})
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDataUpdate}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>

          {videos.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <VideoIcon className="mx-auto size-12 text-muted-foreground" />
                <h3 className="mt-4 font-semibold">No videos synced yet</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {isPipelineActive
                    ? 'Videos are being synced...'
                    : 'Click "Start Auto Analysis" to begin processing this channel.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-4">
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  onUpdate={handleDataUpdate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Container>
  );
};
