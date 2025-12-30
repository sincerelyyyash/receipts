import { prisma } from "../lib/prisma.ts";
import {
  cacheKeys,
  CACHE_TTL,
  withCache,
  invalidateChannelCache,
} from "../lib/cache.ts";
import {
  extractChannelId,
  resolveChannelId,
  fetchChannelInfo,
  fetchChannelVideos,
} from "../lib/youtube.ts";
import { NotFoundError, ValidationError } from "../middleware/errorHandler.ts";
import { startChannelPipeline } from "./pipeline.service.ts";

// Add a new YouTuber channel
export const addChannel = async (channelUrl: string) => {
  // Extract or resolve channel ID
  let channelIdOrHandle = extractChannelId(channelUrl);

  if (!channelIdOrHandle) {
    throw new ValidationError("Invalid YouTube channel URL");
  }

  // Resolve to actual channel ID if it's a handle
  const channelId = await resolveChannelId(channelIdOrHandle);

  if (!channelId) {
    throw new NotFoundError("YouTube channel");
  }

  // Check if already exists
  const existing = await prisma.youTuber.findUnique({
    where: { channelId },
  });

  if (existing) {
    return existing;
  }

  // Fetch channel info from YouTube
  const channelInfo = await fetchChannelInfo(channelId);

  // Create YouTuber record
  const youtuber = await prisma.youTuber.create({
    data: {
      name: channelInfo.name,
      channelId: channelInfo.channelId,
      channelUrl: `https://www.youtube.com/channel/${channelInfo.channelId}`,
      thumbnailUrl: channelInfo.thumbnailUrl,
      description: channelInfo.description,
      subscriberCount: channelInfo.subscriberCount,
    },
  });

  // Start automated pipeline (non-blocking)
  startChannelPipeline(youtuber.id).catch((error) => {
    console.error(`Failed to start pipeline for ${youtuber.name}:`, error);
  });

  return youtuber;
};

// Get all YouTubers
export const getAllChannels = async () => {
  return prisma.youTuber.findMany({
    orderBy: { avgScore: "desc" },
    include: {
      _count: {
        select: { videos: true },
      },
    },
  });
};

// Get single channel by ID
export const getChannelById = async (id: string) => {
  const youtuber = await prisma.youTuber.findUnique({
    where: { id },
    include: {
      videos: {
        orderBy: { publishedAt: "desc" },
        take: 20,
      },
      _count: {
        select: { videos: true },
      },
    },
  });

  if (!youtuber) {
    throw new NotFoundError("YouTuber");
  }

  return youtuber;
};

// Sync videos for a channel within a time range
export const syncChannelVideos = async (
  youtuberId: string,
  from: Date,
  to: Date
) => {
  const youtuber = await prisma.youTuber.findUnique({
    where: { id: youtuberId },
  });

  if (!youtuber) {
    throw new NotFoundError("YouTuber");
  }

  // Create cache key based on year for granular caching
  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();
  const cacheKey = cacheKeys.channelVideos(
    youtuber.channelId,
    fromYear === toYear ? fromYear : 0
  );

  // Try to use cached data if available
  const videos = await withCache(cacheKey, CACHE_TTL.VIDEO_LIST, async () => {
    return fetchChannelVideos(youtuber.channelId, from, to, 100);
  });

  // Upsert videos to database
  const upsertedVideos = await Promise.all(
    videos.map(async (video) => {
      return prisma.video.upsert({
        where: { videoId: video.videoId },
        create: {
          youtuberId: youtuber.id,
          videoId: video.videoId,
          title: video.title,
          url: `https://www.youtube.com/watch?v=${video.videoId}`,
          thumbnailUrl: video.thumbnailUrl,
          publishedAt: video.publishedAt,
          duration: video.duration,
          viewCount: video.viewCount,
        },
        update: {
          title: video.title,
          thumbnailUrl: video.thumbnailUrl,
          viewCount: video.viewCount,
        },
      });
    })
  );

  // Update YouTuber's last synced time and video count
  await prisma.youTuber.update({
    where: { id: youtuberId },
    data: {
      lastSyncedAt: new Date(),
      totalVideos: await prisma.video.count({ where: { youtuberId } }),
    },
  });

  return {
    synced: upsertedVideos.length,
    videos: upsertedVideos,
  };
};

// Get videos for a channel with filtering
export const getChannelVideos = async (
  youtuberId: string,
  options: {
    from?: Date;
    to?: Date;
    analyzed?: boolean;
    page?: number;
    limit?: number;
  }
) => {
  const { from, to, analyzed, page = 1, limit = 20 } = options;

  const where: any = { youtuberId };

  if (from || to) {
    where.publishedAt = {};
    if (from) where.publishedAt.gte = from;
    if (to) where.publishedAt.lte = to;
  }

  if (analyzed !== undefined) {
    where.analyzed = analyzed;
  }

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: { predictions: true },
        },
      },
    }),
    prisma.video.count({ where }),
  ]);

  return {
    videos,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

// Delete a channel
export const deleteChannel = async (id: string) => {
  const youtuber = await prisma.youTuber.findUnique({
    where: { id },
  });

  if (!youtuber) {
    throw new NotFoundError("YouTuber");
  }

  // Delete and invalidate cache
  await prisma.youTuber.delete({ where: { id } });
  await invalidateChannelCache(youtuber.channelId);

  return { success: true };
};

// Update YouTuber's average score and prediction statistics based on analyzed videos
export const recalculateYouTuberScore = async (youtuberId: string) => {
  // Calculate video-level statistics
  const videoStats = await prisma.video.aggregate({
    where: {
      youtuberId,
      analyzed: true,
      avgScore: { not: null },
    },
    _avg: { avgScore: true },
    _count: true,
  });

  // Calculate prediction-level statistics
  // Get all predictions for this YouTuber's videos
  const predictionStats = await prisma.prediction.aggregate({
    where: {
      video: {
        youtuberId,
        analyzed: true,
      },
      accuracyScore: { not: null },
    },
    _count: true,
    _avg: { accuracyScore: true },
  });

  // Count correct predictions (accuracyScore >= 70)
  const correctPredictions = await prisma.prediction.count({
    where: {
      video: {
        youtuberId,
        analyzed: true,
      },
      accuracyScore: {
        gte: 70,
      },
    },
  });

  // Calculate accuracy percentage
  const totalPredictions = predictionStats._count;
  const accuracyPercent =
    totalPredictions > 0
      ? Math.round((correctPredictions / totalPredictions) * 100 * 100) / 100
      : 0;

  await prisma.youTuber.update({
    where: { id: youtuberId },
    data: {
      avgScore: videoStats._avg.avgScore || 0,
      totalPredictions,
      correctPredictions,
      accuracyPercent,
    },
  });

  return {
    videoStats,
    predictionStats,
    totalPredictions,
    correctPredictions,
    accuracyPercent,
  };
};

