import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Bell, Beaker, Database } from 'lucide-react';
import { supabase } from './lib/supabase';
import {
  ActiveChat,
  AgentName,
  Client,
  FeedItem,
  Hook,
  Seller,
  Source,
  ZoomCall,
} from './types';
import { Sidebar } from './components/Sidebar';
import { ParserModal } from './components/ParserModal';
import { PipelineGrid } from './components/Pipeline';
import { GlassCard } from './components/GlassCard';
import { LiveFeed } from './components/LiveFeed';
import { CampaignGoalWidget } from './components/CampaignGoalWidget';
import { DrillDownTable } from './components/DrillDownTable';
import { ChatInterface } from './components/ChatInterface';
import { TelegramSummaryModal } from './components/TelegramSummaryModal';
import { KnowledgeBaseEditor } from './components/KnowledgeBaseEditor';
import { AddHookModal } from './components/AddHookModal';
import { HealthDashboard } from './components/HealthDashboard';
import { SmartFunnelControl } from './components/SmartFunnelControl';
import { ProcessControlPanel } from './components/ProcessControlPanel';
import { SystemLogsPanel } from './components/SystemLogsPanel';

const DEFAULT_SOURCES: Source[] = [
  { id: '1', platform: 'TG_CHAT', name: 'Telegram Communities', total: 0, processed: 0, active: true },
  { id: '2', platform: 'VK', name: 'VK Communities', total: 0, processed: 0, active: true },
  { id: '3', platform: 'INSTAGRAM', name: 'Instagram Leads', total: 0, processed: 0, active: false },
  { id: '4', platform: 'WB_API', name: 'Wildberries Suppliers', total: 0, processed: 0, active: true },
];

const DEFAULT_HOOKS: Hook[] = [
  { id: '1', variant: 'A', name: 'Direct Pitch', text: 'Saw you are scaling lead gen. We built a control tower...', conversion: 0, active: true },
  { id: '2', variant: 'B', name: 'Value First', text: 'Here is a breakdown of 500 leads we processed last week...', conversion: 0, active: true },
];

const DEFAULT_ZOOMS: ZoomCall[] = [];

