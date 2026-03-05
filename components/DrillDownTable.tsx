

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Play, Filter, Eye, ChevronRight, Users, Zap, MessageSquare, Video } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Seller, SellerStatus, Hook } from '../types';
import { motion } from 'framer-motion';
import { SourcesFilter, SourcesFilterState } from './SourcesFilter';
import { LeadDetailModal } from './LeadDetailModal';

interface DrillDownTableProps {
    view: 'sources' | 'hooks' | 'chats' | 'zooms';
    onBack: () => void;
    projectId?: string;
    sellers?: Seller[];
    isSandbox?: boolean;
    onUpdateSellers?: (sellers: Seller[]) => void;
    onAddHook?: () => void;
    hooks?: Hook[];
}

const SOURCE_OPTIONS = [
    { value: 'ALL', label: 'Все' },
    { value: 'WB_API', label: 'Wildberries API' },
    { value: 'TG_CHAT', label: 'Telegram' },
    { value: 'VK', label: 'ВКонтакте' },
    { value: 'INSTAGRAM', label: 'Instagram' }
];

const STATUS_MAP: Record<string, string> = {
    'NEW': 'Новый',
    'QUALIFIED': 'Квалифицирован',
    'CONTACTED': 'Отправлено',
    'HOOK_SENT': 'Хук Отправлен',
    'REPLIED': 'Ответил',
    'ZOOM_BOOKED': 'Зум',
    'CONVERTED': 'Продажа',
    'REJECTED': 'Отказ'
};

const STATUS_COLORS: Record<string, string> = {
    'NEW': 'bg-slate-700/50 text-slate-300',
    'QUALIFIED': 'bg-blue-500/20 text-blue-400',
    'CONTACTED': 'bg-purple-500/20 text-purple-400',
    'HOOK_SENT': 'bg-indigo-500/20 text-indigo-400',
    'REPLIED': 'bg-yellow-500/20 text-yellow-400',
    'ZOOM_BOOKED': 'bg-cyan-500/20 text-cyan-400',
    'CONVERTED': 'bg-green-500/20 text-green-400',
    'REJECTED': 'bg-red-500/10 text-red-400',
};

const NEXT_STATUS: Record<string, SellerStatus> = {
    'NEW': 'QUALIFIED',
    'QUALIFIED': 'CONTACTED',
    'CONTACTED': 'HOOK_SENT',
    'HOOK_SENT': 'REPLIED',
    'REPLIED': 'ZOOM_BOOKED',
    'ZOOM_BOOKED': 'CONVERTED',
};

const NEXT_ACTION_LABEL: Record<string, { label: string; icon: React.ReactNode }> = {
    'NEW': { label: 'Квалифицировать', icon: <ChevronRight size={12} /> },
    'QUALIFIED': { label: 'Контакт', icon: <Zap size={12} /> },
    'CONTACTED': { label: 'Хук', icon: <Zap size={12} /> },
    'HOOK_SENT': { label: 'Ответил', icon: <MessageSquare size={12} /> },
    'REPLIED': { label: 'Зум', icon: <Video size={12} /> },
    'ZOOM_BOOKED': { label: 'Продажа', icon: <ChevronRight size={12} /> },
};

const VIEW_CONFIG = {
    sources: { title: 'Очередь Парсера (Свежие Лиды)', icon: <Users size={20} />, color: 'text-blue-400' },
    hooks: { title: 'Кампания (Хуки / Скрипты)', icon: <Zap size={20} />, color: 'text-purple-400' },
    chats: { title: 'Активные Диалоги', icon: <MessageSquare size={20} />, color: 'text-yellow-400' },
    zooms: { title: 'Назначенные Зумы & Конвертация', icon: <Video size={20} />, color: 'text-green-400' },
};

