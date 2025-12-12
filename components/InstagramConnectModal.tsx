
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Instagram, CheckCircle2, ArrowRight, ArrowLeft, Building2, Facebook, ShieldCheck, Key, Loader2, AlertCircle } from 'lucide-react';
import { initFacebookSdk, loginToFacebook, getInstagramBusinessAccountId } from '../services/instagramService';

interface InstagramConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (accessToken: string, igAccountId: string, appId: string) => void;
}

// Hardcoded Facebook App ID System Default
const DEFAULT_FB_APP_ID = '1803248414411032';

export const InstagramConnectModal: React.FC<InstagramConnectModalProps> = ({ isOpen, onClose, onConnect }) => {
  const [step, setStep] = useState(1);
  const [appId] = useState(DEFAULT_FB_APP_ID);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!appId) {
        setError("Erro de Configuração: Facebook App ID não encontrado no sistema.");
        return;
    }
    
    setError(null);
    setIsLoading(true);

    try {
        // 1. Init SDK
        await initFacebookSdk(appId);

        // 2. Login & Get Token
        const { accessToken } = await loginToFacebook();

        // 3. Get IG Account ID
        const igId = await getInstagramBusinessAccountId(accessToken);

        // Success
        onConnect(accessToken, igId, appId);
        setStep(3); // Go to success step
        
    } catch (err: any) {
        console.error(err);
        setError(err.message || "Falha na conexão. Verifique se sua conta é Business e está vinculada a uma Página.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (step === 2) {
       // On Step 2, "Next" triggers the login
       handleConnect();
    } else if (step === 3) {
      onClose();
      // Reset after closing
      setTimeout(() => {
          setStep(1);
          setError(null);
      }, 500);
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
        setStep(step - 1);
        setError(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-lg rounded-[5px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#444746] flex justify-between items-center bg-[#171918]">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 p-1.5 rounded-[5px]">
                <Instagram className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-lg font-bold text-[#E3E3E3]">Conectar Instagram</h2>
          </div>
          <button onClick={onClose} className="text-[#C4C7C5] hover:text-[#E3E3E3] transition-colors">
            <X className="w-5 h-5" strokeWidth={1} />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 bg-[#101110] flex-1 overflow-y-auto">
          
          {/* Progress Bar */}
          <div className="flex items-center justify-between mb-8 px-2">
            <StepIndicator current={step} number={1} />
            <div className={`h-0.5 flex-1 mx-2 ${step > 1 ? 'bg-purple-500' : 'bg-[#444746]'}`} />
            <StepIndicator current={step} number={2} />
            <div className={`h-0.5 flex-1 mx-2 ${step > 2 ? 'bg-purple-500' : 'bg-[#444746]'}`} />
            <StepIndicator current={step} number={3} />
          </div>

          <div className="min-h-[280px]">
            {/* STEP 1: Requirements */}
            {step === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-purple-500/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-purple-500/20">
                  <Building2 className="w-8 h-8 text-purple-400" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-[#E3E3E3]">Pré-requisitos</h3>
                <p className="text-[#C4C7C5] text-sm leading-relaxed">
                  Para importar estatísticas e permitir automação, verifique:
                </p>
                <div className="bg-[#2D2E2F] rounded-[5px] p-4 border border-[#444746] text-sm space-y-3">
                   <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0BB07B]" />
                        <span className="text-[#E3E3E3]">Conta <strong>Instagram Business</strong> (ou Criador)</span>
                   </div>
                   <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0BB07B]" />
                        <span className="text-[#E3E3E3]">Vinculada a uma <strong>Página do Facebook</strong></span>
                   </div>
                   <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[#0BB07B]" />
                        <span className="text-[#E3E3E3]">Você é <strong>Admin</strong> dessa Página</span>
                   </div>
                </div>
              </div>
            )}

            {/* STEP 2: Login Prompt */}
            {step === 2 && (
               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-blue-600/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-blue-600/20">
                  <Facebook className="w-8 h-8 text-blue-500" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-[#E3E3E3]">Autenticação</h3>
                <p className="text-[#C4C7C5] text-sm leading-relaxed">
                  Clique no botão abaixo para iniciar o login seguro com o Facebook e selecionar sua página.
                </p>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-[5px] p-3 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1} />
                        <p className="text-sm text-red-400">{error}</p>
                    </div>
                )}
                
                <div className="bg-[#2D2E2F] rounded-[5px] p-4 border border-[#444746] text-sm text-[#C4C7C5]">
                   <p>O sistema usará o App ID configurado internamente.</p>
                </div>
              </div>
            )}

            {/* STEP 3: Success */}
            {step === 3 && (
               <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="bg-[#0BB07B]/10 w-16 h-16 rounded-full flex items-center justify-center mb-4 border border-[#0BB07B]/20">
                  <ShieldCheck className="w-8 h-8 text-[#0BB07B]" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-bold text-[#E3E3E3]">Conectado com Sucesso!</h3>
                <p className="text-[#C4C7C5] text-sm leading-relaxed">
                   Seus dados do Instagram agora serão sincronizados com o Dashboard Executivo.
                </p>
                <div className="bg-[#2D2E2F] p-4 rounded-[5px] border border-[#444746] flex items-center gap-3">
                    <div className="bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-500 p-2 rounded-full">
                        <Instagram className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[#E3E3E3] font-medium text-sm">Integração Ativa</p>
                        <p className="text-[#0BB07B] text-xs">Analytics + Automação</p>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#444746] bg-[#171918] flex justify-between items-center">
           {step > 1 && step < 3 ? (
             <button 
                onClick={handleBack}
                disabled={isLoading}
                className="px-4 py-2 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50"
             >
                <ArrowLeft className="w-4 h-4" /> Voltar
             </button>
           ) : (
             <div></div> 
           )}

           <button 
              onClick={handleNext}
              disabled={isLoading}
              className="px-6 py-2.5 rounded-[5px] bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white font-bold text-sm shadow-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
           >
              {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Conectando...
                  </>
              ) : (
                  <>
                    {step === 3 ? 'Concluir' : step === 2 ? 'Fazer Login' : 'Próximo'}
                    {step === 3 ? <CheckCircle2 className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </>
              )}
           </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

const StepIndicator: React.FC<{ current: number, number: number }> = ({ current, number }) => {
  const isActive = current === number;
  const isCompleted = current > number;

  return (
    <div className={`
      w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
      ${isActive ? 'bg-purple-600 text-white scale-110 shadow-lg shadow-purple-500/30' : ''}
      ${isCompleted ? 'bg-purple-900 text-purple-200' : ''}
      ${!isActive && !isCompleted ? 'bg-[#2D2E2F] text-[#5E5E5E]' : ''}
    `}>
      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : number}
    </div>
  );
};
