import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X, CheckCircle2, Info, AlertTriangle } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: 'error' | 'success' | 'info' | 'warning';
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, title, message, type = 'error' }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle2 className="w-8 h-8 text-[#0BB07B]" strokeWidth={1.5} />;
      case 'warning': return <AlertTriangle className="w-8 h-8 text-yellow-500" strokeWidth={1.5} />;
      case 'info': return <Info className="w-8 h-8 text-blue-500" strokeWidth={1.5} />;
      default: return <AlertCircle className="w-8 h-8 text-red-500" strokeWidth={1.5} />;
    }
  };

  const getStyles = () => {
     switch (type) {
      case 'success': return { bg: 'bg-[#0BB07B]/10', border: 'border-[#0BB07B]/20' };
      case 'warning': return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' };
      case 'info': return { bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      default: return { bg: 'bg-red-500/10', border: 'border-red-500/20' };
    }
  };

  const styles = getStyles();

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-sm rounded-[5px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${styles.bg} ${styles.border}`}>
                {getIcon()}
            </div>
            <h3 className="text-xl font-bold text-[#E3E3E3] mb-2">{title}</h3>
            <p className="text-[#C4C7C5] text-sm mb-6 leading-relaxed">
                {message}
            </p>
            <button 
              onClick={onClose}
              className="w-full py-3 rounded-[5px] bg-[#2D2E2F] hover:bg-[#3E3F40] text-[#E3E3E3] font-medium text-sm transition-colors border border-[#444746] hover:border-[#5E5E5E]"
            >
              Entendi
            </button>
        </div>
      </div>
    </div>,
    document.body
  );
};