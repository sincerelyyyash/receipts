import { YoutubeTranscript } from "youtube-transcript";
import { prisma } from "../lib/prisma.ts";
import {
  cacheKeys,
  CACHE_TTL,
  getFromCache,
  setInCache,
} from "../lib/cache.ts";
import { NotFoundError, ExternalServiceError } from "../middleware/errorHandler.ts";
import type { TranscriptSegment } from "../types/index.ts";

// Format seconds to timestamp string (MM:SS or HH:MM:SS)
const formatTimestamp = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Fetch transcript from YouTube
export const fetchTranscript = async (
  videoId: string
): Promise<TranscriptSegment[]> => {
  const cacheKey = cacheKeys.transcript(videoId);

  // Check cache first
  const cached = await getFromCache<TranscriptSegment[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch from YouTube (no API key needed)
    const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId);

    const transcript: TranscriptSegment[] = rawTranscript.map((segment) => {
      const offsetSec = Math.floor(segment.offset / 1000);
      return {
        text: segment.text,
        offsetSec,
        timestamp: formatTimestamp(offsetSec),
        duration: segment.duration,
      };
    });

    // Cache the transcript
    await setInCache(cacheKey, transcript, CACHE_TTL.TRANSCRIPT);

    return transcript;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new ExternalServiceError("YouTube Transcript", message);
  }
};

// Fetch and save transcript to database
export const fetchAndSaveTranscript = async (videoDbId: string) => {
  // Get video from database
  const video = await prisma.video.findUnique({
    where: { id: videoDbId },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  // Fetch transcript using YouTube video ID
  const transcript = await fetchTranscript(video.videoId);

  // Save to database
  await prisma.video.update({
    where: { id: videoDbId },
    data: {
      transcript: JSON.stringify(transcript),
      transcriptFetchedAt: new Date(),
    },
  });

  return transcript;
};

// Get transcript from database or fetch if not available
export const getTranscript = async (
  videoDbId: string
): Promise<TranscriptSegment[]> => {
  const video = await prisma.video.findUnique({
    where: { id: videoDbId },
    select: { videoId: true, transcript: true },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  // Return from database if available
  if (video.transcript) {
    return JSON.parse(video.transcript);
  }

  // Otherwise fetch and save
  return fetchAndSaveTranscript(videoDbId);
};

// Get full transcript text (for AI processing)
export const getFullTranscriptText = async (videoDbId: string): Promise<string> => {
  const segments = await getTranscript(videoDbId);
  return segments.map((s) => s.text).join(" ");
};

// Get transcript with context windows (for extracting predictions)
export const getTranscriptWithContext = async (
  videoDbId: string,
  windowSize: number = 5
): Promise<{ text: string; startTimestamp: string; endTimestamp: string }[]> => {
  const segments = await getTranscript(videoDbId);

  const windows: { text: string; startTimestamp: string; endTimestamp: string }[] = [];

  for (let i = 0; i < segments.length; i += windowSize) {
    const windowSegments = segments.slice(i, i + windowSize);
    if (windowSegments.length === 0) continue;

    const firstSegment = windowSegments[0];
    const lastSegment = windowSegments[windowSegments.length - 1];

    if (firstSegment && lastSegment) {
      windows.push({
        text: windowSegments.map((s) => s.text).join(" "),
        startTimestamp: firstSegment.timestamp,
        endTimestamp: lastSegment.timestamp,
      });
    }
  }

  return windows;
};

// Batch fetch transcripts for multiple videos
export const batchFetchTranscripts = async (videoDbIds: string[]) => {
  const results: { videoId: string; success: boolean; error?: string }[] = [];

  for (const videoDbId of videoDbIds) {
    try {
      await fetchAndSaveTranscript(videoDbId);
      results.push({ videoId: videoDbId, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ videoId: videoDbId, success: false, error: message });
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
};

