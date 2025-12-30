import { Router } from "express";
import channelsRouter from "./channels.routes.ts";
import videosRouter from "./videos.routes.ts";
import leaderboardRouter from "./leaderboard.routes.ts";
import { getQueueStats } from "../lib/queue.ts";
import { asyncHandler } from "../middleware/errorHandler.ts";

const router = Router();

// Health check
router.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

// Queue stats endpoint (for monitoring during deployments)
router.get("/queue/stats", asyncHandler(async (_req, res) => {
  const stats = await getQueueStats();
  res.json({
    success: true,
    data: stats,
  });
}));

// Mount routes
router.use("/channels", channelsRouter);
router.use("/videos", videosRouter);
router.use("/leaderboard", leaderboardRouter);

export default router;

