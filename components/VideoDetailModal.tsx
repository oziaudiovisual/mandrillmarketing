
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2, Wand2, FileText, CheckCircle2, Instagram, Music, Youtube, ThumbsUp, Ban, Save, Undo2, Power, Smartphone, Film, PlaySquare, Image as ImageIcon, Video, MapPin, UserPlus, BookOpen, ListVideo, Check, AlertTriangle, List } from 'lucide-react';
import { VideoAsset, Platform, YouTubeMetadata, SocialMetadata, Integration, DistributionConfig } from '../types';
import { transcribeVideo, generateYouTubeMetadata, generateSocialCaption } from '../services/geminiService';
import { updateVideoTranscription, approveVideo, dismissVideo, updateVideoPlatforms, updateVideoMetadata, unapproveVideo, updateVideoDistributionConfig } from '../services/videoService';
import { getIntegrations } from '../services/integrationService';
import { getCachedFile } from '../services/fileCache';
import { ApproveConfirmationModal } from './ApproveConfirmationModal';
import { getChannelPlaylists, YouTubePlaylist } from '../services/youtubeService';

interface VideoDetailModalProps {
  video: VideoAsset;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedVideo: VideoAsset) => void;
}

// Helper to check object equality
const isEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

// YouTube Category List (Standard IDs)
const YOUTUBE_CATEGORIES = [
    { id: '22', name: 'Pessoas e Blogs' },
    { id: '10', name: 'Música' },
    { id: '23', name: 'Comédia' },
    { id: '24', name: 'Entretenimento' },
    { id: '1',  name: 'Filmes e Animação' },
    { id: '20', name: 'Jogos' },
    { id: '27', name: 'Educação' },
    { id: '28', name: 'Ciência e Tecnologia' },
    { id: '25', name: 'Notícias e Política' },
    { id: '17', name: 'Esportes' },
    { id: '19', name: 'Viagens e Eventos' },
];

