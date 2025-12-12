
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Youtube, Instagram, Music, Video, Linkedin, CheckCircle2, Loader2, AlertCircle, Key, Facebook, ExternalLink, ShieldCheck } from 'lucide-react';
import { Integration, Platform } from '../types';
import { getAuthenticatedChannel } from '../services/youtubeService';
import { initFacebookSdk, loginToFacebook, getInstagramBusinessAccountId, fetchInstagramStats } from '../services/instagramService';
import { loginToGoogle } from '../services/googleAuthService';
import { fetchTikTokAccountStats } from '../services/tiktokService';
import { addIntegration } from '../services/integrationService';

interface IntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (integration: Integration) => void;
}

// Hardcoded Facebook App ID Default
const DEFAULT_FB_APP_ID = '1803248414411032';

export const IntegrationModal: React.FC<IntegrationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  
  // Instagram Form States (Internal System Config)
  const [fbAppId] = useState(DEFAULT_FB_APP_ID);

  // TikTok Form States
  const [tikTokToken, setTikTokToken] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePlatformSelect = (platform: Platform) => {
    // Disabled platforms
    if (platform === 'linkedin') {
       alert("Em breve! No momento estamos implementando YouTube, Instagram e TikTok.");
       return;
    }
    setSelectedPlatform(platform);
    setStep('configure');
    setError(null);
  };

  const handleSaveYouTube = async () => {
    // Read Client ID from Global Config (index.html)
    const googleClientId = (window as any).APP_CONFIG?.GOOGLE_CLIENT_ID;

    if (!googleClientId || googleClientId.includes("SEU_GOOGLE_CLIENT_ID")) {
        throw new Error("Google Client ID não configurado no sistema (index.html).");
    }

    // 1. Perform Login
    const { accessToken, expiresIn } = await loginToGoogle(googleClientId);

    // 2. Fetch Channel Details (Validation + Data)
    const stats = await getAuthenticatedChannel(accessToken);

    // 3. Save Integration
    const newIntegration = await addIntegration({
      name: stats.title, 
      platform: 'youtube',
      connectedAt: new Date().toISOString(),
      config: {
        clientId: googleClientId,
        accessToken: accessToken, // Save token for future calls
        channelId: stats.id,
        expiresAt: Date.now() + (expiresIn * 1000) // Store expiration
      },
      stats: {
        subscribers: stats.subscribers,
        views: stats.views,
        videoCount: stats.videoCount,
        lastUpdated: new Date().toISOString()
      }
    });

    return newIntegration;
  };

  const handleSaveInstagram = async () => {
    if (!fbAppId) throw new Error("App ID não configurado.");

    // 1. Initialize SDK
    await initFacebookSdk(fbAppId);

    // 2. Login Flow
    const { accessToken, expiresIn } = await loginToFacebook();

    // 3. Get Account ID
    const accountId = await getInstagramBusinessAccountId(accessToken);

    // 4. Fetch Stats for Validation & Initial Data
    const igStats = await fetchInstagramStats(accountId, accessToken);

    // 5. Save Integration
    const newIntegration = await addIntegration({
        name: `@${igStats.username}`, // Use IG handle as name
        platform: 'instagram',
        connectedAt: new Date().toISOString(),
        config: {
            accessToken: accessToken,
            accountId: accountId,
            appId: fbAppId,
            expiresAt: Date.now() + (expiresIn * 1000) // Store expiration
        },
        stats: {
            subscribers: igStats.followers_count,
            views: 0, // IG Profile API doesn't give aggregate views easily, set 0 for now
            videoCount: igStats.media_count,
            lastUpdated: new Date().toISOString()
        }
    });

    return newIntegration;
  };

  const handleSaveTikTok = async () => {
    if (!tikTokToken) throw new Error("Insira o Access Token.");

    // 1. Fetch Data
    const stats = await fetchTikTokAccountStats(tikTokToken);

    // 2. Save
    const newIntegration = await addIntegration({
        name: stats.username || "TikTok Account",
        platform: 'tiktok',
        connectedAt: new Date().toISOString(),
        config: {
            accessToken: tikTokToken
        },
        stats: {
            subscribers: stats.subscribers,
            views: stats.views, // Note: usually 0 from profile endpoint
            videoCount: stats.videoCount,
            lastUpdated: new Date().toISOString()
        }
    });

    return newIntegration;
  };

  const handleSubmit = async () => {
    if (!selectedPlatform) return;
    setIsLoading(true);
    setError(null);

    try {
      let integration;
      
      if (selectedPlatform === 'youtube') {
        integration = await handleSaveYouTube();
      } else if (selectedPlatform === 'instagram') {
        integration = await handleSaveInstagram();
      } else if (selectedPlatform === 'tiktok') {
        integration = await handleSaveTikTok();
      }

      if (integration) {
        onSuccess(integration);
        onClose();
        resetForm();
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Falha ao conectar.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setStep('select');
    setSelectedPlatform(null);
    setTikTokToken('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-2xl rounded-[5px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#444746] flex justify-between items-center bg-[#171918]">
          <h2 className="text-xl font-bold text-[#E3E3E3] flex items-center gap-2">
            {step === 'select' ? 'Nova Integração' : (
                <>
                    Conectar 
                    <span className="capitalize">{selectedPlatform}</span>
                </>
            )}
          </h2>
          <button onClick={handleClose} className="text-[#C4C7C5] hover:text-[#E3E3E3]">
            <X className="w-6 h-6" strokeWidth={1} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 bg-[#101110] flex-1 overflow-y-auto">
          
          {step === 'select' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <PlatformOption 
                icon={<Youtube className="w-8 h-8" />} 
                label="YouTube" 
                color="text-red-500" 
                onClick={() => handlePlatformSelect('youtube')} 
              />
              <PlatformOption 
                icon={<Instagram className="w-8 h-8" />} 
                label="Instagram" 
                color="text-pink-500" 
                onClick={() => handlePlatformSelect('instagram')} 
              />
              <PlatformOption 
                icon={<Music className="w-8 h-8" />} 
                label="TikTok" 
                color="text-cyan-400" 
                onClick={() => handlePlatformSelect('tiktok')} 
              />
              <PlatformOption 
                icon={<Linkedin className="w-8 h-8" />} 
                label="LinkedIn" 
                color="text-blue-500" 
                onClick={() => handlePlatformSelect('linkedin')} 
              />
            </div>
          ) : (
            <div className="space-y-6 max-w-md mx-auto">
               
               {/* Platform Icon Header */}
               <div className="text-center mb-6">
                  {selectedPlatform === 'youtube' && (
                    <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                        <Youtube className="w-8 h-8 text-red-500" strokeWidth={1.5} />
                    </div>
                  )}
                  {selectedPlatform === 'instagram' && (
                    <div className="bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 p-1 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <div className="bg-black w-full h-full rounded-full flex items-center justify-center">
                            <Instagram className="w-8 h-8 text-white" strokeWidth={1.5} />
                        </div>
                    </div>
                  )}
                  {selectedPlatform === 'tiktok' && (
                    <div className="bg-cyan-400/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-cyan-400/20">
                        <Music className="w-8 h-8 text-cyan-400" strokeWidth={1.5} />
                    </div>
                  )}
                  
                  <p className="text-[#C4C7C5] text-sm">
                    {selectedPlatform === 'youtube' 
                        ? "O sistema usará seu Client ID pré-configurado para autenticar."
                        : selectedPlatform === 'instagram'
                        ? "Conecte sua conta Business para importar seguidores e métricas de engajamento."
                        : "Importe dados do seu perfil TikTok usando seu Access Token de desenvolvedor."
                    }
                  </p>
               </div>

               {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-[5px] p-3 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1} />
                      <p className="text-sm text-red-400">{error}</p>
                  </div>
               )}

               {/* YOUTUBE FORM (Login Flow - Simplified) */}
               {selectedPlatform === 'youtube' && (
                   <div className="space-y-4">
                      
                      <div className="bg-[#2D2E2F] p-4 rounded-[5px] border border-[#444746] text-xs text-[#C4C7C5] space-y-2">
                           <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-[#0BB07B]"/> Client ID Configurado</div>
                           <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-[#0BB07B]"/> Permissão para ler dados</div>
                      </div>

                      <div className="text-center">
                          <p className="text-xs text-[#5E5E5E]">
                              Ao clicar em Login, um popup do Google abrirá para você selecionar o canal.
                          </p>
                      </div>
                   </div>
               )}

               {/* INSTAGRAM FORM */}
               {selectedPlatform === 'instagram' && (
                   <div className="space-y-6">
                       {/* App ID is now hidden and hardcoded */}
                       <div className="bg-[#2D2E2F] p-4 rounded-[5px] border border-[#444746] text-xs text-[#C4C7C5] space-y-2">
                            <p className="font-semibold text-[#E3E3E3] uppercase mb-1">Requisitos:</p>
                            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-[#0BB07B]"/> Conta Instagram Business/Creator</div>
                            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-[#0BB07B]"/> Vinculada a uma Página do Facebook</div>
                            <div className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-[#0BB07B]"/> App ID do Sistema Configurado</div>
                       </div>
                   </div>
               )}

               {/* TIKTOK FORM */}
               {selectedPlatform === 'tiktok' && (
                   <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-[#C4C7C5] uppercase tracking-wider block mb-2 flex items-center gap-1">
                            <Key className="w-3 h-3" /> Access Token
                        </label>
                        <input 
                          type="text" 
                          value={tikTokToken}
                          onChange={(e) => setTikTokToken(e.target.value)}
                          placeholder="Insira seu Access Token do TikTok API"
                          className="w-full bg-[#2D2E2F] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 focus:border-[#fe6a0f] outline-none placeholder-[#5E5E5E]"
                        />
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-[10px] text-[#5E5E5E]">
                                Requer token gerado via API Explorer.
                            </p>
                            <a 
                                href="https://developers.tiktok.com/tools/explorer" 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-[10px] text-[#fe6a0f] hover:underline flex items-center gap-1"
                            >
                                Gerar Token <ExternalLink className="w-3 h-3" />
                            </a>
                        </div>
                      </div>
                   </div>
               )}

            </div>
          )}

        </div>

        {/* Footer */}
        {step === 'configure' && (
           <div className="p-6 border-t border-[#444746] bg-[#171918] flex justify-between items-center">
             <button 
               onClick={() => setStep('select')}
               disabled={isLoading}
               className="text-[#C4C7C5] hover:text-[#E3E3E3] text-sm font-medium disabled:opacity-50"
             >
               Voltar
             </button>
             <button 
               onClick={handleSubmit}
               disabled={isLoading}
               className={`px-6 py-2.5 rounded-[5px] text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all ${
                   selectedPlatform === 'instagram' 
                   ? 'bg-[#1877F2] hover:bg-[#1877F2]/80 text-white' 
                   : selectedPlatform === 'tiktok'
                   ? 'bg-[#25F4EE] hover:bg-[#25F4EE]/80 text-black'
                   : 'bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white'
               }`}
             >
               {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                   selectedPlatform === 'instagram' ? <Facebook className="w-4 h-4" /> : 
                   selectedPlatform === 'youtube' ? <ShieldCheck className="w-4 h-4" /> :
                   <CheckCircle2 className="w-4 h-4" />
               )}
               {selectedPlatform === 'instagram' ? 'Login com Facebook' : 
                selectedPlatform === 'youtube' ? 'Login com Google' :
                'Salvar Integração'}
             </button>
           </div>
        )}

      </div>
    </div>,
    document.body
  );
};

const PlatformOption: React.FC<{ icon: React.ReactNode, label: string, color: string, onClick: () => void }> = ({ icon, label, color, onClick }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center justify-center p-6 bg-[#2D2E2F] border border-[#444746] rounded-[5px] hover:border-[#fe6a0f] hover:bg-[#1E1F20] transition-all group gap-3"
  >
    <div className={`${color} group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <span className="text-[#E3E3E3] font-medium">{label}</span>
  </button>
);
