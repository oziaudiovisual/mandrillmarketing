import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

interface DeleteIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  isDeleting: boolean;
}

export const DeleteIntegrationModal: React.FC<DeleteIntegrationModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title,
  isDeleting 
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-md rounded-[5px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#2D2E2F]">
        <div className="p-6 text-center">
          <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <AlertTriangle className="w-8 h-8 text-red-500" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-[#E3E3E3] mb-2">Remover Integração?</h3>
          <p className="text-[#C4C7C5] text-sm mb-6 leading-relaxed">
            Você tem certeza que deseja desconectar <strong className="text-white">"{title}"</strong>?<br/>
            O sistema deixará de coletar estatísticas para esta conta.
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-3 rounded-[5px] bg-red-600 hover:bg-red-500 text-white font-medium text-sm shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Remover
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};