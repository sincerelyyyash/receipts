// YouTube API types
export interface YouTubeChannelInfo {
  channelId: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  subscriberCount: number;
  videoCount: number;
}

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  duration: string;
  viewCount: number;
  channelId: string;
}

// Transcript types
export interface TranscriptSegment {
  text: string;
  offsetSec: number;
  timestamp: string;
  duration: number;
}

// Prediction types
export interface ExtractedPrediction {
  timestampSec: number;
  timestampFormatted: string;
  predictionText: string;
  predictionType: "stock" | "market" | "sector" | "macro" | "other";
  targetDate?: string;
  confidence: number;
}

export interface PredictionVerification {
  actualOutcome: string;
  accuracyScore: number;
  explanation: string;
  searchSources: string[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Leaderboard types
export interface LeaderboardEntry {
  id: string;
  name: string;
  channelId: string;
  thumbnailUrl: string | null;
  avgScore: number;
  totalVideos: number;
  analyzedVideos: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracyPercent: number;
  rank: number;
}

// Query params types
export interface TimeRangeParams {
  from?: string;
  to?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface VideoFilterParams extends TimeRangeParams, PaginationParams {
  analyzed?: boolean;
}

