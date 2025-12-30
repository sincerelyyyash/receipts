import { Worker, Job } from "bullmq";
import { redis, bullmqConnection } from "../config/redis.ts";
import { prisma } from "../lib/prisma.ts";
import {
  pipelineQueue,
  PipelineJobData,
  SyncVideosJobData,
  FetchTranscriptJobData,
  AnalyzeVideoJobData,
  CompletePipelineJobData,
  updatePipelineStatus,
  addJob,
  QUEUE_CONFIG,
} from "../lib/queue.ts";
import { syncChannelVideos, recalculateYouTuberScore } from "./channel.service.ts";
import { fetchAndSaveTranscript } from "./transcript.service.ts";
import { analyzeVideo } from "./analysis.service.ts";

// Configuration
const PIPELINE_CONFIG = {
  defaultMonthsBack: 12, // Sync last 1 year of videos
  delayBetweenTranscripts: 2000, // 2 seconds between transcript fetches
  delayBetweenAnalysis: 3000, // 3 seconds between analysis jobs
  maxVideosToProcess: 50, // Limit videos per channel to avoid overwhelming
};

// Start the full pipeline for a channel
export const startChannelPipeline = async (youtuberId: string): Promise<void> => {
  const youtuber = await prisma.youTuber.findUnique({
    where: { id: youtuberId },
  });

  if (!youtuber) {
    console.error(`YouTuber not found: ${youtuberId}`);
    return;
  }

  // Initialize pipeline status
  await updatePipelineStatus(youtuberId, {
    status: "syncing",
    totalVideos: 0,
    transcriptsFetched: 0,
    videosAnalyzed: 0,
    currentStep: "Starting video sync (last 1 year)...",
    startedAt: new Date().toISOString(),
  });

  // Add sync job to queue
  await addJob({
    type: "sync-videos",
    youtuberId,
    channelId: youtuber.channelId,
    monthsBack: PIPELINE_CONFIG.defaultMonthsBack,
  });

  console.log(`🚀 Pipeline started for ${youtuber.name} (syncing last ${PIPELINE_CONFIG.defaultMonthsBack} months)`);
};

// Process sync videos job
const processSyncVideos = async (job: Job<SyncVideosJobData>): Promise<void> => {
  const { youtuberId, monthsBack } = job.data;

  const timePeriod = monthsBack >= 12 
    ? `${Math.floor(monthsBack / 12)} year${Math.floor(monthsBack / 12) > 1 ? 's' : ''}`
    : `${monthsBack} month${monthsBack > 1 ? 's' : ''}`;

  await updatePipelineStatus(youtuberId, {
    currentStep: `Syncing videos from last ${timePeriod}...`,
  });

  // Calculate date range
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - monthsBack);

  try {
    // Sync videos
    const result = await syncChannelVideos(youtuberId, from, to);
    const videoCount = Math.min(result.synced, PIPELINE_CONFIG.maxVideosToProcess);

    await updatePipelineStatus(youtuberId, {
      status: "fetching-transcripts",
      totalVideos: videoCount,
      currentStep: `Found ${result.synced} videos. Fetching transcripts...`,
    });

    // Get videos that need transcripts (limit to max)
    const videos = await prisma.video.findMany({
      where: {
        youtuberId,
        transcript: null,
      },
      orderBy: { publishedAt: "desc" },
      take: PIPELINE_CONFIG.maxVideosToProcess,
      select: { id: true },
    });

    if (videos.length === 0) {
      // No videos need transcripts, skip to analysis
      await queueAnalysisJobs(youtuberId);
      return;
    }

    // Queue transcript jobs with delays
    for (let i = 0; i < videos.length; i++) {
      await addJob(
        {
          type: "fetch-transcript",
          videoId: videos[i]!.id,
          youtuberId,
        },
        { delay: i * PIPELINE_CONFIG.delayBetweenTranscripts }
      );
    }
  } catch (error) {
    console.error(`Sync videos failed for ${youtuberId}:`, error);
    await updatePipelineStatus(youtuberId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Sync failed",
    });
    throw error;
  }
};

