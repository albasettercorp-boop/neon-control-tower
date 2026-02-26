import React, { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Play, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Seller, Hook } from '../types';
import { motion } from 'framer-motion';
import { SourcesFilter, SourcesFilterState } from './SourcesFilter';

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

export const DrillDownTable: React.FC<DrillDownTableProps> = ({ view, onBack, projectId, sellers: sellersFromProps, isSandbox, onUpdateSellers, onAddHook, hooks }) => {
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedSource, setSelectedSource] = useState('ALL');
    const [processLimit, setProcessLimit] = useState(20);
    const [processing, setProcessing] = useState(false);
    const [filters, setFilters] = useState<SourcesFilterState>({
        revenue: 'all',
        category: 'all',
        health: 'all',
        status: 'all'
    });

    const filteredSellers = sellers.filter(seller => {
        if (view !== 'sources') return true;

        if (filters.revenue !== 'all') {
            const revenue = (seller as any).revenue_monthly || 0;
            if (filters.revenue === '0-2' && (revenue < 0 || revenue > 2000000)) return false;
            if (filters.revenue === '2-5' && (revenue < 2000000 || revenue > 5000000)) return false;
            if (filters.revenue === '5-10' && (revenue < 5000000 || revenue > 10000000)) return false;
            if (filters.revenue === '10+' && revenue < 10000000) return false;
        }

        if (filters.category !== 'all' && (seller as any).category !== filters.category) {
            return false;
        }

        if (filters.health !== 'all' && (seller as any).health_status !== filters.health) {
            return false;
        }

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
            query = query.eq('status', 'ZOOM_BOOKED');
        }

        if (projectId) {
            query = query.eq('project_id', projectId);
        }

        if (selectedSource !== 'ALL') {
            query = query.eq('source', selectedSource);
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
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .slice(0, processLimit);

                if (candidates.length === 0) {
                    setProcessing(false);
                    return;
                }

                const candidateIds = new Set(candidates.map(c => c.id));

                const updatedSellers = sellersFromProps.map(s => {
                    if (candidateIds.has(s.id)) {
                        return { ...s, status: 'QUALIFIED', variant: Math.random() > 0.5 ? 'A' : 'B' };
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
                    console.error('Error updating status', updateError);
                } else {
                    await fetchDetails();
                }
            }

        } catch (e) {
            console.error('Batch processing failed', e);
        } finally {
            setProcessing(false);
        }
    };

    const handleSandboxAction = (sellerId: string, action: 'REPLY' | 'ZOOM' | 'CONVERT') => {
        if (!isSandbox || !onUpdateSellers || !sellersFromProps) return;

        const updatedSellers = sellersFromProps.map(s => {
            if (s.id === sellerId) {
                if (action === 'REPLY') return { ...s, status: 'REPLIED' };
                if (action === 'ZOOM') return { ...s, status: 'ZOOM_BOOKED' };
                if (action === 'CONVERT') return { ...s, status: 'CONVERTED' };
            }
            return s;
        });
        onUpdateSellers(updatedSellers);
    };

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
                filtered = filtered.filter(s => ['ZOOM_BOOKED'].includes(s.status));
            }

            setSellers(filtered);
            setLoading(false);
        }
    }, [sellersFromProps, view]);

    useEffect(() => {
        if (!sellersFromProps || sellersFromProps.length === 0) {
            fetchDetails();
        }
    }, [view, projectId, selectedSource]);

    const getTitle = () => {
        switch (view) {
            case 'sources': return 'Очередь Парсера (Свежие Лиды)';
            case 'hooks': return 'Кампания (Отправлено/Квалиф.)';
            case 'chats': return 'Активные Диалоги';
            case 'zooms': return 'Назначенные Зумы';
            default: return 'Детали';
        }
    };

    return (
        <div className="h-full flex flex-col bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="p-4 border-b border-white/10 flex flex-col gap-4 bg-white/5">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-wide">{getTitle()}</h2>
                            {view === 'sources' && (
                                <p className="text-xs text-slate-400 mt-1">
                                    Всего найдено: <span className="text-neon-purple font-mono">{filteredSellers.length}</span>
                                    {filteredSellers.length !== sellers.length && (
                                        <span className="text-slate-500"> из {sellers.length}</span>
                                    )}
                                </p>
                            )}
                        </div>
                    </div>
                    <button onClick={fetchDetails} className="p-2 text-slate-400 hover:text-neon-purple transition-colors">
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>

                {view === 'sources' && (
                    <SourcesFilter
                        filters={filters}
                        onFilterChange={setFilters}
                        onReset={handleResetFilters}
                    />
                )}

                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg">
                        <Filter size={14} className="text-slate-500 ml-2" />
                        {SOURCE_OPTIONS.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setSelectedSource(opt.value)}
                                className={`
                                    px-3 py-1.5 rounded-md text-xs font-medium transition-all
                                    ${selectedSource === opt.value
                                        ? 'bg-neon-purple text-white shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'}
                                `}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {view === 'sources' && (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span>Лимит:</span>
                                <input
                                    type="number"
                                    value={processLimit}
                                    onChange={(e) => setProcessLimit(Math.max(1, parseInt(e.target.value) || 0))}
                                    className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-white text-center focus:border-neon-purple outline-none"
                                />
                            </div>
                            <button
                                onClick={handleProcessBatch}
                                disabled={processing || sellers.length === 0}
                                className={`
                                    flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all
                                    ${processing || sellers.length === 0
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-neon-purple to-purple-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]'}
                                `}
                            >
                                {processing ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
                                {processing ? 'Обработка...' : 'Запустить в работу'}
                            </button>
                        </div>
                    )}

                    {view === 'hooks' && (
                        <button
                            onClick={onAddHook}
                            className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all bg-gradient-to-r from-neon-purple to-purple-600 text-white hover:shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                        >
                            <Play size={16} />
                            Добавить
                        </button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                {view === 'hooks' && hooks ? (
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
                                        <td className="p-3 font-mono text-neon-purple">
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
                ) : sellers.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-slate-500">
                        Нет данных для отображения.
                    </div>
                ) : (
                    <div className="w-full text-left border-collapse">
                        <table className="w-full">
                            <thead>
                                <tr className="text-xs uppercase tracking-wider text-slate-400 border-b border-white/10 bg-white/5">
                                    <th className="p-3 font-medium text-left">Бренд / Создан</th>
                                    <th className="p-3 font-medium text-left">Выручка</th>
                                    <th className="p-3 font-medium text-left">Источник / ИНН</th>
                                    <th className="p-3 font-medium text-left">Статус</th>
                                    {isSandbox && (view === 'chats' || view === 'zooms') && (
                                        <th className="p-3 font-medium text-right">Действия (Sandbox)</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredSellers.map((seller, idx) => (
                                    <motion.tr
                                        key={seller.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                                    >
                                        <td className="p-3">
                                            <div className="font-medium text-white">{seller.brand_name}</div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(seller.created_at || Date.now()).toLocaleString('ru-RU')}
                                            </div>
                                        </td>
                                        <td className="p-3 text-slate-300 font-mono">
                                            {seller.revenue_monthly ? `${(seller.revenue_monthly / 1000000).toFixed(1)}M ₽` : '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase">
                                                    {seller.source || 'N/A'}
                                                </span>
                                                {seller.inn && <span className="text-xs text-slate-500 font-mono">{seller.inn}</span>}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className={`
                                                text-[10px] px-2 py-1 rounded-full font-bold uppercase
                                                ${seller.status === 'NEW' ? 'bg-slate-700/50 text-slate-300' :
                                                    seller.status === 'QUALIFIED' ? 'bg-blue-500/20 text-blue-400' :
                                                        seller.status === 'CONTACTED' ? 'bg-purple-500/20 text-purple-400' :
                                                            seller.status === 'REPLIED' ? 'bg-yellow-500/20 text-yellow-400' :
                                                                seller.status === 'CONVERTED' ? 'bg-green-500/20 text-green-400' :
                                                                    'bg-red-500/10 text-red-400'}
                                            `}>
                                                {STATUS_MAP[seller.status || ''] || seller.status}
                                            </span>
                                        </td>
                                        {isSandbox && (view === 'chats' || view === 'zooms') && (
                                            <td className="p-3 text-right">
                                                {view === 'chats' && (
                                                    <button
                                                        onClick={() => handleSandboxAction(seller.id, 'ZOOM')}
                                                        className="px-2 py-1 bg-white/5 hover:bg-neon-blue/20 text-slate-300 hover:text-white rounded text-xs transition-colors"
                                                    >
                                                        Назначить Зум
                                                    </button>
                                                )}
                                                {view === 'zooms' && (
                                                    <button
                                                        onClick={() => handleSandboxAction(seller.id, 'CONVERT')}
                                                        className="px-2 py-1 bg-white/5 hover:bg-neon-green/20 text-slate-300 hover:text-white rounded text-xs transition-colors"
                                                    >
                                                        Продажа
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
