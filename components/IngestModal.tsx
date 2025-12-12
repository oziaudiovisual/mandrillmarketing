import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, FileVideo, AlertCircle, CheckCircle2, Loader2, Trash2, Smartphone, Monitor, Square, FileText } from 'lucide-react';
import { Project, VideoFormat } from '../types';
import { storage } from '../services/firebase';
// Using namespace import to fix potential module resolution issues
import * as firebaseStorage from 'firebase/storage';
import { saveVideoMetadata, updateVideoTranscription } from '../services/videoService';
import { transcribeVideo } from '../services/geminiService';
import { generateVideoThumbnail } from '../services/mediaUtils';
import { useAuth } from '../contexts/AuthContext';
import { setCachedFile } from '../services/fileCache';
import { getProjects } from '../services/projectService';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface QueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'transcribing' | 'completed' | 'error';
  format: VideoFormat;
  error?: string;
  thumbnailUrl?: string; 
}

export const IngestModal: React.FC<IngestModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    if (isOpen && user) {
      setQueue([]);
      setIsProcessing(false);
      getProjects(user.uid).then(data => {
          setProjects(data);
          if (data.length > 0 && !selectedProjectId) {
              setSelectedProjectId(data[0].id);
          }
      });
    }
  }, [isOpen, user]);

  const detectFormat = (file: File): Promise<VideoFormat> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const ratio = video.videoWidth / video.videoHeight;
        URL.revokeObjectURL(url);
        if (ratio > 1.2) resolve('horizontal');
        else if (ratio < 0.8) resolve('vertical');
        else resolve('square');
      };
      video.onerror = () => resolve('vertical'); 
      video.src = url;
    });
  };

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newItems: QueueItem[] = [];
      
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const format = await detectFormat(file);
        
        newItems.push({
          id: Math.random().toString(36).substring(7),
          file,
          progress: 0,
          status: 'pending',
          format
        });
      }

      setQueue(prev => [...prev, ...newItems]);
    }
  };

  const removeItem = (id: string) => {
    if (isProcessing) return;
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const processQueue = async () => {
    if (!user || !selectedProjectId) return;
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) return;

    setIsProcessing(true);

    // Process sequentially
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item.status === 'completed') continue;

      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'uploading' } : q));

      try {
        // 1. Generate Thumbnail
        let thumbnailUrl = '';
        try {
            const thumbBlob = await generateVideoThumbnail(item.file);
            const thumbPath = `users/${user.uid}/projects/${selectedProjectId}/thumbnails/${Date.now()}_${item.id}_thumb.webp`;
            const thumbRef = firebaseStorage.ref(storage, thumbPath);
            await firebaseStorage.uploadBytes(thumbRef, thumbBlob);
            thumbnailUrl = await firebaseStorage.getDownloadURL(thumbRef);
        } catch (thumbErr) {
            console.warn("Thumbnail gen failed:", thumbErr);
        }

        // Updated Storage Path
        const storagePath = `users/${user.uid}/projects/${selectedProjectId}/${Date.now()}_${item.file.name}`;
        const storageRef = firebaseStorage.ref(storage, storagePath);
        const uploadTask = firebaseStorage.uploadBytesResumable(storageRef, item.file);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, progress } : q));
            },
            (error) => {
              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: error.message } : q));
              reject(error);
            },
            async () => {
              const downloadURL = await firebaseStorage.getDownloadURL(uploadTask.snapshot.ref);
              
              const newVideo = await saveVideoMetadata({
                projectId: selectedProjectId,
                userId: user.uid,
                title: item.file.name,
                url: downloadURL,
                thumbnailUrl: thumbnailUrl,
                storagePath,
                format: item.format,
                status: 'ready',
                createdAt: new Date().toISOString(),
                fileSize: item.file.size,
                clientName: selectedProject.clientName || selectedProject.name,
                projectName: selectedProject.name
              });

              setCachedFile(newVideo.id, item.file);

              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'transcribing' } : q));
              
              try {
                  const transcription = await transcribeVideo(item.file);
                  if (transcription) {
                      await updateVideoTranscription(newVideo.id, transcription);
                  }
              } catch (transcribeError) {
                  console.error("Transcribe failed during ingest:", transcribeError);
              }

              setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'completed', progress: 100 } : q));
              resolve();
            }
          );
        });

      } catch (error) {
        console.error("Upload failed for", item.file.name, error);
      }
    }

    setIsProcessing(false);
  };

  const completedCount = queue.filter(q => q.status === 'completed').length;
  const isAllCompleted = queue.length > 0 && completedCount === queue.length;

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-3xl rounded-[5px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-[#2D2E2F]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#444746] flex justify-between items-center bg-[#171918] shrink-0">
          <div>
            <h2 className="text-xl font-bold text-[#E3E3E3] flex items-center gap-2">
              <UploadCloud className="w-6 h-6 text-[#fe6a0f]" />
              Ingestão de Mídia
            </h2>
            <p className="text-[#C4C7C5] text-sm mt-1">Upload em massa com transcrição automática.</p>
          </div>
          <button onClick={onClose} disabled={isProcessing} className="text-[#C4C7C5] hover:text-[#E3E3E3] disabled:opacity-50">
            <X className="w-6 h-6" strokeWidth={1} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#101110]">
          
          {/* Project Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider">Projeto de Destino</label>
            <select 
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={isProcessing || queue.length > 0}
              className="w-full bg-[#2D2E2F] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] outline-none disabled:opacity-50"
            >
              <option value="" disabled>Selecione um projeto...</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {queue.length > 0 && !isProcessing && (
               <p className="text-xs text-[#5E5E5E]">Para mudar de projeto, limpe a fila primeiro.</p>
            )}
          </div>

          {/* Dropzone / List */}
          {queue.length === 0 ? (
            <div className="relative border-2 border-dashed border-[#444746] rounded-[5px] h-64 flex flex-col items-center justify-center bg-[#1E1F20]/50 hover:bg-[#1E1F20] transition-colors group">
              <input 
                type="file" 
                multiple 
                accept="video/*"
                onChange={handleFilesSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                disabled={!selectedProjectId}
              />
              <div className="bg-[#2D2E2F] p-4 rounded-full mb-4 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-8 h-8 text-[#fe6a0f]" />
              </div>
              <h3 className="text-[#E3E3E3] font-medium text-lg">Arraste vídeos ou clique aqui</h3>
              <p className="text-[#C4C7C5] text-sm mt-2">MP4, MOV ou WebM</p>
              {!selectedProjectId && (
                <div className="mt-4 bg-red-500/10 text-red-400 text-xs px-3 py-1 rounded-[5px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Selecione um projeto primeiro
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
               <div className="flex justify-between items-center mb-2">
                  <h3 className="text-[#E3E3E3] font-medium">Fila de Upload ({queue.length})</h3>
                  {!isProcessing && !isAllCompleted && (
                    <button 
                       onClick={() => handleFilesSelect({ target: { files: null } } as any)} 
                       className="text-[#fe6a0f] text-sm hover:underline flex items-center gap-1 relative"
                    >
                       <input 
                        type="file" 
                        multiple 
                        accept="video/*"
                        onChange={handleFilesSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                       + Adicionar mais
                    </button>
                  )}
               </div>
               
               {queue.map((item) => (
                 <div key={item.id} className="bg-[#1E1F20] border border-[#444746] rounded-[5px] p-4 flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#2D2E2F] rounded flex items-center justify-center text-[#C4C7C5]">
                        <FileVideo className="w-5 h-5" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                       <div className="flex justify-between mb-1">
                          <span className="text-sm font-medium text-[#E3E3E3] truncate">{item.file.name}</span>
                          <span className="text-xs text-[#C4C7C5] flex items-center gap-1">
                             {item.format === 'vertical' && <Smartphone className="w-3 h-3" />}
                             {item.format === 'horizontal' && <Monitor className="w-3 h-3" />}
                             {item.format === 'square' && <Square className="w-3 h-3" />}
                             {(item.file.size / (1024*1024)).toFixed(1)} MB
                          </span>
                       </div>
                       
                       {/* Progress Bar */}
                       <div className="h-1.5 bg-[#2D2E2F] rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-300 ${item.status === 'error' ? 'bg-red-500' : item.status === 'completed' ? 'bg-[#0BB07B]' : 'bg-[#fe6a0f]'}`} 
                            style={{width: `${item.progress}%`}}
                          />
                       </div>
                    </div>

                    <div className="flex items-center gap-2">
                       {item.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-[#0BB07B]" />}
                       {item.status === 'error' && (
                           <div title={item.error}>
                               <AlertCircle className="w-5 h-5 text-red-500" />
                           </div>
                       )}
                       {item.status === 'uploading' && <Loader2 className="w-5 h-5 text-[#fe6a0f] animate-spin" />}
                       {item.status === 'transcribing' && (
                           <div title="Transcrevendo...">
                               <FileText className="w-5 h-5 text-purple-400 animate-pulse" />
                           </div>
                       )}
                       
                       {item.status === 'pending' && (
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 hover:bg-[#2D2E2F] rounded text-[#5E5E5E] hover:text-red-400 transition-colors"
                          >
                             <Trash2 className="w-4 h-4" />
                          </button>
                       )}
                    </div>
                 </div>
               ))}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#444746] bg-[#171918] flex justify-between items-center shrink-0">
           <div>
              {isProcessing && <span className="text-sm text-[#C4C7C5] animate-pulse">Processando fila (Upload + Preview + Transcrição)...</span>}
              {isAllCompleted && <span className="text-sm text-[#0BB07B] flex items-center gap-2"><CheckCircle2 className="w-4 h-4"/> Ingestão concluída com sucesso!</span>}
           </div>

           <div className="flex gap-3">
              <button 
                onClick={onClose}
                className="px-6 py-3 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-base"
              >
                {isAllCompleted ? 'Fechar' : 'Cancelar'}
              </button>
              
              {!isAllCompleted && (
                <button 
                    onClick={processQueue}
                    disabled={isProcessing || queue.length === 0}
                    className="px-6 py-3 rounded-[5px] bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white font-medium text-base shadow-lg flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    {isProcessing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <UploadCloud className="w-5 h-5" />
                    )}
                    Iniciar Ingestão
                </button>
              )}
           </div>
        </div>

      </div>
    </div>,
    document.body
  );
};