
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Briefcase, User, Building, Loader2, Save } from 'lucide-react';
import { Project } from '../types';
import { createProject } from '../services/projectService';
import { useAuth } from '../contexts/AuthContext';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({ isOpen, onClose, onProjectCreated }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name.trim()) return;

    setIsLoading(true);
    try {
      const newProject = await createProject(user.uid, name, clientName, agencyName);
      onProjectCreated(newProject);
      onClose();
      // Reset form
      setName('');
      setClientName('');
      setAgencyName('');
    } catch (error) {
      console.error("Error creating project:", error);
      alert("Erro ao criar projeto.");
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#171918] w-full max-w-md rounded-[5px] shadow-2xl overflow-hidden border border-[#2D2E2F]">
        
        {/* Header */}
        <div className="p-6 border-b border-[#444746] flex justify-between items-center bg-[#171918]">
          <h2 className="text-xl font-bold text-[#E3E3E3] flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#fe6a0f]" />
            Novo Projeto
          </h2>
          <button onClick={onClose} className="text-[#C4C7C5] hover:text-[#E3E3E3] transition-colors">
            <X className="w-6 h-6" strokeWidth={1} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-[#101110]">
          
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider">Nome do Projeto *</label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Campanha Verão 2024"
              className="w-full bg-[#2D2E2F] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 focus:border-[#fe6a0f] outline-none placeholder-[#5E5E5E]"
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider flex items-center gap-2">
               <User className="w-4 h-4" /> Cliente (Opcional)
            </label>
            <input 
              type="text" 
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome do Cliente"
              className="w-full bg-[#2D2E2F] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 focus:border-[#fe6a0f] outline-none placeholder-[#5E5E5E]"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider flex items-center gap-2">
               <Building className="w-4 h-4" /> Agência (Opcional)
            </label>
            <input 
              type="text" 
              value={agencyName}
              onChange={(e) => setAgencyName(e.target.value)}
              placeholder="Nome da Agência"
              className="w-full bg-[#2D2E2F] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 focus:border-[#fe6a0f] outline-none placeholder-[#5E5E5E]"
            />
          </div>

          <div className="pt-4 flex gap-3">
             <button 
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors font-medium"
             >
                Cancelar
             </button>
             <button 
                type="submit"
                disabled={isLoading}
                className="flex-1 px-4 py-3 rounded-[5px] bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white font-medium shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
             >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Criar Projeto
             </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
};
