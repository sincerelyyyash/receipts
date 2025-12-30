import { prisma } from "../lib/prisma.ts";
import { NotFoundError } from "../middleware/errorHandler.ts";

// Get all videos with optional filters
export const getAllVideos = async (options: {
  youtuberId?: string;
  analyzed?: boolean;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}) => {
  const { youtuberId, analyzed, from, to, page = 1, limit = 20 } = options;

  const where: any = {};

  if (youtuberId) {
    where.youtuberId = youtuberId;
  }

  if (analyzed !== undefined) {
    where.analyzed = analyzed;
  }

  if (from || to) {
    where.publishedAt = {};
    if (from) where.publishedAt.gte = from;
    if (to) where.publishedAt.lte = to;
  }

  const [videos, total] = await Promise.all([
    prisma.video.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        youtuber: {
          select: {
            id: true,
            name: true,
            thumbnailUrl: true,
          },
        },
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

// Get single video by ID with all details
export const getVideoById = async (id: string) => {
  const video = await prisma.video.findUnique({
    where: { id },
    include: {
      youtuber: {
        select: {
          id: true,
          name: true,
          channelId: true,
          thumbnailUrl: true,
        },
      },
      predictions: {
        orderBy: { timestampSec: "asc" },
      },
    },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  return video;
};

// Get video by YouTube video ID
export const getVideoByYouTubeId = async (videoId: string) => {
  const video = await prisma.video.findUnique({
    where: { videoId },
    include: {
      youtuber: {
        select: {
          id: true,
          name: true,
          channelId: true,
          thumbnailUrl: true,
        },
      },
      predictions: {
        orderBy: { timestampSec: "asc" },
      },
    },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  return video;
};

// Update video after analysis
export const updateVideoAnalysis = async (
  videoId: string,
  avgScore: number
) => {
  return prisma.video.update({
    where: { id: videoId },
    data: {
      avgScore,
      analyzed: true,
      analyzedAt: new Date(),
    },
  });
};

// Get videos needing analysis
export const getVideosForAnalysis = async (limit: number = 10) => {
  return prisma.video.findMany({
    where: {
      analyzed: false,
      transcript: { not: null },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: {
      youtuber: {
        select: { name: true },
      },
    },
  });
};

// Delete a video
export const deleteVideo = async (id: string) => {
  const video = await prisma.video.findUnique({
    where: { id },
  });

  if (!video) {
    throw new NotFoundError("Video");
  }

  await prisma.video.delete({ where: { id } });

  return { success: true };
};

