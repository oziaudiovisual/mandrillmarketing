import { Integration } from '../types';

/**
 * Fetches User Info from TikTok API v2
 * Requires an Access Token with scope: 'user.info.basic', 'user.info.stats'
 */
export const fetchTikTokAccountStats = async (accessToken: string) => {
  try {
    // Note: Calling TikTok API directly from browser often triggers CORS.
    // In a production environment, this should go through a backend proxy.
    // We attempt a direct call here.
    
    const fields = "display_name,avatar_url,follower_count,video_count,likes_count";
    const url = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
        // Handle specific error cases or fallback
        const errText = await response.text();
        console.warn("TikTok API Error:", errText);
        throw new Error(`Erro na API TikTok: ${response.status}. Verifique se o token é válido.`);
    }

    const data = await response.json();
    
    if (data.error && data.error.code !== 'ok') {
        throw new Error(data.error.message || "Erro desconhecido do TikTok");
    }

    const user = data.data.user;

    return {
        username: user.display_name,
        avatar_url: user.avatar_url,
        subscribers: user.follower_count || 0,
        videoCount: user.video_count || 0,
        likes: user.likes_count || 0,
        views: 0 // TikTok Profile API doesn't provide aggregate views, usually requires video iteration
    };

  } catch (error: any) {
    console.error("TikTok Fetch Error:", error);
    throw error;
  }
};

/**
 * Validates token format locally before sending request
 */
export const validateTikTokToken = (token: string): boolean => {
    return token.length > 10;
};