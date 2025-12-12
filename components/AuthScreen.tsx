import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, Mail, Lock, ArrowRight, AlertCircle, KeyRound } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  // Always true now, as public signup is disabled via UI
  const [isLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      let msg = err.message;
      if (msg.includes('auth/invalid-email')) msg = "E-mail inválido.";
      else if (msg.includes('auth/user-not-found')) msg = "Usuário não encontrado.";
      else if (msg.includes('auth/wrong-password')) msg = "Senha incorreta.";
      else if (msg.includes('auth/too-many-requests')) msg = "Muitas tentativas. Tente novamente mais tarde.";
      else msg = msg.replace('Firebase: ', '');
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#101110] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        
        {/* Card */}
        <div className="bg-[#171918] rounded-[5px] p-6 shadow-2xl">
          <div className="mb-10 text-center">
            <div className="bg-[#fe6a0f]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#fe6a0f]/20">
               <KeyRound className="w-8 h-8 text-[#fe6a0f]" strokeWidth={1.5} />
            </div>
            <h2 className="text-3xl font-bold text-[#E3E3E3] mb-3">
              Login
            </h2>
            <p className="text-[#C4C7C5] text-base">
              Insira suas credenciais para acessar o painel.
            </p>
          </div>

          {error && (
            <div className="mb-8 bg-red-500/10 border border-red-500/20 rounded-[5px] p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1} />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-5 h-5 text-[#5E5E5E]" strokeWidth={1} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#101110] border border-[#444746] text-[#E3E3E3] rounded-[5px] pl-12 pr-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] focus:border-transparent outline-none transition-all placeholder-[#5E5E5E]"
                  placeholder="nome@empresa.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-5 h-5 text-[#5E5E5E]" strokeWidth={1} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#101110] border border-[#444746] text-[#E3E3E3] rounded-[5px] pl-12 pr-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] focus:border-transparent outline-none transition-all placeholder-[#5E5E5E]"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white py-4 rounded-[5px] font-medium shadow-lg shadow-[#fe6a0f]/20 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin" strokeWidth={1} />
              ) : (
                <>
                  Entrar
                  <ArrowRight className="w-5 h-5" strokeWidth={1} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};