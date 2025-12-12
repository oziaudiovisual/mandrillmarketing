import { VideoAnalytics, YouTubeMetadata } from '../types';

interface YouTubeChannelStats {
  subscriberCount: string;
  viewCount: string;
  videoCount: string;
  hiddenSubscriberCount: boolean;
}

interface Credentials {
  apiKey?: string;
  accessToken?: string;
}

export interface YouTubePlaylist {
  id: string;
  title: string;
  channelId: string;
  channelTitle: string;
}

/**
 * Helper to build headers/params based on credentials
 */
const getAuthParams = (credentials: Credentials) => {
  const headers: Record<string, string> = {};
  let query = '';

  if (credentials.accessToken) {
    headers['Authorization'] = `Bearer ${credentials.accessToken}`;
  } else if (credentials.apiKey) {
    query = `&key=${credentials.apiKey}`;
  } else {
    throw new Error("Nenhuma credencial (API Key ou Token) fornecida.");
  }

  return { headers, query };
};

/**
 * Fetches the authenticated user's own channel details.
 */
export const getAuthenticatedChannel = async (accessToken: string) => {
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
      headers: {
          'Authorization': `Bearer ${accessToken}`
      }
  });

  if (!response.ok) {
      throw new Error("Falha ao buscar canal do YouTube. Verifique o token.");
  }

  const data = await response.json();
  if (!data.items || data.items.length === 0) {
       throw new Error("Nenhum canal associado a esta conta Google.");
  }

  const item = data.items[0];
  const stats = item.statistics as YouTubeChannelStats;

  return {
       id: item.id,
       title: item.snippet.title,
       thumbnail: item.snippet.thumbnails?.default?.url,
       subscribers: parseInt(stats.subscriberCount) || 0,
       views: parseInt(stats.viewCount) || 0,
       videoCount: parseInt(stats.videoCount) || 0
  };
};

/**
 * Fetches basic channel statistics using the Google Data API v3.
 */
export const getYouTubeChannelStats = async (channelId: string, credentials: Credentials) => {
  const { headers, query } = getAuthParams(credentials);
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}${query}`;

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to fetch YouTube data");
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("Canal não encontrado. Verifique o ID do canal.");
  }

  const item = data.items[0];
  const stats = item.statistics as YouTubeChannelStats;
  const snippet = item.snippet;

  return {
    title: snippet.title,
    thumbnail: snippet.thumbnails?.default?.url,
    subscribers: parseInt(stats.subscriberCount) || 0,
    views: parseInt(stats.viewCount) || 0,
    videoCount: parseInt(stats.videoCount) || 0
  };
};

/**
 * Helper to fetch detailed statistics for a list of video IDs
 */
const fetchVideoStats = async (videoIds: string, credentials: Credentials): Promise<VideoAnalytics[]> => {
    const { headers, query } = getAuthParams(credentials);
    const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}${query}`;
    
    const statsRes = await fetch(statsUrl, { headers });
    const statsData = await statsRes.json();

    if(!statsData.items) return [];

    return statsData.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails.medium?.url || item.snippet.thumbnails.default?.url,
        publishedAt: item.snippet.publishedAt,
        viewCount: parseInt(item.statistics.viewCount) || 0,
        likeCount: parseInt(item.statistics.likeCount) || 0,
        commentCount: parseInt(item.statistics.commentCount) || 0,
        channelTitle: item.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${item.id}`
    }));
};

/**
 * Fetches the most popular videos of a channel
 */
export const getTopVideos = async (channelId: string, limit: number = 1, credentials: Credentials): Promise<VideoAnalytics[]> => {
    const { headers, query } = getAuthParams(credentials);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=viewCount&type=video&maxResults=${limit}${query}`;
    const searchRes = await fetch(searchUrl, { headers });
    const searchData = await searchRes.json();
    
    if (!searchData.items?.length) return [];
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    return fetchVideoStats(videoIds, credentials);
};

export const getRecentVideos = async (channelId: string, limit: number = 10, credentials: Credentials): Promise<VideoAnalytics[]> => {
    const { headers, query } = getAuthParams(credentials);
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=${limit}${query}`;
    const searchRes = await fetch(searchUrl, { headers });
    const searchData = await searchRes.json();
    
    if (!searchData.items?.length) return [];
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    return fetchVideoStats(videoIds, credentials);
};

// --- UPLOAD & MANAGEMENT LOGIC ---

/**
 * Fetch Playlists for the authenticated channel
 */
export const getChannelPlaylists = async (accessToken: string): Promise<YouTubePlaylist[]> => {
    const url = 'https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50';
    const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) throw new Error("Falha ao buscar playlists.");
    const data = await response.json();
    if (!data.items) return [];

    return data.items.map((item: any) => ({
        id: item.id,
        title: item.snippet.title,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle
    }));
};

/**
 * Add a video to a playlist
 */
export const addVideoToPlaylist = async (accessToken: string, playlistId: string, videoId: string) => {
    const url = 'https://www.googleapis.com/youtube/v3/playlistItems?part=snippet';
    const body = {
        snippet: {
            playlistId: playlistId,
            resourceId: { kind: 'youtube#video', videoId: videoId }
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Falha ao adicionar à playlist: ${err}`);
    }
};

/**
 * UPLOAD VIA BACKEND (Cloud Run)
 * Envia o vídeo para o YouTube através do servidor
 * O backend faz streaming direto do Firebase Storage para a YouTube API
 * Isso evita o problema de CORS do navegador
 */
export const uploadVideoToYouTube = async (
    accessToken: string,
    storagePath: string,  // Caminho no Firebase Storage (ex: "users/uid/videos/video.mp4")
    metadata: YouTubeMetadata,
    scheduledDate?: string
): Promise<{ id: string }> => {
    
    console.log("🚀 Enviando para o backend processar o upload...");
    console.log("📁 Storage Path:", storagePath);

    const requestBody = {
        storagePath: storagePath,
        accessToken: accessToken,
        metadata: {
            title: metadata.title.substring(0, 100),
            description: metadata.description.substring(0, 5000),
            tags: metadata.tags || [],
            categoryId: metadata.categoryId || '22',
            privacyStatus: scheduledDate ? 'private' : (metadata.privacyStatus || 'public'),
            publishAt: scheduledDate || undefined
        }
    };

    try {
        const response = await fetch('/api/upload-youtube', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Erro no upload: ${response.status}`);
        }

        const result = await response.json();
        console.log("✅ Upload concluído! Video ID:", result.id);
        
        return { id: result.id };

    } catch (error: any) {
        console.error("❌ Erro no upload:", error);
        throw new Error(error.message || "Falha ao enviar vídeo para o YouTube");
    }
};

/**
 * Deletes a video from YouTube by its Video ID.
 */
export const deleteVideoFromYouTube = async (accessToken: string, videoId: string): Promise<void> => {
    console.log(`🗑️ Deleting YouTube Video: ${videoId}`);
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });

    if (res.status === 404) {
        console.warn("Video already deleted or not found on YouTube.");
        return;
    }

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Failed to delete from YouTube (${res.status}): ${err}`);
    }
};
