
import React, { useState, useEffect } from 'react';
import { Plus, Search, Loader2, Upload, CheckCircle2, X, Ban, Briefcase, ArrowLeft, FolderOpen, Building, User, ChevronRight, Check } from 'lucide-react';
import { Project, VideoAsset } from '../types';
import { getProjects } from '../services/projectService';
import { getProjectVideos } from '../services/videoService';
import { useAuth } from '../contexts/AuthContext';
import { VideoUploadModal } from './VideoUploadModal';
import { VideoDetailModal } from './VideoDetailModal';
import { ProjectCreateModal } from './ProjectCreateModal';
import { AlertModal } from './AlertModal';

export const VideosView: React.FC = () => {
  const { user } = useAuth();
  
  // View State
  const [viewMode, setViewMode] = useState<'projects' | 'videos'>('projects');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Data State
  const [projects, setProjects] = useState<Project[]>([]);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  
  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoAsset | null>(null);

  // Alerts
  const [alertConfig, setAlertConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      type: 'error' | 'success' | 'warning' | 'info';
    }>({
      isOpen: false,
      title: '',
      message: '',
      type: 'error'
  });

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'warning' | 'info' = 'error') => {
      setAlertConfig({ isOpen: true, title, message, type });
  };

  useEffect(() => {
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadProjects = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const data = await getProjects(user.uid);
      setProjects(data);
    } catch (error) {
      console.error("Error loading projects", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenProject = async (project: Project) => {
      setIsLoading(true);
      setActiveProject(project);
      setSearchTerm(''); // Clear search term from project list
      try {
          const projectVideos = await getProjectVideos(project.id);
          setVideos(projectVideos);
          setViewMode('videos');
      } catch (e) {
          console.error(e);
          showAlert("Erro", "Falha ao carregar vídeos do projeto.");
      } finally {
          setIsLoading(false);
      }
  };

  const handleBackToProjects = () => {
      setViewMode('projects');
      setActiveProject(null);
      setVideos([]);
      setSearchTerm('');
      loadProjects(); // Reload to update stats if changes occurred
  };

  const updateVideoInState = (updated: VideoAsset) => {
      setVideos(prev => prev.map(v => v.id === updated.id ? updated : v));
      if (selectedVideo?.id === updated.id) {
          setSelectedVideo(updated);
      }
  };

  const handleProjectCreated = (newProject: Project) => {
      setProjects(prev => [newProject, ...prev]);
  };

  const handleUploadComplete = (newVideo: VideoAsset) => {
      // If we are inside the project, add it to the list
      if (activeProject && newVideo.projectId === activeProject.id) {
          setVideos(prev => [newVideo, ...prev]);
          // We ideally reload projects in background to update stats, but for now we just show the video
      } else {
          // If uploaded from outside (e.g. Ingest), just reload projects to update counts
          loadProjects();
      }
  };

  // Status Badge Logic
  const getVideoStatusConfig = (v: VideoAsset) => {
    if (v.status === 'published') return { label: 'Publicado', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    if (v.status === 'approved') return { label: 'Aprovado', color: 'text-[#0BB07B] bg-[#0BB07B]/10 border-[#0BB07B]/20' };
    if (!v.transcription || v.transcription.trim() === '') return { label: 'Transcrição Pendente', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' };
    if (!v.platforms || v.platforms.length === 0) return { label: 'Seleção de Plataformas', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
    
    // Metadata Checks
    if (v.platforms.includes('youtube')) {
         const yt = v.youtubeMetadata;
         if (!yt || !yt.title || !yt.description) return { label: 'Metadados YouTube', color: 'text-red-400 bg-red-500/10 border-red-500/20' };
    }
    if (v.platforms.includes('instagram')) {
         const ig = v.instagramMetadata;
         if (!ig || !ig.caption) return { label: 'Legenda Instagram', color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' };
    }
    if (v.platforms.includes('tiktok')) {
         const tt = v.tiktokMetadata;
         if (!tt || !tt.caption) return { label: 'Legenda TikTok', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' };
    }

    return { label: 'Revisão Pendente', color: 'text-[#fe6a0f] bg-[#fe6a0f]/10 border-[#fe6a0f]/20' };
  };

  // Logic to determine if a project is "Resolved"
  const isProjectResolved = (p: Project) => {
      // If no stats, assume not resolved unless videoCount is 0 (empty project is considered pending setup)
      if (!p.stats) return false;
      
      const total = p.stats.total || p.videoCount || 0;
      if (total === 0) return false; // Empty project, technically active/waiting for uploads

      // Resolved if NO pending review AND NO approved (waiting distribution)
      // All videos must be either distributed (scheduled/published) or discarded
      return p.stats.pendingReview === 0 && p.stats.approved === 0;
  };

  // Filter Logic
  const allFilteredProjects = projects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  
  const activeProjects = allFilteredProjects.filter(p => !isProjectResolved(p));
  const resolvedProjects = allFilteredProjects.filter(p => isProjectResolved(p));

  const filteredVideos = videos.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase()));
  
  // Categorize videos inside project view
  const videosPendingReview = filteredVideos.filter(v => 
      v.status !== 'approved' && v.status !== 'published' && v.status !== 'scheduled' && v.status !== 'dismissed'
  );
  const videosApproved = filteredVideos.filter(v => v.status === 'approved'); // Ready for distribution
  const videosDiscarded = filteredVideos.filter(v => v.status === 'dismissed');
  
  // Optional: Show published/scheduled in a separate or bottom list if needed, 
  // but usually they leave the "Deliveries" view in previous logic. 
  // User asked to see if there are videos "waiting for distribution". That matches `videosApproved`.

  if (isLoading && !activeProject) return (
    <div className="flex justify-center items-center h-full text-[#C4C7C5]">
      <Loader2 className="w-8 h-8 animate-spin text-[#fe6a0f]" strokeWidth={1} />
    </div>
  );

  return (
    <div className="w-full animate-fadeIn pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3]">Entregas</h1>
          <p className="text-[#C4C7C5] text-base mt-2">
              {viewMode === 'projects' ? 'Gerencie seus projetos e campanhas.' : 'Revisão de conteúdo do projeto.'}
          </p>
        </div>
        
        <div className="flex gap-4">
           {viewMode === 'projects' ? (
                <button 
                    onClick={() => setIsProjectModalOpen(true)}
                    className="bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white px-5 py-2.5 rounded-[5px] text-base font-medium transition-colors flex items-center gap-2 shadow-lg shadow-[#fe6a0f]/20"
                >
                    <Plus className="w-5 h-5" strokeWidth={1} />
                    Novo Projeto
                </button>
           ) : (
                <button 
                    onClick={() => setIsUploadModalOpen(true)}
                    className="bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white px-5 py-2.5 rounded-[5px] text-base font-medium transition-colors flex items-center gap-2 shadow-lg shadow-[#fe6a0f]/20"
                >
                    <Upload className="w-5 h-5" strokeWidth={1} />
                    Upload de Vídeo
                </button>
           )}
        </div>
      </div>

      {/* --- PROJECTS LIST VIEW --- */}
      {viewMode === 'projects' && (
          <>
            <div className="mb-8 max-w-xl">
                <div className="relative group">
                    <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#5E5E5E] group-focus-within:text-[#fe6a0f] transition-colors" strokeWidth={1.5} />
                    <input 
                        type="text" 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar projetos..."
                        className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] pl-12 pr-4 py-3 text-base focus:border-[#fe6a0f] outline-none transition-colors placeholder-[#5E5E5E]"
                    />
                </div>
            </div>

            {allFilteredProjects.length === 0 ? (
                <div className="bg-[#171918] border border-[#2D2E2F] rounded-[5px] p-12 text-center text-[#5E5E5E]">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-2">Nenhum projeto encontrado</h3>
                    <p>Crie um novo projeto para começar a organizar seus vídeos.</p>
                </div>
            ) : (
                <div className="space-y-10">
                    
                    {/* SECTION: ACTIVE PROJECTS */}
                    <section>
                        <h3 className="text-[#E3E3E3] font-medium text-lg mb-4 flex items-center gap-2">
                            Projetos Ativos 
                            <span className="bg-[#fe6a0f]/20 text-[#fe6a0f] text-xs px-2 py-0.5 rounded-full">{activeProjects.length}</span>
                        </h3>
                        {activeProjects.length === 0 ? (
                            <p className="text-[#5E5E5E] italic text-sm">Nenhum projeto pendente.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {activeProjects.map(project => (
                                    <ProjectCard key={project.id} project={project} onClick={() => handleOpenProject(project)} />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* SECTION: RESOLVED PROJECTS */}
                    {resolvedProjects.length > 0 && (
                        <section className="opacity-70 hover:opacity-100 transition-opacity">
                            <div className="flex items-center gap-2 mb-4 border-t border-[#2D2E2F] pt-8">
                                <CheckCircle2 className="w-5 h-5 text-[#0BB07B]" />
                                <h3 className="text-[#E3E3E3] font-medium text-lg">
                                    Resolvidos / Concluídos
                                    <span className="bg-[#0BB07B]/10 text-[#0BB07B] text-xs px-2 py-0.5 rounded-full ml-2">{resolvedProjects.length}</span>
                                </h3>
                            </div>
                            <div className="flex flex-col gap-3">
                                {resolvedProjects.map(project => (
                                    <ProjectCard key={project.id} project={project} onClick={() => handleOpenProject(project)} isResolved />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            )}
          </>
      )}

      {/* --- PROJECT DETAIL VIEW --- */}
      {viewMode === 'videos' && activeProject && (
          <div className="space-y-8 animate-fadeIn">
              
              {/* Breadcrumb / Info Header */}
              <div className="flex items-center gap-4 mb-6 bg-[#171918] p-4 rounded-[5px] border border-[#2D2E2F]">
                  <button 
                    onClick={handleBackToProjects}
                    className="p-2 hover:bg-[#2D2E2F] rounded-[5px] text-[#C4C7C5] hover:text-white transition-colors"
                  >
                      <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="h-8 w-px bg-[#2D2E2F]"></div>
                  <div>
                      <h2 className="text-lg font-bold text-[#E3E3E3]">{activeProject.name}</h2>
                      <div className="flex items-center gap-3 text-xs text-[#5E5E5E]">
                          {activeProject.clientName && <span>Cliente: {activeProject.clientName}</span>}
                          {activeProject.agencyName && <span>Agência: {activeProject.agencyName}</span>}
                      </div>
                  </div>
              </div>

              {/* 1. PENDING REVISION LIST */}
              <section>
                  <h3 className="text-[#E3E3E3] font-medium text-lg mb-4 flex items-center gap-2">
                     Revisão Pendente
                     <span className="bg-[#fe6a0f]/20 text-[#fe6a0f] text-xs px-2 py-0.5 rounded-full">{videosPendingReview.length}</span>
                  </h3>
                  
                  {videosPendingReview.length === 0 ? (
                      <div className="bg-[#171918] border border-[#2D2E2F] rounded-[5px] p-6 text-center text-[#5E5E5E] text-sm">
                          Nenhum vídeo aguardando revisão.
                      </div>
                  ) : (
                      <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
                          {videosPendingReview.map(video => {
                              const statusConfig = getVideoStatusConfig(video);
                              return (
                                <div 
                                    key={video.id} 
                                    onClick={() => setSelectedVideo(video)}
                                    className="flex items-center justify-between p-4 border-b border-[#2D2E2F] last:border-0 hover:bg-[#1E1F20] transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div>
                                            <h4 className="text-[#E3E3E3] font-medium text-base group-hover:text-[#fe6a0f] transition-colors">{video.title}</h4>
                                            <span className="text-xs text-[#5E5E5E]">{(video.fileSize / (1024*1024)).toFixed(1)} MB • {video.format}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                                            {statusConfig.label}
                                        </span>
                                    </div>
                                </div>
                              );
                          })}
                      </div>
                  )}
              </section>

              {/* 2. APPROVED (WAITING DISTRIBUTION) LIST */}
              <section>
                  <h3 className="text-[#E3E3E3] font-medium text-lg mb-4 flex items-center gap-2">
                     Aguardando Distribuição
                     <span className="bg-[#0BB07B]/20 text-[#0BB07B] text-xs px-2 py-0.5 rounded-full">{videosApproved.length}</span>
                  </h3>
                  
                  {videosApproved.length === 0 ? (
                      <div className="bg-[#171918] border border-[#2D2E2F] rounded-[5px] p-6 text-center text-[#5E5E5E] text-sm">
                          Nenhum vídeo aprovado aguardando envio.
                      </div>
                  ) : (
                      <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
                          {videosApproved.map(video => (
                                <div 
                                    key={video.id} 
                                    onClick={() => setSelectedVideo(video)}
                                    className="flex items-center justify-between p-4 border-b border-[#2D2E2F] last:border-0 hover:bg-[#1E1F20] transition-colors cursor-pointer group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-[#0BB07B]"></div>
                                        <div>
                                            <h4 className="text-[#E3E3E3] font-medium text-base group-hover:text-[#fe6a0f] transition-colors">{video.title}</h4>
                                            <span className="text-xs text-[#0BB07B]">Pronto para envio</span>
                                        </div>
                                    </div>
                                    <button className="text-xs text-[#C4C7C5] bg-[#2D2E2F] px-3 py-1.5 rounded hover:text-white">
                                        Ver Detalhes
                                    </button>
                                </div>
                          ))}
                      </div>
                  )}
              </section>

              {/* 3. DISMISSED VIDEOS LIST */}
              {videosDiscarded.length > 0 && (
                  <section className="opacity-60 hover:opacity-100 transition-opacity">
                    <h3 className="text-[#5E5E5E] font-medium text-lg mb-4 flex items-center gap-2">
                        Vídeos Dispensados
                        <span className="bg-[#2D2E2F] text-[#5E5E5E] text-xs px-2 py-0.5 rounded-full">{videosDiscarded.length}</span>
                    </h3>
                    <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
                        {videosDiscarded.map(video => (
                            <div 
                                key={video.id} 
                                onClick={() => setSelectedVideo(video)}
                                className="flex items-center justify-between p-4 border-b border-[#2D2E2F] last:border-0 hover:bg-[#1E1F20] transition-colors cursor-pointer"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-[#101110] rounded flex items-center justify-center text-[#5E5E5E]">
                                        <Ban className="w-4 h-4" />
                                    </div>
                                    <span className="text-[#C4C7C5] line-through decoration-[#5E5E5E]">{video.title}</span>
                                </div>
                                <span className="text-xs text-[#5E5E5E]">Dispensado</span>
                            </div>
                        ))}
                    </div>
                  </section>
              )}
          </div>
      )}

      {/* Upload Modal (Passes activeProject if available) */}
      <VideoUploadModal 
        projects={projects}
        preSelectedProjectId={activeProject?.id}
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Create Project Modal */}
      <ProjectCreateModal 
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* Detail Modal */}
      {selectedVideo && (
        <VideoDetailModal
            video={selectedVideo}
            clientName={selectedVideo.clientName || activeProject?.clientName || activeProject?.name || ''}
            isOpen={!!selectedVideo}
            onClose={() => setSelectedVideo(null)}
            onUpdate={updateVideoInState}
        />
      )}

      <AlertModal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />

    </div>
  );
};

const ProjectCard: React.FC<{ project: Project; onClick: () => void; isResolved?: boolean }> = ({ project, onClick, isResolved }) => {
    // Determine counts. Fallback to 0 if stats object is missing
    const pending = project.stats?.pendingReview || 0;
    const approved = project.stats?.approved || 0;
    const discarded = project.stats?.discarded || 0;
    const total = project.stats?.total || project.videoCount || 0;

    return (
        <div 
            onClick={onClick}
            className="bg-[#171918] border border-[#444746] hover:border-[#fe6a0f] rounded-[5px] p-5 cursor-pointer transition-all group relative overflow-hidden"
        >
            {isResolved && <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-[#0BB07B]/10 to-transparent pointer-events-none"></div>}

            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-[5px] border shrink-0 ${isResolved ? 'bg-[#0BB07B]/10 border-[#0BB07B]/20 text-[#0BB07B]' : 'bg-[#101110] border-[#2D2E2F] text-[#fe6a0f]'}`}>
                        {isResolved ? <Check className="w-6 h-6" /> : <FolderOpen className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-[#E3E3E3] group-hover:text-[#fe6a0f] transition-colors">
                            {project.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {project.clientName && (
                                <span className="text-xs text-[#5E5E5E] flex items-center gap-1 shrink-0">
                                    <User className="w-3 h-3" /> {project.clientName}
                                </span>
                            )}
                            <span className="text-xs text-[#5E5E5E] border-l border-[#2D2E2F] pl-3 shrink-0">
                                {new Date(project.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
                
                <ChevronRight className="w-5 h-5 text-[#5E5E5E] group-hover:text-[#fe6a0f] transition-colors" />
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4 border-t border-[#2D2E2F] pt-4">
                <StatItem label="Conteúdos" value={total} color="text-[#E3E3E3]" />
                <StatItem label="Pendente Aprovação" value={pending} color={pending > 0 ? "text-yellow-500" : "text-[#5E5E5E]"} />
                <StatItem label="Aprovados" value={approved} color={approved > 0 ? "text-[#0BB07B]" : "text-[#5E5E5E]"} />
                <StatItem label="Descartados" value={discarded} color={discarded > 0 ? "text-red-400" : "text-[#5E5E5E]"} />
            </div>
        </div>
    );
};

const StatItem: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
    <div>
        <span className="text-[10px] text-[#5E5E5E] uppercase tracking-wider font-semibold block mb-0.5">{label}</span>
        <span className={`text-sm font-medium ${color}`}>{value}</span>
    </div>
);
