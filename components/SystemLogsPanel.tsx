import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle, Info, XCircle, Trash2, Filter, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SystemLog, LogLevel } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface SystemLogsPanelProps {
    projectId?: string;
    maxItems?: number;
}

const LEVEL_CONFIG: Record<LogLevel, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
    info: {
        icon: <Info size={14} />,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
    },
    warning: {
        icon: <AlertTriangle size={14} />,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
    },
    error: {
        icon: <AlertCircle size={14} />,
        color: 'text-red-400',
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
    },
    critical: {
        icon: <XCircle size={14} />,
        color: 'text-red-500',
        bg: 'bg-red-600/15',
        border: 'border-red-500/30',
    },
};

const LEVEL_FILTERS: { value: LogLevel | 'all'; label: string }[] = [
    { value: 'all', label: 'Все' },
    { value: 'error', label: 'Ошибки' },
    { value: 'warning', label: 'Предупр.' },
    { value: 'info', label: 'Инфо' },
    { value: 'critical', label: 'Крит.' },
];

export const SystemLogsPanel: React.FC<SystemLogsPanelProps> = ({ projectId, maxItems = 50 }) => {
    const [logs, setLogs] = useState<SystemLog[]>([]);
    const [filter, setFilter] = useState<LogLevel | 'all'>('all');
    const [loading, setLoading] = useState(true);

    const fetchLogs = useCallback(async () => {
        try {
            let query = (supabase.from('system_logs') as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(maxItems);

            if (filter !== 'all') {
                query = query.eq('level', filter);
            }

            if (projectId) {
                query = query.or(`project_id.eq.${projectId},project_id.is.null`);
            }

            const { data, error } = await query;
            if (error) throw error;
            setLogs((data as SystemLog[]) || []);
        } catch (e) {
            console.error('Failed to fetch system logs:', e);
        } finally {
            setLoading(false);
        }
    }, [filter, projectId, maxItems]);

    useEffect(() => {
        fetchLogs();

        const channel = supabase
            .channel('system_logs_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
                const newLog = payload.new as SystemLog;
                if (filter === 'all' || newLog.level === filter) {
                    setLogs((prev) => [newLog, ...prev].slice(0, maxItems));
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchLogs, filter, maxItems]);

    const handleClearLogs = async () => {
        if (!confirm('Очистить все логи? Это действие нельзя отменить.')) return;
        try {
            await (supabase.from('system_logs') as any).delete().neq('id', '00000000-0000-0000-0000-000000000000');
            setLogs([]);
        } catch (e) {
            console.error('Failed to clear logs:', e);
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        const today = new Date();
        if (d.toDateString() === today.toDateString()) return 'Сегодня';
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return 'Вчера';
        return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    };

    const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'critical').length;

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                    <AlertCircle size={16} className={errorCount > 0 ? 'text-red-400' : 'text-slate-500'} />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Системные логи</h3>
                    {errorCount > 0 && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono animate-pulse">
                            {errorCount} ошибок
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={fetchLogs}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                        title="Обновить"
                    >
                        <RefreshCw size={12} />
                    </button>
                    <button
                        onClick={handleClearLogs}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
                        title="Очистить логи"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-1 mb-3 shrink-0">
                {LEVEL_FILTERS.map((f) => (
                    <button
                        key={f.value}
                        onClick={() => setFilter(f.value)}
                        className={`
              px-2 py-1 rounded-lg text-[10px] font-medium transition-all
              ${filter === f.value
                                ? 'bg-white/15 text-white border border-white/20'
                                : 'bg-white/5 text-slate-500 border border-transparent hover:text-slate-300 hover:bg-white/10'
                            }
            `}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Logs list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 min-h-0">
                {loading ? (
                    <div className="text-center text-slate-600 text-xs py-8">Загрузка логов...</div>
                ) : logs.length === 0 ? (
                    <div className="text-center text-slate-600 text-xs py-8">
                        <AlertCircle size={20} className="mx-auto mb-2 opacity-30" />
                        Нет логов{filter !== 'all' ? ` с уровнем "${filter}"` : ''}
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {logs.map((log) => {
                            const cfg = LEVEL_CONFIG[log.level];
                            return (
                                <motion.div
                                    key={log.id}
                                    initial={{ opacity: 0, x: -10, height: 0 }}
                                    animate={{ opacity: 1, x: 0, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                >
                                    <div className={`p-2.5 rounded-lg border ${cfg.bg} ${cfg.border} hover:bg-white/5 transition-colors`}>
                                        <div className="flex items-start gap-2">
                                            <div className={`mt-0.5 shrink-0 ${cfg.color}`}>{cfg.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline justify-between gap-2">
                                                    <p className="text-xs text-white font-medium truncate">{log.message}</p>
                                                    <span className="text-[9px] text-slate-500 font-mono shrink-0">
                                                        {formatDate(log.created_at)} {formatTime(log.created_at)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-[9px] font-mono uppercase ${cfg.color}`}>{log.level}</span>
                                                    <span className="text-[9px] text-slate-600">•</span>
                                                    <span className="text-[9px] text-slate-500 font-mono">{log.source}</span>
                                                </div>
                                                {log.details && (
                                                    <pre className="mt-1.5 text-[9px] text-slate-500 bg-black/20 rounded p-1.5 overflow-x-auto max-h-16">
                                                        {JSON.stringify(log.details, null, 2)}
                                                    </pre>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
