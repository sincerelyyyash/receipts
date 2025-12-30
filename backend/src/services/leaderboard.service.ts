import { prisma } from "../lib/prisma.ts";
import { cacheKeys, CACHE_TTL, withCache } from "../lib/cache.ts";
import type { LeaderboardEntry } from "../types/index.ts";

// Get leaderboard ranked by accuracy score
export const getLeaderboard = async (): Promise<LeaderboardEntry[]> => {
  const cacheKey = cacheKeys.leaderboard();

  return withCache(cacheKey, CACHE_TTL.LEADERBOARD, async () => {
    const youtubers = await prisma.youTuber.findMany({
      where: {
        avgScore: { gt: 0 },
      },
      orderBy: { avgScore: "desc" },
      include: {
        _count: {
          select: { videos: true },
        },
        videos: {
          where: { analyzed: true },
          select: { id: true },
        },
      },
    });

    return youtubers.map((yt, index) => ({
      id: yt.id,
      name: yt.name,
      channelId: yt.channelId,
      thumbnailUrl: yt.thumbnailUrl,
      avgScore: Math.round(yt.avgScore * 100) / 100,
      totalVideos: yt._count.videos,
      analyzedVideos: yt.videos.length,
      totalPredictions: yt.totalPredictions,
      correctPredictions: yt.correctPredictions,
      accuracyPercent: Math.round(yt.accuracyPercent * 100) / 100,
      rank: index + 1,
    }));
  });
};

// Get overall platform statistics
export const getStats = async () => {
  const cacheKey = "stats:overall";

  return withCache(cacheKey, CACHE_TTL.STATS, async () => {
    const [
      youtuberCount,
      videoCount,
      analyzedVideoCount,
      predictionCount,
      avgScore,
    ] = await Promise.all([
      prisma.youTuber.count(),
      prisma.video.count(),
      prisma.video.count({ where: { analyzed: true } }),
      prisma.prediction.count(),
      prisma.prediction.aggregate({
        where: { accuracyScore: { not: null } },
        _avg: { accuracyScore: true },
      }),
    ]);

    // Get top 3 most accurate predictors
    const topPredictors = await prisma.youTuber.findMany({
      where: { avgScore: { gt: 0 } },
      orderBy: { avgScore: "desc" },
      take: 3,
      select: {
        id: true,
        name: true,
        avgScore: true,
        thumbnailUrl: true,
      },
    });

    // Get prediction type breakdown
    const predictionTypes = await prisma.prediction.groupBy({
      by: ["predictionType"],
      _count: true,
      _avg: { accuracyScore: true },
    });

    return {
      totalYouTubers: youtuberCount,
      totalVideos: videoCount,
      analyzedVideos: analyzedVideoCount,
      totalPredictions: predictionCount,
      platformAvgAccuracy: Math.round((avgScore._avg.accuracyScore || 0) * 100) / 100,
      topPredictors,
      predictionBreakdown: predictionTypes.map((pt) => ({
        type: pt.predictionType || "other",
        count: pt._count,
        avgAccuracy: Math.round((pt._avg.accuracyScore || 0) * 100) / 100,
      })),
    };
  });
};

// Get YouTuber ranking position
export const getYouTuberRank = async (youtuberId: string) => {
  const youtuber = await prisma.youTuber.findUnique({
    where: { id: youtuberId },
  });

  if (!youtuber) {
    return null;
  }

  const rank = await prisma.youTuber.count({
    where: {
      avgScore: { gt: youtuber.avgScore },
    },
  });

  const total = await prisma.youTuber.count({
    where: { avgScore: { gt: 0 } },
  });

  return {
    rank: rank + 1,
    total,
    percentile: total > 0 ? Math.round(((total - rank) / total) * 100) : 0,
  };
};

// Get time-based accuracy trends
export const getAccuracyTrends = async (youtuberId?: string) => {
  const where = youtuberId
    ? { video: { youtuberId } }
    : {};

  // Group predictions by month
  const predictions = await prisma.prediction.findMany({
    where: {
      ...where,
      accuracyScore: { not: null },
      verifiedAt: { not: null },
    },
    select: {
      verifiedAt: true,
      accuracyScore: true,
      predictionType: true,
    },
    orderBy: { verifiedAt: "asc" },
  });

  // Group by month
  const monthlyData: Record<string, { scores: number[]; count: number }> = {};

  for (const pred of predictions) {
    if (!pred.verifiedAt) continue;

    const monthKey = pred.verifiedAt.toISOString().slice(0, 7); // YYYY-MM
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { scores: [], count: 0 };
    }
    monthlyData[monthKey]!.scores.push(pred.accuracyScore!);
    monthlyData[monthKey]!.count++;
  }

  return Object.entries(monthlyData).map(([month, data]) => ({
    month,
    avgAccuracy:
      Math.round(
        (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100
      ) / 100,
    predictionCount: data.count,
  }));
};

