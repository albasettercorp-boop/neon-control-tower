import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, XCircle, Search, Send, MessageSquare, Activity, RefreshCw, PowerOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkerCommand, CommandAction, CommandStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface ProcessControlPanelProps {
    projectId?: string;
}

interface ProcessButton {
    action: CommandAction;
    label: string;
    icon: React.ReactNode;
    description: string;
    gradient: string;
    glowColor: string;
}

const PROCESSES: ProcessButton[] = [
    {
        action: 'parse',
        label: 'Парсинг',
        icon: <Search size={18} />,
        description: 'Поиск селлеров на WB',
        gradient: 'from-blue-500 to-cyan-500',
        glowColor: 'rgba(59,130,246,0.4)',
    },
    {
        action: 'outreach',
        label: 'Outreach',
        icon: <Send size={18} />,
        description: 'Рассылка сообщений QUALIFIED',
        gradient: 'from-purple-500 to-pink-500',
        glowColor: 'rgba(168,85,247,0.4)',
    },
    {
        action: 'send_messages',
        label: 'Отправка',
        icon: <MessageSquare size={18} />,
        description: 'Обработка PENDING_SEND',
        gradient: 'from-emerald-500 to-green-500',
        glowColor: 'rgba(16,185,129,0.4)',
    },
    {
        action: 'health_check',
        label: 'Health Check',
        icon: <Activity size={18} />,
        description: 'Проверка всех сервисов',
        gradient: 'from-amber-500 to-orange-500',
        glowColor: 'rgba(245,158,11,0.4)',
    },
    {
        action: 'kill_switch',
        label: 'Kill Switch',
        icon: <PowerOff size={18} />,
        description: 'Остановить automation',
        gradient: 'from-rose-500 to-red-600',
        glowColor: 'rgba(239,68,68,0.4)',
    },
];

const getStatusInfo = (status: CommandStatus) => {
    switch (status) {
        case 'pending':
            return { icon: <Loader2 size={14} className="animate-spin text-yellow-400" />, text: 'Ожидание...', color: 'text-yellow-400' };
        case 'processing':
            return { icon: <Loader2 size={14} className="animate-spin text-blue-400" />, text: 'Выполняется...', color: 'text-blue-400' };
        case 'completed':
            return { icon: <CheckCircle2 size={14} className="text-green-400" />, text: 'Готово', color: 'text-green-400' };
        case 'failed':
            return { icon: <XCircle size={14} className="text-red-400" />, text: 'Ошибка', color: 'text-red-400' };
    }
};

