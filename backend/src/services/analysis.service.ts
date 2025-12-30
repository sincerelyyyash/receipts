import { prisma } from "../lib/prisma.ts";
import { NotFoundError } from "../middleware/errorHandler.ts";
import { getTranscript, getTranscriptWithContext } from "./transcript.service.ts";
import {
  extractPredictions,
  extractPredictionsWithTimestamps,
  compareOutcome,
} from "./gemini.service.ts";
import { searchForVerification } from "./exa.service.ts";
import { recalculateYouTuberScore } from "./channel.service.ts";

interface AnalysisResult {
  videoId: string;
  predictionsFound: number;
  predictionsVerified: number;
  avgScore: number;
  predictions: {
    id: string;
    text: string;
    timestamp: string;
    score: number | null;
    verified: boolean;
  }[];
}

// Analyze a single video - extract predictions and verify them
export const analyzeVideo = async (videoDbId: string): Promise<AnalysisResult> => {
  // Get video details
  const video = await prisma.video.findUnique({
    where: { id: videoDbId },
    include: { youtuber: true },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  // Get transcript
  let transcript;
  try {
    transcript = await getTranscript(videoDbId);
  } catch (error) {
    // If transcript fetch fails, try to continue with any existing transcript
    if (video.transcript) {
      transcript = JSON.parse(video.transcript);
    } else {
      throw error;
    }
  }

  // Check if transcript is unavailable placeholder
  if (
    transcript.length === 1 &&
    transcript[0]?.text === "TRANSCRIPT_UNAVAILABLE"
  ) {
    console.log(`⏭️ Skipping video ${videoDbId} - transcript unavailable`);
    // Mark as analyzed but with no predictions
    await prisma.video.update({
      where: { id: video.id },
      data: {
        analyzed: true,
        analyzedAt: new Date(),
        avgScore: 0,
      },
    });
    return {
      videoId: video.id,
      predictionsFound: 0,
      predictionsVerified: 0,
      avgScore: 0,
      predictions: [],
    };
  }

  // Get transcript windows for better timestamp extraction
  const transcriptWindows = await getTranscriptWithContext(videoDbId, 5);

  // Extract predictions with timestamps
  let extractedPredictions = await extractPredictionsWithTimestamps(
    transcriptWindows,
    video.publishedAt
  );

  // Fallback to simple extraction if no predictions found with timestamps
  if (extractedPredictions.length === 0) {
    const fullText = transcript.map((s: { text: string }) => s.text).join(" ");
    extractedPredictions = await extractPredictions(fullText, video.publishedAt);
  }

  // Save predictions to database
  const savedPredictions = await Promise.all(
    extractedPredictions.map(async (pred) => {
      return prisma.prediction.create({
        data: {
          videoId: video.id,
          timestampSec: pred.timestampSec,
          timestampFormatted: pred.timestampFormatted,
          predictionText: pred.predictionText,
          predictionType: pred.predictionType,
          targetDate: pred.targetDate ? new Date(pred.targetDate) : null,
        },
      });
    })
  );

  // Verify predictions against actual outcomes
  const verifiedPredictions: {
    id: string;
    text: string;
    timestamp: string;
    score: number | null;
    verified: boolean;
  }[] = [];

  for (const prediction of savedPredictions) {
    try {
      // Search for actual market data
      const { combinedText, sources } = await searchForVerification(
        prediction.predictionText,
        video.publishedAt
      );

      if (combinedText.length > 0) {
        // Compare prediction with actual outcome
        const verification = await compareOutcome(
          prediction.predictionText,
          video.publishedAt,
          combinedText,
          sources
        );

        // Update prediction with verification results
        await prisma.prediction.update({
          where: { id: prediction.id },
          data: {
            actualOutcome: verification.actualOutcome,
            accuracyScore: verification.accuracyScore,
            explanation: verification.explanation,
            searchSources: sources,
            verifiedAt: new Date(),
          },
        });

        verifiedPredictions.push({
          id: prediction.id,
          text: prediction.predictionText,
          timestamp: prediction.timestampFormatted,
          score: verification.accuracyScore,
          verified: true,
        });
      } else {
        verifiedPredictions.push({
          id: prediction.id,
          text: prediction.predictionText,
          timestamp: prediction.timestampFormatted,
          score: null,
          verified: false,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error verifying prediction ${prediction.id}:`, error);
      verifiedPredictions.push({
        id: prediction.id,
        text: prediction.predictionText,
        timestamp: prediction.timestampFormatted,
        score: null,
        verified: false,
      });
    }
  }

  // Calculate average score for verified predictions
  const verifiedScores = verifiedPredictions
    .filter((p) => p.score !== null)
    .map((p) => p.score as number);

  const avgScore =
    verifiedScores.length > 0
      ? verifiedScores.reduce((a, b) => a + b, 0) / verifiedScores.length
      : 0;

  // Update video with analysis results
  await prisma.video.update({
    where: { id: video.id },
    data: {
      avgScore,
      analyzed: true,
      analyzedAt: new Date(),
    },
  });

  // Recalculate YouTuber's overall score
  await recalculateYouTuberScore(video.youtuberId);

  return {
    videoId: video.id,
    predictionsFound: savedPredictions.length,
    predictionsVerified: verifiedScores.length,
    avgScore,
    predictions: verifiedPredictions,
  };
};

// Batch analyze multiple videos
export const batchAnalyzeVideos = async (videoDbIds: string[]) => {
  const results: {
    videoId: string;
    success: boolean;
    result?: AnalysisResult;
    error?: string;
  }[] = [];

  for (const videoId of videoDbIds) {
    try {
      const result = await analyzeVideo(videoId);
      results.push({ videoId, success: true, result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({ videoId, success: false, error: message });
    }

    // Delay between videos
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return results;
};

// Re-verify a specific prediction
export const reverifyPrediction = async (predictionId: string) => {
  const prediction = await prisma.prediction.findUnique({
    where: { id: predictionId },
    include: {
      video: true,
    },
  });

  if (!prediction) {
    throw new NotFoundError("Prediction");
  }

  // Search for actual market data
  const { combinedText, sources } = await searchForVerification(
    prediction.predictionText,
    prediction.video.publishedAt
  );

  if (combinedText.length === 0) {
    return {
      id: prediction.id,
      verified: false,
      message: "No market data found for verification",
    };
  }

  // Compare prediction with actual outcome
  const verification = await compareOutcome(
    prediction.predictionText,
    prediction.video.publishedAt,
    combinedText,
    sources
  );

  // Update prediction
  const updated = await prisma.prediction.update({
    where: { id: prediction.id },
    data: {
      actualOutcome: verification.actualOutcome,
      accuracyScore: verification.accuracyScore,
      explanation: verification.explanation,
      searchSources: sources,
      verifiedAt: new Date(),
    },
  });

  // Recalculate video average score
  const videoScores = await prisma.prediction.aggregate({
    where: {
      videoId: prediction.videoId,
      accuracyScore: { not: null },
    },
    _avg: { accuracyScore: true },
  });

  if (videoScores._avg.accuracyScore !== null) {
    await prisma.video.update({
      where: { id: prediction.videoId },
      data: { avgScore: videoScores._avg.accuracyScore },
    });

    // Recalculate YouTuber score
    await recalculateYouTuberScore(prediction.video.youtuberId);
  }

  return {
    id: updated.id,
    verified: true,
    score: updated.accuracyScore,
    outcome: updated.actualOutcome,
    explanation: updated.explanation,
  };
};

// Get analysis status for a channel
export const getChannelAnalysisStatus = async (youtuberId: string) => {
  const stats = await prisma.video.groupBy({
    by: ["analyzed"],
    where: { youtuberId },
    _count: true,
  });

  const totalVideos = stats.reduce((sum, s) => sum + s._count, 0);
  const analyzedVideos =
    stats.find((s) => s.analyzed)?._count || 0;

  const predictionStats = await prisma.prediction.aggregate({
    where: {
      video: { youtuberId },
      accuracyScore: { not: null },
    },
    _count: true,
    _avg: { accuracyScore: true },
  });

  // Get correct predictions count (accuracyScore >= 70)
  const correctPredictions = await prisma.prediction.count({
    where: {
      video: { youtuberId },
      accuracyScore: { gte: 70 },
    },
  });

  const accuracyPercent =
    predictionStats._count > 0
      ? Math.round((correctPredictions / predictionStats._count) * 100 * 100) / 100
      : 0;

  // Get YouTuber record to include stored stats
  const youtuber = await prisma.youTuber.findUnique({
    where: { id: youtuberId },
    select: {
      totalPredictions: true,
      correctPredictions: true,
      accuracyPercent: true,
      avgScore: true,
    },
  });

  return {
    totalVideos,
    analyzedVideos,
    pendingVideos: totalVideos - analyzedVideos,
    totalPredictions: youtuber?.totalPredictions || predictionStats._count,
    correctPredictions: youtuber?.correctPredictions || correctPredictions,
    accuracyPercent: youtuber?.accuracyPercent || accuracyPercent,
    averageAccuracy: youtuber?.avgScore || predictionStats._avg.accuracyScore || 0,
  };
};

