
import React, { useState, useEffect } from 'react';
import { Share2, Loader2, CheckCircle2, Undo2, Youtube, Instagram, Music, FolderOpen } from 'lucide-react';
import { VideoAsset, DistributionConfig, Project } from '../types';
import { markVideoAsProcessing, subscribeToDistributionVideos, unapproveVideo } from '../services/videoService';
import { getProjects } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';
import { DistributionModal } from './DistributionModal';
import { VideoPlayerModal } from './VideoPlayerModal';
import { UnapproveConfirmationModal } from './UnapproveConfirmationModal';

export const DistributionView: React.FC = () => {
  const { user } = useAuth();
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]); // To resolve project names for old videos
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoAsset | null>(null);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Unapprove Modal State
  const [unapproveTarget, setUnapproveTarget] = useState<VideoAsset | null>(null);
  const [isUnapproving, setIsUnapproving] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;

    const loadData = async () => {
      if (!user) return;
      try {
        // Fetch projects for lookup
        const projectsData = await getProjects(user.uid);
        setProjects(projectsData);

        // Subscribe to videos in real-time
        unsubscribe = subscribeToDistributionVideos(user.uid, (videosData) => {
          setVideos(videosData);
          setIsLoading(false);
        });

      } catch (error) {
        console.error("Error loading distribution data", error);
        setIsLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user]);

  const openDistributionModal = (video: VideoAsset) => {
    setSelectedVideo(video);
    setIsModalOpen(true);
  };

  const handleDistribute = async (videoId: string, config: DistributionConfig[], scheduledDate?: string) => {
    // Optimistic UI Update: Add to processing to show spinner or prevent clicks
    setProcessingIds(prev => new Set(prev).add(videoId));
    
    try {
        // This will move the video status to 'scheduled' or 'published', removing it from this view
        await markVideoAsProcessing(videoId, config, scheduledDate); 
        console.log(`Video ${videoId} distributed/scheduled.`);
    } catch (error) {
        console.error("Error distributing video", error);
        setProcessingIds(prev => {
            const next = new Set(prev);
            next.delete(videoId);
            return next;
        });
    }
  };

  const handleUnapproveClick = (e: React.MouseEvent, video: VideoAsset) => {
    e.stopPropagation();
    setUnapproveTarget(video);
  };

  const confirmUnapprove = async () => {
    if (!unapproveTarget) return;

    setIsUnapproving(true);
    const videoId = unapproveTarget.id;
    
    // Add to processing set to prevent interaction
    setProcessingIds(prev => new Set(prev).add(videoId));

    try {
        await unapproveVideo(videoId);
        // Optimistic Update: Immediately remove from UI if not handled by snapshot
        setVideos(currentVideos => currentVideos.filter(v => v.id !== videoId));
    } catch (error) {
        console.error("Error unapproving video", error);
        // Remove from processing set if error
        setProcessingIds(prev => {
            const next = new Set(prev);
            next.delete(videoId);
            return next;
        });
    } finally {
        setIsUnapproving(false);
        setUnapproveTarget(null);
    }
  };

  // Helper to find project name
  const getProjectName = (video: VideoAsset) => {
      if (video.projectName) return video.projectName;
      if (video.projectId) {
          const p = projects.find(proj => proj.id === video.projectId);
          return p ? p.name : 'Projeto';
      }
      return 'Projeto';
  };

  if (isLoading) return (
    <div className="flex justify-center items-center h-full text-[#C4C7C5]">
      <Loader2 className="w-10 h-10 animate-spin text-[#fe6a0f]" strokeWidth={1} />
    </div>
  );

  return (
    <div className="space-y-8 animate-fadeIn pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3]">Distribuição</h1>
          <p className="text-[#C4C7C5] text-base mt-2">Gerencie e publique vídeos aprovados</p>
        </div>
        <div className="flex gap-2">
            <span className="bg-[#171918] px-4 py-2 rounded-[5px] text-sm text-[#C4C7C5] border border-[#444746] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0BB07B]" />
                {videos.length} vídeos para distribuir
            </span>
        </div>
      </div>

      {videos.length === 0 ? (
         <div className="text-center py-24 bg-[#171918] rounded-[5px] border border-[#2D2E2F]">
           <div className="bg-[#101110] w-20 h-20 rounded-full border border-[#444746] flex items-center justify-center mx-auto mb-6">
              <Share2 className="w-10 h-10 text-[#C4C7C5]" strokeWidth={1} />
           </div>
           <h3 className="text-[#E3E3E3] font-medium mb-2 text-xl">Nada para distribuir</h3>
           <p className="text-[#C4C7C5] text-base">Aprove vídeos na aba de Entregas para que apareçam aqui.</p>
         </div>
      ) : (
        <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
            {videos.map((video) => {
                // Use denormalized client name from video, or fallback text
                const clientName = video.clientName || 'Cliente';
                const projectName = getProjectName(video);
                
                return (
                    <div 
                        key={video.id} 
                        onClick={() => openDistributionModal(video)}
                        className={`flex items-center justify-between p-4 border-b border-[#2D2E2F] last:border-0 hover:bg-[#1E1F20] transition-colors cursor-pointer group ${
                            processingIds.has(video.id) ? 'opacity-50 pointer-events-none' : ''
                        }`}
                    >
                        {/* Left: Info */}
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="min-w-0">
                                <h3 className="font-medium text-[#E3E3E3] text-base group-hover:text-[#fe6a0f] transition-colors truncate pr-4">
                                    {video.title}
                                </h3>
                                <div className="flex items-center gap-3 mt-1 text-xs">
                                    <div className="flex items-center gap-1 text-[#C4C7C5] font-medium">
                                        <FolderOpen className="w-3 h-3 text-[#5E5E5E]" />
                                        {projectName}
                                    </div>
                                    <span className="text-[#5E5E5E]">•</span>
                                    <p className="text-[#5E5E5E] uppercase tracking-wider">{clientName}</p>
                                    
                                    {/* Platform Icons */}
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
                                </div>
                            </div>
                        </div>

                        {/* Right: Actions & Status */}
                        <div className="flex items-center gap-6 shrink-0">
                            
                            {/* Status Badge */}
                            <span className="px-3 py-1 rounded-full text-xs font-medium border bg-[#fe6a0f]/10 text-[#fe6a0f] border-[#fe6a0f]/20 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" /> Aprovado
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-2 justify-end">
                                <button 
                                    onClick={(e) => handleUnapproveClick(e, video)}
                                    disabled={processingIds.has(video.id)}
                                    className="p-2 text-[#5E5E5E] hover:text-red-400 hover:bg-red-500/10 rounded-[5px] transition-colors disabled:opacity-50"
                                    title="Desfazer Aprovação"
                                >
                                    {processingIds.has(video.id) ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Undo2 className="w-4 h-4" strokeWidth={1.5} />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
      )}

      {selectedVideo && (
        <DistributionModal 
          video={selectedVideo} 
          clientName={selectedVideo.clientName || 'Cliente'}
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          onDistribute={handleDistribute}
        />
      )}

      {/* Preview Modal for published videos (not used in this view anymore but kept for component safety) */}
      <VideoPlayerModal 
        video={previewVideo}
        isOpen={!!previewVideo}
        onClose={() => setPreviewVideo(null)}
        showApproveButton={false}
      />

      {/* Unapprove Confirmation Modal */}
      <UnapproveConfirmationModal 
        isOpen={!!unapproveTarget}
        title={unapproveTarget?.title || ''}
        onClose={() => setUnapproveTarget(null)}
        onConfirm={confirmUnapprove}
        isProcessing={isUnapproving}
      />
    </div>
  );
};
