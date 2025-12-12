
declare global {
  interface Window {
    google: any;
  }
}

let isScriptLoaded = false;

/**
 * Loads the Google Identity Services SDK
 */
export const initGoogleSdk = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (isScriptLoaded && window.google) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      isScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Falha ao carregar Google SDK"));
    document.head.appendChild(script);
  });
};

/**
 * Triggers the Google OAuth2 Token Flow popup
 * Requires a valid Client ID from Google Cloud Console
 */
export const loginToGoogle = async (clientId: string): Promise<{ accessToken: string; expiresIn: number }> => {
  await initGoogleSdk();
  
  return new Promise((resolve, reject) => {
    if (!window.google) return reject("Google SDK not ready");

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      // Requesting full access to manage account (upload, edit, etc)
      // 'youtube.upload' is specifically for uploading
      // 'youtube.readonly' is for analytics
      // 'youtube' is the broad scope
      scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube',
      callback: (response: any) => {
        if (response.access_token) {
          resolve({
            accessToken: response.access_token,
            expiresIn: response.expires_in || 3600 // Default 1h if not provided
          });
        } else {
          reject(new Error("Permissão negada ou token inválido."));
        }
      },
      error_callback: (error: any) => {
        console.error("Google Auth Error:", error);
        reject(new Error("Erro na autenticação Google."));
      }
    });

    client.requestAccessToken();
  });
};