export const ProcessControlPanel: React.FC<ProcessControlPanelProps> = ({ projectId }) => {
    const [commands, setCommands] = useState<Record<string, WorkerCommand>>({});
    const [loadingActions, setLoadingActions] = useState<Set<CommandAction>>(new Set());

    const killSwitchCommand = commands.kill_switch;
    const killSwitchActive = Boolean(killSwitchCommand?.result?.active ?? killSwitchCommand?.params?.enabled);

    const fetchLatestCommands = useCallback(async () => {
        try {
            const { data } = await (supabase.from('worker_commands') as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (data) {
                const latest: Record<string, WorkerCommand> = {};
                for (const cmd of data as WorkerCommand[]) {
                    if (!latest[cmd.action]) {
                        latest[cmd.action] = cmd;
                    }
                }
                setCommands(latest);
            }
        } catch (e) {
            console.error('Failed to fetch commands:', e);
        }
    }, []);

    useEffect(() => {
        fetchLatestCommands();

        const channel = supabase
            .channel('worker_commands_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_commands' }, () => {
                fetchLatestCommands();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchLatestCommands]);

    const handleRunProcess = async (action: CommandAction) => {
        setLoadingActions((prev) => new Set(prev).add(action));

        try {
            const params: Record<string, any> = {};
            if (projectId) params.project_id = projectId;
            if (action === 'kill_switch') {
                const enable = !killSwitchActive;
                params.enabled = enable;
                params.reason = enable
                    ? 'Triggered from dashboard control panel'
                    : 'Deactivated from dashboard control panel';
            } else if (killSwitchActive) {
                alert('Kill Switch активен. Сначала отключите его.');
                return;
            }

            const { data, error } = await (supabase.from('worker_commands') as any)
                .insert({
                    action,
                    params,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setCommands((prev) => ({ ...prev, [action]: data as WorkerCommand }));
            }
        } catch (e) {
            console.error(`Failed to create command ${action}:`, e);
        } finally {
            setLoadingActions((prev) => {
                const next = new Set(prev);
                next.delete(action);
                return next;
            });
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-neon-purple animate-pulse" />
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Управление процессами</h3>
                </div>
                <button
                    onClick={fetchLatestCommands}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    title="Обновить"
                >
                    <RefreshCw size={14} />
                </button>
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-5 gap-2">
                {PROCESSES.map((proc) => {
                    const latestCmd = commands[proc.action];
                    const isLoading = loadingActions.has(proc.action);
                    const isActive = latestCmd && (latestCmd.status === 'pending' || latestCmd.status === 'processing');
                    const statusInfo = latestCmd ? getStatusInfo(latestCmd.status) : null;
                    const blockedByKillSwitch = killSwitchActive && proc.action !== 'kill_switch';
                    const buttonDisabled = isLoading || isActive || blockedByKillSwitch;
                    const killLabel = proc.action === 'kill_switch'
                        ? (killSwitchActive ? 'Kill Switch ON' : 'Kill Switch OFF')
                        : proc.label;
                    const killDescription = proc.action === 'kill_switch'
                        ? (killSwitchActive ? 'Нажмите для разблокировки' : 'Остановить automation')
                        : proc.description;

                    return (
                        <motion.button
                            key={proc.action}
                            onClick={() => handleRunProcess(proc.action)}
                            disabled={buttonDisabled}
                            whileHover={{ scale: isActive ? 1 : 1.02 }}
                            whileTap={{ scale: isActive ? 1 : 0.98 }}
                            className={`
                relative p-3 rounded-xl border backdrop-blur-sm text-left transition-all
                ${isActive
                                    ? 'bg-white/5 border-white/20 cursor-wait'
                                    : blockedByKillSwitch
                                        ? 'bg-slate-900/30 border-amber-500/20 cursor-not-allowed'
                                        : 'bg-slate-900/40 border-white/5 hover:border-white/20 cursor-pointer'
                                }
                disabled:opacity-60
              `}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className={`p-1.5 rounded-lg bg-gradient-to-br ${proc.gradient} text-white`}>
                                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : proc.icon}
                                </div>
                                {statusInfo && (
                                    <div className={`flex items-center gap-1 ${statusInfo.color}`}>
                                        {statusInfo.icon}
                                    </div>
                                )}
                            </div>

                            <div className="text-sm font-medium text-white mb-0.5">{killLabel}</div>
                            <div className="text-[10px] text-slate-500">{killDescription}</div>

                            {/* Status bar */}
                            <AnimatePresence>
                                {statusInfo && latestCmd && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="mt-2 pt-2 border-t border-white/5"
                                    >
                                        <span className={`text-[10px] font-mono ${statusInfo.color}`}>
                                            {statusInfo.text}
                                        </span>
                                        {latestCmd.error && (
                                            <p className="text-[9px] text-red-400/80 mt-1 line-clamp-2">{latestCmd.error}</p>
                                        )}
                                        {latestCmd.result?.message && !latestCmd.error && (
                                            <p className="text-[9px] text-slate-400 mt-1 line-clamp-2">{String(latestCmd.result.message)}</p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Glow effect on hover */}
                            {!isActive && (
                                <div
                                    className="absolute inset-0 rounded-xl opacity-0 hover:opacity-100 transition-opacity pointer-events-none"
                                    style={{ boxShadow: `inset 0 0 20px ${proc.glowColor}` }}
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
