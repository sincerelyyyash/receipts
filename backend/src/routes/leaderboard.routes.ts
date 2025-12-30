import { Router } from "express";
import { asyncHandler } from "../middleware/errorHandler.ts";
import { apiLimiter } from "../middleware/rateLimiter.ts";
import { cacheResponse } from "../middleware/cacheMiddleware.ts";
import { CACHE_TTL } from "../lib/cache.ts";
import {
  getLeaderboard,
  getStats,
  getYouTuberRank,
  getAccuracyTrends,
} from "../services/leaderboard.service.ts";

const router = Router();

// GET /api/leaderboard - Get ranked leaderboard
router.get(
  "/",
  apiLimiter,
  // CACHING DISABLED - cacheResponse({ ttl: CACHE_TTL.LEADERBOARD }),
  asyncHandler(async (_req, res) => {
    const leaderboard = await getLeaderboard();

    res.json({
      success: true,
      data: leaderboard,
    });
  })
);

// GET /api/leaderboard/stats - Get overall platform statistics
router.get(
  "/stats",
  apiLimiter,
  // CACHING DISABLED - cacheResponse({ ttl: CACHE_TTL.STATS }),
  asyncHandler(async (_req, res) => {
    const stats = await getStats();

    res.json({
      success: true,
      data: stats,
    });
  })
);

// GET /api/leaderboard/rank/:youtuberId - Get YouTuber's ranking
router.get(
  "/rank/:youtuberId",
  apiLimiter,
  asyncHandler(async (req, res) => {
    const rank = await getYouTuberRank(req.params.youtuberId!);

    if (!rank) {
      return res.status(404).json({
        success: false,
        error: "YouTuber not found or has no analyzed videos",
      });
    }

    res.json({
      success: true,
      data: rank,
    });
  })
);

// GET /api/leaderboard/trends - Get accuracy trends
router.get(
  "/trends",
  apiLimiter,
  // CACHING DISABLED - cacheResponse({ ttl: CACHE_TTL.STATS }),
  asyncHandler(async (req, res) => {
    const youtuberId = req.query.youtuberId as string | undefined;
    const trends = await getAccuracyTrends(youtuberId);

    res.json({
      success: true,
      data: trends,
    });
  })
);

export default router;

