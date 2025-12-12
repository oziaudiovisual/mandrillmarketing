import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Search, ShieldAlert, Ban, CheckCircle2, Trash2, Loader2, AlertCircle, Plus, X, Pencil, Save, Key, Shield } from 'lucide-react';
import { UserProfile } from '../types';
import { getAllUsers, toggleUserStatus, deleteUserSystem, createUserSystem, updateUserDetails } from '../services/userService';
import { useAuth } from '../contexts/AuthContext';

export const AdminUsersView: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    uid: '',
    email: '',
    password: '',
    displayName: '',
    role: 'user' as 'admin' | 'user'
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await getAllUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setFormData({ uid: '', email: '', password: '', displayName: '', role: 'user' });
    setIsEditMode(false);
    setModalError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserProfile) => {
    setFormData({ 
        uid: user.uid, 
        email: user.email, 
        password: '', // Password not needed/shown for edit
        displayName: user.displayName || '', 
        role: user.role 
    });
    setIsEditMode(true);
    setModalError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalLoading(true);

    try {
        if (isEditMode) {
            // Update
            await updateUserDetails(formData.uid, {
                displayName: formData.displayName,
                role: formData.role
            });
            
            // Update local state
            setUsers(prev => prev.map(u => 
                u.uid === formData.uid 
                ? { ...u, displayName: formData.displayName, role: formData.role } 
                : u
            ));
        } else {
            // Create
            if (!formData.password || formData.password.length < 6) {
                throw new Error("A senha deve ter pelo menos 6 caracteres.");
            }
            const newUser = await createUserSystem(formData.email, formData.password, formData.displayName, formData.role);
            setUsers([newUser, ...users]);
        }
        setIsModalOpen(false);
    } catch (error: any) {
        console.error(error);
        let msg = error.message;
        if (msg.includes('auth/email-already-in-use')) msg = "Este e-mail já está em uso.";
        else if (msg.includes('auth/weak-password')) msg = "Senha muito fraca.";
        else if (msg.includes('auth/invalid-email')) msg = "E-mail inválido.";
        setModalError(msg);
    } finally {
        setModalLoading(false);
    }
  };

  const handleToggleStatus = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser?.uid) return;
    setActionLoading(targetUser.uid);
    try {
      const newStatus = await toggleUserStatus(targetUser.uid, targetUser.status);
      setUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, status: newStatus } : u));
    } catch (error) {
      console.error("Error toggling status:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (targetUser: UserProfile) => {
    if (targetUser.uid === currentUser?.uid) return;
    if (!window.confirm(`Tem certeza que deseja remover o usuário ${targetUser.email}? Esta ação removerá o acesso ao sistema imediatamente.`)) return;

    setActionLoading(targetUser.uid);
    try {
      await deleteUserSystem(targetUser.uid);
      setUsers(prev => prev.filter(u => u.uid !== targetUser.uid));
    } catch (error) {
      console.error("Error deleting user:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (isLoading) return (
    <div className="flex justify-center items-center h-full text-[#C4C7C5]">
      <Loader2 className="w-10 h-10 animate-spin text-[#fe6a0f]" strokeWidth={1} />
    </div>
  );

  return (
    <div className="w-full animate-fadeIn pb-20">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3]">Usuários</h1>
          <p className="text-[#C4C7C5] text-base mt-2">Gestão de acesso e permissões</p>
        </div>
        <div className="flex gap-4">
            <button 
                onClick={openCreateModal}
                className="bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white px-5 py-2.5 rounded-[5px] text-base font-medium transition-colors flex items-center gap-2 shadow-lg shadow-[#fe6a0f]/20"
            >
                <Plus className="w-5 h-5" strokeWidth={1} />
                Novo Usuário
            </button>
        </div>
      </div>

      {/* Tools Row */}
      <div className="mb-10">
          <div className="relative group flex-1 max-w-xl">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-[#5E5E5E] group-focus-within:text-[#fe6a0f] transition-colors" strokeWidth={1.5} />
            <input 
                type="text" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou e-mail..."
                className="w-full bg-[#171918] border border-[#444746] text-[#E3E3E3] rounded-[5px] pl-12 pr-4 py-3 text-base focus:border-[#fe6a0f] outline-none transition-colors placeholder-[#5E5E5E]"
            />
          </div>
      </div>

      {/* Users List (Row Style) */}
      <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
        {filteredUsers.length === 0 ? (
            <div className="p-10 text-center text-[#C4C7C5] flex flex-col items-center">
                <AlertCircle className="w-10 h-10 mb-3 opacity-50" />
                <p className="text-lg">Nenhum usuário encontrado.</p>
            </div>
        ) : (
            filteredUsers.map(user => (
                <div 
                    key={user.uid} 
                    className="flex items-center justify-between p-4 border-b border-[#2D2E2F] last:border-0 hover:bg-[#1E1F20] transition-colors group"
                >
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-[#101110] border border-[#444746] flex items-center justify-center text-sm font-bold text-[#fe6a0f]">
                            {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                         </div>
                         <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-[#E3E3E3] font-medium text-base">
                                    {user.displayName || 'Sem nome'}
                                </h4>
                                {user.uid === currentUser?.uid && (
                                    <span className="text-[10px] bg-[#fe6a0f]/20 text-[#fe6a0f] px-1.5 py-0.5 rounded border border-[#fe6a0f]/30 font-medium">
                                        VOCÊ
                                    </span>
                                )}
                            </div>
                            <span className="text-xs text-[#5E5E5E]">{user.email}</span>
                         </div>
                    </div>

                    {/* Right: Badges & Actions */}
                    <div className="flex items-center gap-6">
                        
                        {/* Date (Hidden on mobile) */}
                        <div className="hidden md:block text-right w-20">
                            <span className="text-[10px] text-[#5E5E5E] uppercase tracking-wider font-bold block">Criado em</span>
                            <span className="text-xs text-[#C4C7C5]">{new Date(user.createdAt).toLocaleDateString()}</span>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center justify-end gap-2 w-36">
                             {/* Role Badge */}
                             <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 capitalize ${
                                 user.role === 'admin' 
                                 ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                 : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                             }`}>
                                 {user.role === 'admin' && <Shield className="w-3 h-3" />}
                                 {user.role === 'admin' ? 'Admin' : 'Usuário'}
                             </span>

                             {/* Status Badge */}
                             <span className={`px-2.5 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5 capitalize ${
                                 user.status === 'active' 
                                 ? 'bg-[#0BB07B]/10 text-[#0BB07B] border-[#0BB07B]/20' 
                                 : 'bg-red-500/10 text-red-400 border-red-500/20'
                             }`}>
                                 {user.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                                 {user.status === 'active' ? 'Ativo' : 'Bloq.'}
                             </span>
                        </div>
                        
                        {/* Divider */}
                        <div className="h-8 w-px bg-[#2D2E2F] mx-1"></div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 w-28">
                             <button 
                                onClick={() => openEditModal(user)}
                                className="p-2 rounded-[5px] text-[#5E5E5E] hover:text-[#E3E3E3] hover:bg-[#2D2E2F] transition-colors"
                                title="Editar"
                             >
                                <Pencil className="w-4 h-4" strokeWidth={1.5} />
                             </button>

                             {user.uid !== currentUser?.uid && (
                                <>
                                    <button 
                                        onClick={() => handleToggleStatus(user)}
                                        disabled={!!actionLoading}
                                        className={`p-2 rounded-[5px] transition-colors ${
                                            user.status === 'active' 
                                            ? 'text-[#5E5E5E] hover:text-amber-500 hover:bg-amber-500/10' 
                                            : 'text-[#0BB07B] hover:bg-[#0BB07B]/10'
                                        }`}
                                        title={user.status === 'active' ? "Bloquear" : "Ativar"}
                                    >
                                        {actionLoading === user.uid ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <ShieldAlert className="w-4 h-4" strokeWidth={1.5} />
                                        )}
                                    </button>

                                    <button 
                                        onClick={() => handleDelete(user)}
                                        disabled={!!actionLoading}
                                        className="p-2 rounded-[5px] text-[#5E5E5E] hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                                    </button>
                                </>
                             )}
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 pt-24 animate-fadeIn">
            <div className="bg-[#171918] w-full max-w-xl rounded-[5px] shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-[#444746] flex justify-between items-center bg-[#171918]">
                    <h2 className="text-xl font-bold text-[#E3E3E3]">
                        {isEditMode ? 'Editar Usuário' : 'Novo Usuário'}
                    </h2>
                    <button onClick={() => setIsModalOpen(false)} className="text-[#C4C7C5] hover:text-[#E3E3E3] transition-colors">
                        <X className="w-6 h-6" strokeWidth={1} />
                    </button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-6 bg-[#101110]">
                    {modalError && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-[5px] p-4 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" strokeWidth={1} />
                            <p className="text-sm text-red-400">{modalError}</p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider">Nome de Exibição</label>
                        <input 
                            type="text" 
                            value={formData.displayName}
                            onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                            placeholder="Ex: João Silva"
                            className="w-full bg-[#101110] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] focus:border-transparent outline-none placeholder-[#5E5E5E]"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider">E-mail</label>
                        <input 
                            type="email" 
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                            placeholder="email@exemplo.com"
                            disabled={isEditMode}
                            className={`w-full bg-[#101110] border border-[#444746] text-[#E3E3E3] rounded-[5px] px-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] focus:border-transparent outline-none placeholder-[#5E5E5E] ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                            required
                        />
                    </div>

                    {!isEditMode && (
                         <div className="space-y-2">
                            <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider">Senha Provisória</label>
                            <div className="relative">
                                <Key className="absolute left-3 top-3.5 w-5 h-5 text-[#5E5E5E]" />
                                <input 
                                    type="password" 
                                    value={formData.password}
                                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full bg-[#101110] border border-[#444746] text-[#E3E3E3] rounded-[5px] pl-10 pr-4 py-3 text-base focus:ring-2 focus:ring-[#fe6a0f] focus:border-transparent outline-none placeholder-[#5E5E5E]"
                                    required={!isEditMode}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-[#C4C7C5] uppercase tracking-wider">Função</label>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={() => setFormData({...formData, role: 'user'})}
                                className={`py-3 rounded-[5px] text-base font-medium transition-all border ${
                                    formData.role === 'user' 
                                    ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                                    : 'bg-[#101110] border-[#444746] text-[#C4C7C5]'
                                }`}
                            >
                                Usuário Padrão
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData({...formData, role: 'admin'})}
                                className={`py-3 rounded-[5px] text-base font-medium transition-all border ${
                                    formData.role === 'admin' 
                                    ? 'bg-purple-500/10 border-purple-500 text-purple-400' 
                                    : 'bg-[#101110] border-[#444746] text-[#C4C7C5]'
                                }`}
                            >
                                Administrador
                            </button>
                        </div>
                    </div>

                    <div className="pt-6 flex gap-4">
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-5 py-3 rounded-[5px] text-[#C4C7C5] hover:text-[#E3E3E3] hover:bg-[#101110] transition-colors font-medium text-base"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={modalLoading}
                            className="flex-1 px-5 py-3 rounded-[5px] bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white font-medium text-base shadow-lg shadow-[#fe6a0f]/20 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                        >
                            {modalLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};