import type {
  ApiResponse,
  LeaderboardEntry,
  PaginatedResponse,
  PlatformStats,
  Prediction,
  Video,
  YouTuber,
  YouTuberWithAnalysis,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Generic fetch wrapper with error handling
const fetchApi = async <T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    let data;
    try {
      data = await response.json();
    } catch {
      // If response is not JSON, return error
      return {
        success: false,
        error: `Server returned ${response.status} ${response.statusText}`,
      } as T;
    }

    if (!response.ok) {
      // Return error response structure instead of throwing
      return {
        success: false,
        error: data.error || `Server returned ${response.status} ${response.statusText}`,
      } as T;
    }

    return data;
  } catch (err) {
    // Handle network errors or other fetch errors
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error occurred',
    } as T;
  }
};

// Health check
export const checkHealth = async (): Promise<ApiResponse<null>> => {
  return fetchApi<ApiResponse<null>>('/health');
};

// Channel/YouTuber endpoints
export const getChannels = async (): Promise<ApiResponse<YouTuber[]>> => {
  return fetchApi<ApiResponse<YouTuber[]>>('/channels');
};

export const getChannel = async (
  id: string,
): Promise<ApiResponse<YouTuberWithAnalysis>> => {
  return fetchApi<ApiResponse<YouTuberWithAnalysis>>(`/channels/${id}`);
};

export const addChannel = async (
  channelUrl: string,
): Promise<ApiResponse<YouTuber>> => {
  return fetchApi<ApiResponse<YouTuber>>('/channels', {
    method: 'POST',
    body: JSON.stringify({ channelUrl }),
  });
};

export const syncChannelVideos = async (
  channelId: string,
  from?: string,
  to?: string,
): Promise<ApiResponse<Video[]>> => {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);

  const queryString = params.toString();
  const endpoint = `/channels/${channelId}/sync${queryString ? `?${queryString}` : ''}`;

  return fetchApi<ApiResponse<Video[]>>(endpoint, {
    method: 'POST',
  });
};

export const getChannelVideos = async (
  channelId: string,
  page = 1,
  limit = 10,
): Promise<PaginatedResponse<Video>> => {
  return fetchApi<PaginatedResponse<Video>>(
    `/channels/${channelId}/videos?page=${page}&limit=${limit}`,
  );
};

// Video endpoints
export const getVideos = async (
  page = 1,
  limit = 10,
  analyzed?: boolean,
): Promise<PaginatedResponse<Video>> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (analyzed !== undefined) {
    params.append('analyzed', analyzed.toString());
  }

  return fetchApi<PaginatedResponse<Video>>(`/videos?${params.toString()}`);
};

export const getVideo = async (id: string): Promise<ApiResponse<Video>> => {
  return fetchApi<ApiResponse<Video>>(`/videos/${id}`);
};

export const fetchTranscript = async (
  videoId: string,
): Promise<ApiResponse<{ transcript: string }>> => {
  return fetchApi<ApiResponse<{ transcript: string }>>(
    `/videos/${videoId}/transcript`,
    {
      method: 'POST',
    },
  );
};

export const analyzeVideo = async (
  videoId: string,
): Promise<ApiResponse<Prediction[]>> => {
  return fetchApi<ApiResponse<Prediction[]>>(`/videos/${videoId}/analyze`, {
    method: 'POST',
  });
};

// Leaderboard endpoints
export const getLeaderboard = async (): Promise<
  ApiResponse<LeaderboardEntry[]>
> => {
  return fetchApi<ApiResponse<LeaderboardEntry[]>>('/leaderboard');
};

export const getPlatformStats = async (): Promise<
  ApiResponse<PlatformStats>
> => {
  return fetchApi<ApiResponse<PlatformStats>>('/leaderboard/stats');
};

// Pipeline status
export interface PipelineStatus {
  youtuberId: string;
  status: 'idle' | 'syncing' | 'fetching-transcripts' | 'analyzing' | 'completed' | 'failed';
  totalVideos: number;
  transcriptsFetched: number;
  videosAnalyzed: number;
  currentStep: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export const getPipelineStatus = async (
  channelId: string
): Promise<ApiResponse<PipelineStatus>> => {
  return fetchApi<ApiResponse<PipelineStatus>>(
    `/channels/${channelId}/pipeline-status`
  );
};

export const startPipeline = async (
  channelId: string
): Promise<ApiResponse<{ message: string }>> => {
  return fetchApi<ApiResponse<{ message: string }>>(
    `/channels/${channelId}/start-pipeline`,
    { method: 'POST' }
  );
};

