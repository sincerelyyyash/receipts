'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn, getAccuracyBgColor } from '@/lib/utils';
import type { Prediction } from '@/types';
import {
  CheckCircle,
  Clock,
  ExternalLink,
  HelpCircle,
  Play,
  XCircle,
} from 'lucide-react';
import React from 'react';

interface PredictionCardProps {
  prediction: Prediction;
  videoId?: string;
}

const predictionTypeColors: Record<string, string> = {
  stock: 'bg-blue-500/20 text-blue-700 dark:text-blue-300',
  market: 'bg-purple-500/20 text-purple-700 dark:text-purple-300',
  sector: 'bg-orange-500/20 text-orange-700 dark:text-orange-300',
  macro: 'bg-green-500/20 text-green-700 dark:text-green-300',
  other: 'bg-gray-500/20 text-gray-700 dark:text-gray-300',
};

export const PredictionCard = ({ prediction, videoId }: PredictionCardProps) => {
  const isVerified = prediction.verified;
  const isCorrect =
    isVerified && prediction.accuracyScore !== null && prediction.accuracyScore >= 70;
  const isPartial =
    isVerified &&
    prediction.accuracyScore !== null &&
    prediction.accuracyScore >= 40 &&
    prediction.accuracyScore < 70;
  const isWrong =
    isVerified && prediction.accuracyScore !== null && prediction.accuracyScore < 40;

  // Generate YouTube timestamp link
  const youtubeTimestampUrl = videoId
    ? `https://www.youtube.com/watch?v=${videoId}&t=${prediction.timestampSec}s`
    : null;

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-xs', predictionTypeColors[prediction.predictionType])}
            >
              {prediction.predictionType}
            </Badge>

            {/* Clickable Timestamp */}
            {youtubeTimestampUrl ? (
              <a
                href={youtubeTimestampUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline transition-colors"
                aria-label={`Jump to ${prediction.timestampFormatted} in video`}
                tabIndex={0}
              >
                <Play className="size-3" />
                {prediction.timestampFormatted}
              </a>
            ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3" />
              {prediction.timestampFormatted}
            </span>
            )}

            {prediction.targetDate && (
              <span className="text-xs text-muted-foreground">
                Target: {prediction.targetDate}
              </span>
            )}
            <Badge
              variant="secondary"
              className="text-xs ml-auto"
            >
              {(prediction.confidence * 100).toFixed(0)}% confidence
            </Badge>
          </div>

          {/* Prediction Text (acts as transcript snippet) */}
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              Prediction Statement:
            </p>
            <p className="text-sm italic">&ldquo;{prediction.predictionText}&rdquo;</p>
          </div>

          {/* Verification Status */}
          {isVerified ? (
            <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-3">
              {/* Accuracy Score */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {isCorrect && (
                    <CheckCircle className="size-4 text-green-600 dark:text-green-400" />
                  )}
                  {isPartial && (
                    <HelpCircle className="size-4 text-yellow-600 dark:text-yellow-400" />
                  )}
                  {isWrong && (
                    <XCircle className="size-4 text-red-600 dark:text-red-400" />
                  )}
                  <span className="text-sm font-medium">
                    {isCorrect && 'Correct'}
                    {isPartial && 'Partially Correct'}
                    {isWrong && 'Incorrect'}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    'font-mono',
                    prediction.accuracyScore !== null &&
                      getAccuracyBgColor(prediction.accuracyScore),
                  )}
                >
                  {prediction.accuracyScore?.toFixed(0)}%
                </Badge>
              </div>

              {/* Progress Bar */}
              <Progress
                value={prediction.accuracyScore || 0}
                className={cn(
                  'h-2',
                  isCorrect && '[&>div]:bg-green-500',
                  isPartial && '[&>div]:bg-yellow-500',
                  isWrong && '[&>div]:bg-red-500',
                )}
              />

              {/* Actual Outcome */}
              {prediction.actualOutcome && (
                <div className="mt-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Actual Outcome:
                  </p>
                  <p className="text-sm">{prediction.actualOutcome}</p>
                </div>
              )}

              {/* Explanation */}
              {prediction.explanation && (
                <div className="mt-1">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Analysis:
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {prediction.explanation}
                  </p>
                </div>
              )}

              {/* Sources */}
              {prediction.searchSources && prediction.searchSources.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Sources:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {prediction.searchSources.slice(0, 3).map((source, index) => (
                      <a
                        key={index}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        tabIndex={0}
                        aria-label={`View source ${index + 1}`}
                      >
                        <ExternalLink className="size-3" />
                        Source {index + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              Pending verification
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
