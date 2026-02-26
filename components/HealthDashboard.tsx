import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';

interface HealthRecord {
  id: string;
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  last_check: string;
  error_message: string | null;
}

interface HealthDashboardProps {
  projectId?: string;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({ projectId }) => {
  const [records, setRecords] = useState<HealthRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase.from('account_health') as any)
        .select('*')
        .order('service_name');
      if (error) throw error;
      setRecords((data as HealthRecord[]) || []);
    } catch (e) {
      console.error('HealthDashboard fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  useEffect(() => {
    const channel = supabase
      .channel('health_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_health' }, () => {
        fetchHealth();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchHealth]);

  const statusConfig = {
    healthy: { icon: CheckCircle2, color: 'text-neon-green', bg: 'bg-neon-green/10', border: 'border-neon-green/30', label: 'Healthy' },
    degraded: { icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/30', label: 'Degraded' },
    down: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Down' },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-neon-blue" />
          <h3 className="text-lg font-medium text-white">System Health</h3>
        </div>
        <button onClick={fetchHealth} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-all">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && records.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin text-slate-500" size={24} />
        </div>
      ) : records.length === 0 ? (
        <div className="text-center text-slate-600 text-sm py-8">Нет данных о сервисах</div>
      ) : (
        <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
          {records.map((record) => {
            const config = statusConfig[record.status] || statusConfig.down;
            const Icon = config.icon;
            return (
              <motion.div
                key={record.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className={`p-3 rounded-xl border ${config.bg} ${config.border} flex items-center gap-3`}
              >
                <Icon size={18} className={config.color} />
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-white">{record.service_name}</span>
                    <span className={`text-xs font-mono ${config.color}`}>{config.label}</span>
                  </div>
                  {record.error_message && (
                    <p className="text-xs text-red-400 mt-1 truncate">{record.error_message}</p>
                  )}
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Last check: {new Date(record.last_check).toLocaleTimeString('ru-RU')}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
