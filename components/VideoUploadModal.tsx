import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, UploadCloud, FileVideo, AlertCircle, CheckCircle2, Loader2, Smartphone, Monitor, Square, FolderOpen } from 'lucide-react';
import { VideoFormat, VideoAsset, Project } from '../types';
import { storage } from '../services/firebase';
// Using namespace import to fix potential module resolution issues
import * as firebaseStorage from 'firebase/storage';
import { saveVideoMetadata } from '../services/videoService';
import { useAuth } from '../contexts/AuthContext';
import { setCachedFile } from '../services/fileCache';

interface VideoUploadModalProps {
  projects: Project[];
  preSelectedProjectId?: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (video: VideoAsset) => void;
}

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({ projects, preSelectedProjectId, isOpen, onClose, onUploadComplete }) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [format, setFormat] = useState<VideoFormat>('vertical');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'completed'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  // Hidden video element for metadata validation
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen) {
        setFile(null);
        setStatus('idle');
        setProgress(0);
        setError(null);
        setValidationError(null);
        
        if (preSelectedProjectId) {
            setSelectedProjectId(preSelectedProjectId);
        } else if (projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(projects[0].id);
        }
    }
  }, [isOpen, projects, preSelectedProjectId]);

  if (!isOpen) return null;

  const handleCloseAttempt = () => {
    if (status === 'uploading') {
      const confirmExit = window.confirm("O upload está em andamento. Se você sair agora, todo o progresso será perdido. Deseja sair mesmo assim?");
      if (!confirmExit) return;
    }
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setValidationError(null);
      setError(null);
      setStatus('idle');
      setProgress(0);

      // Validate dimensions
      const url = URL.createObjectURL(selectedFile);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
          const width = videoRef.current?.videoWidth || 0;
          const height = videoRef.current?.videoHeight || 0;
          const ratio = width / height;

          let detectedFormat: VideoFormat = 'square';
          if (ratio > 1.2) detectedFormat = 'horizontal';
          if (ratio < 0.8) detectedFormat = 'vertical';

          setFormat(detectedFormat);

          if (format === 'vertical' && detectedFormat === 'horizontal') {
            setValidationError("Aviso: O vídeo parece ser Horizontal, alterando seleção.");
          }
        };
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !user || !selectedProjectId) return;
    
    const selectedProject = projects.find(p => p.id === selectedProjectId);
    if (!selectedProject) return;

    setStatus('uploading');
    setError(null);

    try {
      // 1. Storage Reference for Video (Updated Path structure)
      // Path: users/{uid}/projects/{projectId}/{timestamp_filename}
      const storagePath = `users/${user.uid}/projects/${selectedProjectId}/${Date.now()}_${file.name}`;
      const storageRef = firebaseStorage.ref(storage, storagePath);

      // 2. Upload Task
      const uploadTask = firebaseStorage.uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progressValue = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progressValue);
        }, 
        (err) => {
          setError(err.message);
          setStatus('idle');
        }, 
        async () => {
          // 3. Complete Upload
          const downloadURL = await firebaseStorage.getDownloadURL(uploadTask.snapshot.ref);
          
          // 4. Save Metadata 
          const newVideo = await saveVideoMetadata({
            projectId: selectedProjectId,
            userId: user.uid,
            title: file.name,
            url: downloadURL,
            thumbnailUrl: '',
            storagePath,
            format,
            status: 'pending', 
            createdAt: new Date().toISOString(),
            fileSize: file.size,
            transcription: '',
            description: '',
            // Save client and project name strings denormalized for easier display later
            clientName: selectedProject.clientName || selectedProject.name,
            projectName: selectedProject.name
          });

          setCachedFile(newVideo.id, file);

          setStatus('completed');
          onUploadComplete(newVideo);
          
          setTimeout(() => {
             onClose();
          }, 1000);
        }
      );

    } catch (err: any) {
      setError(err.message);
      setStatus('idle');
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-lg rounded-[5px] shadow-2xl overflow-hidden border border-[#2D2E2F]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#444746] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#E3E3E3]">Upload de Vídeo</h2>
          <button onClick={handleCloseAttempt} className="text-[#C4C7C5] hover:text-[#E3E3E3]">
            <X className="w-6 h-6" strokeWidth={1} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Project Selector */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider block">
              Projeto de Destino
            </label>
            <div className="relative">
                <FolderOpen className="absolute left-4 top-3.5 w-5 h-5 text-[#5E5E5E]" />
                <select 
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    disabled={status !== 'idle' || !!preSelectedProjectId}
                    className="w-full bg-[#101110] border border-[#444746] text-[#E3E3E3] rounded-[5px] pl-12 pr-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] outline-none appearance-none"
                >
                    <option value="" disabled>Selecione um projeto...</option>
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
            {projects.length === 0 && (
                <p className="text-xs text-red-400">Crie um projeto na tela anterior primeiro.</p>
            )}
          </div>

          {/* Format Selector */}
          <div>
            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider block mb-3">
              Formato Detectado
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button 
                onClick={() => setFormat('vertical')}
                disabled={status !== 'idle'}
                className={`flex flex-col items-center justify-center p-3 rounded-[5px] border transition-all ${format === 'vertical' ? 'bg-[#fe6a0f]/10 border-[#fe6a0f] text-[#fe6a0f]' : 'bg-[#2D2E2F] border-[#444746] text-[#C4C7C5] opacity-50'}`}
              >
                <Smartphone className="w-5 h-5 mb-1" strokeWidth={1} />
                <span className="text-[10px]">9:16</span>
              </button>
              <button 
                onClick={() => setFormat('square')}
                disabled={status !== 'idle'}
                className={`flex flex-col items-center justify-center p-3 rounded-[5px] border transition-all ${format === 'square' ? 'bg-[#fe6a0f]/10 border-[#fe6a0f] text-[#fe6a0f]' : 'bg-[#2D2E2F] border-[#444746] text-[#C4C7C5] opacity-50'}`}
              >
                <Square className="w-5 h-5 mb-1" strokeWidth={1} />
                <span className="text-[10px]">1:1</span>
              </button>
              <button 
                onClick={() => setFormat('horizontal')}
                disabled={status !== 'idle'}
                className={`flex flex-col items-center justify-center p-3 rounded-[5px] border transition-all ${format === 'horizontal' ? 'bg-[#fe6a0f]/10 border-[#fe6a0f] text-[#fe6a0f]' : 'bg-[#2D2E2F] border-[#444746] text-[#C4C7C5] opacity-50'}`}
              >
                <Monitor className="w-5 h-5 mb-1" strokeWidth={1} />
                <span className="text-[10px]">16:9</span>
              </button>
            </div>
          </div>

          {/* File Input */}
          <div className="relative">
             <input 
                type="file" 
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden" 
                id="video-upload"
                disabled={status !== 'idle'}
             />
             <label 
                htmlFor="video-upload"
                className={`w-full h-32 border-2 border-dashed rounded-[5px] flex flex-col items-center justify-center cursor-pointer transition-colors ${file ? 'border-[#fe6a0f] bg-[#fe6a0f]/5' : 'border-[#444746] hover:border-[#C4C7C5] hover:bg-[#2D2E2F]'}`}
             >
                {file ? (
                  <>
                    <FileVideo className="w-8 h-8 text-[#fe6a0f] mb-2" strokeWidth={1} />
                    <span className="text-sm text-[#E3E3E3] font-medium">{file.name}</span>
                    <span className="text-xs text-[#C4C7C5] mt-1">{(file.size / (1024*1024)).toFixed(2)} MB</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-[#C4C7C5] mb-2" strokeWidth={1} />
                    <span className="text-sm text-[#C4C7C5]">Clique para selecionar o vídeo</span>
                  </>
                )}
             </label>
             <video ref={videoRef} className="hidden" />
          </div>

          {/* Messages */}
          {validationError && (
             <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-[5px] p-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" strokeWidth={1} />
                <p className="text-sm text-yellow-400">{validationError}</p>
             </div>
          )}
          {error && (
             <div className="bg-red-500/10 border border-red-500/20 rounded-[5px] p-3 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" strokeWidth={1} />
                <p className="text-sm text-red-400">{error}</p>
             </div>
          )}

          {/* Progress / Status Bar */}
          {status !== 'idle' && (
            <div className="space-y-3 bg-[#2D2E2F] p-4 rounded-[5px] border border-[#444746]">
               <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-[#E3E3E3]">
                      {status === 'uploading' && <><Loader2 className="w-4 h-4 animate-spin text-[#fe6a0f]"/> Enviando arquivo...</>}
                      {status === 'completed' && <><CheckCircle2 className="w-4 h-4 text-[#0BB07B]"/> Concluído!</>}
                  </span>
                  <span className="text-[#C4C7C5]">{status === 'uploading' ? Math.round(progress) : 100}%</span>
               </div>
               <div className="h-2 bg-[#101110] rounded-full overflow-hidden">
                  <div className="h-full bg-[#fe6a0f] transition-all duration-300" style={{width: `${status === 'uploading' ? progress : 100}%`}}></div>
               </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#444746] bg-[#171918] flex justify-end gap-3">
          <button 
            onClick={handleCloseAttempt}
            className="px-5 py-2.5 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-sm"
          >
            Cancelar
          </button>
          <button 
            onClick={handleUpload}
            disabled={!file || !selectedProjectId || (status !== 'idle' && status !== 'completed')}
            className="px-6 py-2.5 rounded-[5px] bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white font-medium text-sm shadow-lg shadow-[#fe6a0f]/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
             Salvar Vídeo
             <CheckCircle2 className="w-4 h-4" strokeWidth={1} />
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
};