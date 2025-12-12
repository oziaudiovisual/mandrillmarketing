
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BarChart3, 
  Settings, 
  Share2,
  TrendingUp,
  Heart,
  ExternalLink,
  Users,
  Zap,
  ArrowUpRight,
  Calendar,
  LogOut,
  Loader2,
  Lock,
  Megaphone,
  Plus,
  Trash2,
  Youtube,
  Instagram,
  Music,
  RefreshCw,
  Filter,
  Trophy,
  PlayCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { InstagramConnectModal } from './components/InstagramConnectModal';
import { IntegrationModal } from './components/IntegrationModal';
import { VideosView } from './components/VideosView';
import { DistributionView } from './components/DistributionView';
import { TrafficView } from './components/TrafficView';
import { CalendarView } from './components/CalendarView';
import { AdminUsersView } from './components/AdminUsersView';
import { ChartData, InstagramStats, InstagramMedia, Integration, Platform, VideoAnalytics } from './types';
import { fetchInstagramStats, fetchInstagramMedia } from './services/instagramService';
import { getGlobalSettings, updateGlobalSettings } from './services/settingsService';
import { getIntegrations, deleteIntegration } from './services/integrationService';
import { getYouTubeChannelStats, getTopVideos, getRecentVideos } from './services/youtubeService';
import { useAuth } from './contexts/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { AlertModal } from './components/AlertModal';
import { DeleteIntegrationModal } from './components/DeleteIntegrationModal';

// --- APP COMPONENT ---

