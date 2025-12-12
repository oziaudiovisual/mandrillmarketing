import React from 'react';
import { createPortal } from 'react-dom';
import { CalendarOff, Loader2 } from 'lucide-react';

interface CancelScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export const CancelScheduleModal: React.FC<CancelScheduleModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isProcessing 
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-md rounded-[5px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-[#2D2E2F]">
        <div className="p-6 text-center">
          <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <CalendarOff className="w-8 h-8 text-red-500" strokeWidth={1.5} />
          </div>
          <h3 className="text-xl font-bold text-[#E3E3E3] mb-2">Cancelar Agendamento?</h3>
          <p className="text-[#C4C7C5] text-sm mb-6 leading-relaxed">
            Tem certeza que deseja cancelar o agendamento? <br/>
            O vídeo voltará para a lista de Distribuição.
          </p>
          
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-sm disabled:opacity-50"
            >
              Não, manter
            </button>
            <button 
              onClick={onConfirm}
              disabled={isProcessing}
              className="flex-1 px-4 py-3 rounded-[5px] bg-red-600 hover:bg-red-500 text-white font-medium text-sm shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarOff className="w-4 h-4" />}
              Sim, cancelar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};