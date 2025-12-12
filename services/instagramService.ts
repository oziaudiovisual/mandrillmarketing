
import { InstagramStats, InstagramMedia } from '../types';

declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

/**
 * Initializes the Facebook SDK
 * Must be called before login
 */
export const initFacebookSdk = (appId: string): Promise<void> => {
  return new Promise((resolve) => {
    if (window.FB) {
      resolve();
      return;
    }

    // Check if script is already present but FB not ready
    if (document.getElementById('facebook-jssdk')) {
        // Wait a bit or resolve if assuming it loads
        // For simplicity, we just resolve and let FB.login handle the wait or retry
        setTimeout(resolve, 500); 
        return;
    }

    window.fbAsyncInit = function() {
      window.FB.init({
        appId      : appId,
        cookie     : true,
        xfbml      : true,
        version    : 'v18.0'
      });
      resolve();
    };

    // Load the SDK asynchronously
    (function(d, s, id){
       var js, fjs = d.getElementsByTagName(s)[0];
       if (d.getElementById(id)) { return; }
       js = d.createElement(s) as HTMLScriptElement; js.id = id;
       js.src = "https://connect.facebook.net/en_US/sdk.js";
       if (fjs && fjs.parentNode) {
           fjs.parentNode.insertBefore(js, fjs);
       } else {
           d.head.appendChild(js);
       }
     }(document, 'script', 'facebook-jssdk'));
  });
};

/**
 * Triggers the Facebook Login Popup
 * Requests permissions: instagram_basic, instagram_manage_insights, pages_show_list, business_management
 */
export const loginToFacebook = (): Promise<{ accessToken: string; expiresIn: number }> => {
  return new Promise((resolve, reject) => {
    if (!window.FB) return reject("Facebook SDK not initialized");

    window.FB.login((response: any) => {
      console.log("FB Login Response:", response);
      if (response.authResponse) {
        resolve({
            accessToken: response.authResponse.accessToken,
            expiresIn: response.authResponse.expiresIn || 0 // FB returns seconds until expiry
        });
      } else {
        reject("Login cancelado ou permissões não concedidas.");
      }
    }, { 
        // Added business_management to cover some edge cases with Business Manager assets
        scope: 'instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement,read_insights,public_profile,business_management',
        auth_type: 'rerequest'
    });
  });
};

/**
 * Finds the Instagram Business Account ID linked to the user's Pages
 */
export const getInstagramBusinessAccountId = async (accessToken: string): Promise<string> => {
  
  // 1. DIAGNOSTIC: Check Permissions
  try {
      const permReq = await fetch(`https://graph.facebook.com/v18.0/me/permissions?access_token=${accessToken}`);
      const permData = await permReq.json();
      console.log("🔍 Diagnóstico de Permissões:", permData);
      
      const required = ['pages_show_list', 'instagram_basic', 'instagram_manage_insights'];
      const missing = required.filter(req => 
          !permData.data?.some((p: any) => p.permission === req && p.status === 'granted')
      );

      if (missing.length > 0) {
          console.warn("⚠️ Permissões faltando:", missing);
          throw new Error(`As seguintes permissões não foram concedidas no popup: ${missing.join(', ')}. Tente novamente e marque todas as caixas.`);
      }
  } catch (e) {
      console.warn("Erro ao verificar permissões (ignorado, tentando continuar):", e);
  }

  // 2. Fetch User's Pages
  const response = await fetch(
    `https://graph.facebook.com/v18.0/me/accounts?access_token=${accessToken}&fields=instagram_business_account{id},name,id&limit=100`
  );
  
  if (!response.ok) {
     const errText = await response.text();
     console.error("FB Graph API Error:", errText);
     throw new Error("Falha ao buscar páginas do Facebook. Erro de API: " + response.status);
  }
  
  const data = await response.json();

  // 3. Handle Empty Pages List
  if (!data.data || data.data.length === 0) {
      console.error("Lista de páginas retornou vazia:", data);
      throw new Error(
          "Nenhuma página do Facebook foi encontrada nesta conta.\n\n" +
          "CAUSAS POSSÍVEIS:\n" +
          "1. Modo DEV: Se o app está em modo 'Desenvolvimento', sua conta deve ser Admin ou Testadora no painel da Meta.\n" +
          "2. Perfil Errado: Você pode estar logado como uma 'Página' (Novo Perfil). Saia do Facebook e logue com seu perfil PESSOAL que administra a página.\n" +
          "3. Seleção: Você desmarcou as páginas na tela de 'O que você permite' no login."
      );
  }
  
  // Debug: Log pages found
  console.log("✅ Páginas encontradas:", data.data.map((p: any) => ({ 
      name: p.name, 
      pageId: p.id,
      igId: p.instagram_business_account?.id || '🔴 SEM INSTAGRAM'
  })));
  
  // 4. Find first page with an IG Business Account
  const pageWithIg = data.data.find((page: any) => page.instagram_business_account && page.instagram_business_account.id);
  
  if (!pageWithIg) {
    throw new Error(
        "Suas páginas foram encontradas, mas NENHUMA tem conta Instagram Business vinculada.\n\n" +
        "Páginas encontradas: " + data.data.map((p:any) => p.name).join(', ') + "\n\n" +
        "Solução: Vá nas 'Configurações' da sua Página no Facebook > 'Contas Vinculadas' e conecte o Instagram."
    );
  }
  
  return pageWithIg.instagram_business_account.id;
};

/**
 * Fetches Profile Stats (Followers, etc)
 */
export const fetchInstagramStats = async (igAccountId: string, accessToken: string): Promise<InstagramStats> => {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}?fields=biography,id,username,website,followers_count,media_count,profile_picture_url&access_token=${accessToken}`
  );
  
  if (!response.ok) throw new Error("Failed to fetch Instagram Stats");
  
  return await response.json();
};

/**
 * Fetches Recent Media (Posts/Reels)
 */
export const fetchInstagramMedia = async (igAccountId: string, accessToken: string): Promise<InstagramMedia[]> => {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${igAccountId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=10&access_token=${accessToken}`
  );
  
  if (!response.ok) throw new Error("Failed to fetch Instagram Media");
  
  const data = await response.json();
  return data.data; // Array of media objects
};
