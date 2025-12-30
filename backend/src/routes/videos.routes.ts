import { Router } from "express";
import { z } from "zod";
import {
  asyncHandler,
  ValidationError,
} from "../middleware/errorHandler.ts";
import { heavyLimiter, apiLimiter } from "../middleware/rateLimiter.ts";
import { cacheResponse } from "../middleware/cacheMiddleware.ts";
import { CACHE_TTL } from "../lib/cache.ts";
import {
  getAllVideos,
  getVideoById,
  deleteVideo,
} from "../services/video.service.ts";
import {
  fetchAndSaveTranscript,
  getTranscript,
  batchFetchTranscripts,
} from "../services/transcript.service.ts";
import {
  analyzeVideo,
  batchAnalyzeVideos,
  reverifyPrediction,
} from "../services/analysis.service.ts";

const router = Router();

// Validation schemas
const videosQuerySchema = z.object({
  youtuberId: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  analyzed: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

const batchSchema = z.object({
  videoIds: z.array(z.string().uuid()).min(1).max(10),
});

// GET /api/videos - List all videos with filters
router.get(
  "/",
  apiLimiter,
  asyncHandler(async (req, res) => {
    const result = videosQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid query");
    }

    const { youtuberId, from, to, analyzed, page, limit } = result.data;

    const videos = await getAllVideos({
      youtuberId,
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

// GET /api/videos/:id - Get video details with predictions
router.get(
  "/:id",
  apiLimiter,
  cacheResponse({
    ttl: CACHE_TTL.VIDEO_META,
    keyGenerator: (req) => `response:video:${req.params.id}`,
  }),
  asyncHandler(async (req, res) => {
    const video = await getVideoById(req.params.id!);

    res.json({
      success: true,
      data: video,
    });
  })
);

// POST /api/videos/:id/transcript - Fetch transcript for a video
router.post(
  "/:id/transcript",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const transcript = await fetchAndSaveTranscript(req.params.id!);

    res.json({
      success: true,
      data: {
        segmentCount: transcript.length,
        transcript,
      },
      message: "Transcript fetched successfully",
    });
  })
);

// GET /api/videos/:id/transcript - Get existing transcript
router.get(
  "/:id/transcript",
  apiLimiter,
  cacheResponse({
    ttl: CACHE_TTL.TRANSCRIPT,
    keyGenerator: (req) => `response:transcript:${req.params.id}`,
  }),
  asyncHandler(async (req, res) => {
    const transcript = await getTranscript(req.params.id!);

    res.json({
      success: true,
      data: transcript,
    });
  })
);

// POST /api/videos/:id/analyze - Analyze a video for predictions
router.post(
  "/:id/analyze",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const result = await analyzeVideo(req.params.id!);

    res.json({
      success: true,
      data: result,
      message: `Found ${result.predictionsFound} predictions, verified ${result.predictionsVerified}`,
    });
  })
);

// POST /api/videos/batch/transcript - Batch fetch transcripts
router.post(
  "/batch/transcript",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const result = batchSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid input");
    }

    const results = await batchFetchTranscripts(result.data.videoIds);

    const successCount = results.filter((r) => r.success).length;

    res.json({
      success: true,
      data: results,
      message: `Fetched transcripts for ${successCount}/${results.length} videos`,
    });
  })
);

// POST /api/videos/batch/analyze - Batch analyze videos
router.post(
  "/batch/analyze",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const result = batchSchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.errors[0]?.message || "Invalid input");
    }

    const results = await batchAnalyzeVideos(result.data.videoIds);

    const successCount = results.filter((r) => r.success).length;

    res.json({
      success: true,
      data: results,
      message: `Analyzed ${successCount}/${results.length} videos`,
    });
  })
);

// POST /api/videos/predictions/:id/reverify - Re-verify a prediction
router.post(
  "/predictions/:id/reverify",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    const result = await reverifyPrediction(req.params.id!);

    res.json({
      success: true,
      data: result,
      message: result.verified
        ? "Prediction re-verified successfully"
        : "Could not verify prediction",
    });
  })
);

// DELETE /api/videos/:id - Delete a video
router.delete(
  "/:id",
  heavyLimiter,
  asyncHandler(async (req, res) => {
    await deleteVideo(req.params.id!);

    res.json({
      success: true,
      message: "Video deleted successfully",
    });
  })
);

export default router;