function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'sources' | 'hooks' | 'chats' | 'zooms'>('dashboard');
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClientId, setActiveClientId] = useState<string>('');

  const [isParserModalOpen, setIsParserModalOpen] = useState(false);
  const [isKBEditorOpen, setIsKBEditorOpen] = useState(false);
  const [isAddHookModalOpen, setIsAddHookModalOpen] = useState(false);
  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientInitials, setNewClientInitials] = useState('');
  const [addClientLoading, setAddClientLoading] = useState(false);
  const [sandboxMode, setSandboxMode] = useState<boolean>(() => localStorage.getItem('sandboxMode') === 'true');

  const [activeChatModal, setActiveChatModal] = useState<ActiveChat | null>(null);
  const [telegramSummaryData, setTelegramSummaryData] = useState<ZoomCall | null>(null);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chats, setChats] = useState<ActiveChat[]>([]);
  const [hooks, setHooks] = useState<Hook[]>(DEFAULT_HOOKS);
  const [sources, setSources] = useState<Source[]>(DEFAULT_SOURCES);
  const [zooms, setZooms] = useState<ZoomCall[]>(DEFAULT_ZOOMS);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [lastWorkerHeartbeatAt, setLastWorkerHeartbeatAt] = useState<string | null>(null);

  const currentClient = useMemo(
    () => clients.find((client) => client.id === activeClientId) || clients[0],
    [clients, activeClientId]
  );

  const fetchProjects = useCallback(async () => {
    if (sandboxMode) {
      const sandboxClient: Client = {
        id: 'sandbox',
        name: 'Sandbox Client',
        initials: 'SB',
        activeCampaigns: 3,
        leadsToday: 12,
        status: 'active',
        goal: 100,
        achieved: 12,
      };
      setClients([sandboxClient]);
      setActiveClientId('sandbox');
      return;
    }

    const { data, error } = await (supabase.from('projects') as any).select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching projects:', error);
      return;
    }

    const mappedClients: Client[] = ((data as any[]) || []).map((project) => ({
      id: project.id,
      name: project.name,
      initials: project.initials,
      activeCampaigns: 3,
      leadsToday: 12,
      status: project.status,
      goal: project.goal || 0,
      achieved: project.achieved || 0,
    }));

    setClients(mappedClients);
    if (mappedClients.length > 0) {
      setActiveClientId((prev) => prev || mappedClients[0].id);
    }
  }, [sandboxMode]);

  const fetchSellers = useCallback(async () => {
    if (sandboxMode) {
      setSellers([
        { id: '1', brand_name: 'TechCorp', status: 'NEW', revenue_monthly: 5000000, created_at: new Date().toISOString(), source: 'WB_API' },
        { id: '2', brand_name: 'SoftServe', status: 'QUALIFIED', revenue_monthly: 3200000, created_at: new Date().toISOString(), source: 'WB_API', variant: 'A' },
        { id: '3', brand_name: 'Innovate', status: 'CONTACTED', revenue_monthly: 1500000, created_at: new Date().toISOString(), source: 'TG_CHAT', variant: 'B' },
      ]);
      return;
    }

    setLoadingSellers(true);
    try {
      let query = (supabase.from('sellers') as any).select('*').order('created_at', { ascending: false }).limit(200);
      if (activeClientId) {
        query = query.eq('project_id', activeClientId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching sellers:', error);
        return;
      }
      setSellers((data as Seller[]) || []);
    } catch (error) {
      console.error('Error in fetchSellers:', error);
    } finally {
      setLoadingSellers(false);
    }
  }, [sandboxMode, activeClientId]);

  const fetchHooks = useCallback(async () => {
    if (sandboxMode) {
      setHooks(DEFAULT_HOOKS);
      return;
    }

    const { data, error } = await (supabase.from('hooks') as any).select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching hooks:', error);
      return;
    }

    const mappedHooks: Hook[] = ((data as any[]) || []).map((hook) => ({
      id: String(hook.id),
      title: hook.title,
      content: hook.content,
      category: hook.category,
      conversion_rate: hook.conversion_rate,
      created_at: hook.created_at,
      name: hook.title,
      text: hook.content,
      variant: (hook.variant as 'A' | 'B') || 'A',
      active: true,
      conversion: hook.conversion_rate || 0,
    }));

    setHooks(mappedHooks.length > 0 ? mappedHooks : DEFAULT_HOOKS);
  }, [sandboxMode]);

  const fetchZooms = useCallback(async () => {
    if (sandboxMode) {
      setZooms([
        { id: '1', clientName: 'Sandbox Lead', time: '15:00', date: 'Today', status: 'confirmed' },
      ]);
      return;
    }
    try {
      const { data, error } = await (supabase.from('zoom_calls') as any)
        .select('*')
        .order('scheduled_at', { ascending: true })
        .limit(20);
      if (error) {
        // Таблица zoom_calls может ещё не существовать — тихо игнорируем
        if ((error as any).code !== 'PGRST204' && (error as any).code !== '42P01') {
          console.warn('fetchZooms error:', error.message);
        }
        return;
      }
      const mapped: ZoomCall[] = ((data as any[]) || []).map((z) => ({
        id: String(z.id),
        clientName: z.client_name || z.brand_name || 'Неизвестно',
        time: z.scheduled_at
          ? new Date(z.scheduled_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          : 'TBD',
        date: z.scheduled_at
          ? new Date(z.scheduled_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
          : 'TBD',
        status: z.status || 'pending',
      }));
      setZooms(mapped);
    } catch (e) {
      console.warn('fetchZooms exception:', e);
    }
  }, [sandboxMode]);

  const refreshFromRealtime = useCallback(async () => {
    await Promise.all([fetchSellers(), fetchHooks(), fetchZooms()]);
  }, [fetchSellers, fetchHooks, fetchZooms]);

  const fetchWorkerHeartbeat = useCallback(async () => {
    if (sandboxMode) {
      setLastWorkerHeartbeatAt(new Date().toISOString());
      return;
    }

    try {
      const { data, error } = await (supabase.from('system_logs') as any)
        .select('created_at')
        .eq('source', 'worker_heartbeat')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching worker heartbeat:', error);
        return;
      }

      setLastWorkerHeartbeatAt(data?.[0]?.created_at || null);
    } catch (e) {
      console.error('Worker heartbeat fetch failed:', e);
    }
  }, [sandboxMode]);

  const workerOnline = useMemo(() => {
    if (sandboxMode) return true;
    if (!lastWorkerHeartbeatAt) return false;
    return Date.now() - new Date(lastWorkerHeartbeatAt).getTime() <= 120000;
  }, [lastWorkerHeartbeatAt, sandboxMode]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  useEffect(() => {
    fetchHooks();
  }, [fetchHooks]);

  useEffect(() => {
    fetchZooms();
  }, [fetchZooms]);

  useEffect(() => {
    fetchWorkerHeartbeat();
  }, [fetchWorkerHeartbeat]);

  useEffect(() => {
    if (sandboxMode) {
      return;
    }

    const channel = supabase
      .channel('realtime_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sellers' }, () => {
        fetchSellers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hooks' }, () => {
        fetchHooks();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parser_jobs' }, () => {
        fetchSellers();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zoom_calls' }, () => {
        fetchZooms();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs', filter: 'source=eq.worker_heartbeat' }, () => {
        fetchWorkerHeartbeat();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sandboxMode, fetchSellers, fetchHooks]);

  const stageStats = useMemo(() => {
    const qualifiedCount = sellers.filter((seller) => seller.status === 'QUALIFIED').length;
    const repliedCount = sellers.filter((seller) => seller.status === 'REPLIED').length;
    const convertedCount = sellers.filter((seller) => seller.status === 'CONVERTED').length;
    return { qualifiedCount, repliedCount, convertedCount };
  }, [sellers]);

  useEffect(() => {
    if (sellers.length === 0 && !loadingSellers) {
      setChats([]);
      setSources((prev) => prev.map((source) => ({ ...source, total: 0, processed: 0 })));
      return;
    }

    const sourceCounts = sellers.reduce((acc, seller) => {
      const sourceStr = (seller.source || '').toUpperCase();
      const sourceKey: Source['platform'] =
        sourceStr === 'WB_API' || sourceStr.includes('WB')
          ? 'WB_API'
          : sourceStr === 'TG_CHAT' || sourceStr.includes('TG') || sourceStr.includes('TELEGRAM')
            ? 'TG_CHAT'
            : sourceStr === 'VK' || sourceStr.includes('VK')
              ? 'VK'
              : sourceStr === 'INSTAGRAM' || sourceStr.includes('IG') || sourceStr.includes('INSTA')
                ? 'INSTAGRAM'
                : 'WB_API';

      if (!acc[sourceKey]) {
        acc[sourceKey] = { total: 0, processed: 0 };
      }
      acc[sourceKey].total += 1;
      if (seller.status !== 'NEW') {
        acc[sourceKey].processed += 1;
      }
      return acc;
    }, {} as Record<string, { total: number; processed: number }>);

    setSources((prev) =>
      prev.map((source) => ({
        ...source,
        total: sourceCounts[source.platform]?.total || 0,
        processed: sourceCounts[source.platform]?.processed || 0,
      }))
    );

    const repliedLeads = sellers
      .filter((seller) => seller.status === 'REPLIED')
      .slice(0, 12)
      .map((seller, index) => ({
        id: seller.id,
        clientName: seller.brand_name,
        progress: Math.max(35, 90 - index * 5),
        painPoints: ((seller as any).pain_points as string[] | undefined) || [],
        status: (index % 3 === 0 ? 'hot' : index % 2 === 0 ? 'warm' : 'cold') as ActiveChat['status'],
      }));
    setChats(repliedLeads);
  }, [sellers, loadingSellers]);

  const toggleProjectStatus = async () => {
    if (!currentClient || !currentClient.id || sandboxMode) {
      return;
    }

    const newStatus = currentClient.status === 'active' ? 'paused' : 'active';
    setClients((prev) => prev.map((client) => (client.id === activeClientId ? { ...client, status: newStatus } : client)));

    const { error } = await (supabase.from('projects') as any).update({ status: newStatus }).eq('id', currentClient.id);
    if (error) {
      console.error('Error updating project status:', error);
      setClients((prev) => prev.map((client) => (client.id === activeClientId ? { ...client, status: currentClient.status } : client)));
      return;
    }

    if (newStatus === 'active') {
      try {
        const activeProjectId = currentClient.id;
        const { data: existing } = await (supabase.from('parser_jobs') as any)
          .select('id,status')
          .eq('project_id', activeProjectId)
          .in('status', ['pending', 'processing'])
          .limit(1);

        if (!existing || existing.length === 0) {
          const kickoffQuery = currentClient.name || 'wildberries sellers';
          const { error: kickoffError } = await (supabase.from('parser_jobs') as any).insert({
            project_id: activeProjectId,
            query: kickoffQuery,
            status: 'pending',
            min_revenue: 0,
            max_results: 50,
            category: 'auto',
          });

          if (kickoffError) {
            console.error('Error creating kickoff parser job:', kickoffError);
          } else {
            const eventItem: FeedItem = {
              id: `feed-kickoff-${Date.now()}`,
              agent: 'Artem',
              action: 'Parsing Started',
              target: `${currentClient.name} auto kickoff`,
              time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              status: 'success',
            };
            setFeed((prev) => [eventItem, ...prev].slice(0, 50));
          }
        }
      } catch (kickoffException) {
        console.error('Active kickoff failed:', kickoffException);
      }
    }
  };

  const handleSearchClick = () => {
    setActiveView('sources');
  };

  const handleBellClick = async () => {
    try {
      const { data, error } = await (supabase.from('account_health') as any)
        .select('service_name,status,last_check,updated_at,error_message')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (error) throw error;

      const lines = ((data as any[]) || []).map((row) => `${row.service_name}: ${row.status}`);
      alert(lines.length > 0 ? `Статус сервисов:\n${lines.join('\n')}` : 'Нет уведомлений');
    } catch (e) {
      console.error('Notifications load failed:', e);
      alert('Не удалось загрузить уведомления');
    }
  };

  const handleSandboxJobCreated = (job: { id: string; query: string; category: string; leadsCount: number }) => {
    const newSource: Source = {
      id: job.id,
      name: `${job.category} - ${job.query}`,
      platform: 'WB_API',
      total: job.leadsCount,
      processed: 0,
      active: true,
    };
    setSources((prev) => [newSource, ...prev]);

    const revenues = [500000, 1200000, 2500000, 4000000, 6500000, 8000000, 12000000, 15000000];
    const mockSellers: Seller[] = Array.from({ length: job.leadsCount }).map((_, idx) => ({
      id: `${job.id}-seller-${idx}`,
      brand_name: `${job.category} Brand ${idx + 1}`,
      source: 'WB_API',
      status: 'NEW',
      created_at: new Date().toISOString(),
      revenue_monthly: revenues[Math.floor(Math.random() * revenues.length)],
    }));

    setSellers((prev) => [...mockSellers, ...prev]);

    const newFeedItem: FeedItem = {
      id: `feed-${Date.now()}`,
      agent: 'Artem' as AgentName,
      action: 'Parsing Completed',
      target: `${job.category} - ${job.leadsCount} leads`,
      time: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      status: 'success',
    };
    setFeed((prev) => [newFeedItem, ...prev].slice(0, 50));
  };

  return (
    <div className="min-h-screen bg-[#030712] text-white overflow-hidden selection:bg-neon-purple/30 font-sans relative flex">
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30%] h-[30%] bg-emerald-900/10 rounded-full blur-[100px]" />
      </div>

      <ParserModal
        isOpen={isParserModalOpen}
        onClose={() => setIsParserModalOpen(false)}
        projectId={activeClientId || undefined}
        sandboxMode={sandboxMode}
        onSandboxJobCreated={handleSandboxJobCreated}
      />

      <div className="relative z-20 hidden md:flex flex-col h-screen p-3 pr-0">
        <Sidebar
          clients={clients}
          activeClientId={activeClientId}
          onClientSelect={setActiveClientId}
          onAddClient={() => setIsAddClientOpen(true)}
          onStartParsing={() => setIsParserModalOpen(true)}
        />
      </div>

      <div className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden p-3 md:p-5 gap-3">
        <header className="flex justify-between items-center shrink-0 z-20">
          <div>
            <h1 className="text-2xl font-bold tracking-tighter text-white">
              Control Tower <span className="text-neon-purple">.</span>
            </h1>
            <p className="text-slate-500 text-xs font-mono mt-1">DASHBOARD // {currentClient ? currentClient.name : 'Loading...'}</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const nextValue = !sandboxMode;
                setSandboxMode(nextValue);
                localStorage.setItem('sandboxMode', String(nextValue));
                refreshFromRealtime();
              }}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${sandboxMode
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-800/50 text-slate-500 border border-slate-700/50 hover:border-slate-600'}
              `}
            >
              <Beaker size={14} />
              {sandboxMode ? 'ПЕСОЧНИЦА' : 'Режим песочницы'}
            </button>

            <button
              onClick={() => setIsKBEditorOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-neon-purple to-purple-600 text-white rounded-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all text-sm font-medium"
            >
              <Database size={16} />
              Инфо о клиенте
            </button>

            <button
              onClick={toggleProjectStatus}
              className={`group relative px-5 py-2 rounded-full border flex items-center gap-3 transition-all duration-300 ${currentClient?.status === 'active'
                ? 'bg-neon-green/10 border-neon-green/50 text-neon-green shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-500'
                }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${currentClient?.status === 'active' ? 'bg-neon-green animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-slate-500'
                  }`}
              />
              <div className="flex flex-col items-start leading-none">
                <span className="text-[9px] uppercase tracking-wider opacity-70 mb-0.5">Project Status</span>
                <span className="text-xs font-bold uppercase tracking-widest">{currentClient?.status || 'UNKNOWN'}</span>
              </div>
              <div className="absolute inset-0 rounded-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            <div className={`px-3 py-2 rounded-full border flex items-center gap-2 ${workerOnline ? 'bg-neon-green/10 border-neon-green/40 text-neon-green' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full ${workerOnline ? 'bg-neon-green animate-pulse' : 'bg-red-400'}`} />
              <span className="text-[10px] uppercase tracking-wider font-semibold">Worker {workerOnline ? 'Online' : 'Offline'}</span>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleSearchClick} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all">
                <Search size={16} />
              </button>
              <button onClick={handleBellClick} className="p-2.5 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-all relative">
                <Bell size={16} />
                <span className="absolute top-0 right-0 w-2 h-2 bg-neon-pink rounded-full border-2 border-black" />
              </button>
            </div>
          </div>
        </header>

        <div
          className={`flex-1 flex flex-col gap-3 min-h-0 transition-all duration-500 ${currentClient?.status === 'paused' ? 'grayscale opacity-70 pointer-events-none select-none' : ''}`}
        >
          {activeView === 'dashboard' ? (
            <>
              {/* Панель управления процессами + цель кампании */}
              <div className="shrink-0 space-y-3">
                <GlassCard className="p-3" delay={0.05}>
                  <ProcessControlPanel projectId={activeClientId || undefined} />
                </GlassCard>
                <CampaignGoalWidget achieved={currentClient?.achieved || 0} goal={currentClient?.goal || 100} />
              </div>

              <div className="flex-1 min-h-0">
                <PipelineGrid
                  sources={sources}
                  hooks={hooks}
                  chats={chats}
                  zooms={zooms}
                  qualifiedCount={stageStats.qualifiedCount}
                  repliedCount={stageStats.repliedCount}
                  convertedCount={stageStats.convertedCount}
                  onStageClick={setActiveView}
                  onAddSource={() => setIsParserModalOpen(true)}
                  onChatClick={(chat) => setActiveChatModal(chat)}
                  onGenerateSummary={(zoom) => setTelegramSummaryData(zoom)}
                  onAddHook={() => setIsAddHookModalOpen(true)}
                  onHookUpdated={fetchHooks}
                />
              </div>

              {/* LiveFeed + Системные логи */}
              <div className="shrink-0 grid grid-cols-1 xl:grid-cols-2 gap-3" style={{ height: '180px' }}>
                <GlassCard className="h-full flex flex-col p-3" delay={0.5}>
                  <LiveFeed items={feed} projectId={activeClientId || undefined} />
                </GlassCard>
                <GlassCard className="h-full flex flex-col p-3" delay={0.6}>
                  <SystemLogsPanel projectId={activeClientId || undefined} />
                </GlassCard>
              </div>
            </>
          ) : (
            <div className="flex-1 h-full min-h-0">
              <DrillDownTable
                view={activeView as 'sources' | 'hooks' | 'chats' | 'zooms'}
                onBack={() => setActiveView('dashboard')}
                projectId={activeClientId || undefined}
                sellers={sellers}
                isSandbox={sandboxMode}
                onUpdateSellers={setSellers}
                onAddHook={() => setIsAddHookModalOpen(true)}
                hooks={activeView === 'hooks' ? hooks : undefined}
              />
            </div>
          )}
        </div>
      </div>

      {activeChatModal && (
        <ChatInterface
          isOpen={!!activeChatModal}
          onClose={() => setActiveChatModal(null)}
          leadName={activeChatModal.clientName}
          leadId={activeChatModal.id}
          chat={activeChatModal}
          projectId={activeClientId || undefined}
          clientCompanyName={currentClient?.name}
        />
      )}

      <AddHookModal
        isOpen={isAddHookModalOpen}
        onClose={() => setIsAddHookModalOpen(false)}
        onSuccess={() => {
          fetchHooks();
        }}
      />

      {telegramSummaryData && (
        <TelegramSummaryModal
          isOpen={!!telegramSummaryData}
          onClose={() => setTelegramSummaryData(null)}
          leadData={{
            brandName: telegramSummaryData.clientName,
            revenue:
              sellers.find((s) => s.brand_name === telegramSummaryData.clientName)?.revenue_monthly ||
              0,
            pain:
              (sellers.find((s) => s.brand_name === telegramSummaryData.clientName)?.pain_points || [])
                .join(', ') || 'Требует уточнения',
            date: new Date().toISOString(),
          }}
        />
      )}

      {/* Модал добавления клиента */}
      {isAddClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-4">Добавить клиента</h3>
            <div className="space-y-3 mb-5">
              <input
                type="text"
                placeholder="Название проекта"
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-purple focus:outline-none"
              />
              <input
                type="text"
                placeholder="Инициалы (напр. АГ)"
                maxLength={3}
                value={newClientInitials}
                onChange={(e) => setNewClientInitials(e.target.value.toUpperCase())}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:border-neon-purple focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setIsAddClientOpen(false); setNewClientName(''); setNewClientInitials(''); }}
                className="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm"
              >Отмена</button>
              <button
                disabled={!newClientName.trim() || addClientLoading}
                onClick={async () => {
                  if (!newClientName.trim()) return;
                  setAddClientLoading(true);
                  try {
                    const { error } = await (supabase.from('projects') as any).insert({
                      name: newClientName.trim(),
                      initials: newClientInitials || newClientName.slice(0, 2).toUpperCase(),
                      status: 'active',
                      goal: 100,
                      achieved: 0,
                    });
                    if (!error) {
                      setIsAddClientOpen(false);
                      setNewClientName('');
                      setNewClientInitials('');
                      await fetchProjects();
                    }
                  } catch (e) {
                    console.error('Add client error:', e);
                  } finally {
                    setAddClientLoading(false);
                  }
                }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-neon-purple to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50"
              >{addClientLoading ? 'Создаётся...' : 'Создать'}</button>
            </div>
          </div>
        </div>
      )}

      <KnowledgeBaseEditor
        isOpen={isKBEditorOpen}
        onClose={() => setIsKBEditorOpen(false)}
        projectId={activeClientId || undefined}
        clientName={currentClient?.name}
      />
    </div>
  );
}

export default App;