export const DrillDownTable: React.FC<DrillDownTableProps> = ({ view, onBack, projectId, sellers: sellersFromProps, isSandbox, onUpdateSellers, onAddHook, hooks }) => {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSource, setSelectedSource] = useState('ALL');
    const [processLimit, setProcessLimit] = useState(20);
    const [processing, setProcessing] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Seller | null>(null);
    const [filters, setFilters] = useState<SourcesFilterState>({
        revenue: 'all',
        category: 'all',
        health: 'all',
        status: 'all'
    });

    // Filter sellers based on active filters
    const filteredSellers = sellers.filter(seller => {
        // Source filter
        if (selectedSource !== 'ALL' && seller.source !== selectedSource) return false;

        if (view !== 'sources') return true;

        // Revenue filter
        if (filters.revenue !== 'all') {
            const revenue = (seller as any).revenue_monthly || 0;
            if (filters.revenue === '0-2' && (revenue < 0 || revenue > 2000000)) return false;
            if (filters.revenue === '2-5' && (revenue < 2000000 || revenue > 5000000)) return false;
            if (filters.revenue === '5-10' && (revenue < 5000000 || revenue > 10000000)) return false;
            if (filters.revenue === '10+' && revenue < 10000000) return false;
        }

        // Category filter
        if (filters.category !== 'all' && (seller as any).category !== filters.category) {
            return false;
        }

        // Health filter
        if (filters.health !== 'all' && (seller as any).health_status !== filters.health) {
            return false;
        }

        // Status filter
        if (filters.status !== 'all' && seller.status !== filters.status.toUpperCase()) {
            return false;
        }

        return true;
    });

    const handleResetFilters = () => {
        setFilters({
            revenue: 'all',
            category: 'all',
            health: 'all',
            status: 'all'
        });
    };

    const fetchDetails = async () => {
        if (sellersFromProps) {
            setLoading(false);
            return;
        }

        setLoading(true);

        let query = supabase.from('sellers').select('*').order('created_at', { ascending: false });

        if (view === 'sources') {
            query = query.eq('status', 'NEW');
        } else if (view === 'hooks') {
            query = query.in('status', ['QUALIFIED', 'CONTACTED', 'HOOK_SENT']);
        } else if (view === 'chats') {
            query = query.eq('status', 'REPLIED');
        } else if (view === 'zooms') {
            query = query.in('status', ['ZOOM_BOOKED', 'CONVERTED']);
        }

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching details:', error);
        } else {
            setSellers((data as unknown as Seller[]) || []);
        }
        setLoading(false);
    };

    const handleProcessBatch = async () => {
        setProcessing(true);

        try {
            if (isSandbox && onUpdateSellers && sellersFromProps) {
                const candidates = sellersFromProps
                    .filter(s => s.status === 'NEW' && (selectedSource === 'ALL' || s.source === selectedSource))
                    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
                    .slice(0, processLimit);

                if (candidates.length === 0) {
                    setProcessing(false);
                    return;
                }

                const candidateIds = new Set(candidates.map(c => c.id));
                const updatedSellers = sellersFromProps.map(s => {
                    if (candidateIds.has(s.id)) {
                        return { ...s, status: 'QUALIFIED' as SellerStatus, variant: (Math.random() > 0.5 ? 'A' : 'B') as 'A' | 'B' };
                    }
                    return s;
                });
                onUpdateSellers(updatedSellers);
            } else {
                if (!projectId) return;

                let query = supabase
                    .from('sellers')
                    .select('id')
                    .eq('project_id', projectId)
                    .eq('status', 'NEW')
                    .order('created_at', { ascending: true })
                    .limit(processLimit);

                if (selectedSource !== 'ALL') {
                    query = query.eq('source', selectedSource);
                }

                const { data: candidates, error: fetchError } = await query;

                if (fetchError || !candidates || candidates.length === 0) {
                    setProcessing(false);
                    return;
                }

                const ids = (candidates as any[]).map(c => c.id);

                const { error: updateError } = await supabase
                    .from('sellers')
                    .update({ status: 'QUALIFIED' } as any)
                    .in('id', ids);

                if (updateError) {
                    console.error("Error updating status", updateError);
                } else {
                    await fetchDetails();
                }
            }
        } catch (e) {
            console.error("Batch processing failed", e);
        } finally {
            setProcessing(false);
        }
    };

    const handleAdvanceLead = async (sellerId: string, newStatus: SellerStatus) => {
        if (isSandbox && onUpdateSellers && sellersFromProps) {
            const updatedSellers = sellersFromProps.map(s => {
                if (s.id === sellerId) {
                    return { ...s, status: newStatus };
                }
                return s;
            });
            onUpdateSellers(updatedSellers);
        } else {
            try {
                const { error } = await (supabase.from('sellers') as any)
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', sellerId);
                if (error) {
                    console.error('Error advancing lead:', error);
                } else {
                    await fetchDetails();
                }
            } catch (e) {
                console.error('Advance lead failed:', e);
            }
        }
    };

    const handleRejectLead = async (sellerId: string) => {
        await handleAdvanceLead(sellerId, 'REJECTED');
    };

    const handleLeadStatusChange = (sellerId: string, newStatus: SellerStatus) => {
        handleAdvanceLead(sellerId, newStatus);
        // Update selectedLead to reflect new status
        setSelectedLead(prev => prev && prev.id === sellerId ? { ...prev, status: newStatus } : prev);
    };

    // Sync sellers from props
    useEffect(() => {
        if (sellersFromProps) {
            setLoading(true);
            let filtered = sellersFromProps;

            if (view === 'sources') {
                filtered = filtered.filter(s => s.status === 'NEW');
            } else if (view === 'hooks') {
                filtered = filtered.filter(s => ['QUALIFIED', 'CONTACTED', 'HOOK_SENT'].includes(s.status));
            } else if (view === 'chats') {
                filtered = filtered.filter(s => ['REPLIED'].includes(s.status));
            } else if (view === 'zooms') {
                filtered = filtered.filter(s => ['ZOOM_BOOKED', 'CONVERTED'].includes(s.status));
            }

            setSellers(filtered);
            setLoading(false);
        }
    }, [sellersFromProps, view]);

    // Fetch from Supabase only when no props
    useEffect(() => {
        if (!sellersFromProps || sellersFromProps.length === 0) {
            fetchDetails();
        }
    }, [view, projectId, selectedSource]);

    // Update selected lead when sellers change
    useEffect(() => {
        if (selectedLead) {
            const updated = sellers.find(s => s.id === selectedLead.id);
            if (updated) {
                setSelectedLead(updated);
            }
        }
    }, [sellers]);

    const viewCfg = VIEW_CONFIG[view];

    // Stats for current view
    const statusCounts = sellers.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <>
            <div className="h-full flex flex-col bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex flex-col gap-3 bg-white/5">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={onBack}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className={viewCfg.color}>{viewCfg.icon}</span>
                                    <h2 className="text-xl font-bold text-white tracking-wide">{viewCfg.title}</h2>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-400">
                                        Всего: <span className="text-white font-mono">{filteredSellers.length}</span>
                                    </span>
                                    {Object.entries(statusCounts).map(([status, count]) => (
                                        <span key={status} className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[status] || 'bg-slate-700 text-slate-300'}`}>
                                            {STATUS_MAP[status] || status}: {count}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                if (sellersFromProps) {
                                    // Re-sync from props
                                    let filtered = sellersFromProps;
                                    if (view === 'sources') filtered = filtered.filter(s => s.status === 'NEW');
                                    else if (view === 'hooks') filtered = filtered.filter(s => ['QUALIFIED', 'CONTACTED', 'HOOK_SENT'].includes(s.status));
                                    else if (view === 'chats') filtered = filtered.filter(s => ['REPLIED'].includes(s.status));
                                    else if (view === 'zooms') filtered = filtered.filter(s => ['ZOOM_BOOKED', 'CONVERTED'].includes(s.status));
                                    setSellers(filtered);
                                } else {
                                    fetchDetails();
                                }
                            }}
                            className="p-2 text-slate-400 hover:text-purple-400 transition-colors"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>

                    {/* Sources Filter (for sources view) */}
                    {view === 'sources' && (
                        <SourcesFilter
                            filters={filters}
                            onFilterChange={setFilters}
                            onReset={handleResetFilters}
                        />
                    )}

                    {/* Controls Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/5">
                        {/* Source Filter Tabs */}
                        <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg">
                            <Filter size={14} className="text-slate-500 ml-2" />
                            {SOURCE_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setSelectedSource(opt.value)}
                                    className={`
                                        px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                        ${selectedSource === opt.value
                                            ? 'bg-purple-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                                            : 'text-slate-400 hover:text-white hover:bg-white/5'}
                                    `}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Batch Actions (Sources view) */}
                        {view === 'sources' && (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 text-sm text-slate-400">
                                    <span>Лимит:</span>
                                    <input
                                        type="number"
                                        value={processLimit}
                                        onChange={(e) => setProcessLimit(Math.max(1, parseInt(e.target.value) || 0))}
                                        className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-center focus:border-purple-500 outline-none"
                                    />
                                </div>
                                <button
                                    onClick={handleProcessBatch}
                                    disabled={processing || sellers.length === 0}
                                    className={`
                                        flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                        ${processing || sellers.length === 0
                                            ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                            : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]'}
                                    `}
                                >
                                    {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                    {processing ? 'Обработка...' : 'Квалифицировать пачку'}
                                </button>
                            </div>
                        )}

                        {/* Add Hook (Hooks view) */}
                        {view === 'hooks' && (
                            <button
                                onClick={onAddHook}
                                className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                            >
                                <Zap size={16} />
                                Добавить хук
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                    {view === 'hooks' && hooks ? (
                        /* Hooks Table */
                        <div className="w-full text-left border-collapse">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-white/10 bg-white/5">
                                        <th className="p-3 font-medium text-left">Название / Текст</th>
                                        <th className="p-3 font-medium text-left">Категория</th>
                                        <th className="p-3 font-medium text-left">Конверсия</th>
                                        <th className="p-3 font-medium text-left">Статус</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {hooks.map((hook, idx) => (
                                        <motion.tr
                                            key={hook.id}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                                        >
                                            <td className="p-3">
                                                <div className="font-medium text-white">{hook.title || hook.name}</div>
                                                <div className="text-xs text-slate-500 line-clamp-1 max-w-[300px]">
                                                    {hook.content || hook.text}
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className="text-xs bg-slate-800 px-2 py-1 rounded text-slate-400">
                                                    {hook.category || 'Общее'}
                                                </span>
                                            </td>
                                            <td className="p-3 font-mono text-purple-400">
                                                {hook.conversion_rate || hook.conversion || 0}%
                                            </td>
                                            <td className="p-3">
                                                <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${hook.active !== false ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                    {hook.active !== false ? 'ACTIVE' : 'INACTIVE'}
                                                </span>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : loading ? (
                        <div className="flex justify-center items-center h-full text-slate-500 gap-2">
                            <Loader2 className="animate-spin" /> Загрузка данных...
                        </div>
                    ) : filteredSellers.length === 0 ? (
                        <div className="flex flex-col justify-center items-center h-full text-slate-500">
                            <Users size={48} className="text-slate-700 mb-4" />
                            <p className="text-lg font-medium">Нет данных для отображения</p>
                            <p className="text-xs text-slate-600 mt-1">Попробуйте сменить фильтры или запустить парсинг</p>
                        </div>
                    ) : (
                        /* Sellers Table */
                        <div className="w-full text-left border-collapse">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-white/10 bg-white/5 sticky top-0">
                                        <th className="p-3 font-medium text-left">Бренд</th>
                                        <th className="p-3 font-medium text-left">Выручка</th>
                                        <th className="p-3 font-medium text-left">Источник</th>
                                        <th className="p-3 font-medium text-left">Статус</th>
                                        <th className="p-3 font-medium text-left">Дата</th>
                                        <th className="p-3 font-medium text-right">Действия</th>
                                    </tr>
                                </thead>
                                <tbody className="text-sm">
                                    {filteredSellers.map((seller, idx) => {
                                        const nextAction = NEXT_ACTION_LABEL[seller.status];
                                        const nextStatus = NEXT_STATUS[seller.status];
                                        return (
                                            <motion.tr
                                                key={seller.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                                                className="border-b border-white/5 hover:bg-purple-500/5 transition-colors group cursor-pointer"
                                                onClick={() => setSelectedLead(seller)}
                                            >
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600/30 to-blue-600/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-purple-300">
                                                            {seller.brand_name.slice(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-white group-hover:text-purple-300 transition-colors">{seller.brand_name}</div>
                                                            {seller.top_product_name && (
                                                                <div className="text-[10px] text-slate-600 line-clamp-1 max-w-[200px]">{seller.top_product_name}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-slate-300 font-mono text-xs">
                                                    {seller.revenue_monthly ? `${(seller.revenue_monthly / 1000000).toFixed(1)}M ₽` : '—'}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase">
                                                            {seller.source || 'N/A'}
                                                        </span>
                                                        {seller.variant && (
                                                            <span className={`text-[10px] font-bold px-1 py-0.5 rounded ${seller.variant === 'A' ? 'bg-pink-500/15 text-pink-400' : 'bg-blue-500/15 text-blue-400'}`}>
                                                                {seller.variant}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase ${STATUS_COLORS[seller.status] || 'bg-slate-700/50 text-slate-300'}`}>
                                                        {STATUS_MAP[seller.status || ''] || seller.status}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-[10px] text-slate-500 font-mono">
                                                    {seller.created_at
                                                        ? new Date(seller.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
                                                        : '—'}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {/* View Detail */}
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setSelectedLead(seller); }}
                                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                                            title="Подробности"
                                                        >
                                                            <Eye size={14} />
                                                        </button>
                                                        {/* Advance to Next Status */}
                                                        {nextAction && nextStatus && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleAdvanceLead(seller.id, nextStatus);
                                                                }}
                                                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 hover:text-purple-300 transition-all text-[11px] font-medium border border-purple-500/20 hover:border-purple-500/40"
                                                                title={`Перевести → ${nextAction.label}`}
                                                            >
                                                                {nextAction.icon}
                                                                {nextAction.label}
                                                            </button>
                                                        )}
                                                        {/* Reject */}
                                                        {seller.status !== 'REJECTED' && seller.status !== 'CONVERTED' && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRejectLead(seller.id);
                                                                }}
                                                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 transition-colors"
                                                                title="Отказ"
                                                            >
                                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Lead Detail Modal */}
            <LeadDetailModal
                isOpen={!!selectedLead}
                onClose={() => setSelectedLead(null)}
                seller={selectedLead}
                projectId={projectId}
                isSandbox={isSandbox}
                onStatusChange={handleLeadStatusChange}
                onSellerUpdated={() => {
                    if (sellersFromProps) {
                        // Re-sync from props will happen via useEffect
                    } else {
                        fetchDetails();
                    }
                }}
            />
        </>
    );
};
