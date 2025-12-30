import type { YouTubeChannelInfo, YouTubeVideoInfo } from "../types/index.ts";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const getApiKey = () => {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error("YOUTUBE_API_KEY is not configured");
  }
  return key;
};

// Extract channel ID from various YouTube URL formats
export const extractChannelId = (url: string): string | null => {
  const patterns = [
    // https://www.youtube.com/channel/UC...
    /youtube\.com\/channel\/(UC[\w-]+)/,
    // https://www.youtube.com/@username
    /youtube\.com\/@([\w-]+)/,
    // https://www.youtube.com/c/channelname
    /youtube\.com\/c\/([\w-]+)/,
    // https://www.youtube.com/user/username
    /youtube\.com\/user\/([\w-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  // If it's already a channel ID
  if (url.startsWith("UC") && url.length === 24) {
    return url;
  }

  return null;
};

// YouTube API response types
interface YouTubeSearchResponse {
  items?: { snippet: { channelId: string } }[];
}

interface YouTubeChannelsResponse {
  items?: { id: string }[];
}

interface YouTubeChannelDetailResponse {
  items?: {
    id: string;
    snippet: {
      title: string;
      description: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
      };
    };
    statistics: {
      subscriberCount: string;
      videoCount: string;
    };
  }[];
}

interface YouTubeSearchVideoResponse {
  items?: {
    id: { videoId?: string };
    snippet: {
      title: string;
      description: string;
      channelId: string;
      publishedAt: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
      };
    };
  }[];
  nextPageToken?: string;
}

interface YouTubeVideoDetailsResponse {
  items?: {
    id: string;
    contentDetails: { duration: string };
    statistics: { viewCount: string };
  }[];
}

// Resolve handle/username to channel ID
export const resolveChannelId = async (
  handleOrId: string
): Promise<string | null> => {
  // If already a channel ID
  if (handleOrId.startsWith("UC") && handleOrId.length === 24) {
    return handleOrId;
  }

  const apiKey = getApiKey();

  // Try searching by handle/username
  const searchUrl = `${YOUTUBE_API_BASE}/search?part=snippet&type=channel&q=${encodeURIComponent(
    handleOrId
  )}&key=${apiKey}`;

  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.statusText}`);
  }

  const data = (await response.json()) as YouTubeSearchResponse;
  const items = data.items || [];

  if (items.length > 0 && items[0]) {
    return items[0].snippet.channelId;
  }

  // Try forHandle endpoint for @handles
  if (handleOrId.startsWith("@") || !handleOrId.startsWith("UC")) {
    const handle = handleOrId.startsWith("@") ? handleOrId : `@${handleOrId}`;
    const channelUrl = `${YOUTUBE_API_BASE}/channels?part=id&forHandle=${encodeURIComponent(
      handle.slice(1)
    )}&key=${apiKey}`;

    const channelResponse = await fetch(channelUrl);
    if (channelResponse.ok) {
      const channelData = (await channelResponse.json()) as YouTubeChannelsResponse;
      if (channelData.items && channelData.items.length > 0 && channelData.items[0]) {
        return channelData.items[0].id;
      }
    }
  }

  return null;
};

// Fetch channel details
export const fetchChannelInfo = async (
  channelId: string
): Promise<YouTubeChannelInfo> => {
  const apiKey = getApiKey();
  const url = `${YOUTUBE_API_BASE}/channels?part=snippet,statistics&id=${channelId}&key=${apiKey}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`YouTube API error: ${response.statusText}`);
  }

  const data = (await response.json()) as YouTubeChannelDetailResponse;
  const channel = data.items?.[0];

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  return {
    channelId: channel.id,
    name: channel.snippet.title,
    description: channel.snippet.description || "",
    thumbnailUrl:
      channel.snippet.thumbnails?.medium?.url ||
      channel.snippet.thumbnails?.default?.url ||
      "",
    subscriberCount: parseInt(channel.statistics.subscriberCount || "0", 10),
    videoCount: parseInt(channel.statistics.videoCount || "0", 10),
  };
};

// Fetch videos from a channel within a date range
export const fetchChannelVideos = async (
  channelId: string,
  from: Date,
  to: Date,
  maxResults: number = 50
): Promise<YouTubeVideoInfo[]> => {
  const apiKey = getApiKey();
  const videos: YouTubeVideoInfo[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      channelId: channelId,
      type: "video",
      order: "date",
      publishedAfter: from.toISOString(),
      publishedBefore: to.toISOString(),
      maxResults: Math.min(maxResults - videos.length, 50).toString(),
      key: apiKey,
    });

    if (pageToken) {
      params.set("pageToken", pageToken);
    }

    const url = `${YOUTUBE_API_BASE}/search?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = (await response.json()) as YouTubeSearchVideoResponse;
    const items = data.items || [];

    // Get video IDs for fetching additional details
    const videoIds = items
      .map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length > 0) {
      // Fetch video details (duration, view count)
      const detailsUrl = `${YOUTUBE_API_BASE}/videos?part=contentDetails,statistics&id=${videoIds.join(
        ","
      )}&key=${apiKey}`;
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = (await detailsResponse.json()) as YouTubeVideoDetailsResponse;
      const detailsMap = new Map(
        (detailsData.items || []).map((item) => [item.id, item])
      );

      for (const item of items) {
        const videoId = item.id?.videoId;
        if (!videoId) continue;

        const details = detailsMap.get(videoId);

        videos.push({
          videoId,
          title: item.snippet.title,
          description: item.snippet.description || "",
          thumbnailUrl:
            item.snippet.thumbnails?.medium?.url ||
            item.snippet.thumbnails?.default?.url ||
            "",
          publishedAt: new Date(item.snippet.publishedAt),
          duration: details?.contentDetails?.duration || "",
          viewCount: parseInt(details?.statistics?.viewCount || "0", 10),
          channelId: item.snippet.channelId,
        });
      }
    }

    pageToken = data.nextPageToken;
  } while (pageToken && videos.length < maxResults);

  return videos;
};

// Parse ISO 8601 duration to human readable format
export const parseDuration = (isoDuration: string): string => {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return isoDuration;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

