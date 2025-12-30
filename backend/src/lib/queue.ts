import { Queue, Worker, Job } from "bullmq";
import { redis, bullmqConnection } from "../config/redis.ts";

// Queue configuration
export const QUEUE_CONFIG = {
  concurrency: 1, // Process one job at a time to avoid rate limits
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential" as const,
      delay: 5000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 50, // Keep last 50 failed jobs
  },
};

// Job types
export type JobType = "sync-videos" | "fetch-transcript" | "analyze-video" | "complete-pipeline";

export interface SyncVideosJobData {
  type: "sync-videos";
  youtuberId: string;
  channelId: string;
  monthsBack: number;
}

export interface FetchTranscriptJobData {
  type: "fetch-transcript";
  videoId: string;
  youtuberId: string;
}

export interface AnalyzeVideoJobData {
  type: "analyze-video";
  videoId: string;
  youtuberId: string;
}

export interface CompletePipelineJobData {
  type: "complete-pipeline";
  youtuberId: string;
}

export type PipelineJobData =
  | SyncVideosJobData
  | FetchTranscriptJobData
  | AnalyzeVideoJobData
  | CompletePipelineJobData;

// Create the queue
export const pipelineQueue = new Queue<PipelineJobData>("pipeline", {
  connection: bullmqConnection,
  defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
});

// Pipeline status stored in Redis
export interface PipelineStatus {
  youtuberId: string;
  status: "idle" | "syncing" | "fetching-transcripts" | "analyzing" | "completed" | "failed";
  totalVideos: number;
  transcriptsFetched: number;
  videosAnalyzed: number;
  currentStep: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// Get pipeline status from Redis
export const getPipelineStatus = async (youtuberId: string): Promise<PipelineStatus | null> => {
  const status = await redis.get(`pipeline:status:${youtuberId}`);
  return status ? JSON.parse(status) : null;
};

// Update pipeline status in Redis
export const updatePipelineStatus = async (
  youtuberId: string,
  update: Partial<PipelineStatus>
): Promise<void> => {
  const current = await getPipelineStatus(youtuberId);
  const newStatus: PipelineStatus = {
    youtuberId,
    status: "idle",
    totalVideos: 0,
    transcriptsFetched: 0,
    videosAnalyzed: 0,
    currentStep: "",
    ...current,
    ...update,
  };
  await redis.set(
    `pipeline:status:${youtuberId}`,
    JSON.stringify(newStatus),
    "EX",
    86400 // Expire after 24 hours
  );
};

// Clear pipeline status
export const clearPipelineStatus = async (youtuberId: string): Promise<void> => {
  await redis.del(`pipeline:status:${youtuberId}`);
};

// Add job to queue with delay
export const addJob = async (
  data: PipelineJobData,
  options?: { delay?: number; priority?: number }
): Promise<Job<PipelineJobData>> => {
  return pipelineQueue.add(data.type, data, {
    delay: options?.delay || 0,
    priority: options?.priority || 0,
  });
};

// Get queue stats
export const getQueueStats = async () => {
  const [waiting, active, completed, failed] = await Promise.all([
    pipelineQueue.getWaitingCount(),
    pipelineQueue.getActiveCount(),
    pipelineQueue.getCompletedCount(),
    pipelineQueue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
};

// Export for worker creation
export { Worker, Job };

