
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Play } from 'lucide-react';
import { VideoAsset } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToAllScheduledVideos, cancelVideoScheduling } from '../services/videoService';
import { getIntegrations } from '../services/integrationService';
import { deleteVideoFromYouTube } from '../services/youtubeService';
import { VideoPlayerModal } from './VideoPlayerModal';
import { CancelScheduleModal } from './CancelScheduleModal';

export const CalendarView: React.FC = () => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewVideo, setPreviewVideo] = useState<VideoAsset | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToAllScheduledVideos(user.uid, (data) => {
        setVideos(data);
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Calendar Logic
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getVideosForDay = (day: number) => {
      const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const targetStr = targetDate.toDateString();
      
      const dayVideos = videos.filter(v => {
          if (!v.scheduledDate) return false;
          return new Date(v.scheduledDate).toDateString() === targetStr;
      });

      return dayVideos.sort((a, b) => {
          const timeA = new Date(a.scheduledDate!).getTime();
          const timeB = new Date(b.scheduledDate!).getTime();
          return timeA - timeB;
      });
  };

  const isToday = (day: number) => {
      const today = new Date();
      return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const formatTime = (isoString: string) => {
      const date = new Date(isoString);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleCancelClick = () => {
    if (previewVideo && previewVideo.status === 'scheduled') {
        setShowCancelModal(true);
    }
  };

  const onConfirmCancel = async () => {
    if (!previewVideo) return;
    
    setIsCancelling(true);
    try {
        // 1. Check for YouTube External ID and Delete if exists
        if (previewVideo.distributionConfig) {
            const ytConfig = previewVideo.distributionConfig.find(c => c.platform === 'youtube' && c.externalId);
            
            if (ytConfig) {
                console.log("Found YouTube external ID, deleting...");
                // Fetch integrations to get the token for the account used
                const integrations = await getIntegrations();
                const integ = integrations.find(i => i.id === ytConfig.accountId);
                
                if (integ && integ.config.accessToken) {
                    await deleteVideoFromYouTube(integ.config.accessToken, ytConfig.externalId!);
                    console.log("Deleted from YouTube.");
                } else {
                    console.warn("Integration not found or missing token, skipping YouTube deletion.");
                }
            }
        }

        // 2. Update Database (remove schedule)
        await cancelVideoScheduling(previewVideo.id);
        
        setPreviewVideo(null); 
    } catch (error) {
        console.error("Erro ao cancelar agendamento:", error);
        alert("Erro ao cancelar agendamento. Verifique o console.");
    } finally {
        setIsCancelling(false);
        setShowCancelModal(false);
    }
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-full text-[#C4C7C5]">
      <Loader2 className="w-10 h-10 animate-spin text-[#fe6a0f]" strokeWidth={1} />
    </div>
  );

  return (
    <div className="animate-fadeIn h-full flex flex-col pb-10">
      
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3]">Calendário</h1>
          <p className="text-[#C4C7C5] text-base mt-2">Visualize e gerencie seu cronograma de postagens.</p>
        </div>
        
        <div className="flex items-center bg-[#171918] p-1 rounded-[5px] border border-[#2D2E2F]">
            <button onClick={prevMonth} className="p-2 hover:bg-[#2D2E2F] rounded-[5px] text-[#C4C7C5] hover:text-white">
                <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="px-6 text-center min-w-[150px]">
                <span className="text-lg font-medium text-[#E3E3E3] block">
                    {currentDate.toLocaleDateString('pt-BR', { month: 'long' })}
                </span>
                <span className="text-xs text-[#5E5E5E] font-bold block uppercase">
                    {currentDate.getFullYear()}
                </span>
            </div>
            <button onClick={nextMonth} className="p-2 hover:bg-[#2D2E2F] rounded-[5px] text-[#C4C7C5] hover:text-white">
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
        
        <button 
            onClick={goToToday}
            className="px-4 py-2 bg-[#2D2E2F] hover:bg-[#3E3F40] text-[#E3E3E3] rounded-[5px] text-sm font-medium border border-[#444746]"
        >
            Hoje
        </button>
      </div>

      <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] flex-1 flex flex-col overflow-hidden shadow-2xl">
          <div className="grid grid-cols-7 border-b border-[#2D2E2F] bg-[#101110]">
              {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map(day => (
                  <div key={day} className="p-4 text-center text-xs font-bold text-[#5E5E5E] uppercase tracking-wider">
                      {day}
                  </div>
              ))}
          </div>

          <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-[#2D2E2F] gap-px">
                {Array.from({ length: firstDayOfMonth(currentDate) }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-[#171918]/50 min-h-[120px]" />
                ))}

                {Array.from({ length: daysInMonth(currentDate) }).map((_, i) => {
                    const day = i + 1;
                    const dayVideos = getVideosForDay(day);
                    const today = isToday(day);

                    return (
                        <div 
                            key={day} 
                            className={`bg-[#171918] p-2 min-h-[120px] relative group hover:bg-[#1E1F20] transition-colors flex flex-col gap-1 overflow-hidden ${today ? 'bg-[#1E1F20]' : ''}`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium ${today ? 'bg-[#fe6a0f] text-white shadow-lg shadow-[#fe6a0f]/20' : 'text-[#5E5E5E]'}`}>
                                    {day}
                                </span>
                                {dayVideos.length > 0 && (
                                    <span className="text-[10px] text-[#5E5E5E] font-medium">{dayVideos.length} posts</span>
                                )}
                            </div>

                            {dayVideos.length === 0 && (
                                <div className="flex-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-[#5E5E5E] border border-[#444746] rounded-full px-2 py-0.5">Livre</span>
                                </div>
                            )}

                            <div className="flex flex-col gap-1 overflow-y-auto custom-scrollbar max-h-[120px]">
                                {dayVideos.map(video => (
                                    <div 
                                        key={video.id}
                                        onClick={() => setPreviewVideo(video)}
                                        className="bg-[#2D2E2F] hover:bg-[#3E3F40] border border-[#444746] hover:border-[#5E5E5E] rounded-[4px] p-1.5 cursor-pointer group/chip shadow-sm transition-all flex items-center gap-2"
                                    >
                                        <div className="w-8 h-8 bg-black rounded shrink-0 overflow-hidden relative">
                                            {video.thumbnailUrl ? (
                                                <img src={video.thumbnailUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-[#101110] flex items-center justify-center">
                                                    <Play className="w-3 h-3 text-[#5E5E5E]" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-0.5">
                                                <span className="text-[10px] text-[#E3E3E3] truncate font-medium flex-1">{video.title}</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                 <div className="flex gap-0.5">
                                                    {video.platforms?.includes('youtube') && <div className="w-1.5 h-1.5 rounded-full bg-red-500" title="YouTube" />}
                                                    {video.platforms?.includes('instagram') && <div className="w-1.5 h-1.5 rounded-full bg-pink-500" title="Instagram" />}
                                                    {video.platforms?.includes('tiktok') && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" title="TikTok" />}
                                                </div>
                                                {video.scheduledDate && (
                                                    <span className="text-[9px] text-[#fe6a0f] font-mono font-medium">
                                                        {formatTime(video.scheduledDate)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
          </div>
      </div>

       <VideoPlayerModal 
        video={previewVideo}
        isOpen={!!previewVideo}
        onClose={() => setPreviewVideo(null)}
        showApproveButton={false}
        onCancelSchedule={previewVideo?.status === 'scheduled' ? handleCancelClick : undefined}
        isCancelling={isCancelling}
      />

      <CancelScheduleModal 
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={onConfirmCancel}
        isProcessing={isCancelling}
      />
    </div>
  );
};
