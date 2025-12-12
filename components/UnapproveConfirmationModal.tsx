import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Undo2, Loader2, AlertCircle } from 'lucide-react';

interface UnapproveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  isProcessing: boolean;
}

export const UnapproveConfirmationModal: React.FC<UnapproveConfirmationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title,
  isProcessing 
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-md rounded-[5px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
          <div className="bg-yellow-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-yellow-500/20">
            <Undo2 className="w-8 h-8 text-yellow-500" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-[#E3E3E3] mb-2">Desfazer Aprovação?</h3>
          <p className="text-[#C4C7C5] text-sm mb-6 leading-relaxed">
            O vídeo <strong className="text-white">"{title}"</strong> será removido da fila de distribuição e voltará para o status <strong>"Pronto"</strong> na tela do cliente.
          </p>
          
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
              className="flex-1 px-4 py-3 rounded-[5px] bg-[#E3E3E3] hover:bg-white text-black font-medium text-sm shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};