
import React, { useState, useEffect } from 'react';
import { Loader2, Megaphone, CheckCircle2, Clock, Youtube, Instagram, Music, Calendar, FolderOpen } from 'lucide-react';
import { VideoAsset, Project } from '../types';
import { subscribeToTrafficVideos } from '../services/videoService';
import { getProjects } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';
import { VideoPlayerModal } from './VideoPlayerModal';

export const TrafficView: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewVideo, setPreviewVideo] = useState<VideoAsset | null>(null);

  useEffect(() => {
    let unsubscribe: () => void;

    const loadData = async () => {
      if (!user) return;
      try {
        const projectsData = await getProjects(user.uid);
        setProjects(projectsData);

        unsubscribe = subscribeToTrafficVideos(user.uid, (videosData) => {
          setVideos(videosData);
          setIsLoading(false);
        });

      } catch (error) {
        console.error("Error loading traffic data", error);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const formatDateTime = (isoString: string) => {
      const date = new Date(isoString);
      return `${date.toLocaleDateString()} às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getProjectName = (video: VideoAsset) => {
      if (video.projectName) return video.projectName;
      if (video.projectId) {
          const p = projects.find(proj => proj.id === video.projectId);
          return p ? p.name : 'Projeto';
      }
      return 'Projeto';
  };

  const publishedVideos = videos.filter(v => v.status === 'published');
  const scheduledVideos = videos.filter(v => v.status === 'scheduled');

  if (isLoading) return (
    <div className="flex justify-center items-center h-full text-[#C4C7C5]">
      <Loader2 className="w-10 h-10 animate-spin text-[#fe6a0f]" strokeWidth={1} />
    </div>
  );

  const renderVideoList = (items: VideoAsset[], isPublished: boolean) => (
      <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
          {items.map((video) => {
              const clientName = video.clientName || '...';
              const projectName = getProjectName(video);
              
              return (
                  <div 
                      key={video.id} 
                      onClick={() => setPreviewVideo(video)}
                      className={`flex items-center justify-between p-4 border-b border-[#2D2E2F] last:border-0 hover:bg-[#1E1F20] transition-colors cursor-pointer group`}
                  >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="min-w-0">
                              <h3 className={`font-medium text-base truncate pr-4 ${isPublished ? 'text-[#E3E3E3] group-hover:text-[#fe6a0f]' : 'text-[#C4C7C5]'}`}>
                                  {video.title}
                              </h3>
                              <div className="flex items-center gap-3 mt-1 text-xs">
                                  <div className="flex items-center gap-1 text-[#C4C7C5] font-medium">
                                      <FolderOpen className="w-3 h-3 text-[#5E5E5E]" />
                                      {projectName}
                                  </div>
                                  <span className="text-[#5E5E5E]">•</span>
                                  <p className="text-[#5E5E5E] uppercase tracking-wider">{clientName}</p>
                                  
                                  <div className="flex items-center gap-1.5 border-l border-[#2D2E2F] pl-3">
                                      {video.platforms?.includes('youtube') && (
                                          <div className="w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center" title="YouTube">
                                              <Youtube className="w-3 h-3 text-red-500" />
                                          </div>
                                      )}
                                      {video.platforms?.includes('instagram') && (
                                          <div className="w-5 h-5 rounded-full bg-pink-500/10 flex items-center justify-center" title="Instagram">
                                              <Instagram className="w-3 h-3 text-pink-500" />
                                          </div>
                                      )}
                                      {video.platforms?.includes('tiktok') && (
                                          <div className="w-5 h-5 rounded-full bg-cyan-400/10 flex items-center justify-center" title="TikTok">
                                              <Music className="w-3 h-3 text-cyan-400" />
                                          </div>
                                      )}
                                  </div>

                                  {video.scheduledDate && (
                                      <div className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded ml-2 border border-blue-500/20">
                                          <Calendar className="w-3 h-3" />
                                          {formatDateTime(video.scheduledDate)}
                                      </div>
                                  )}
                              </div>
                          </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0">
                          {video.status === 'published' ? (
                              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-[#0BB07B]/10 text-[#0BB07B] border-[#0BB07B]/20 flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Postado
                              </span>
                          ) : (
                              <span className="px-3 py-1 rounded-full text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20 flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Agendado
                              </span>
                          )}
                      </div>
                  </div>
              );
          })}
      </div>
  );

  return (
    <div className="space-y-12 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3]">Tráfego Pago</h1>
          <p className="text-[#C4C7C5] text-base mt-2">Impulsione vídeos distribuídos nas plataformas de anúncios</p>
        </div>
        <div className="flex gap-2">
            <span className="bg-[#171918] px-4 py-2 rounded-[5px] text-sm text-[#C4C7C5] border border-[#444746] flex items-center gap-2">
                <Megaphone className="w-4 h-4 text-[#fe6a0f]" />
                {videos.length} no pipeline
            </span>
        </div>
      </div>

      {videos.length === 0 ? (
         <div className="text-center py-24 bg-[#171918] rounded-[5px]">
           <div className="bg-[#101110] w-20 h-20 rounded-full border border-[#444746] flex items-center justify-center mx-auto mb-6">
              <Megaphone className="w-10 h-10 text-[#C4C7C5]" strokeWidth={1} />
           </div>
           <h3 className="text-[#E3E3E3] font-medium mb-2 text-xl">Nenhum vídeo disponível</h3>
           <p className="text-[#C4C7C5] text-base">Distribua vídeos para que eles apareçam aqui.</p>
         </div>
      ) : (
        <div className="space-y-12">
            
            {/* PUBLISHED SECTION */}
            <section>
                <h3 className="text-[#E3E3E3] font-medium text-lg mb-4 flex items-center gap-2">
                   Disponíveis para Impulsionar
                   <span className="bg-[#0BB07B]/20 text-[#0BB07B] text-xs px-2 py-0.5 rounded-full">{publishedVideos.length}</span>
                </h3>
                {publishedVideos.length === 0 ? (
                    <div className="p-6 bg-[#171918] rounded-[5px] border border-[#2D2E2F] text-[#5E5E5E] text-sm italic">
                        Nenhum vídeo publicado ainda.
                    </div>
                ) : (
                    renderVideoList(publishedVideos, true)
                )}
            </section>

            {/* SCHEDULED SECTION */}
            <section>
                <h3 className="text-[#E3E3E3] font-medium text-lg mb-4 flex items-center gap-2">
                   Agendados (Aguardando Publicação)
                   <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-0.5 rounded-full">{scheduledVideos.length}</span>
                </h3>
                {scheduledVideos.length === 0 ? (
                     <div className="p-6 bg-[#171918] rounded-[5px] border border-[#2D2E2F] text-[#5E5E5E] text-sm italic">
                        Nenhum vídeo agendado.
                    </div>
                ) : (
                    renderVideoList(scheduledVideos, false)
                )}
            </section>
        </div>
      )}

      {/* Preview Modal */}
      <VideoPlayerModal 
        video={previewVideo}
        isOpen={!!previewVideo}
        onClose={() => setPreviewVideo(null)}
        showApproveButton={false}
      />
    </div>
  );
};