// Process fetch transcript job
const processFetchTranscript = async (job: Job<FetchTranscriptJobData>): Promise<void> => {
  const { videoId, youtuberId } = job.data;

  let transcriptSuccess = false;
  try {
    await fetchAndSaveTranscript(videoId);
    transcriptSuccess = true;
  } catch (error) {
    console.error(`Transcript fetch failed for video ${videoId}:`, error);
    // Mark video as having failed transcript fetch so we don't retry forever
    await prisma.video.update({
      where: { id: videoId },
      data: { transcript: JSON.stringify([{ text: "TRANSCRIPT_UNAVAILABLE", offsetSec: 0, timestamp: "0:00", duration: 0 }]) },
    });
  }

  // Update progress - count all videos that have any transcript (including failed ones)
  const transcriptsProcessed = await prisma.video.count({
    where: { youtuberId, transcript: { not: null } },
  });

  await updatePipelineStatus(youtuberId, {
    transcriptsFetched: transcriptsProcessed,
    currentStep: `Processed ${transcriptsProcessed} transcripts${transcriptSuccess ? '' : ' (some unavailable)'}...`,
  });

  // Check if this is the last transcript job in the queue
  const pendingJobs = await pipelineQueue.getWaiting();
  const activeJobs = await pipelineQueue.getActive();
  
  const pendingTranscriptJobs = [...pendingJobs, ...activeJobs].filter(
    (j) => j.data.type === 'fetch-transcript' && j.data.youtuberId === youtuberId && j.id !== job.id
  );

  // If no more transcript jobs for this YouTuber, move to analysis
  if (pendingTranscriptJobs.length === 0) {
    console.log(`📝 All transcript jobs completed for ${youtuberId}, moving to analysis...`);
    await queueAnalysisJobs(youtuberId);
  }
};

// Queue analysis jobs for videos with transcripts
const queueAnalysisJobs = async (youtuberId: string): Promise<void> => {
  await updatePipelineStatus(youtuberId, {
    status: "analyzing",
    currentStep: "Starting video analysis...",
  });

  // Get videos with transcripts that haven't been analyzed
  const videos = await prisma.video.findMany({
    where: {
      youtuberId,
      transcript: { not: null },
      analyzed: false,
    },
    orderBy: { publishedAt: "desc" },
    take: PIPELINE_CONFIG.maxVideosToProcess,
    select: { id: true },
  });

  if (videos.length === 0) {
    // No videos to analyze, complete pipeline
    await completePipeline(youtuberId);
    return;
  }

  // Queue analysis jobs with delays
  for (let i = 0; i < videos.length; i++) {
    await addJob(
      {
        type: "analyze-video",
        videoId: videos[i]!.id,
        youtuberId,
      },
      { delay: i * PIPELINE_CONFIG.delayBetweenAnalysis }
    );
  }

  // Queue completion job after all analysis jobs
  await addJob(
    {
      type: "complete-pipeline",
      youtuberId,
    },
    { delay: videos.length * PIPELINE_CONFIG.delayBetweenAnalysis + 5000 }
  );
};

// Process analyze video job
const processAnalyzeVideo = async (job: Job<AnalyzeVideoJobData>): Promise<void> => {
  const { videoId, youtuberId } = job.data;

  try {
    await analyzeVideo(videoId);

    // Update progress
    const analyzed = await prisma.video.count({
      where: { youtuberId, analyzed: true },
    });

    await updatePipelineStatus(youtuberId, {
      videosAnalyzed: analyzed,
      currentStep: `Analyzed ${analyzed} videos...`,
    });
  } catch (error) {
    console.error(`Analysis failed for video ${videoId}:`, error);
    // Don't fail the whole pipeline for one video
  }
};

// Complete pipeline
const completePipeline = async (youtuberId: string): Promise<void> => {
  try {
    // Recalculate YouTuber scores
    await recalculateYouTuberScore(youtuberId);

    const stats = await prisma.video.aggregate({
      where: { youtuberId },
      _count: true,
    });

    const analyzed = await prisma.video.count({
      where: { youtuberId, analyzed: true },
    });

    const predictions = await prisma.prediction.count({
      where: { video: { youtuberId } },
    });

    await updatePipelineStatus(youtuberId, {
      status: "completed",
      videosAnalyzed: analyzed,
      currentStep: `Completed! ${analyzed} videos analyzed, ${predictions} predictions found.`,
      completedAt: new Date().toISOString(),
    });

    console.log(`✅ Pipeline completed for YouTuber ${youtuberId}`);
  } catch (error) {
    console.error(`Pipeline completion failed for ${youtuberId}:`, error);
    await updatePipelineStatus(youtuberId, {
      status: "failed",
      error: error instanceof Error ? error.message : "Completion failed",
    });
  }
};

