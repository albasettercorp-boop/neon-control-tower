import React, { useCallback, useEffect, useState } from 'react';
import { Play, Square, RefreshCw, AlertTriangle, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { WorkerCommand, CommandAction, CommandStatus } from '../types';

interface ProcessControlPanelProps {
  projectId?: string;
}

const ACTIONS: { action: CommandAction; label: string; icon: React.ElementType; color: string }[] = [
  { action: 'parse', label: 'Парсинг', icon: RefreshCw, color: 'from-blue-500 to-cyan-500' },
  { action: 'outreach', label: 'Аутрич', icon: Play, color: 'from-purple-500 to-pink-500' },
  { action: 'send_messages', label: 'Рассылка', icon: Play, color: 'from-green-500 to-emerald-500' },
  { action: 'health_check', label: 'Здоровье', icon: RefreshCw, color: 'from-yellow-500 to-amber-500' },
  { action: 'kill_switch', label: 'KILL SWITCH', icon: Square, color: 'from-red-600 to-red-800' },
];

const statusIcons: Record<CommandStatus, React.ElementType> = {
  pending: Loader2,
  processing: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

const statusColors: Record<CommandStatus, string> = {
  pending: 'text-yellow-400',
  processing: 'text-blue-400',
  completed: 'text-neon-green',
  failed: 'text-red-500',
};

export const ProcessControlPanel: React.FC<ProcessControlPanelProps> = ({ projectId }) => {
  const [commands, setCommands] = useState<WorkerCommand[]>([]);
  const [sending, setSending] = useState<string | null>(null);

  const fetchCommands = useCallback(async () => {
    try {
      const { data, error } = await (supabase.from('worker_commands') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      setCommands((data as WorkerCommand[]) || []);
    } catch (e) {
      console.error('ProcessControlPanel fetch error:', e);
    }
  }, []);

  useEffect(() => {
    fetchCommands();
    const channel = supabase
      .channel('worker_commands_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_commands' }, () => fetchCommands())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchCommands]);

  const sendCommand = async (action: CommandAction) => {
    if (sending) return;
    setSending(action);
    try {
      const { error } = await (supabase.from('worker_commands') as any).insert({
        action,
        params: { project_id: projectId },
        status: 'pending',
      });
      if (error) throw error;
      await fetchCommands();
    } catch (e) {
      console.error('Send command error:', e);
    } finally {
      setTimeout(() => setSending(null), 1000);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Управление процессами</h3>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        {ACTIONS.map(({ action, label, icon: Icon, color }) => (
          <button
            key={action}
            onClick={() => sendCommand(action)}
            disabled={!!sending}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-gradient-to-r ${color} hover:shadow-lg transition-all disabled:opacity-50 ${action === 'kill_switch' ? 'ml-auto' : ''}`}
          >
            {sending === action ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
            {label}
          </button>
        ))}
      </div>

      {commands.length > 0 && (
        <div className="space-y-1">
          {commands.slice(0, 5).map(cmd => {
            const StatusIcon = statusIcons[cmd.status];
            return (
              <div key={cmd.id} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-slate-800/30">
                <StatusIcon size={12} className={`${statusColors[cmd.status]} ${cmd.status === 'pending' || cmd.status === 'processing' ? 'animate-spin' : ''}`} />
                <span className="text-slate-300 font-mono">{cmd.action}</span>
                <span className={`ml-auto ${statusColors[cmd.status]} font-medium`}>{cmd.status}</span>
                <span className="text-slate-600 text-[10px]">{new Date(cmd.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
