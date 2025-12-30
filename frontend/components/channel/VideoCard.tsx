'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { analyzeVideo, fetchTranscript } from '@/lib/api';
import { cn, formatDate, getAccuracyBgColor } from '@/lib/utils';
import type { Video } from '@/types';
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';

import { PredictionCard } from './PredictionCard';

interface VideoCardProps {
  video: Video;
  onUpdate?: () => void;
}

export const VideoCard = ({ video, onUpdate }: VideoCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchTranscript = async () => {
    setError(null);
    setIsLoadingTranscript(true);

    try {
      const response = await fetchTranscript(video.id);
      if (response.success) {
        onUpdate?.();
      } else {
        setError(response.error || 'Failed to fetch transcript');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to fetch transcript',
      );
    } finally {
      setIsLoadingTranscript(false);
    }
  };

  const handleAnalyze = async () => {
    setError(null);
    setIsAnalyzing(true);

    try {
      const response = await analyzeVideo(video.id);
      if (response.success) {
        onUpdate?.();
      } else {
        setError(response.error || 'Failed to analyze video');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze video');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const predictions = video.predictions || [];
  const hasPredictions = predictions.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Video Header */}
        <div className="flex gap-4 p-4">
          {/* Thumbnail */}
          <div className="relative shrink-0">
            {video.thumbnailUrl ? (
              <Image
                src={video.thumbnailUrl}
                alt={video.title}
                width={160}
                height={90}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="flex h-[90px] w-[160px] items-center justify-center rounded-md bg-muted">
                <FileText className="size-8 text-muted-foreground" />
              </div>
            )}
            {video.duration && (
              <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 py-0.5 text-xs text-white">
                {video.duration}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium line-clamp-2">{video.title}</h3>
              <a
                href={video.url || `https://www.youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                aria-label="Watch on YouTube"
              >
                <ExternalLink className="size-3.5" />
                <span className="hidden sm:inline">Watch</span>
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(video.publishedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {video.viewCount.toLocaleString()} views
              </span>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap items-center gap-2">
              {video.transcript && (
                <Badge variant="secondary" className="gap-1">
                  <FileText className="size-3" />
                  Transcript
                </Badge>
              )}
              {video.analyzed && (
                <Badge variant="success" className="gap-1">
                  <CheckCircle className="size-3" />
                  Analyzed
                </Badge>
              )}
              {hasPredictions && (
                <Badge variant="outline">
                  {predictions.length} prediction
                  {predictions.length !== 1 ? 's' : ''}
                </Badge>
              )}
              {video.avgScore !== null && (
                <Badge
                  variant="outline"
                  className={cn('font-mono', getAccuracyBgColor(video.avgScore))}
                >
                  {video.avgScore.toFixed(1)}% avg
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 mt-auto pt-2">
              {!video.transcript && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleFetchTranscript}
                  disabled={isLoadingTranscript}
                >
                  {isLoadingTranscript ? (
                    <>
                      <div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <FileText className="size-3" />
                      Get Transcript
                    </>
                  )}
                </Button>
              )}
              {video.transcript && !video.analyzed && (
                <Button
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3" />
                      Analyze
                    </>
                  )}
                </Button>
              )}
              {hasPredictions && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleToggleExpand}
                  className="ml-auto"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="size-4" />
                      Hide Predictions
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4" />
                      Show Predictions
                    </>
                  )}
                </Button>
              )}
            </div>

            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
        </div>

        {/* Predictions */}
        {isExpanded && hasPredictions && (
          <div className="border-t bg-muted/30 p-4">
            <div className="flex flex-col gap-3">
              {predictions.map((prediction) => (
                <PredictionCard
                  key={prediction.id}
                  prediction={prediction}
                  videoId={video.videoId}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