// Process complete pipeline job
const processCompletePipeline = async (job: Job<CompletePipelineJobData>): Promise<void> => {
  await completePipeline(job.data.youtuberId);
};

// Create and start the worker
export const createPipelineWorker = (): Worker<PipelineJobData> => {
  const worker = new Worker<PipelineJobData>(
    "pipeline",
    async (job) => {
      console.log(`📦 Processing job: ${job.name} (${job.id})`);

      switch (job.data.type) {
        case "sync-videos":
          await processSyncVideos(job as Job<SyncVideosJobData>);
          break;
        case "fetch-transcript":
          await processFetchTranscript(job as Job<FetchTranscriptJobData>);
          break;
        case "analyze-video":
          await processAnalyzeVideo(job as Job<AnalyzeVideoJobData>);
          break;
        case "complete-pipeline":
          await processCompletePipeline(job as Job<CompletePipelineJobData>);
          break;
        default:
          console.warn(`Unknown job type: ${(job.data as any).type}`);
      }
    },
    {
      connection: bullmqConnection,
      concurrency: QUEUE_CONFIG.concurrency,
    }
  );

  worker.on("completed", (job) => {
    console.log(`✅ Job completed: ${job.name} (${job.id})`);
  });

  worker.on("failed", (job, error) => {
    console.error(`❌ Job failed: ${job?.name} (${job?.id})`, error.message);
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  console.log("🔧 Pipeline worker started");

  return worker;
};

// Check if pipeline is running for a channel
export const isPipelineRunning = async (youtuberId: string): Promise<boolean> => {
  const status = await redis.get(`pipeline:status:${youtuberId}`);
  if (!status) return false;

  const parsed = JSON.parse(status);
  return ["syncing", "fetching-transcripts", "analyzing"].includes(parsed.status);
};

// Force start analysis for a specific channel (for stuck pipelines)
export const forceStartAnalysis = async (youtuberId: string): Promise<void> => {
  const youtuber = await prisma.youTuber.findUnique({
    where: { id: youtuberId },
  });

  if (!youtuber) {
    console.error(`YouTuber not found: ${youtuberId}`);
    return;
  }

  console.log(`🔧 Force starting analysis for ${youtuber.name}...`);

  // Get videos with transcripts that haven't been analyzed
  const videosToAnalyze = await prisma.video.findMany({
    where: {
      youtuberId,
      transcript: { not: null },
      analyzed: false,
    },
    select: { id: true, title: true },
    orderBy: { publishedAt: "desc" },
    take: PIPELINE_CONFIG.maxVideosToProcess,
  });

  // Also get videos without transcripts and mark them with placeholder
  const videosWithoutTranscripts = await prisma.video.findMany({
    where: {
      youtuberId,
      transcript: null,
    },
    select: { id: true },
  });

  // Mark videos without transcripts so they don't block future runs
  for (const video of videosWithoutTranscripts) {
    await prisma.video.update({
      where: { id: video.id },
      data: { 
        transcript: JSON.stringify([{ text: "TRANSCRIPT_UNAVAILABLE", offsetSec: 0, timestamp: "0:00", duration: 0 }]) 
      },
    });
  }

  if (videosToAnalyze.length === 0) {
    console.log(`✅ No videos to analyze for ${youtuber.name}`);
    await updatePipelineStatus(youtuberId, {
      status: "completed",
      currentStep: "No videos with valid transcripts to analyze.",
      completedAt: new Date().toISOString(),
    });
    return;
  }

  console.log(`📊 Found ${videosToAnalyze.length} videos to analyze for ${youtuber.name}`);

  // Update pipeline status
  await updatePipelineStatus(youtuberId, {
    status: "analyzing",
    totalVideos: videosToAnalyze.length,
    transcriptsFetched: videosToAnalyze.length,
    videosAnalyzed: 0,
    currentStep: `Starting analysis of ${videosToAnalyze.length} videos...`,
    startedAt: new Date().toISOString(),
  });

  // Queue analysis jobs with delays
  for (let i = 0; i < videosToAnalyze.length; i++) {
    await addJob(
      {
        type: "analyze-video",
        videoId: videosToAnalyze[i]!.id,
        youtuberId,
      },
      { delay: i * PIPELINE_CONFIG.delayBetweenAnalysis }
    );
  }

  // Queue completion job
  await addJob(
    {
      type: "complete-pipeline",
      youtuberId,
    },
    { delay: videosToAnalyze.length * PIPELINE_CONFIG.delayBetweenAnalysis + 5000 }
  );

  console.log(`🚀 Queued ${videosToAnalyze.length} analysis jobs for ${youtuber.name}`);
};

// Auto-analyze unanalyzed videos on server startup
export const runStartupAnalysis = async (): Promise<void> => {
  console.log("🔍 Checking for stuck pipelines and unanalyzed videos...");

  try {
    // First, check for stuck pipelines (status is fetching-transcripts but no jobs in queue)
    const youtubers = await prisma.youTuber.findMany({
      select: { id: true, name: true },
    });

    for (const youtuber of youtubers) {
      const pipelineStatus = await redis.get(`pipeline:status:${youtuber.id}`);
      if (pipelineStatus) {
        const status = JSON.parse(pipelineStatus);
        if (status.status === "fetching-transcripts") {
          // Check if there are any pending transcript jobs
          const pendingJobs = await pipelineQueue.getWaiting();
          const activeJobs = await pipelineQueue.getActive();
          const allJobs = [...pendingJobs, ...activeJobs];
          
          const transcriptJobsForYouTuber = allJobs.filter(
            (j) => j.data.type === "fetch-transcript" && j.data.youtuberId === youtuber.id
          );

          if (transcriptJobsForYouTuber.length === 0) {
            console.log(`🔧 Found stuck pipeline for ${youtuber.name} - forcing to analysis phase`);
            await forceStartAnalysis(youtuber.id);
          }
        }
      }
    }

    // Then, find videos with transcripts that haven't been analyzed
    const unanalyzedVideos = await prisma.video.findMany({
      where: {
        transcript: { not: null },
        analyzed: false,
      },
      select: {
        id: true,
        title: true,
        youtuberId: true,
        youtuber: {
          select: { name: true },
        },
      },
      orderBy: { publishedAt: "desc" },
      take: 100, // Limit to prevent overwhelming the system
    });

    if (unanalyzedVideos.length === 0) {
      console.log("✅ No unanalyzed videos found");
      return;
    }

    console.log(`📊 Found ${unanalyzedVideos.length} unanalyzed videos with transcripts`);

    // Group videos by YouTuber
    const videosByYouTuber = new Map<string, typeof unanalyzedVideos>();
    for (const video of unanalyzedVideos) {
      const existing = videosByYouTuber.get(video.youtuberId) || [];
      existing.push(video);
      videosByYouTuber.set(video.youtuberId, existing);
    }

    // Queue analysis jobs for each YouTuber's videos
    let jobsQueued = 0;
    for (const [youtuberId, videos] of videosByYouTuber) {
      // Check if pipeline is already running for this YouTuber
      const isRunning = await isPipelineRunning(youtuberId);
      if (isRunning) {
        console.log(`⏭️  Skipping ${videos[0]?.youtuber?.name || youtuberId} - pipeline already running`);
        continue;
      }

      // Update pipeline status
      await updatePipelineStatus(youtuberId, {
        status: "analyzing",
        totalVideos: videos.length,
        transcriptsFetched: videos.length,
        videosAnalyzed: 0,
        currentStep: `Auto-analyzing ${videos.length} videos on startup...`,
        startedAt: new Date().toISOString(),
      });

      // Queue analysis jobs with delays
      for (let i = 0; i < videos.length; i++) {
        await addJob(
          {
            type: "analyze-video",
            videoId: videos[i]!.id,
            youtuberId,
          },
          { delay: (jobsQueued + i) * PIPELINE_CONFIG.delayBetweenAnalysis }
        );
      }

      // Queue completion job
      await addJob(
        {
          type: "complete-pipeline",
          youtuberId,
        },
        { delay: (jobsQueued + videos.length) * PIPELINE_CONFIG.delayBetweenAnalysis + 5000 }
      );

      jobsQueued += videos.length;
      console.log(`📦 Queued ${videos.length} analysis jobs for ${videos[0]?.youtuber?.name || youtuberId}`);
    }

    console.log(`🚀 Startup analysis: Queued ${jobsQueued} total analysis jobs`);
  } catch (error) {
    console.error("❌ Startup analysis error:", error);
  }
};

