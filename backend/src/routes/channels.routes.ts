import { Router } from "express";
import { z } from "zod";
import {
  asyncHandler,
  ValidationError,
} from "../middleware/errorHandler.ts";
import { heavyLimiter, apiLimiter } from "../middleware/rateLimiter.ts";
import { cacheResponse, invalidateCachePatterns } from "../middleware/cacheMiddleware.ts";
import { CACHE_TTL, invalidateChannelCache } from "../lib/cache.ts";
import { redis } from "../config/redis.ts";
import {
  addChannel,
  getAllChannels,
  getChannelById,
  syncChannelVideos,
  getChannelVideos,
  deleteChannel,
} from "../services/channel.service.ts";
import { getChannelAnalysisStatus } from "../services/analysis.service.ts";
import { getPipelineStatus } from "../lib/queue.ts";
import { startChannelPipeline } from "../services/pipeline.service.ts";

const router = Router();

// Validation schemas
const addChannelSchema = z.object({
  channelUrl: z.string().url().includes("youtube.com"),
});

const syncVideosSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const videosQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  analyzed: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// GET /api/channels - List all YouTubers
router.get(
  "/",
  apiLimiter,
  cacheResponse({ ttl: CACHE_TTL.STATS }),
  asyncHandler(async (_req, res) => {
    const channels = await getAllChannels();
    res.json({
      success: true,
      data: channels,
    });
  })
);

// GET /api/channels/:id - Get channel details
router.get(
  "/:id",
  apiLimiter,
  cacheResponse({
    ttl: CACHE_TTL.CHANNEL,
    keyGenerator: (req) => `response:channel:${req.params.id}`,
  }),
  asyncHandler(async (req, res) => {
    const channel = await getChannelById(req.params.id!);
    const analysisStatus = await getChannelAnalysisStatus(req.params.id!);

    res.json({
      success: true,
      data: {
        ...channel,
        analysisStatus,
      },
    });
  })
);

// POST /api/channels - Add new channel
router.post(
  "/",
  heavyLimiter,
  invalidateCachePatterns(["response:/api/channels", "response:/api/leaderboard"]),
  asyncHandler(async (req, res) => {
    const result = addChannelSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid input");
    }

    const channel = await addChannel(result.data.channelUrl);

    res.status(201).json({
      success: true,
      data: channel,
      message: "Channel added successfully",
    });
  })
);

// POST /api/channels/:id/sync - Sync videos for time range
router.post(
  "/:id/sync",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const result = syncVideosSchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(
        "Invalid date range. Use ?from=YYYY-MM-DD&to=YYYY-MM-DD"
      );
    }

    const from = new Date(result.data.from);
    const to = new Date(result.data.to);

    if (from > to) {
      throw new ValidationError("'from' date must be before 'to' date");
    }

    const syncResult = await syncChannelVideos(req.params.id!, from, to);

    res.json({
      success: true,
      data: syncResult,
      message: `Synced ${syncResult.synced} videos`,
    });
  })
);

// GET /api/channels/:id/videos - Get videos for a channel
router.get(
  "/:id/videos",
  apiLimiter,
  asyncHandler(async (req, res) => {
    const result = videosQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid query");
    }

    const { from, to, analyzed, page, limit } = result.data;

    const videos = await getChannelVideos(req.params.id!, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      analyzed: analyzed ? analyzed === "true" : undefined,
      page,
      limit,
    });

    res.json({
      success: true,
      ...videos,
    });
  })
);

// DELETE /api/channels/:id - Delete a channel
router.delete(
  "/:id",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const channelId = req.params.id!;
    await deleteChannel(channelId);
    await invalidateChannelCache(channelId);
    // Also invalidate list and leaderboard caches
    const { deleteByPattern } = await import("../lib/cache.ts");
    await deleteByPattern("response:/api/channels");
    await deleteByPattern("response:/api/leaderboard");

    res.json({
      success: true,
      message: "Channel deleted successfully",
    });
  })
);

// GET /api/channels/:id/pipeline-status - Get pipeline processing status
router.get(
  "/:id/pipeline-status",
  apiLimiter,
  asyncHandler(async (req, res) => {
    const status = await getPipelineStatus(req.params.id!);

    res.json({
      success: true,
      data: status || {
        youtuberId: req.params.id,
        status: "idle",
        totalVideos: 0,
        transcriptsFetched: 0,
        videosAnalyzed: 0,
        currentStep: "No pipeline running",
      },
    });
  })
);

// POST /api/channels/:id/start-pipeline - Manually trigger pipeline
router.post(
  "/:id/start-pipeline",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    await startChannelPipeline(req.params.id!);

    res.json({
      success: true,
      message: "Pipeline started",
    });
  })
);

// POST /api/channels/clear-cache - Clear all channel-related cache (admin endpoint)
router.post(
  "/clear-cache",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const { deleteByPattern, deleteFromCache } = await import("../lib/cache.ts");
    const { cacheKeys } = await import("../lib/cache.ts");
    
    // Clear all response caches (multiple patterns to catch all variations)
    const patterns = [
      "response:/api/channels*",
      "response:channel:*",
      "response:/api/channels/",
      "channel:*",
      "response:/api/leaderboard*",
      "response:/api/videos*",
    ];
    
    let totalCleared = 0;
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        totalCleared += keys.length;
      }
    }
    
    // Also clear specific cache keys
    await deleteFromCache(cacheKeys.leaderboard());
    
    res.json({
      success: true,
      message: `Cache cleared successfully. Removed ${totalCleared} cache entries.`,
      cleared: totalCleared,
    });
  })
);

export default router;

