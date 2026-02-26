import React, { useCallback, useEffect, useState } from 'react';
import { FileText, AlertTriangle, Info, XCircle, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SystemLog, LogLevel } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface SystemLogsPanelProps {
  projectId?: string;
}

const levelConfig: Record<LogLevel, { icon: React.ElementType; color: string; bg: string }> = {
  info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  error: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  critical: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-600/10' },
};

export const SystemLogsPanel: React.FC<SystemLogsPanelProps> = ({ projectId }) => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      let query = (supabase.from('system_logs') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (projectId) {
        query = query.or(`project_id.eq.${projectId},project_id.is.null`);
      }
      if (filter !== 'all') {
        query = query.eq('level', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLogs((data as SystemLog[]) || []);
    } catch (e) {
      console.error('SystemLogs fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  useEffect(() => {
    fetchLogs();
    const channel = supabase
      .channel('system_logs_realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
        const row = payload.new as SystemLog;
        if (projectId && row.project_id && row.project_id !== projectId) return;
        if (filter !== 'all' && row.level !== filter) return;
        setLogs(prev => [row, ...prev].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchLogs, projectId, filter]);

  const errorCount = logs.filter(l => l.level === 'error' || l.level === 'critical').length;

  const handleClear = async () => {
    try {
      let query = (supabase.from('system_logs') as any).delete();
      if (projectId) {
        query = query.eq('project_id', projectId);
      } else {
        query = query.is('project_id', null);
      }
      await query;
      setLogs([]);
    } catch (e) {
      console.error('Clear logs error:', e);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-slate-400" />
          <h3 className="text-sm font-medium text-white">System Logs</h3>
          {errorCount > 0 && (
            <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[10px] rounded-full font-mono">{errorCount} errors</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {(['all', 'info', 'warning', 'error'] as const).map(level => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${filter === level ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              {level === 'all' ? 'ALL' : level.toUpperCase()}
            </button>
          ))}
          <button onClick={handleClear} className="p-1 text-slate-600 hover:text-red-400 transition-colors ml-1">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1">
        {loading && logs.length === 0 ? (
          <div className="flex justify-center py-4"><Loader2 className="animate-spin text-slate-500" size={20} /></div>
        ) : logs.length === 0 ? (
          <div className="text-center text-slate-600 text-xs py-4">Нет логов</div>
        ) : (
          <AnimatePresence initial={false}>
            {logs.map(log => {
              const config = levelConfig[log.level] || levelConfig.info;
              const Icon = config.icon;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`flex items-start gap-2 p-1.5 rounded-lg ${config.bg} text-xs`}
                >
                  <Icon size={12} className={`${config.color} mt-0.5 flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-300 truncate">{log.message}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-slate-600 font-mono">{log.source}</span>
                      <span className="text-slate-700">{new Date(log.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
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
