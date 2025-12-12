import React from 'react';
import { createPortal } from 'react-dom';
import { ThumbsUp, Loader2, Youtube, Instagram, Music } from 'lucide-react';
import { Platform } from '../types';

interface ApproveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  isProcessing: boolean;
  platforms: Platform[];
}

export const ApproveConfirmationModal: React.FC<ApproveConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title,
  isProcessing,
  platforms
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-md rounded-[5px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#2D2E2F]">
        <div className="p-6 text-center">
          <div className="bg-[#fe6a0f]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#fe6a0f]/20">
            <ThumbsUp className="w-8 h-8 text-[#fe6a0f]" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-[#E3E3E3] mb-2">Aprovar Vídeo?</h3>
          <p className="text-[#C4C7C5] text-sm mb-4 leading-relaxed">
            O vídeo <strong className="text-white">"{title}"</strong> será movido para a fila de <strong>Distribuição</strong>.
          </p>

          {/* Platform Summary */}
          {platforms && platforms.length > 0 && (
             <div className="flex items-center justify-center gap-2 mb-6">
                {platforms.includes('youtube') && (
                    <div className="bg-red-500/10 p-2 rounded-full border border-red-500/20" title="YouTube">
                        <Youtube className="w-4 h-4 text-red-500" />
                    </div>
                )}
                {platforms.includes('instagram') && (
                    <div className="bg-pink-500/10 p-2 rounded-full border border-pink-500/20" title="Instagram">
                        <Instagram className="w-4 h-4 text-pink-500" />
                    </div>
                )}
                {platforms.includes('tiktok') && (
                    <div className="bg-cyan-400/10 p-2 rounded-full border border-cyan-400/20" title="TikTok">
                        <Music className="w-4 h-4 text-cyan-400" />
                    </div>
                )}
             </div>
          )}
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-[5px] bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white font-medium text-sm shadow-lg shadow-[#fe6a0f]/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};