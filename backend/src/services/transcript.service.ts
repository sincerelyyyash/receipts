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

// Transcript fetching configuration
const TRANSCRIPT_CONFIG = {
  // Try multiple language codes in order of preference
  languageCodes: [
    "en",      // English
    "en-US",   // English (US)
    "en-GB",   // English (UK)
    "a.en",    // Auto-generated English
    "hi",      // Hindi (common for Indian finance YouTubers)
    "es",      // Spanish
    "pt",      // Portuguese
    "de",      // German
    "fr",      // French
    "ja",      // Japanese
    "ko",      // Korean
  ],
  maxRetries: 3,
  retryDelay: 2000, // 2 seconds
  backoffMultiplier: 2,
};

// Sleep helper for retry delays
const sleep = (ms: number): Promise<void> => 
  new Promise((resolve) => setTimeout(resolve, ms));

// Check if error is transient (should retry) or permanent
const isTransientError = (error: Error): boolean => {
  const message = error.message.toLowerCase();
  return (
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("econnreset") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("temporarily")
  );
};

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

// Fetch transcript from YouTube with language fallbacks and retry logic
export const fetchTranscript = async (
  videoId: string
): Promise<TranscriptSegment[]> => {
  const cacheKey = cacheKeys.transcript(videoId);

  // Check cache first
  const cached = await getFromCache<TranscriptSegment[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const attemptedLanguages: string[] = [];
  let lastError: Error | null = null;

  // Try each language code with retry logic
  for (const langCode of TRANSCRIPT_CONFIG.languageCodes) {
    attemptedLanguages.push(langCode);
    
    // Retry logic for each language
    for (let attempt = 1; attempt <= TRANSCRIPT_CONFIG.maxRetries; attempt++) {
      try {
        // Fetch from YouTube with specific language
        const rawTranscript = await YoutubeTranscript.fetchTranscript(videoId, {
          lang: langCode,
        });

        // Successfully fetched - transform and cache
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

        console.log(`✅ Transcript fetched for ${videoId} using language: ${langCode}`);
        return transcript;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error("Unknown error");
        const errorMsg = lastError.message;

        // Check if this is a permanent error (no captions for this language)
        if (
          errorMsg.includes("Could not find") ||
          errorMsg.includes("No transcript") ||
          errorMsg.includes("Subtitles are disabled") ||
          errorMsg.includes("disabled for this video")
        ) {
          // This language doesn't exist, try next language
          break;
        }

        // Check if this is a transient error that should be retried
        if (isTransientError(lastError) && attempt < TRANSCRIPT_CONFIG.maxRetries) {
          const delay = TRANSCRIPT_CONFIG.retryDelay * Math.pow(TRANSCRIPT_CONFIG.backoffMultiplier, attempt - 1);
          console.log(`⚠️ Transient error for ${videoId} (${langCode}), attempt ${attempt}/${TRANSCRIPT_CONFIG.maxRetries}. Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        // Other error or max retries reached, try next language
        break;
      }
    }
  }

  // All languages and retries exhausted
  const errorMessage = lastError?.message || "Unknown error";
  console.error(`❌ Failed to fetch transcript for ${videoId} after trying languages: ${attemptedLanguages.join(", ")}. Last error: ${errorMessage}`);
  
  throw new ExternalServiceError(
    "YouTube Transcript",
    `No transcripts available. Tried languages: ${attemptedLanguages.join(", ")}. Error: ${errorMessage}`
  );
};

// Fetch and save transcript to database with detailed error logging
export const fetchAndSaveTranscript = async (videoDbId: string) => {
  // Get video from database with metadata for better logging
  const video = await prisma.video.findUnique({
    where: { id: videoDbId },
    include: {
      youtuber: {
        select: { name: true },
      },
    },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  try {
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

    console.log(`📝 Saved transcript for: ${video.title} (${video.youtuber.name})`);
    return transcript;
  } catch (error) {
    // Log detailed error information
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const videoDate = video.publishedAt.toISOString().split('T')[0];
    
    console.error(`❌ Transcript fetch failed for video:
      - Title: ${video.title}
      - Channel: ${video.youtuber.name}
      - Video ID: ${video.videoId}
      - Published: ${videoDate}
      - Duration: ${Math.floor(video.duration / 60)}m ${video.duration % 60}s
      - Error: ${errorMessage}
    `);

    // Re-throw the error to be handled by the pipeline
    throw error;
  }
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

