import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, CalendarOff, Loader2 } from 'lucide-react';
import { VideoAsset } from '../types';

interface VideoPlayerModalProps {
  video: VideoAsset | null;
  isOpen: boolean;
  onClose: () => void;
  onApprove?: () => void;
  showApproveButton?: boolean;
  onCancelSchedule?: () => void;
  isCancelling?: boolean;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({ 
  video, 
  isOpen, 
  onClose, 
  onApprove,
  showApproveButton = false,
  onCancelSchedule,
  isCancelling = false
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !video || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 pt-24 animate-fadeIn" onClick={onClose}>
      <div 
        className="bg-[#171918] rounded-[5px] overflow-hidden shadow-2xl flex flex-col items-center relative"
        style={{ 
            width: 'fit-content',
            height: 'fit-content',
            maxWidth: '80vw', 
            maxHeight: '80vh',
            minWidth: '320px'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-[#444746] bg-[#171918] w-full shrink-0">
           <h3 className="text-[#E3E3E3] font-medium truncate flex-1 mr-4 text-sm" style={{ maxWidth: '400px' }}>{video.title}</h3>
           <button onClick={onClose} className="text-[#C4C7C5] hover:text-white transition-colors p-1 rounded-full hover:bg-[#2D2E2F] shrink-0">
              <X className="w-5 h-5" />
           </button>
        </div>

        {/* Video Wrapper - transparent bg to avoid black bars */}
        <div className="flex items-center justify-center overflow-hidden bg-[#101110]">
           <video 
              src={video.url} 
              controls 
              className="block"
              style={{ 
                  maxWidth: '80vw', 
                  maxHeight: (showApproveButton || onCancelSchedule) ? 'calc(80vh - 80px)' : 'calc(80vh - 54px)', // Adjust for header/footer height
                  width: 'auto', 
                  height: 'auto',
                  objectFit: 'contain'
              }}
           />
        </div>

        {/* Footer */}
        {(showApproveButton && onApprove) && (
           <div className="p-4 border-t border-[#444746] bg-[#171918] w-full flex justify-end shrink-0">
               <button 
                  onClick={onApprove}
                  className="px-5 py-2 bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white rounded-full text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-[#fe6a0f]/20"
               >
                  <CheckCircle2 className="w-4 h-4" strokeWidth={2} />
                  Aprovar Vídeo
               </button>
           </div>
        )}

        {onCancelSchedule && (
           <div className="p-4 border-t border-[#444746] bg-[#171918] w-full flex justify-end shrink-0">
               <button 
                  onClick={onCancelSchedule}
                  disabled={isCancelling}
                  className="px-5 py-2 bg-[#2D2E2F] hover:bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
               >
                  {isCancelling ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                      <CalendarOff className="w-4 h-4" strokeWidth={2} />
                  )}
                  {isCancelling ? 'Cancelando...' : 'Cancelar Agendamento'}
               </button>
           </div>
        )}
      </div>
    </div>,
    document.body
  );
};
