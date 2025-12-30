// YouTuber/Channel types
export interface YouTuber {
  id: string;
  channelId: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  totalPredictions: number;
  correctPredictions: number;
  accuracyPercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface YouTuberWithAnalysis extends YouTuber {
  analysisStatus: {
    totalVideos: number;
    analyzedVideos: number;
    pendingVideos: number;
    avgScore: number | null;
    averageAccuracy?: number | null;
    totalPredictions?: number;
    correctPredictions?: number;
    accuracyPercent?: number;
  };
}

// Video types
export interface Video {
  id: string;
  videoId: string;
  title: string;
  description: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  duration: string;
  viewCount: number;
  transcript: string | null;
  analyzed: boolean;
  avgScore: number | null;
  youtuberId: string;
  createdAt: string;
  updatedAt: string;
  youtuber?: YouTuber;
  predictions?: Prediction[];
}

// Prediction types
export interface Prediction {
  id: string;
  timestampSec: number;
  timestampFormatted: string;
  predictionText: string;
  predictionType: 'stock' | 'market' | 'sector' | 'macro' | 'other';
  targetDate: string | null;
  confidence: number;
  actualOutcome: string | null;
  accuracyScore: number | null;
  explanation: string | null;
  searchSources: string[];
  verified: boolean;
  videoId: string;
  createdAt: string;
  updatedAt: string;
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

// Platform stats types
export interface PlatformStats {
  totalYouTubers: number;
  totalVideos: number;
  analyzedVideos: number;
  totalPredictions: number;
  verifiedPredictions: number;
  avgAccuracy: number;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface AddChannelForm {
  channelUrl: string;
}

export interface SyncVideosForm {
  from: string;
  to: string;
}