export const VideoDetailModal: React.FC<VideoDetailModalProps> = ({ video, clientName, isOpen, onClose, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'transcription' | 'content'>('preview');
  const [subTab, setSubTab] = useState<Platform>('youtube'); // Default sub-tab
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [localVideo, setLocalVideo] = useState<VideoAsset>(video);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(video.platforms || []);
  
  // Video Metadata State
  const [videoDimensions, setVideoDimensions] = useState<{width: number, height: number} | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  
  // YouTube specific state
  const [availablePlaylists, setAvailablePlaylists] = useState<YouTubePlaylist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  
  // Confirmation Modal State
  const [showApproveModal, setShowApproveModal] = useState(false);

  // Integration Data
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  
  // Distribution Configs (Flattened array from video asset)
  const [distributionConfigs, setDistributionConfigs] = useState<DistributionConfig[]>([]);

  // Form States (Legacy Metadata)
  const defaultYt = { title: '', description: '', tags: [], categoryId: '22', privacyStatus: 'public' as const };
  const defaultSocial = { caption: '' };

  const [ytData, setYtData] = useState<YouTubeMetadata>(video.youtubeMetadata || defaultYt);
  const [igData, setIgData] = useState<SocialMetadata>(video.instagramMetadata || defaultSocial);
  const [ttData, setTtData] = useState<SocialMetadata>(video.tiktokMetadata || defaultSocial);

  // Shared Settings Per Platform (e.g. Post Type)
  const [platformSettings, setPlatformSettings] = useState<Record<Platform, { postType: string }>>({
      youtube: { postType: video.format === 'vertical' ? 'shorts' : 'video' },
      instagram: { postType: 'reel' },
      tiktok: { postType: 'reel' },
      kwai: { postType: 'video' },
      linkedin: { postType: 'video' }
  });

  // Load Integrations
  useEffect(() => {
     if (isOpen) {
         getIntegrations().then(data => setIntegrations(data));
     }
  }, [isOpen]);

  // Sync state when video prop changes
  useEffect(() => {
      setLocalVideo(video);
      if (video.platforms) setSelectedPlatforms(video.platforms);
      if (video.youtubeMetadata) setYtData(video.youtubeMetadata);
      if (video.instagramMetadata) setIgData(video.instagramMetadata);
      if (video.tiktokMetadata) setTtData(video.tiktokMetadata);
      
      if (video.distributionConfig) {
          setDistributionConfigs(video.distributionConfig);
          
          // Try to infer post types from existing configs
          const newSettings = { ...platformSettings };
          video.distributionConfig.forEach(c => {
              if (c.postType) newSettings[c.platform].postType = c.postType;
          });
          setPlatformSettings(newSettings);
      } else {
          setDistributionConfigs([]);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video]);

  // Fetch Playlists when YouTube tab is active and we have connected accounts
  useEffect(() => {
      const fetchPlaylists = async () => {
          if (activeTab !== 'content' || subTab !== 'youtube') return;
          
          const youtubeIntegrations = integrations.filter(i => i.platform === 'youtube' && i.config.accessToken);
          if (youtubeIntegrations.length === 0) return;

          setIsLoadingPlaylists(true);
          try {
              let allPlaylists: YouTubePlaylist[] = [];
              
              // Fetch from all connected accounts to allow selection
              for (const integ of youtubeIntegrations) {
                  try {
                      if (integ.config.accessToken) {
                          const pl = await getChannelPlaylists(integ.config.accessToken);
                          // Append channel name to distinguish
                          const enriched = pl.map(p => ({ ...p, channelTitle: integ.name }));
                          allPlaylists = [...allPlaylists, ...enriched];
                      }
                  } catch (e) {
                      console.warn(`Failed to fetch playlists for ${integ.name}`, e);
                  }
              }
              setAvailablePlaylists(allPlaylists);
          } catch (error) {
              console.error("Error fetching playlists", error);
          } finally {
              setIsLoadingPlaylists(false);
          }
      };

      if (integrations.length > 0) {
          fetchPlaylists();
      }
  }, [activeTab, subTab, integrations]);

  // --- CONFIG MANAGEMENT HELPERS ---

  const getPlatformConfigs = (platform: Platform) => {
      return distributionConfigs.filter(c => c.platform === platform);
  };

  const isAccountSelected = (platform: Platform, accountId: string) => {
      return distributionConfigs.some(c => c.platform === platform && c.accountId === accountId);
  };

  const toggleAccountSelection = async (platform: Platform, accountId: string) => {
      let newConfigs = [...distributionConfigs];
      
      if (isAccountSelected(platform, accountId)) {
          // Remove
          newConfigs = newConfigs.filter(c => !(c.platform === platform && c.accountId === accountId));
      } else {
          // Add
          const metadata = platform === 'youtube' 
            ? { 
                title: ytData.title, 
                caption: ytData.description, 
                tags: ytData.tags.join(', '),
                playlistId: ytData.playlistId || null, // FIX: Ensure undefined becomes null
                categoryId: ytData.categoryId
              }
            : { caption: platform === 'instagram' ? igData.caption : ttData.caption };

          const newConfig: DistributionConfig = {
              platform,
              accountId,
              postType: platformSettings[platform].postType as any,
              metadata
          };
          newConfigs.push(newConfig);
      }

      await saveDistributionConfigs(newConfigs);
  };

  const updatePostTypeForPlatform = async (platform: Platform, newType: string) => {
      // Update local settings state
      setPlatformSettings(prev => ({
          ...prev,
          [platform]: { ...prev[platform], postType: newType }
      }));

      // Update all existing configs for this platform
      const newConfigs = distributionConfigs.map(c => {
          if (c.platform === platform) {
              return { ...c, postType: newType as any };
          }
          return c;
      });

      await saveDistributionConfigs(newConfigs);
  };

  const syncMetadataToConfigs = async (platform: Platform, metaUpdates: any) => {
      // Update all configs for this platform with new metadata
      const newConfigs = distributionConfigs.map(c => {
          if (c.platform === platform) {
              return { 
                  ...c, 
                  metadata: { ...c.metadata, ...metaUpdates } 
              };
          }
          return c;
      });
      
      // We don't save to DB on every keystroke, just update local state
      setDistributionConfigs(newConfigs);
  };

  const saveDistributionConfigs = async (configs: DistributionConfig[]) => {
      setDistributionConfigs(configs);
      await updateVideoDistributionConfig(localVideo.id, configs);
      const updatedVideo = { ...localVideo, distributionConfig: configs };
      setLocalVideo(updatedVideo);
      onUpdate(updatedVideo);
  };

  // Workflow Initialization
  useEffect(() => {
    if (isOpen) {
        if (video.transcription && video.transcription.trim().length > 0) {
            setActiveTab('content');
            if (video.platforms && video.platforms.length > 0) {
                 setSubTab(video.platforms[0]);
            } else {
                 setSubTab('youtube');
            }
        } else {
            setActiveTab('preview');
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); 

  // --- VALIDATION LOGIC ---
  const isInstagramRatioValid = () => {
      if (!videoDimensions) return true; // Assume valid if loading or error
      const ratio = videoDimensions.width / videoDimensions.height;
      return ratio >= 0.50 && ratio <= 0.85; 
  };

  const isInstagramDurationValid = () => {
      if (!videoDuration) return true; 
      return videoDuration >= 3 && videoDuration <= 3600;
  };

  const isInstagramValid = () => isInstagramRatioValid() && isInstagramDurationValid();

  // --- YOUTUBE RULES ---
  const getYouTubeRuleType = (): 'shorts' | 'video' | null => {
      if (!videoDimensions || !videoDuration) return null;
      
      const ratio = videoDimensions.width / videoDimensions.height;
      const isSquare = ratio >= 0.9 && ratio <= 1.1; 
      const isVertical = ratio < 0.9; 
      const isShortDuration = videoDuration < 60;

      if ((isSquare || isVertical) && isShortDuration) {
          return 'shorts';
      }
      return 'video';
  };

  // Enforce YouTube Rules Automatically
  useEffect(() => {
      const ruleType = getYouTubeRuleType();
      if (ruleType && platformSettings['youtube'].postType !== ruleType) {
          console.log(`Auto-switching YouTube to ${ruleType} based on dimensions/duration.`);
          updatePostTypeForPlatform('youtube', ruleType);
      }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoDimensions, videoDuration]);

  if (!isOpen) return null;

  const hasTranscription = !!localVideo.transcription && localVideo.transcription.trim().length > 0;
  const isDismissed = localVideo.status === 'dismissed';
  
  // YouTube Type Determination for UI
  const ytRuleType = getYouTubeRuleType();
  const isYouTubeLongForm = platformSettings['youtube'].postType === 'video';
  
  // Validation for Approval
  const isYouTubeReady = !selectedPlatforms.includes('youtube') || (ytData.title.trim() !== '' && ytData.description.trim() !== '');
  const isInstagramReady = !selectedPlatforms.includes('instagram') || (igData.caption.trim() !== '');
  const isTikTokReady = !selectedPlatforms.includes('tiktok') || (ttData.caption.trim() !== '');
  
  // Check if at least one account is selected for active platforms
  const hasAccountForYoutube = !selectedPlatforms.includes('youtube') || getPlatformConfigs('youtube').length > 0;
  const hasAccountForInstagram = !selectedPlatforms.includes('instagram') || getPlatformConfigs('instagram').length > 0;
  const hasAccountForTikTok = !selectedPlatforms.includes('tiktok') || getPlatformConfigs('tiktok').length > 0;

  const isAllReady = selectedPlatforms.length > 0 && 
                     isYouTubeReady && isInstagramReady && isTikTokReady &&
                     hasAccountForYoutube && hasAccountForInstagram && hasAccountForTikTok;

  // Dirty Checks
  const isYtDirty = !isEqual(ytData, localVideo.youtubeMetadata || defaultYt);

  // --- ACTIONS ---

  const handleTranscribe = async () => {
    setIsProcessing(true);
    try {
      const cachedFile = getCachedFile(localVideo.id);
      const input = cachedFile || localVideo.url;

      const transcription = await transcribeVideo(input); 
      await updateVideoTranscription(localVideo.id, transcription);
      const updated = { ...localVideo, transcription, status: 'pending' as const };
      setLocalVideo(updated);
      onUpdate(updated);
      setActiveTab('content'); 
      setSubTab('youtube');
    } catch (error: any) {
      console.error("Transcription error:", error);
      alert("Erro ao gerar transcrição: " + (error.message || "Verifique o console."));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateYouTube = async () => {
      if (!localVideo.transcription) return;
      setIsProcessing(true);
      try {
          const postType = platformSettings['youtube'].postType as 'shorts' | 'video';
          const meta = await generateYouTubeMetadata(localVideo.transcription, clientName, postType);
          const newYtData = { ...ytData, ...meta };
          setYtData(newYtData);
          
          // Apply to all configs
          const newConfigs = distributionConfigs.map(c => {
              if (c.platform === 'youtube') {
                  return { 
                      ...c, 
                      metadata: { 
                          title: meta.title, 
                          caption: meta.description, 
                          tags: meta.tags.join(', '),
                          // Preserve existing and FIX undefined
                          playlistId: c.metadata.playlistId || null,
                          categoryId: c.metadata.categoryId
                      } 
                  };
              }
              return c;
          });
          
          await updateVideoDistributionConfig(localVideo.id, newConfigs);
          await updateVideoMetadata(localVideo.id, { youtube: newYtData });
          
          const updatedVideo = { 
              ...localVideo, 
              distributionConfig: newConfigs,
              youtubeMetadata: newYtData 
          };
          setLocalVideo(updatedVideo);
          setDistributionConfigs(newConfigs); // Update local state too
          onUpdate(updatedVideo);

      } catch (e) { console.error(e); } 
      finally { setIsProcessing(false); }
  };

  const handleGenerateSocial = async (platform: 'instagram' | 'tiktok') => {
      if (!localVideo.transcription) return;
      setIsProcessing(true);
      try {
          let postType: any = platformSettings[platform].postType;
          
          const caption = await generateSocialCaption(localVideo.transcription, platform, clientName, postType);
          
          // Apply to all configs
          const newConfigs = distributionConfigs.map(c => {
              if (c.platform === platform) {
                  return { ...c, metadata: { ...c.metadata, caption } };
              }
              return c;
          });

          await updateVideoDistributionConfig(localVideo.id, newConfigs);
          setDistributionConfigs(newConfigs);

          if (platform === 'instagram') {
              const newIgData = { caption };
              setIgData(newIgData);
              await updateVideoMetadata(localVideo.id, { instagram: newIgData });
              const updatedVideo = { ...localVideo, distributionConfig: newConfigs, instagramMetadata: newIgData };
              setLocalVideo(updatedVideo);
              onUpdate(updatedVideo);

          } else {
              const newTtData = { caption };
              setTtData(newTtData);
              await updateVideoMetadata(localVideo.id, { tiktok: newTtData });
              const updatedVideo = { ...localVideo, distributionConfig: newConfigs, tiktokMetadata: newTtData };
              setLocalVideo(updatedVideo);
              onUpdate(updatedVideo);
          }
      } catch (e) { console.error(e); } 
      finally { setIsProcessing(false); }
  };

  // Individual Field Saves
  const handleSavePlatformData = async (platform: Platform) => {
      setIsProcessing(true);
      try {
          let metaUpdates: any = {};
          let updates: Partial<VideoAsset> = {};

          // 1. Prepare Metadata Update
          if (platform === 'youtube') {
              const safeYt = { ...ytData, playlistId: ytData.playlistId || null }; // FIX: Sanitize undefined
              metaUpdates.youtube = safeYt;
              updates.youtubeMetadata = safeYt;
          } else if (platform === 'instagram') {
              metaUpdates.instagram = igData;
              updates.instagramMetadata = igData;
          } else if (platform === 'tiktok') {
              metaUpdates.tiktok = ttData;
              updates.tiktokMetadata = ttData;
          }

          // 2. Prepare Distribution Configs Update (Sync current meta to all platform configs)
          const newConfigs = distributionConfigs.map(c => {
              if (c.platform === platform) {
                  const meta = platform === 'youtube' 
                    ? { 
                        title: ytData.title, 
                        caption: ytData.description, 
                        tags: ytData.tags.join(', '),
                        playlistId: ytData.playlistId || null, // FIX: Sanitize undefined
                        categoryId: ytData.categoryId
                      }
                    : { caption: platform === 'instagram' ? igData.caption : ttData.caption };
                  
                  return { ...c, metadata: { ...c.metadata, ...meta } };
              }
              return c;
          });

          // 3. Execute Updates
          await updateVideoMetadata(localVideo.id, metaUpdates);
          await updateVideoDistributionConfig(localVideo.id, newConfigs);
          
          updates.distributionConfig = newConfigs;
          const updatedVideo = { ...localVideo, ...updates };
          
          setLocalVideo(updatedVideo);
          setDistributionConfigs(newConfigs);
          onUpdate(updatedVideo);

      } catch (e) { console.error(e); }
      finally { setIsProcessing(false); }
  };

  const handlePlatformClick = (platform: Platform) => {
    setSubTab(platform);
  };

  const togglePlatformActive = async (platform: Platform, isActive: boolean) => {
      let newPlatforms = [...selectedPlatforms];
      if (isActive) {
          if (!newPlatforms.includes(platform)) newPlatforms.push(platform);
      } else {
          newPlatforms = newPlatforms.filter(p => p !== platform);
      }

      setSelectedPlatforms(newPlatforms);

      try {
          // We don't necessarily delete configs when disabling platform, 
          // but we could. For now, just update the platforms array.
          await updateVideoPlatforms(localVideo.id, newPlatforms);
          
          const updatedVideoAsset = { ...localVideo, platforms: newPlatforms };
          setLocalVideo(updatedVideoAsset);
          onUpdate(updatedVideoAsset);

      } catch (error) {
          console.error("Failed to toggle platform", error);
          setSelectedPlatforms(selectedPlatforms);
          alert("Erro ao atualizar plataforma. Tente novamente.");
      }
  };

  const handleApproveClick = () => {
    if (isAllReady) {
        setShowApproveModal(true);
    }
  };

  const confirmApprove = async () => {
    setIsProcessing(true);
    try {
      // Ensure latest configs are saved
      await updateVideoDistributionConfig(localVideo.id, distributionConfigs);
      await approveVideo(localVideo.id);
      
      const updated = { ...localVideo, status: 'approved' as const, distributionConfig: distributionConfigs };
      setLocalVideo(updated);
      onUpdate(updated);
      onClose();
    } catch (error) {
      console.error("Approval error:", error);
    } finally {
      setIsProcessing(false);
      setShowApproveModal(false);
    }
  };

  const handleDismiss = async () => {
      setIsProcessing(true);
      try {
          await dismissVideo(localVideo.id);
          const updated = { ...localVideo, status: 'dismissed' as const };
          setLocalVideo(updated);
          onUpdate(updated);
          onClose();
      } catch (error) { console.error(error); } 
      finally { setIsProcessing(false); }
  };

  const handleRestore = async () => {
      setIsProcessing(true);
      try {
          await unapproveVideo(localVideo.id); 
          const updated = { ...localVideo, status: 'pending' as const };
          setLocalVideo(updated);
          onUpdate(updated);
          onClose();
      } catch (error) { console.error(error); } 
      finally { setIsProcessing(false); }
  };
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-7xl h-[90vh] rounded-[5px] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-[#2D2E2F]">
        
        {/* Left: Video Preview (Reduced Width 3/12 - 25% | Full Width Content) */}
        <div className="w-full md:w-3/12 bg-black relative flex items-center justify-center border-r border-[#2D2E2F]">
           <video 
             src={localVideo.url} 
             controls 
             className="max-h-full max-w-full shadow-2xl rounded-sm"
             onLoadedMetadata={(e) => {
                 const el = e.currentTarget;
                 setVideoDimensions({ width: el.videoWidth, height: el.videoHeight });
                 setVideoDuration(el.duration);
             }}
           />
           <div className="absolute top-4 left-4">
              <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-[5px] uppercase">
                {localVideo.format}
              </span>
           </div>
        </div>

        {/* Right: Workflow (Expanded Width 9/12 - 75%) */}
        <div className="w-full md:w-9/12 flex flex-col bg-[#171918]">
           {/* Header */}
           <div className="p-5 border-b border-[#444746] flex justify-between items-center shrink-0">
              <div>
                  <h2 className="text-xl font-medium text-[#E3E3E3] line-clamp-1" title={localVideo.title}>
                    {localVideo.title}
                  </h2>
                  <p className="text-[#C4C7C5] text-xs mt-0.5">{clientName}</p>
              </div>
              <div className="flex gap-2">
                  {!isDismissed && (
                    <button 
                        onClick={handleDismiss} 
                        className="text-[#C4C7C5] hover:text-red-400 px-3 py-1.5 rounded-[5px] hover:bg-[#2D2E2F] text-sm flex items-center gap-2 transition-colors"
                    >
                        <Ban className="w-4 h-4" /> Descartar
                    </button>
                  )}
                  <button onClick={onClose} className="text-[#5E5E5E] hover:text-[#E3E3E3] p-1.5">
                      <X className="w-6 h-6" />
                  </button>
              </div>
           </div>

           {/* --- DISMISSED VIEW --- */}
           {isDismissed ? (
             <div className="flex-1 flex flex-col items-center justify-center p-10 text-center animate-fadeIn">
                <div className="w-20 h-20 bg-[#2D2E2F] rounded-full flex items-center justify-center mb-6 border border-[#444746]">
                    <Ban className="w-10 h-10 text-[#5E5E5E]" />
                </div>
                <h3 className="text-[#E3E3E3] text-2xl font-medium mb-3">Vídeo Descartado</h3>
                <p className="text-[#C4C7C5] mb-8 max-w-sm">
                    Este vídeo foi removido do fluxo de produção e não será distribuído.
                </p>
                <button 
                    onClick={handleRestore}
                    disabled={isProcessing}
                    className="bg-[#E3E3E3] text-black px-6 py-3 rounded-[5px] font-medium hover:bg-white flex items-center gap-2 transition-colors shadow-lg"
                >
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Undo2 className="w-5 h-5" />}
                    Restaurar Vídeo
                </button>
             </div>
           ) : (
             <>
               {/* Tabs */}
               <div className="flex border-b border-[#444746] px-5 shrink-0">
                  <TabButton active={activeTab === 'preview'} onClick={() => setActiveTab('preview')} label="Status" />
                  <TabButton active={activeTab === 'transcription'} onClick={() => setActiveTab('transcription')} label="Transcrição" disabled={!hasTranscription} />
                  <TabButton active={activeTab === 'content'} onClick={() => setActiveTab('content')} label="Conteúdo & Metadados" disabled={!hasTranscription} />
               </div>

               {/* Content Area */}
               <div className="flex-1 p-6 overflow-y-auto bg-[#101110] relative">
                  
                  {/* --- STATUS TAB --- */}
                  {activeTab === 'preview' && (
                      <div className="space-y-8 max-w-lg mx-auto py-4">
                          <div className="bg-[#171918] p-6 rounded-[5px] border border-[#2D2E2F]">
                              <h3 className="text-[#E3E3E3] font-medium mb-4 text-sm uppercase tracking-wider">Fluxo de Aprovação</h3>
                              <div className="space-y-5">
                                  <StepItem label="Upload Concluído" completed={true} />
                                  <StepItem label="Transcrição Gerada" completed={hasTranscription} active={!hasTranscription} />
                                  <StepItem label="Plataformas Selecionadas" completed={selectedPlatforms.length > 0} active={hasTranscription && selectedPlatforms.length === 0} />
                                  
                                  {/* Dynamic Steps based on selection */}
                                  {selectedPlatforms.includes('youtube') && (
                                      <StepItem label="Metadados YouTube" completed={isYouTubeReady && hasAccountForYoutube} active={hasTranscription && (!isYouTubeReady || !hasAccountForYoutube)} />
                                  )}
                                  {selectedPlatforms.includes('instagram') && (
                                      <StepItem label="Legenda Instagram" completed={isInstagramReady && hasAccountForInstagram} active={hasTranscription && (!isInstagramReady || !hasAccountForInstagram)} />
                                  )}
                                  {selectedPlatforms.includes('tiktok') && (
                                      <StepItem label="Legenda TikTok" completed={isTikTokReady && hasAccountForTikTok} active={hasTranscription && (!isTikTokReady || !hasAccountForTikTok)} />
                                  )}

                                  <StepItem label="Aprovação Final" completed={localVideo.status === 'approved'} active={isAllReady && localVideo.status !== 'approved'} />
                              </div>
                          </div>

                          <div className="flex justify-center">
                              {!hasTranscription ? (
                                  <button 
                                    onClick={handleTranscribe}
                                    disabled={isProcessing}
                                    className="bg-[#fe6a0f] text-white px-8 py-3 rounded-[5px] font-medium hover:bg-[#fe6a0f]/80 flex items-center gap-2 shadow-lg shadow-[#fe6a0f]/20 transition-all"
                                >
                                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin"/> : <FileText className="w-5 h-5"/>}
                                    Gerar Transcrição (IA)
                                </button>
                              ) : (
                                  <button 
                                      onClick={() => setActiveTab('content')}
                                      className="text-[#fe6a0f] border border-[#fe6a0f] px-6 py-2 rounded-[5px] font-medium hover:bg-[#fe6a0f]/10 flex items-center gap-2"
                                  >
                                      Continuar Edição
                                  </button>
                              )}
                          </div>
                      </div>
                  )}

                  {/* --- TRANSCRIPTION TAB --- */}
                  {activeTab === 'transcription' && (
                      <div className="flex flex-col h-full space-y-4">
                          <div className="flex-1 bg-[#171918] p-4 rounded-[5px] border border-[#2D2E2F] overflow-y-auto">
                              <p className="text-[#C4C7C5] whitespace-pre-wrap leading-relaxed text-sm">
                                  {localVideo.transcription}
                              </p>
                          </div>
                      </div>
                  )}

                  {/* --- CONTENT & METADATA TAB --- */}
                  {activeTab === 'content' && (
                      <div className="flex flex-col h-full">
                          {/* Platform Tabs (Selectors) */}
                          <div className="flex space-x-2 mb-4 overflow-x-auto pb-2 shrink-0">
                               <PlatformTab 
                                   active={subTab === 'youtube'} 
                                   enabled={selectedPlatforms.includes('youtube')}
                                   onClick={() => handlePlatformClick('youtube')}
                                   icon={<Youtube className="w-4 h-4" />} 
                                   label="YouTube" 
                                   color="text-red-500"
                                   ready={isYouTubeReady && hasAccountForYoutube}
                               />
                               <PlatformTab 
                                   active={subTab === 'instagram'} 
                                   enabled={selectedPlatforms.includes('instagram')}
                                   onClick={() => handlePlatformClick('instagram')}
                                   icon={<Instagram className="w-4 h-4" />} 
                                   label="Instagram" 
                                   color="text-pink-500"
                                   ready={isInstagramReady && hasAccountForInstagram}
                               />
                               <PlatformTab 
                                   active={subTab === 'tiktok'} 
                                   enabled={selectedPlatforms.includes('tiktok')}
                                   onClick={() => handlePlatformClick('tiktok')}
                                   icon={<Music className="w-4 h-4" />} 
                                   label="TikTok" 
                                   color="text-cyan-400"
                                   ready={isTikTokReady && hasAccountForTikTok}
                               />
                          </div>

                          <div className="flex-1 overflow-y-auto pr-1">
                              
                              {/* YOUTUBE FORM */}
                              {subTab === 'youtube' && (
                                  <div className="space-y-5 animate-in fade-in slide-in-from-right-4">
                                      {/* Platform Header / Toggle */}
                                      <div className="flex justify-between items-center bg-[#2D2E2F] p-3 rounded-[5px] border border-[#444746] mb-4">
                                          <div className="flex items-center gap-2">
                                              <Youtube className="w-5 h-5 text-red-500" />
                                              <span className="text-sm font-medium text-[#E3E3E3]">Integração YouTube</span>
                                          </div>
                                          <button 
                                              onClick={() => togglePlatformActive('youtube', !selectedPlatforms.includes('youtube'))}
                                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${selectedPlatforms.includes('youtube') ? 'bg-[#0BB07B]' : 'bg-[#444746]'}`}
                                          >
                                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedPlatforms.includes('youtube') ? 'translate-x-6' : 'translate-x-1'}`} />
                                          </button>
                                      </div>

                                      {selectedPlatforms.includes('youtube') ? (
                                        <>
                                          {/* --- TARGET CONFIGURATION (Checkboxes) --- */}
                                          <div className="bg-[#1E1F20] border border-[#2D2E2F] rounded-[5px] p-4 space-y-4">
                                              <div>
                                                  <label className="text-xs text-[#5E5E5E] uppercase font-bold mb-2 block">Canais de Publicação (Selecione)</label>
                                                  <div className="flex flex-col gap-2">
                                                      {integrations.filter(i => i.platform === 'youtube').length === 0 ? (
                                                          <p className="text-xs text-[#C4C7C5] italic">Nenhum canal do YouTube conectado.</p>
                                                      ) : (
                                                          integrations.filter(i => i.platform === 'youtube').map(acc => {
                                                              const isSelected = isAccountSelected('youtube', acc.id);
                                                              return (
                                                                  <button 
                                                                    key={acc.id}
                                                                    onClick={() => toggleAccountSelection('youtube', acc.id)}
                                                                    className={`flex items-center p-3 rounded-[5px] border transition-all text-left ${isSelected ? 'bg-red-500/10 border-red-500' : 'bg-[#101110] border-[#444746] hover:border-[#5E5E5E]'}`}
                                                                  >
                                                                      <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-red-500 border-red-500' : 'border-[#5E5E5E]'}`}>
                                                                          {isSelected && <Check className="w-3 h-3 text-white" />}
                                                                      </div>
                                                                      <span className={`text-sm ${isSelected ? 'text-[#E3E3E3] font-medium' : 'text-[#C4C7C5]'}`}>
                                                                          {acc.name}
                                                                      </span>
                                                                  </button>
                                                              );
                                                          })
                                                      )}
                                                  </div>
                                              </div>
                                              <div>
                                                  <label className="text-xs text-[#5E5E5E] uppercase font-bold mb-2 block">Tipo de Vídeo (Detectado Automaticamente)</label>
                                                  <div className="grid grid-cols-2 gap-3">
                                                      <TypeCard 
                                                          icon={<Smartphone className="w-4 h-4" />} 
                                                          label="Shorts" 
                                                          selected={platformSettings['youtube'].postType === 'shorts'}
                                                          onClick={() => updatePostTypeForPlatform('youtube', 'shorts')}
                                                          disabled={ytRuleType === 'video'}
                                                      />
                                                      <TypeCard 
                                                          icon={<Video className="w-4 h-4" />} 
                                                          label="Vídeo Longo" 
                                                          selected={platformSettings['youtube'].postType === 'video'}
                                                          onClick={() => updatePostTypeForPlatform('youtube', 'video')}
                                                          disabled={ytRuleType === 'shorts'}
                                                      />
                                                  </div>
                                              </div>
                                          </div>

                                          <div className="flex justify-between items-center mt-4">
                                              <h4 className="text-sm font-bold text-[#C4C7C5] uppercase tracking-wider">Metadados (Global)</h4>
                                              <div className="flex gap-2">
                                                  {(isYtDirty || true) && (
                                                      <button 
                                                        onClick={() => handleSavePlatformData('youtube')}
                                                        disabled={isProcessing}
                                                        className="text-[#0BB07B] text-xs hover:bg-[#0BB07B]/10 px-3 py-1.5 rounded-[5px] flex items-center gap-1 transition-colors border border-[#0BB07B]/30 font-medium"
                                                      >
                                                          {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                          Salvar
                                                      </button>
                                                  )}
                                                  <button 
                                                    onClick={handleGenerateYouTube}
                                                    disabled={isProcessing}
                                                    className="text-[#fe6a0f] text-xs hover:bg-[#fe6a0f]/10 px-3 py-1.5 rounded-[5px] flex items-center gap-1 transition-colors border border-[#fe6a0f]/30"
                                                  >
                                                      {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                                      Gerar com IA
                                                  </button>
                                              </div>
                                          </div>

                                          <div className="space-y-1">
                                              <label className="text-xs text-[#5E5E5E] uppercase font-bold">Título</label>
                                              <input 
                                                  type="text" 
                                                  value={ytData.title}
                                                  onChange={(e) => {
                                                      const val = e.target.value;
                                                      setYtData({...ytData, title: val});
                                                      syncMetadataToConfigs('youtube', { title: val });
                                                  }}
                                                  className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-3 py-2 text-sm focus:border-[#fe6a0f] outline-none"
                                                  placeholder="Título do vídeo..."
                                              />
                                          </div>

                                          <div className="space-y-1">
                                              <label className="text-xs text-[#5E5E5E] uppercase font-bold">Descrição</label>
                                              <textarea 
                                                  value={ytData.description}
                                                  onChange={(e) => {
                                                      const val = e.target.value;
                                                      setYtData({...ytData, description: val});
                                                      syncMetadataToConfigs('youtube', { caption: val });
                                                  }}
                                                  className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-3 py-2 text-sm focus:border-[#fe6a0f] outline-none h-32 resize-none"
                                                  placeholder="Descrição otimizada..."
                                              />
                                          </div>

                                          <div className="space-y-1">
                                              <label className="text-xs text-[#5E5E5E] uppercase font-bold">Tags (separadas por vírgula)</label>
                                              <input 
                                                  type="text" 
                                                  value={ytData.tags.join(', ')}
                                                  onChange={(e) => {
                                                      const val = e.target.value;
                                                      setYtData({...ytData, tags: val.split(',').map(t=>t.trim())});
                                                      syncMetadataToConfigs('youtube', { tags: val });
                                                  }}
                                                  className="w-full bg-[#171918] border border-[#444746] text-[#C4C7C5] rounded-[5px] px-3 py-2 text-xs focus:border-[#fe6a0f] outline-none"
                                                  placeholder="tag1, tag2, tag3"
                                              />
                                          </div>

                                          {/* --- LONG FORM FIELDS (Playlists & Category) --- */}
                                          {isYouTubeLongForm && (
                                              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#2D2E2F] mt-2">
                                                  <div className="space-y-1">
                                                      <label className="text-xs text-[#5E5E5E] uppercase font-bold flex items-center gap-1">
                                                          <ListVideo className="w-3 h-3" /> Playlist
                                                      </label>
                                                      <select
                                                          value={ytData.playlistId || ''}
                                                          onChange={(e) => {
                                                              const val = e.target.value;
                                                              setYtData({...ytData, playlistId: val});
                                                              syncMetadataToConfigs('youtube', { playlistId: val });
                                                          }}
                                                          disabled={isLoadingPlaylists}
                                                          className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-3 py-2 text-xs focus:border-[#fe6a0f] outline-none"
                                                      >
                                                          <option value="">Nenhuma playlist</option>
                                                          {/* Group playlists by Channel */}
                                                          {Array.from(new Set(availablePlaylists.map(p => p.channelTitle))).map(channelName => (
                                                              <optgroup key={channelName} label={channelName}>
                                                                  {availablePlaylists
                                                                    .filter(p => p.channelTitle === channelName)
                                                                    .map(p => (
                                                                        <option key={p.id} value={p.id}>{p.title}</option>
                                                                    ))
                                                                  }
                                                              </optgroup>
                                                          ))}
                                                      </select>
                                                      {isLoadingPlaylists && <span className="text-[10px] text-[#5E5E5E] animate-pulse">Carregando playlists...</span>}
                                                  </div>

                                                  <div className="space-y-1">
                                                      <label className="text-xs text-[#5E5E5E] uppercase font-bold flex items-center gap-1">
                                                          <List className="w-3 h-3" /> Categoria
                                                      </label>
                                                      <select
                                                          value={ytData.categoryId || '22'}
                                                          onChange={(e) => {
                                                              const val = e.target.value;
                                                              setYtData({...ytData, categoryId: val});
                                                              syncMetadataToConfigs('youtube', { categoryId: val });
                                                          }}
                                                          className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-3 py-2 text-xs focus:border-[#fe6a0f] outline-none"
                                                      >
                                                          {YOUTUBE_CATEGORIES.map(cat => (
                                                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                          ))}
                                                      </select>
                                                  </div>
                                              </div>
                                          )}
                                        </>
                                      ) : (
                                          <div className="text-center py-10 text-[#5E5E5E]">
                                              <Power className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                              <p>O YouTube está desativado para este vídeo.</p>
                                          </div>
                                      )}
                                  </div>
                              )}

                              {/* SOCIAL FORMS (Insta/TikTok) */}
                              {(subTab === 'instagram' || subTab === 'tiktok') && (
                                  <div className="space-y-4 animate-in fade-in slide-in-from-right-4 h-full flex flex-col">
                                      
                                      {/* Warnings for Instagram */}
                                      {subTab === 'instagram' && (
                                          <>
                                            {!isInstagramRatioValid() && (
                                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-[5px] flex items-start gap-3 mb-2">
                                                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                                    <div className="text-sm text-yellow-200">
                                                        <p className="font-bold">Formato Inválido</p>
                                                        <p className="opacity-80">
                                                            O Instagram Reels exige proporção vertical (9:16 ou 4:5).<br/>
                                                            Vídeos quadrados (1:1) não são permitidos.
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                            {!isInstagramDurationValid() && (
                                                <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-[5px] flex items-start gap-3 mb-2">
                                                    <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                                    <div className="text-sm text-yellow-200">
                                                        <p className="font-bold">Duração Excedida</p>
                                                        <p className="opacity-80">O Instagram permite vídeos entre 3 segundos e 60 minutos.</p>
                                                    </div>
                                                </div>
                                            )}
                                          </>
                                      )}

                                      {/* Platform Header / Toggle */}
                                      <div className="flex justify-between items-center bg-[#2D2E2F] p-3 rounded-[5px] border border-[#444746] mb-4 shrink-0">
                                          <div className="flex items-center gap-2">
                                              {subTab === 'instagram' ? <Instagram className="w-5 h-5 text-pink-500" /> : <Music className="w-5 h-5 text-cyan-400" />}
                                              <span className="text-sm font-medium text-[#E3E3E3]">
                                                  Integração {subTab === 'instagram' ? 'Instagram' : 'TikTok'}
                                              </span>
                                          </div>
                                          <button 
                                              onClick={() => {
                                                  if (subTab === 'instagram' && !isInstagramValid()) return;
                                                  togglePlatformActive(subTab, !selectedPlatforms.includes(subTab));
                                              }}
                                              disabled={subTab === 'instagram' && !isInstagramValid()}
                                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${(subTab === 'instagram' && !isInstagramValid()) ? 'bg-[#2D2E2F] cursor-not-allowed opacity-50' : (selectedPlatforms.includes(subTab) ? 'bg-[#0BB07B]' : 'bg-[#444746]')}`}
                                          >
                                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${selectedPlatforms.includes(subTab) ? 'translate-x-6' : 'translate-x-1'}`} />
                                          </button>
                                      </div>

                                      {selectedPlatforms.includes(subTab) ? (
                                        <>
                                            {/* --- TARGET CONFIGURATION (Checkboxes) --- */}
                                            <div className="bg-[#1E1F20] border border-[#2D2E2F] rounded-[5px] p-4 space-y-4">
                                              <div>
                                                  <label className="text-xs text-[#5E5E5E] uppercase font-bold mb-2 block">Contas (Selecione)</label>
                                                  <div className="flex flex-col gap-2">
                                                      {integrations.filter(i => i.platform === subTab).length === 0 ? (
                                                          <p className="text-xs text-[#C4C7C5] italic">Nenhuma conta conectada.</p>
                                                      ) : (
                                                          integrations.filter(i => i.platform === subTab).map(acc => {
                                                              const isSelected = isAccountSelected(subTab, acc.id);
                                                              const color = subTab === 'instagram' ? 'pink-500' : 'cyan-400';
                                                              
                                                              return (
                                                                  <button 
                                                                    key={acc.id}
                                                                    onClick={() => toggleAccountSelection(subTab, acc.id)}
                                                                    className={`flex items-center p-3 rounded-[5px] border transition-all text-left ${isSelected ? `bg-${color}/10 border-${color}` : 'bg-[#101110] border-[#444746] hover:border-[#5E5E5E]'}`}
                                                                  >
                                                                      <div className={`w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors ${isSelected ? `bg-${color} border-${color}` : 'border-[#5E5E5E]'}`}>
                                                                          {isSelected && <Check className="w-3 h-3 text-white" />}
                                                                      </div>
                                                                      <span className={`text-sm ${isSelected ? 'text-[#E3E3E3] font-medium' : 'text-[#C4C7C5]'}`}>
                                                                          {acc.name}
                                                                      </span>
                                                                  </button>
                                                              );
                                                          })
                                                      )}
                                                  </div>
                                              </div>
                                              
                                              {/* Post Type (Insta Only) */}
                                              {subTab === 'instagram' && (
                                                <div>
                                                    <label className="text-xs text-[#5E5E5E] uppercase font-bold mb-2 block">Tipo de Post</label>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        <TypeCard 
                                                            icon={<Film className="w-4 h-4" />} 
                                                            label="Reels" 
                                                            selected={platformSettings['instagram'].postType === 'reel'}
                                                            onClick={() => updatePostTypeForPlatform('instagram', 'reel')}
                                                        />
                                                        <TypeCard 
                                                            icon={<PlaySquare className="w-4 h-4" />} 
                                                            label="Story" 
                                                            selected={platformSettings['instagram'].postType === 'story'}
                                                            onClick={() => updatePostTypeForPlatform('instagram', 'story')}
                                                        />
                                                        <TypeCard 
                                                            icon={<ImageIcon className="w-4 h-4" />} 
                                                            label="Feed" 
                                                            selected={platformSettings['instagram'].postType === 'feed'}
                                                            onClick={() => updatePostTypeForPlatform('instagram', 'feed')}
                                                        />
                                                    </div>
                                                </div>
                                              )}
                                            </div>

                                            {/* Metadata Header */}
                                            <div className="flex justify-between items-center shrink-0 mt-4">
                                                <h4 className="text-sm font-bold text-[#C4C7C5] uppercase tracking-wider">Conteúdo (Global)</h4>
                                                <div className="flex gap-2">
                                                    {(true) && (
                                                        <button 
                                                            onClick={() => handleSavePlatformData(subTab)}
                                                            disabled={isProcessing}
                                                            className="text-[#0BB07B] text-xs hover:bg-[#0BB07B]/10 px-3 py-1.5 rounded-[5px] flex items-center gap-1 transition-colors border border-[#0BB07B]/30 font-medium"
                                                        >
                                                            {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                            Salvar
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => handleGenerateSocial(subTab)}
                                                        disabled={isProcessing}
                                                        className="text-[#fe6a0f] text-xs hover:bg-[#fe6a0f]/10 px-3 py-1.5 rounded-[5px] flex items-center gap-1 transition-colors border border-[#fe6a0f]/30"
                                                    >
                                                        {isProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                                        Gerar Legenda
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div className="flex-1 flex flex-col">
                                                <label className="text-xs text-[#5E5E5E] uppercase font-bold mb-2">Legenda (Caption)</label>
                                                <textarea 
                                                    value={subTab === 'instagram' ? igData.caption : ttData.caption}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (subTab === 'instagram') setIgData({...igData, caption: val});
                                                        else setTtData({...ttData, caption: val});
                                                        
                                                        syncMetadataToConfigs(subTab, { caption: val });
                                                    }}
                                                    className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 text-sm focus:border-[#fe6a0f] outline-none resize-none flex-1"
                                                    placeholder="Escreva sua legenda aqui..."
                                                />
                                            </div>
                                        </>
                                      ) : (
                                        <div className="text-center py-10 text-[#5E5E5E]">
                                            <Power className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                            <p>{subTab === 'instagram' ? 'Instagram' : 'TikTok'} está desativado para este vídeo.</p>
                                        </div>
                                      )}
                                  </div>
                              )}
                          </div>

                          {/* Approve Footer */}
                          <div className="pt-4 mt-2 border-t border-[#444746] flex justify-between items-center shrink-0">
                              <div className="text-xs text-[#5E5E5E]">
                                  {isAllReady ? (
                                      <span className="text-[#0BB07B] flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Pronto para Aprovação</span>
                                  ) : (
                                      <span>Preencha os dados e selecione ao menos uma conta por plataforma.</span>
                                  )}
                              </div>
                              <div className="flex gap-3">
                                    <button 
                                        onClick={handleApproveClick}
                                        disabled={!isAllReady || isProcessing}
                                        className="px-6 py-2.5 bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white rounded-[5px] text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#fe6a0f]/20 transition-all"
                                    >
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <ThumbsUp className="w-4 h-4" />}
                                        Aprovar Vídeo
                                    </button>
                              </div>
                          </div>
                      </div>
                  )}
               </div>
             </>
           )}
        </div>
      </div>

      <ApproveConfirmationModal 
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        onConfirm={confirmApprove}
        title={localVideo.title}
        isProcessing={isProcessing}
        platforms={selectedPlatforms}
      />
    </div>,
    document.body
  );
};

const TabButton: React.FC<{ active: boolean, onClick: () => void, label: string, disabled?: boolean }> = ({ active, onClick, label, disabled }) => (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`py-4 px-4 text-sm font-medium border-b-2 transition-colors ${
          active ? 'border-[#fe6a0f] text-[#fe6a0f]' : 
          disabled ? 'border-transparent text-[#444746] cursor-not-allowed' : 
          'border-transparent text-[#5E5E5E] hover:text-[#C4C7C5]'
      }`}
    >
        {label}
    </button>
);

const PlatformTab: React.FC<{ active: boolean, enabled: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string, ready: boolean }> = ({ active, enabled, onClick, icon, label, color, ready }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-3 py-2 rounded-[5px] text-sm transition-all border ${
            active 
            ? `bg-[#2D2E2F] border-[#5E5E5E] text-[#E3E3E3]` 
            : `bg-transparent border-transparent text-[#5E5E5E] hover:bg-[#1E1F20]`
        } ${!enabled ? 'opacity-50' : ''}`}
    >
        <span className={enabled ? color : ''}>{icon}</span>
        <span>{label}</span>
        {enabled && ready && <div className="w-1.5 h-1.5 rounded-full bg-[#0BB07B]" title="Pronto" />}
    </button>
);

const StepItem: React.FC<{ label: string, completed: boolean, active?: boolean }> = ({ label, completed, active }) => (
    <div className={`flex items-center gap-3 ${completed ? 'text-[#0BB07B]' : active ? 'text-[#fe6a0f]' : 'text-[#5E5E5E]'}`}>
        {completed ? (
            <CheckCircle2 className="w-5 h-5" />
        ) : (
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${active ? 'border-[#fe6a0f]' : 'border-[#444746]'}`}>
                {active && <div className="w-2 h-2 rounded-full bg-[#fe6a0f]" />}
            </div>
        )}
        <span className={`text-sm font-medium ${!completed && !active && 'text-[#5E5E5E]'}`}>{label}</span>
    </div>
);

const TypeCard: React.FC<{ icon: React.ReactNode, label: string, selected: boolean, onClick: () => void, disabled?: boolean }> = ({ icon, label, selected, onClick, disabled }) => (
    <button 
        onClick={onClick}
        disabled={disabled}
        className={`flex items-center justify-center gap-2 p-3 rounded-[5px] border transition-all ${
            disabled
            ? 'opacity-30 cursor-not-allowed bg-[#1E1F20] border-[#2D2E2F] text-[#5E5E5E]'
            : selected 
                ? 'bg-[#fe6a0f]/10 border-[#fe6a0f] text-[#fe6a0f]' 
                : 'bg-[#2D2E2F] border-[#444746] text-[#C4C7C5] hover:border-[#5E5E5E]'
        }`}
    >
        {icon}
        <span className="text-xs font-medium">{label}</span>
    </button>
);
