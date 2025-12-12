import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Instagram, Music, Youtube, Rocket, CheckCircle2, Lock, Calendar, Clock, ChevronLeft, ChevronRight, Loader2, Users, AlertCircle, Undo2 } from 'lucide-react';
import { VideoAsset, Platform, Integration, DistributionConfig } from '../types';
import { subscribeToAllScheduledVideos, unapproveVideo } from '../services/videoService';
import { getIntegrations } from '../services/integrationService';
import { useAuth } from '../contexts/AuthContext';
import { uploadVideoToYouTube, addVideoToPlaylist } from '../services/youtubeService';

interface DistributionModalProps {
  video: VideoAsset;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
  onDistribute: (videoId: string, config: DistributionConfig[], scheduledDate?: string) => void;
}

export const DistributionModal: React.FC<DistributionModalProps> = ({ video, clientName, isOpen, onClose, onDistribute }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Platform>('youtube');
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);

  // Configuration Map (Platform -> Config Array)
  const [configs, setConfigs] = useState<Record<Platform, DistributionConfig[]>>({} as any);

  const [isSending, setIsSending] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [isUnapproving, setIsUnapproving] = useState(false);
  
  // Scheduling State
  const [isScheduling, setIsScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState<string>("09:00");
  
  // Mini Calendar State
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [scheduledEvents, setScheduledEvents] = useState<VideoAsset[]>([]);

  useEffect(() => {
    if (isOpen) {
       loadIntegrations();
       setIsSending(false);
       setLoadingMessage('');
       setIsScheduling(false);
       setSelectedDate(new Date());
       
       // Set default time to next hour
       const now = new Date();
       const nextHour = new Date(now.setHours(now.getHours() + 1, 0, 0, 0));
       const hours = String(nextHour.getHours()).padStart(2, '0');
       const mins = String(nextHour.getMinutes()).padStart(2, '0');
       setSelectedTime(`${hours}:${mins}`);
       
       // Subscribe to other videos to show dots on calendar
       if (user) {
           const unsubscribe = subscribeToAllScheduledVideos(user.uid, (videos) => {
               setScheduledEvents(videos.filter(v => v.id !== video.id));
           });
           return () => unsubscribe();
       }
    }
  }, [isOpen, video, user]);

  const loadIntegrations = async () => {
    setIsLoadingIntegrations(true);
    try {
        const data = await getIntegrations();
        setIntegrations(data);
        
        // Initialize configs primarily from SAVED video distribution config
        const initialConfigs: Record<string, DistributionConfig[]> = {};

        if (video.distributionConfig && video.distributionConfig.length > 0) {
             video.distributionConfig.forEach(c => {
                 if (!initialConfigs[c.platform]) initialConfigs[c.platform] = [];
                 initialConfigs[c.platform].push(c);
             });
             
             // Set active tab to first available config
             if (video.distributionConfig.length > 0) {
                 setActiveTab(video.distributionConfig[0].platform);
             }
        }

        setConfigs(initialConfigs as any);

    } catch (e) {
        console.error("Failed to load integrations", e);
    } finally {
        setIsLoadingIntegrations(false);
    }
  };

  if (!isOpen) return null;

  const handleReturnToEdit = async () => {
    if (!window.confirm("Deseja retornar o vídeo para edição? Ele sairá da fila de distribuição.")) return;
    setIsUnapproving(true);
    try {
        await unapproveVideo(video.id);
        onClose();
    } catch (error) {
        console.error("Error unapproving:", error);
        setIsUnapproving(false);
    }
  };

  const handleConfirm = async () => {
    // Flatten configs back to array
    const activeConfigs = Object.values(configs).flat() as DistributionConfig[];
    if (activeConfigs.length === 0) return;

    setIsSending(true);
    setLoadingMessage('Iniciando distribuição...');
    
    // Prepare Schedule Date
    let finalDate: string | undefined = undefined;
    if (isScheduling) {
        const combinedDate = new Date(selectedDate);
        const [hours, minutes] = selectedTime.split(':').map(Number);
        combinedDate.setHours(hours, minutes, 0, 0);
        finalDate = combinedDate.toISOString();
    }

    try {
        // --- REAL YOUTUBE UPLOAD LOGIC ---
        const ytConfigs = activeConfigs.filter(c => c.platform === 'youtube');
        
        if (ytConfigs.length > 0) {
            for (const config of ytConfigs) {
                // Find integration credentials
                const integration = integrations.find(i => i.id === config.accountId);
                if (!integration || !integration.config.accessToken) {
                    console.warn(`Skipping YouTube upload for ${config.accountId}: No token found.`);
                    continue;
                }

                setLoadingMessage(`Enviando para YouTube: ${integration.name}...`);
                
                try {
                    // Prepare YT Metadata structure
                    const metadata = {
                        title: config.metadata.title || video.title,
                        description: config.metadata.caption || '', 
                        tags: config.metadata.tags ? config.metadata.tags.split(',').map(t => t.trim()) : [],
                        categoryId: config.metadata.categoryId || '22',
                        privacyStatus: 'public' as const
                    };

                    // Envia o STORAGE PATH para o backend processar (server-side upload)
                    const response = await uploadVideoToYouTube(
                        integration.config.accessToken,
                        video.storagePath, // Path no Firebase Storage
                        metadata,
                        finalDate
                    );
                    
                    // SAVE EXTERNAL ID to allow cancellation/deletion later
                    config.externalId = response.id;
                    
                    // --- Add to Playlist if configured ---
                    if (config.metadata.playlistId) {
                        setLoadingMessage(`Adicionando à playlist...`);
                        try {
                            await addVideoToPlaylist(integration.config.accessToken, config.metadata.playlistId, response.id);
                            console.log(`Added to playlist ${config.metadata.playlistId}`);
                        } catch (plError) {
                            console.error("Failed to add to playlist (continuing anyway):", plError);
                        }
                    }
                    
                    console.log(`Uploaded to ${integration.name} successfully (ID: ${response.id})`);

                } catch (uploadError: any) {
                    console.error("YouTube Upload Error:", uploadError);
                    alert(`Erro ao enviar para YouTube (${integration.name}): ${uploadError.message}`);
                    setIsSending(false);
                    return; // Stop process on error
                }
            }
        }

        // --- FINALIZE ---
        setLoadingMessage('Finalizando...');
        onDistribute(video.id, activeConfigs, finalDate);
        onClose();

    } catch (globalError: any) {
        console.error("Distribution Flow Error:", globalError);
        alert("Erro no processo de distribuição: " + globalError.message);
        setIsSending(false);
    }
  };

  // --- CALENDAR LOGIC ---
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

  const handleDayClick = (day: number) => {
    const newDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
    const today = new Date();
    today.setHours(0,0,0,0);
    if (newDate < today) return;
    setSelectedDate(newDate);
  };
  const nextMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  const prevMonth = () => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  const getDotsForDay = (day: number) => {
      const currentDayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
      const dayString = currentDayDate.toDateString();
      const events = scheduledEvents.filter(v => {
          if (!v.scheduledDate) return false;
          return new Date(v.scheduledDate).toDateString() === dayString;
      });
      const platforms = new Set<Platform>();
      events.forEach(e => e.platforms?.forEach(p => platforms.add(p)));
      return Array.from(platforms);
  };

  const currentPlatformConfigs = configs[activeTab] || [];
  const masterConfig = currentPlatformConfigs.length > 0 ? currentPlatformConfigs[0] : null;
  const isPlatformSelected = currentPlatformConfigs.length > 0;

  const getAccountName = (id: string) => {
      return integrations.find(i => i.id === id)?.name || "Conta Desconhecida";
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-7xl h-[90vh] rounded-[5px] shadow-2xl overflow-hidden flex flex-col md:flex-row border border-[#2D2E2F]">
        
        {/* Left: Video Preview */}
        <div className="w-full md:w-3/12 bg-black relative flex items-center justify-center border-r border-[#2D2E2F]">
           <video 
             src={video.url} 
             controls 
             className="max-h-full max-w-full shadow-2xl rounded-sm"
           />
           <div className="absolute top-4 left-4">
              <span className="bg-black/60 backdrop-blur-md text-white text-xs px-2 py-1 rounded-[5px] uppercase">
                {video.format}
              </span>
           </div>
        </div>

        {/* Right: Content & Configuration */}
        <div className="w-full md:w-9/12 flex flex-col bg-[#171918]">
            
            {/* Header */}
            <div className="p-5 border-b border-[#444746] flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-xl font-medium text-[#E3E3E3] flex items-center gap-2">
                        Confirmar Distribuição
                    </h2>
                    <div className="text-[#C4C7C5] text-xs mt-1 flex items-center gap-2">
                        <span className="text-[#fe6a0f]">{clientName}</span>
                        <span>•</span>
                        <span className="truncate max-w-[200px]">{video.title}</span>
                    </div>
                </div>
                <button onClick={onClose} disabled={isSending} className="text-[#5E5E5E] hover:text-[#E3E3E3] p-1.5 disabled:opacity-50">
                    <X className="w-6 h-6" />
                </button>
            </div>

            {/* Platform Tabs */}
            <div className="flex border-b border-[#444746] px-5 shrink-0 bg-[#101110]">
               <PlatformTab 
                   active={activeTab === 'youtube'} 
                   onClick={() => setActiveTab('youtube')}
                   icon={<Youtube className="w-4 h-4" />} 
                   label="YouTube" 
                   color="text-red-500"
                   selected={!!configs['youtube'] && configs['youtube'].length > 0}
               />
               <PlatformTab 
                   active={activeTab === 'instagram'} 
                   onClick={() => setActiveTab('instagram')}
                   icon={<Instagram className="w-4 h-4" />} 
                   label="Instagram" 
                   color="text-pink-500"
                   selected={!!configs['instagram'] && configs['instagram'].length > 0}
               />
               <PlatformTab 
                   active={activeTab === 'tiktok'} 
                   onClick={() => setActiveTab('tiktok')}
                   icon={<Music className="w-4 h-4" />} 
                   label="TikTok" 
                   color="text-cyan-400"
                   selected={!!configs['tiktok'] && configs['tiktok'].length > 0}
               />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto bg-[#171918] flex flex-col p-6">
                
                {isLoadingIntegrations ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 text-[#fe6a0f] animate-spin" />
                    </div>
                ) : (
                    <>
                        {/* 1. Account Selection & Activation - READ ONLY */}
                        <div className="mb-6 flex items-start justify-between bg-[#2D2E2F] p-4 rounded-[5px] border border-[#444746]">
                            <div className="flex items-start gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0 ${isPlatformSelected ? 'bg-[#0BB07B]' : 'bg-[#101110]'}`}>
                                    {isPlatformSelected ? <CheckCircle2 className="w-6 h-6 text-white" /> : <Lock className="w-5 h-5 text-[#5E5E5E]" />}
                                </div>
                                <div>
                                    <h3 className="text-[#E3E3E3] font-medium">
                                        {isPlatformSelected ? 'Destinos Configurados' : 'Nenhum destino'}
                                    </h3>
                                    <p className="text-xs text-[#C4C7C5] mt-1">
                                        {isPlatformSelected 
                                            ? `Este vídeo será enviado para ${currentPlatformConfigs.length} conta(s).` 
                                            : 'Este vídeo não será enviado para esta plataforma.'}
                                    </p>
                                </div>
                            </div>
                            
                            {isPlatformSelected && (
                                <div className="flex flex-col gap-1 items-end">
                                    {currentPlatformConfigs.map(c => (
                                        <div key={c.accountId} className="bg-[#101110] px-3 py-1.5 rounded-[5px] border border-[#444746] text-[#E3E3E3] text-xs font-medium flex items-center gap-2">
                                            <Users className="w-3 h-3 text-[#5E5E5E]" />
                                            {getAccountName(c.accountId)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. Configuration View (Read Only) */}
                        {isPlatformSelected && masterConfig && (
                            <div className="space-y-6 animate-fadeIn">
                                
                                {/* Post Type Display */}
                                <div>
                                    <label className="text-xs font-bold text-[#5E5E5E] uppercase tracking-wider mb-3 block">Tipo de Postagem</label>
                                    <div className="flex gap-3">
                                        <div className="flex flex-col items-center justify-center p-3 rounded-[5px] border bg-[#fe6a0f]/10 border-[#fe6a0f] text-[#fe6a0f] w-32">
                                             <span className="text-sm font-medium capitalize">{masterConfig.postType}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Common Metadata - READ ONLY */}
                                <div className="space-y-4">
                                     {/* Title (YouTube Only) */}
                                     {activeTab === 'youtube' && (
                                         <div>
                                            <label className="text-xs font-bold text-[#5E5E5E] uppercase tracking-wider mb-1 block">Título</label>
                                            <div className="w-full bg-[#101110] border border-[#444746] text-[#C4C7C5] rounded-[5px] px-3 py-2 text-sm">
                                                {masterConfig.metadata.title}
                                            </div>
                                         </div>
                                     )}

                                     {/* Caption/Description */}
                                     <div>
                                        <label className="text-xs font-bold text-[#5E5E5E] uppercase tracking-wider mb-1 block">
                                            {activeTab === 'youtube' ? 'Descrição' : 'Legenda'}
                                        </label>
                                        <div className="w-full bg-[#101110] border border-[#444746] text-[#C4C7C5] rounded-[5px] px-3 py-2 text-sm h-24 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                                            {masterConfig.metadata.caption}
                                        </div>
                                     </div>

                                     {/* Additional Metadata Fields */}
                                     {activeTab === 'youtube' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {masterConfig.metadata.tags && (
                                                <div className="col-span-2">
                                                    <label className="text-xs font-bold text-[#5E5E5E] uppercase tracking-wider mb-1 block">Tags</label>
                                                    <div className="w-full bg-[#101110] border border-[#444746] text-[#C4C7C5] rounded-[5px] px-3 py-2 text-sm break-words">
                                                        {masterConfig.metadata.tags}
                                                    </div>
                                                </div>
                                            )}
                                            {/* Playlist & Category Read-Only */}
                                            {masterConfig.metadata.playlistId && (
                                                <div>
                                                    <label className="text-xs font-bold text-[#5E5E5E] uppercase tracking-wider mb-1 block">Playlist (ID)</label>
                                                    <div className="w-full bg-[#101110] border border-[#444746] text-[#C4C7C5] rounded-[5px] px-3 py-2 text-sm truncate">
                                                        {masterConfig.metadata.playlistId}
                                                    </div>
                                                </div>
                                            )}
                                            {masterConfig.metadata.categoryId && (
                                                <div>
                                                    <label className="text-xs font-bold text-[#5E5E5E] uppercase tracking-wider mb-1 block">Categoria (ID)</label>
                                                    <div className="w-full bg-[#101110] border border-[#444746] text-[#C4C7C5] rounded-[5px] px-3 py-2 text-sm">
                                                        {masterConfig.metadata.categoryId}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                     )}
                                </div>
                            </div>
                        )}
                        
                        {!isPlatformSelected && (
                            <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-[#2D2E2F] rounded-[5px]">
                                <AlertCircle className="w-8 h-8 text-[#5E5E5E] mb-2" />
                                <p className="text-[#5E5E5E] text-sm">Nenhuma configuração encontrada para {activeTab}.</p>
                            </div>
                        )}
                    </>
                )}

                {/* --- SCHEDULING SECTION --- */}
                <div className="mt-auto border-t border-[#444746] pt-6 mt-8">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[#E3E3E3] font-medium flex items-center gap-2">
                            <Clock className="w-5 h-5 text-[#fe6a0f]" />
                            Quando Postar?
                        </h3>
                        <div className="flex bg-[#101110] p-1 rounded-[5px] border border-[#444746]">
                            <button 
                                onClick={() => setIsScheduling(false)}
                                disabled={isSending}
                                className={`px-4 py-1.5 rounded-[4px] text-xs font-medium transition-all ${!isScheduling ? 'bg-[#2D2E2F] text-white shadow' : 'text-[#5E5E5E] hover:text-[#C4C7C5]'}`}
                            >
                                Agora
                            </button>
                            <button 
                                onClick={() => setIsScheduling(true)}
                                disabled={isSending}
                                className={`px-4 py-1.5 rounded-[4px] text-xs font-medium transition-all ${isScheduling ? 'bg-[#fe6a0f] text-white shadow' : 'text-[#5E5E5E] hover:text-[#C4C7C5]'}`}
                            >
                                Agendar
                            </button>
                        </div>
                    </div>

                    {isScheduling && (
                        <div className="flex flex-col gap-4 animate-fadeIn">
                             {/* Date & Time Inputs */}
                             <div className="flex gap-4 mb-2">
                                <div className="flex-1 bg-[#101110] border border-[#444746] rounded-[5px] p-2 text-center text-[#E3E3E3] text-sm">
                                    <span className="block text-[10px] text-[#5E5E5E] uppercase mb-1">Data</span>
                                    {selectedDate.toLocaleDateString()}
                                </div>
                                <div className="flex-1">
                                     <div className="bg-[#101110] border border-[#444746] rounded-[5px] p-2 flex items-center justify-center">
                                         <input 
                                            type="time" 
                                            value={selectedTime}
                                            onChange={(e) => setSelectedTime(e.target.value)}
                                            disabled={isSending}
                                            className="bg-transparent text-[#E3E3E3] text-sm focus:outline-none text-center w-full"
                                         />
                                     </div>
                                </div>
                             </div>

                             {/* Mini Calendar */}
                             <div className="bg-[#101110] rounded-[5px] border border-[#444746] p-4">
                                 <div className="flex justify-between items-center mb-4">
                                     <button onClick={prevMonth} className="p-1 hover:bg-[#2D2E2F] rounded text-[#C4C7C5]"><ChevronLeft className="w-4 h-4"/></button>
                                     <span className="text-[#E3E3E3] font-medium text-sm">
                                         {calendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                     </span>
                                     <button onClick={nextMonth} className="p-1 hover:bg-[#2D2E2F] rounded text-[#C4C7C5]"><ChevronRight className="w-4 h-4"/></button>
                                 </div>
                                 
                                 <div className="grid grid-cols-7 gap-1 text-center mb-2">
                                     {['D','S','T','Q','Q','S','S'].map(d => (
                                         <span key={d} className="text-[10px] text-[#5E5E5E] font-bold">{d}</span>
                                     ))}
                                 </div>

                                 <div className="grid grid-cols-7 gap-1">
                                     {Array.from({ length: firstDayOfMonth(calendarMonth) }).map((_, i) => (
                                         <div key={`empty-${i}`} />
                                     ))}
                                     {Array.from({ length: daysInMonth(calendarMonth) }).map((_, i) => {
                                         const day = i + 1;
                                         const date = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day);
                                         const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === calendarMonth.getMonth() && selectedDate.getFullYear() === calendarMonth.getFullYear();
                                         const isToday = new Date().getDate() === day && new Date().getMonth() === calendarMonth.getMonth();
                                         const isPast = date < new Date() && !isToday;
                                         
                                         const dots = getDotsForDay(day);

                                         return (
                                             <button 
                                                 key={day}
                                                 disabled={isPast || isSending}
                                                 onClick={() => handleDayClick(day)}
                                                 className={`
                                                     h-9 rounded-[4px] text-xs relative flex flex-col items-center justify-center transition-all
                                                     ${isSelected ? 'bg-[#fe6a0f] text-white' : 'text-[#C4C7C5] hover:bg-[#2D2E2F]'}
                                                     ${isPast ? 'opacity-30 cursor-not-allowed' : ''}
                                                     ${isToday && !isSelected ? 'border border-[#fe6a0f] text-[#fe6a0f]' : ''}
                                                 `}
                                             >
                                                 {day}
                                                 <div className="flex gap-0.5 mt-0.5">
                                                     {dots.map(p => (
                                                         <div 
                                                            key={p} 
                                                            className={`w-1 h-1 rounded-full ${
                                                                p === 'youtube' ? 'bg-red-500' : 
                                                                p === 'instagram' ? 'bg-pink-500' : 
                                                                'bg-cyan-400'
                                                            } ${isSelected ? 'bg-white' : ''}`} 
                                                         />
                                                     ))}
                                                 </div>
                                             </button>
                                         );
                                     })}
                                 </div>
                             </div>
                        </div>
                    )}
                </div>

            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#444746] bg-[#171918] flex justify-between items-center shrink-0">
                <button 
                    onClick={handleReturnToEdit}
                    disabled={isUnapproving || isSending}
                    className="px-4 py-2.5 rounded-[5px] text-[#C4C7C5] hover:text-white hover:bg-[#2D2E2F] transition-colors font-medium text-sm flex items-center gap-2"
                >
                    {isUnapproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
                    Devolver para Edição
                </button>

                <div className="flex gap-3 items-center">
                    {isSending && (
                        <span className="text-xs text-[#C4C7C5] animate-pulse">{loadingMessage}</span>
                    )}
                    <button 
                        onClick={onClose}
                        disabled={isSending || isUnapproving}
                        className="px-5 py-2.5 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-sm disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleConfirm}
                        disabled={Object.keys(configs).length === 0 || isSending || isUnapproving}
                        className="px-6 py-2.5 bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white rounded-[5px] text-sm font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#fe6a0f]/20 transition-all"
                    >
                        {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isScheduling ? <Calendar className="w-4 h-4" /> : <Rocket className="w-4 h-4" />)}
                        {isScheduling ? 'Confirmar Agendamento' : 'Distribuir Agora'}
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>,
    document.body
  );
};

const PlatformTab: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string, color: string, selected: boolean }> = ({ active, onClick, icon, label, color, selected }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 text-sm transition-all border-b-2 ${
            active 
            ? `border-[#fe6a0f] text-[#E3E3E3] bg-[#1E1F20]` 
            : `border-transparent text-[#5E5E5E] hover:text-[#C4C7C5] hover:bg-[#1E1F20]`
        }`}
    >
        <span className={active || selected ? color : ''}>{icon}</span>
        <span className="font-medium">{label}</span>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-[#0BB07B]" title="Aprovado" />}
    </button>
);