export default function App() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'distribution' | 'calendar' | 'traffic' | 'integrations' | 'admin-users'>('dashboard');
  const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);
  
  // Modals State
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false); // Legacy (kept for code compat if needed, but UI hidden)
  const [isIntegrationModalOpen, setIsIntegrationModalOpen] = useState(false);
  
  // Delete Integration Modal State
  const [integrationToDelete, setIntegrationToDelete] = useState<Integration | null>(null);
  const [isDeletingIntegration, setIsDeletingIntegration] = useState(false);

  // Data States
  const [integrationsList, setIntegrationsList] = useState<Integration[]>([]);
  const [instagramMedia, setInstagramMedia] = useState<InstagramMedia[]>([]); // Legacy IG media
  const [selectedDashboardFilter, setSelectedDashboardFilter] = useState<string>('all'); // 'all' or integration ID

  // Advanced Dashboard State
  const [topVideo, setTopVideo] = useState<VideoAnalytics | null>(null);
  const [recentVideos, setRecentVideos] = useState<VideoAnalytics[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Alert State
  const [alertConfig, setAlertConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      type: 'error' | 'success' | 'warning' | 'info';
    }>({
      isOpen: false,
      title: '',
      message: '',
      type: 'success'
  });

  const showAlert = (title: string, message: string, type: 'error' | 'success' | 'warning' | 'info' = 'success') => {
      setAlertConfig({ isOpen: true, title, message, type });
  };

  // Load Initial Data
  useEffect(() => {
    const loadSystemData = async () => {
      if (!user) return;
      
      try {
        // 1. Load Integrations List
        const integrations = await getIntegrations();
        setIntegrationsList(integrations);

        // 2. Load Instagram Media (Legacy support if IG exists in settings)
        const globalSettings = await getGlobalSettings();
        if (globalSettings?.instagram?.accessToken) {
             try {
                const media = await fetchInstagramMedia(globalSettings.instagram.accountId, globalSettings.instagram.accessToken);
                setInstagramMedia(media);
             } catch (e) {
                 console.warn("Could not fetch legacy IG media", e);
             }
        }

      } catch (error) {
        console.error("Error loading system data:", error);
      } finally {
        setIsLoadingIntegrations(false);
      }
    };

    loadSystemData();
  }, [user]);

  // Handle Dashboard Dynamic Data
  useEffect(() => {
      const fetchDashboardData = async () => {
          if (integrationsList.length === 0) return;

          setDashboardLoading(true);

          if (selectedDashboardFilter === 'all') {
              // Aggregate View for 'All'
              // Chart: Compare Channels (Views vs Subs)
              const data = integrationsList.map(integ => {
                  let color = '#EF4444'; // default red (youtube)
                  if (integ.platform === 'instagram') color = '#E1306C';
                  if (integ.platform === 'tiktok') color = '#25F4EE';

                  return {
                    name: integ.name.length > 15 ? integ.name.substring(0,12) + '...' : integ.name,
                    fullName: integ.name,
                    views: integ.stats?.views || 0,
                    subscribers: integ.stats?.subscribers || 0,
                    fill: color
                  };
              });
              setChartData(data);
              setTopVideo(null);
              setRecentVideos([]);
              setDashboardLoading(false);
              return;
          }

          // Specific Channel View
          const selectedInteg = integrationsList.find(i => i.id === selectedDashboardFilter);
          if (!selectedInteg) {
             setDashboardLoading(false);
             return;
          }

          // Handle YouTube Detailed Fetching
          if (selectedInteg.platform === 'youtube' && selectedInteg.config.channelId) {
             
             // Check if we have valid credentials (API Key OR Token)
             const hasCreds = selectedInteg.config.apiKey || selectedInteg.config.accessToken;
             
             if (!hasCreds) {
                 setChartData([]);
                 setDashboardLoading(false);
                 return;
             }

             try {
                 const creds = { apiKey: selectedInteg.config.apiKey, accessToken: selectedInteg.config.accessToken };
                 const [top, recent] = await Promise.all([
                     getTopVideos(selectedInteg.config.channelId, 1, creds),
                     getRecentVideos(selectedInteg.config.channelId, 10, creds)
                 ]);

                 if (top.length > 0) setTopVideo(top[0]);
                 setRecentVideos(recent);
                 
                 // Chart Data: Reverse to show oldest -> newest
                 const cData = [...recent].reverse().map(v => ({
                     name: v.title.length > 10 ? v.title.substring(0, 10) + '...' : v.title,
                     fullTitle: v.title,
                     views: v.viewCount,
                     likes: v.likeCount,
                     date: new Date(v.publishedAt).toLocaleDateString()
                 }));
                 setChartData(cData);
             } catch (error) {
                 console.error("Dashboard fetch error", error);
             }
          } else {
             // Other platforms detailed view not yet implemented
             setChartData([]);
             setTopVideo(null);
             setRecentVideos([]);
          }
          
          setDashboardLoading(false);
      };

      if (!isLoadingIntegrations) {
          fetchDashboardData();
      }
  }, [selectedDashboardFilter, integrationsList, isLoadingIntegrations]);


  const handleRefreshAnalytics = async () => {
    // Refresh logic: Iterate integrations and re-fetch stats from APIs
    const updatedList = [...integrationsList];
    let hasError = false;
    
    // Resolve API Key correctly for both Dev (Vite) and Prod (Server injection)
    const appConfig = (window as any).APP_CONFIG;
    const globalApiKey = (appConfig?.API_KEY && appConfig.API_KEY !== "__API_KEY_PLACEHOLDER__") 
        ? appConfig.API_KEY 
        : process.env.API_KEY;

    for (let i = 0; i < updatedList.length; i++) {
        const integ = updatedList[i];
        
        try {
            if (integ.platform === 'youtube' && integ.config.channelId) {
                 let stats;
                 
                 // Automatic Verification (Client-side Check)
                 const now = Date.now();
                 let useToken = !!integ.config.accessToken;
                 
                 // If we have expiration info and it's expired (with 1 min buffer), don't even try token
                 if (integ.config.expiresAt && now > (integ.config.expiresAt - 60000)) {
                     useToken = false;
                     console.log(`Token expired for ${integ.name}, switching to API Key fallback.`);
                 }

                 try {
                     // Try first with available credentials
                     const creds = { 
                         apiKey: globalApiKey, 
                         accessToken: useToken ? integ.config.accessToken : undefined 
                     };
                     
                     // Skip if no creds
                     if (!creds.apiKey && !creds.accessToken) continue;

                     stats = await getYouTubeChannelStats(integ.config.channelId, creds);
                 } catch (innerError: any) {
                     // Fallback: If token was used but invalid/expired (401), try with Global API Key
                     const isAuthError = innerError.message.includes('401') || 
                                         innerError.message.toLowerCase().includes('invalid authentication') ||
                                         innerError.message.toLowerCase().includes('unauthorized');

                     if (useToken && globalApiKey && isAuthError) {
                         console.warn(`Token rejected for ${integ.name} (401), retrying with API Key...`);
                         // Force use of API Key only
                         stats = await getYouTubeChannelStats(integ.config.channelId, { apiKey: globalApiKey });
                     } else {
                         throw innerError;
                     }
                 }

                 if (stats) {
                     updatedList[i].stats = {
                        subscribers: stats.subscribers,
                        views: stats.views,
                        videoCount: stats.videoCount,
                        lastUpdated: new Date().toISOString()
                    };
                 }
            }
            // Add other platforms refresh here...
        } catch (e) {
            console.error(`Failed to refresh ${integ.name}`, e);
            // Only set error if we couldn't even fallback to API Key (meaning key is missing or quota exceeded)
            if (globalApiKey) {
                console.warn("Fallback failed or key invalid.");
            }
            hasError = true;
        }
    }
    setIntegrationsList(updatedList);
    
    if (hasError) {
        showAlert("Aviso", "Algumas integrações não puderam ser atualizadas. Verifique as credenciais.", "warning");
    } else {
        showAlert("Dados Atualizados", "As estatísticas foram sincronizadas com as plataformas.", "success");
    }
  };

  const confirmDeleteIntegration = async () => {
    if (!integrationToDelete) return;
    
    setIsDeletingIntegration(true);
    try {
        await deleteIntegration(integrationToDelete.id);
        setIntegrationsList(prev => prev.filter(i => i.id !== integrationToDelete.id));
        setIntegrationToDelete(null);
    } catch (e) {
        console.error(e);
        showAlert("Erro", "Falha ao remover integração", "error");
    } finally {
        setIsDeletingIntegration(false);
    }
  };

  // --- DASHBOARD AGGREGATION LOGIC ---
  const dashboardStats = useMemo(() => {
    let totalSubs = 0;
    let totalViews = 0;
    let totalPosts = 0;
    
    // Filter logic
    const activeIntegrations = selectedDashboardFilter === 'all' 
        ? integrationsList 
        : integrationsList.filter(i => i.id === selectedDashboardFilter);

    // Aggregate
    activeIntegrations.forEach(integ => {
        if (integ.stats) {
            totalSubs += integ.stats.subscribers;
            totalViews += integ.stats.views;
            totalPosts += integ.stats.videoCount;
        }
    });

    return {
        totalSubs,
        totalViews,
        totalPosts,
        count: activeIntegrations.length
    };
  }, [integrationsList, selectedDashboardFilter]);

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-[#101110] text-[#E3E3E3] font-sans selection:bg-[#fe6a0f]/20 flex flex-col">
      
      {/* 1. Header Row (Title & User) */}
      <div className="w-full bg-[#101110]">
         <div className="w-[80%] mx-auto flex justify-between items-center py-6">
            <h1 className="font-['Recoleta'] font-medium text-6xl text-[#E3E3E3] tracking-wide">Marketing</h1>
            
            {/* User Profile */}
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#171918] flex items-center justify-center text-sm font-bold text-[#fe6a0f] overflow-hidden hover:border-[#fe6a0f] transition-colors border border-transparent">
                    {user.photoURL ? (
                        <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
                    ) : (
                        user.email?.charAt(0).toUpperCase()
                    )}
                </div>
                <button 
                    onClick={logout} 
                    className="text-[#5E5E5E] hover:text-[#E3E3E3] transition-colors p-2" 
                    title="Sair"
                >
                    <LogOut className="w-5 h-5" strokeWidth={1.5} />
                </button>
            </div>
         </div>
      </div>

      {/* 2. Menu Card */}
      <div className="w-[80%] mx-auto mb-8">
          <nav className="bg-[#171918] rounded-[5px] p-6 flex items-center justify-around gap-4 shadow-xl">
            <NavItem 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
              icon={<LayoutDashboard strokeWidth={1.5} />} 
              label="Visão Geral"
            />
            <NavItem 
              active={activeTab === 'clients'} 
              onClick={() => setActiveTab('clients')} 
              icon={<Users strokeWidth={1.5} />} 
              label="Entregas"
            />
            <NavItem 
              active={activeTab === 'distribution'} 
              onClick={() => setActiveTab('distribution')} 
              icon={<Share2 strokeWidth={1.5} />} 
              label="Distribuição"
            />
             <NavItem 
              active={activeTab === 'calendar'} 
              onClick={() => setActiveTab('calendar')} 
              icon={<Calendar strokeWidth={1.5} />} 
              label="Calendário"
            />
            <NavItem 
              active={activeTab === 'traffic'} 
              onClick={() => setActiveTab('traffic')} 
              icon={<Megaphone strokeWidth={1.5} />} 
              label="Tráfego"
            />
            
            {isAdmin && (
                <>
                    <NavItem 
                        active={activeTab === 'integrations'} 
                        onClick={() => setActiveTab('integrations')} 
                        icon={<Settings strokeWidth={1.5} />} 
                        label="Integrações"
                    />

                    <NavItem 
                        active={activeTab === 'admin-users'} 
                        onClick={() => setActiveTab('admin-users')} 
                        icon={<Lock strokeWidth={1.5} />} 
                        label="Admin"
                    />
                </>
            )}
          </nav>
      </div>

      {/* 3. Main Content Row */}
      <main className="flex-1 w-[80%] mx-auto pb-12">
        
        {isLoadingIntegrations && (
             <div className="flex flex-col items-center justify-center h-64 text-[#C4C7C5] gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-[#fe6a0f]" strokeWidth={1} />
                <p className="text-lg">Carregando...</p>
             </div>
        )}

        {!isLoadingIntegrations && activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
              
              {/* Header & Controls */}
              <div className="flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3] tracking-tight">Visão Geral</h1>
                  <p className="text-[#C4C7C5] mt-2 text-base">Analytics unificado de todas as plataformas.</p>
                </div>
                
                {integrationsList.length > 0 && (
                    <div className="flex gap-3">
                        {/* Source Filter */}
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Filter className="h-4 w-4 text-[#5E5E5E]" />
                            </div>
                            <select 
                                value={selectedDashboardFilter}
                                onChange={(e) => setSelectedDashboardFilter(e.target.value)}
                                className="bg-[#171918] border border-[#444746] text-[#E3E3E3] text-sm rounded-[5px] pl-10 pr-8 py-2.5 focus:border-[#fe6a0f] outline-none appearance-none cursor-pointer hover:bg-[#1E1F20]"
                            >
                                <option value="all">Todas as Fontes ({integrationsList.length})</option>
                                <option disabled>──────────</option>
                                {integrationsList.map(integ => (
                                    <option key={integ.id} value={integ.id}>{integ.name} ({integ.platform})</option>
                                ))}
                            </select>
                        </div>

                        {/* Refresh Button */}
                        <button 
                            onClick={handleRefreshAnalytics}
                            className="bg-[#171918] border border-[#444746] text-[#C4C7C5] hover:text-[#E3E3E3] px-3 py-2 rounded-[5px] flex items-center gap-2 hover:bg-[#1E1F20] transition-colors"
                            title="Atualizar Dados"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                )}
              </div>

              {integrationsList.length === 0 ? (
                 <div className="bg-[#171918] rounded-[5px] p-8 text-center">
                    <div className="bg-[#101110] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <TrendingUp className="w-10 h-10 text-[#fe6a0f]" strokeWidth={1} />
                    </div>
                    <h2 className="text-2xl font-bold text-[#E3E3E3] mb-3">Conectar Fontes de Dados</h2>
                    <p className="text-[#C4C7C5] text-base mb-8 max-w-lg mx-auto">
                        Adicione canais do YouTube e outras redes na aba Integrações para visualizar o desempenho aqui.
                    </p>
                    {isAdmin && (
                        <button 
                          onClick={() => setActiveTab('integrations')}
                          className="px-8 py-4 bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white rounded-[5px] text-base font-medium transition-all flex items-center gap-2 mx-auto"
                        >
                          Configurar Integrações
                          <ArrowUpRight className="w-5 h-5" strokeWidth={1} />
                        </button>
                    )}
                 </div>
              ) : (
                <>
                  {/* KPI Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <KPICard 
                      title="Audiência Total"
                      value={dashboardStats.totalSubs.toLocaleString('pt-BR')}
                      subValue={selectedDashboardFilter === 'all' ? 'Soma de Inscritos/Seguidores' : 'Inscritos'}
                      icon={<Users className="w-6 h-6 text-[#fe6a0f]" strokeWidth={1} />}
                      trend="Acumulado"
                      trendUp={true}
                    />
                    <KPICard 
                      title="Visualizações Totais"
                      value={dashboardStats.totalViews.toLocaleString('pt-BR')}
                      subValue="Todas as plataformas"
                      icon={<TrendingUp className="w-6 h-6 text-[#fe6a0f]" strokeWidth={1} />}
                      trend="Vitalício"
                      trendUp={true}
                    />
                    <KPICard 
                      title="Volume de Conteúdo"
                      value={dashboardStats.totalPosts.toLocaleString('pt-BR')}
                      subValue="Vídeos/Posts Publicados"
                      icon={<BarChart3 className="w-6 h-6 text-[#fe6a0f]" strokeWidth={1} />}
                      trend="Biblioteca"
                      trendUp={true}
                    />
                  </div>

                  {dashboardLoading ? (
                      <div className="h-64 flex items-center justify-center bg-[#171918] rounded-[5px] border border-[#2D2E2F]">
                          <Loader2 className="w-8 h-8 animate-spin text-[#fe6a0f]" />
                      </div>
                  ) : (
                      <>
                        {/* CHART & HIGHLIGHT ROW */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Left: Chart */}
                            <div className="lg:col-span-2 bg-[#171918] rounded-[5px] p-6 border border-[#2D2E2F]">
                                <h3 className="text-lg font-medium text-[#E3E3E3] mb-6 flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5 text-[#fe6a0f]" />
                                    {selectedDashboardFilter === 'all' ? 'Comparativo de Canais' : 'Performance Recente (Views)'}
                                </h3>
                                <div className="h-[300px] w-full">
                                    {selectedDashboardFilter === 'all' ? (
                                        // Comparison Chart
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#2D2E2F" vertical={false} />
                                                <XAxis dataKey="name" stroke="#5E5E5E" tick={{fill: '#5E5E5E'}} axisLine={false} tickLine={false} />
                                                <YAxis stroke="#5E5E5E" tick={{fill: '#5E5E5E'}} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#171918', borderColor: '#444746', color: '#E3E3E3' }}
                                                    itemStyle={{ color: '#E3E3E3' }}
                                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                                />
                                                <Legend />
                                                <Bar dataKey="views" name="Visualizações" fill="#fe6a0f" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        // Specific Channel Performance (Area)
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#2D2E2F" vertical={false} />
                                                <XAxis dataKey="name" stroke="#5E5E5E" tick={{fill: '#5E5E5E'}} axisLine={false} tickLine={false} />
                                                <YAxis stroke="#5E5E5E" tick={{fill: '#5E5E5E'}} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    contentStyle={{ backgroundColor: '#171918', borderColor: '#444746', color: '#E3E3E3' }}
                                                    labelStyle={{ color: '#C4C7C5' }}
                                                />
                                                <Bar dataKey="views" fill="#fe6a0f" radius={[4, 4, 0, 0]} name="Visualizações" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    )}
                                </div>
                            </div>

                            {/* Right: Top Performer OR Channel List */}
                            {selectedDashboardFilter === 'all' ? (
                                // Show Connected Integrations List
                                <div className="bg-[#171918] rounded-[5px] p-6 border border-[#2D2E2F]">
                                    <h3 className="text-lg font-medium text-[#E3E3E3] mb-4">Fontes Conectadas</h3>
                                    <div className="space-y-4">
                                        {integrationsList.map(integ => (
                                            <div key={integ.id} className="flex items-center justify-between p-3 bg-[#101110] rounded-[5px] border border-[#2D2E2F]">
                                                <div className="flex items-center gap-3">
                                                        {integ.platform === 'youtube' && <Youtube className="w-5 h-5 text-red-500" />}
                                                        {integ.platform === 'instagram' && <Instagram className="w-5 h-5 text-pink-500" />}
                                                        {integ.platform === 'tiktok' && <Music className="w-5 h-5 text-cyan-400" />}
                                                        {integ.platform !== 'youtube' && integ.platform !== 'instagram' && integ.platform !== 'tiktok' && <Settings className="w-5 h-5 text-[#C4C7C5]" />}
                                                        
                                                        <div>
                                                            <div className="text-sm font-medium text-[#E3E3E3]">{integ.name}</div>
                                                            <div className="text-xs text-[#5E5E5E]">{(integ.stats?.subscribers || 0).toLocaleString()} subs</div>
                                                        </div>
                                                </div>
                                                <div className="text-xs text-[#0BB07B]">{integ.platform}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : topVideo ? (
                                // Show Top Performer Card
                                <div className="bg-[#171918] rounded-[5px] border border-[#fe6a0f]/30 overflow-hidden relative group">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-[#fe6a0f]"></div>
                                    <div className="p-6">
                                        <div className="flex items-center gap-2 mb-4 text-[#fe6a0f]">
                                            <Trophy className="w-5 h-5" />
                                            <span className="text-xs font-bold uppercase tracking-wider">Top Performance</span>
                                        </div>
                                        
                                        <div className="aspect-video w-full bg-black rounded-[5px] overflow-hidden mb-4 relative">
                                            <img src={topVideo.thumbnail} alt={topVideo.title} className="w-full h-full object-cover opacity-80" />
                                            <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                                                {new Date(topVideo.publishedAt).toLocaleDateString()}
                                            </div>
                                        </div>

                                        <h4 className="text-lg font-medium text-[#E3E3E3] line-clamp-2 mb-2 leading-snug">
                                            {topVideo.title}
                                        </h4>
                                        
                                        <div className="flex justify-between items-end mt-4 pt-4 border-t border-[#2D2E2F]">
                                            <div>
                                                <div className="text-xs text-[#5E5E5E] uppercase tracking-wider mb-1">Visualizações</div>
                                                <div className="text-2xl font-bold text-[#E3E3E3]">{topVideo.viewCount.toLocaleString()}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs text-[#5E5E5E] uppercase tracking-wider mb-1">Engajamento</div>
                                                <div className="flex gap-3 text-sm text-[#C4C7C5]">
                                                    <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> {topVideo.likeCount}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <a href={topVideo.url} target="_blank" rel="noopener noreferrer" className="mt-4 w-full py-2 bg-[#101110] hover:bg-[#2D2E2F] text-[#C4C7C5] rounded-[5px] text-sm flex items-center justify-center gap-2 transition-colors">
                                            <PlayCircle className="w-4 h-4" /> Ver no YouTube
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-[#171918] rounded-[5px] p-6 border border-[#2D2E2F] flex flex-col items-center justify-center text-center">
                                    <Loader2 className="w-6 h-6 text-[#fe6a0f] animate-spin mb-2" />
                                    <p className="text-[#5E5E5E] text-sm">Buscando destaque...</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Videos Table (Only if Specific Channel) */}
                        {selectedDashboardFilter !== 'all' && recentVideos.length > 0 && (
                            <div className="bg-[#171918] rounded-[5px] border border-[#2D2E2F] overflow-hidden">
                                <div className="p-6 border-b border-[#2D2E2F]">
                                    <h3 className="text-lg font-medium text-[#E3E3E3]">Uploads Recentes</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-[#101110] text-[#5E5E5E] text-xs uppercase tracking-wider">
                                                <th className="p-4">Vídeo</th>
                                                <th className="p-4 text-center">Data</th>
                                                <th className="p-4 text-right">Views</th>
                                                <th className="p-4 text-right">Likes</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2D2E2F]">
                                            {recentVideos.map(video => (
                                                <tr key={video.id} className="hover:bg-[#1E1F20] transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-12 h-8 bg-black rounded overflow-hidden shrink-0">
                                                                <img src={video.thumbnail} className="w-full h-full object-cover" alt="" />
                                                            </div>
                                                            <a href={video.url} target="_blank" rel="noreferrer" className="text-sm text-[#E3E3E3] font-medium hover:text-[#fe6a0f] truncate max-w-[200px]">
                                                                {video.title}
                                                            </a>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-center text-sm text-[#C4C7C5]">
                                                        {new Date(video.publishedAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="p-4 text-right text-sm font-medium text-[#E3E3E3]">
                                                        {video.viewCount.toLocaleString()}
                                                    </td>
                                                    <td className="p-4 text-right text-sm text-[#C4C7C5]">
                                                        {video.likeCount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                      </>
                  )}
                  
                </>
              )}
            </div>
          )}

          {!isLoadingIntegrations && activeTab === 'clients' && (
             <VideosView />
          )}

          {!isLoadingIntegrations && activeTab === 'distribution' && (
            <DistributionView />
          )}

          {!isLoadingIntegrations && activeTab === 'calendar' && (
            <CalendarView />
          )}

          {!isLoadingIntegrations && activeTab === 'traffic' && (
            <TrafficView />
          )}

          {!isLoadingIntegrations && activeTab === 'admin-users' && isAdmin && (
            <AdminUsersView />
          )}

          {!isLoadingIntegrations && activeTab === 'integrations' && isAdmin && (
            <div className="w-full space-y-8 animate-fadeIn">
               <div className="flex justify-between items-start">
                  <div>
                      <h1 className="text-3xl font-['Recoleta'] font-medium text-[#E3E3E3]">Integrações Globais</h1>
                      <p className="text-[#C4C7C5] text-base mt-2">Gerencie as conexões de Analytics e Distribuição.</p>
                  </div>
                  <button 
                     onClick={() => setIsIntegrationModalOpen(true)}
                     className="bg-[#fe6a0f] hover:bg-[#fe6a0f]/80 text-white px-5 py-3 rounded-[5px] font-medium flex items-center gap-2 shadow-lg shadow-[#fe6a0f]/20 transition-all"
                  >
                      <Plus className="w-5 h-5" />
                      Nova Integração
                  </button>
               </div>
               
               {integrationsList.length === 0 ? (
                   <div className="text-center text-[#C4C7C5] bg-[#171918] p-12 rounded-[5px] border border-[#2D2E2F]">
                       <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                       <h3 className="text-xl font-medium text-[#E3E3E3] mb-2">Nenhuma integração ativa</h3>
                       <p>Adicione um canal do YouTube ou conta social para começar.</p>
                   </div>
               ) : (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {integrationsList.map((integ) => (
                           <div key={integ.id} className="bg-[#171918] border border-[#444746] rounded-[5px] p-6 hover:border-[#5E5E5E] transition-colors group relative">
                               <div className="flex justify-between items-start mb-4">
                                   <div className="p-3 bg-[#101110] rounded-[5px] border border-[#2D2E2F]">
                                       {integ.platform === 'youtube' && <Youtube className="w-6 h-6 text-red-500" />}
                                       {integ.platform === 'instagram' && <Instagram className="w-6 h-6 text-pink-500" />}
                                       {integ.platform === 'tiktok' && <Music className="w-6 h-6 text-cyan-400" />}
                                   </div>
                                   <button 
                                      onClick={() => setIntegrationToDelete(integ)}
                                      className="text-[#5E5E5E] hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remover"
                                   >
                                       <Trash2 className="w-4 h-4" />
                                   </button>
                               </div>
                               
                               <h3 className="text-lg font-bold text-[#E3E3E3] mb-1">{integ.name}</h3>
                               <p className="text-xs text-[#5E5E5E] uppercase tracking-wider font-semibold mb-4">{integ.platform}</p>
                               
                               <div className="grid grid-cols-2 gap-4 border-t border-[#2D2E2F] pt-4">
                                   <div>
                                       <div className="text-xs text-[#C4C7C5] mb-1">Inscritos/Seguidores</div>
                                       <div className="text-lg font-medium text-[#E3E3E3]">{(integ.stats?.subscribers || 0).toLocaleString()}</div>
                                   </div>
                                   <div>
                                       <div className="text-xs text-[#C4C7C5] mb-1">Conteúdos</div>
                                       <div className="text-lg font-medium text-[#E3E3E3]">{(integ.stats?.videoCount || 0).toLocaleString()}</div>
                                   </div>
                               </div>

                               <div className="mt-4 pt-3 border-t border-[#2D2E2F] flex items-center justify-between text-xs">
                                   <span className="text-[#0BB07B] flex items-center gap-1">
                                       <div className="w-2 h-2 rounded-full bg-[#0BB07B]"></div> Conectado
                                   </span>
                                   {integ.config.channelId && (
                                    <span className="text-[#5E5E5E]">
                                        ID: {integ.config.channelId?.slice(0,6)}...
                                    </span>
                                   )}
                               </div>
                           </div>
                       ))}
                   </div>
               )}
            </div>
          )}
      </main>

      {/* Integration Modal */}
      <IntegrationModal 
        isOpen={isIntegrationModalOpen}
        onClose={() => setIsIntegrationModalOpen(false)}
        onSuccess={(newInteg) => setIntegrationsList(prev => [...prev, newInteg])}
      />

      {/* Alert Modal */}
      <AlertModal 
        isOpen={alertConfig.isOpen}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
      />
      
      {/* Delete Integration Confirmation Modal */}
      <DeleteIntegrationModal
        isOpen={!!integrationToDelete}
        onClose={() => setIntegrationToDelete(null)}
        onConfirm={confirmDeleteIntegration}
        title={integrationToDelete?.name || ''}
        isDeleting={isDeletingIntegration}
      />
    </div>
  );
}

// --- SUB COMPONENTS ---

const KPICard: React.FC<{title: string, value: string, subValue: string, icon: React.ReactNode, trend?: string, trendUp?: boolean}> = ({title, value, subValue, icon, trend, trendUp}) => (
    <div className="bg-[#171918] rounded-[5px] p-6 hover:bg-[#1E1F20] transition-colors group">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-[#101110] rounded-[5px] border border-[#444746] group-hover:border-[#fe6a0f] transition-colors">
                {icon}
            </div>
            {trend && (
                <span className={`text-sm font-medium px-2 py-1 rounded-[5px] ${trendUp ? 'text-[#0BB07B] bg-[#0BB07B]/10' : 'text-red-400 bg-red-500/10'}`}>
                    {trend}
                </span>
            )}
        </div>
        <div className="text-4xl font-medium text-[#E3E3E3] mb-2 tracking-tight">{value}</div>
        <div className="flex justify-between items-end">
            <div className="text-base text-[#C4C7C5] font-medium">{title}</div>
            <div className="text-sm text-[#5E5E5E]">{subValue}</div>
        </div>
    </div>
);

interface NavItemProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const NavItem: React.FC<NavItemProps> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    title={label}
    className="flex flex-col items-center justify-center gap-3 p-2 group"
  >
    <div className="relative w-14 h-14 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
        <svg 
            viewBox="0 0 100 100" 
            className="absolute inset-0 w-full h-full"
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
        >
            <path 
                d="M50 4 L89.8 27 V73 L50 96 L10.2 73 V27 Z" 
                fill={active ? "rgba(254, 106, 15, 0.1)" : "#101110"}
                stroke={active ? "#fe6a0f" : "transparent"}
                strokeWidth={active ? "2" : "0"}
                strokeLinejoin="round"
                className="transition-all duration-300"
            />
        </svg>

        <div className={`relative z-10 transition-colors duration-300 ${active ? 'text-[#fe6a0f]' : 'text-[#5E5E5E] group-hover:text-[#C4C7C5]'}`}>
            {React.cloneElement(icon as React.ReactElement<any>, { 
                className: "w-6 h-6",
                strokeWidth: active ? 2 : 1.5
            })}
        </div>
    </div>
    
    <span className={`text-sm font-['Outfit'] font-medium tracking-wide transition-colors ${active ? 'text-[#E3E3E3]' : 'text-[#5E5E5E] group-hover:text-[#C4C7C5]'}`}>
        {label}
    </span>
  </button>
);
