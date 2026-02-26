import React, { useCallback, useEffect, useState } from 'react';
import { Zap, Play, Users, TrendingUp, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Seller } from '../types';
import { motion } from 'framer-motion';

interface SmartFunnelControlProps {
  projectId?: string;
}

export const SmartFunnelControl: React.FC<SmartFunnelControlProps> = ({ projectId }) => {
  const [newLeadsBySource, setNewLeadsBySource] = useState<Record<string, number>>({});
  const [processing, setProcessing] = useState(false);
  const [totalNew, setTotalNew] = useState(0);

  const fetchNewLeads = useCallback(async () => {
    try {
      let query = (supabase.from('sellers') as any)
        .select('id,source')
        .eq('status', 'NEW');
      if (projectId) query = query.eq('project_id', projectId);

      const { data, error } = await query;
      if (error) throw error;

      const sellers = (data as Seller[]) || [];
      setTotalNew(sellers.length);

      const counts: Record<string, number> = {};
      sellers.forEach(s => {
        const src = s.source || 'OTHER';
        counts[src] = (counts[src] || 0) + 1;
      });
      setNewLeadsBySource(counts);
    } catch (e) {
      console.error('SmartFunnel fetch error:', e);
    }
  }, [projectId]);

  useEffect(() => {
    fetchNewLeads();
  }, [fetchNewLeads]);

  const handleBatchQualify = async () => {
    if (processing) return;
    setProcessing(true);
    try {
      const { error } = await (supabase.from('worker_commands') as any).insert({
        action: 'outreach',
        params: { project_id: projectId, batch_size: 20 },
        status: 'pending',
      });
      if (error) throw error;
      setTimeout(fetchNewLeads, 2000);
    } catch (e) {
      console.error('Batch qualify error:', e);
    } finally {
      setTimeout(() => setProcessing(false), 3000);
    }
  };

  const sourceEntries = Object.entries(newLeadsBySource).sort((a, b) => b[1] - a[1]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={18} className="text-yellow-400" />
          <h3 className="text-lg font-medium text-white">Smart Funnel</h3>
          <span className="px-2 py-0.5 bg-yellow-400/10 text-yellow-400 text-xs rounded-full font-mono">{totalNew} new</span>
        </div>
        <button
          onClick={handleBatchQualify}
          disabled={processing || totalNew === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-600 text-white rounded-lg text-xs font-medium hover:shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all disabled:opacity-50"
        >
          {processing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
          {processing ? 'Обработка...' : 'Обработать все'}
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
        {sourceEntries.length === 0 ? (
          <div className="text-center text-slate-600 text-sm py-6">Нет новых лидов</div>
        ) : (
          sourceEntries.map(([source, count]) => (
            <motion.div
              key={source}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/30 border border-white/5 hover:border-yellow-500/20 transition-all"
            >
              <div className="p-2 rounded-lg bg-yellow-400/10">
                <Users size={16} className="text-yellow-400" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{source}</div>
                <div className="text-xs text-slate-500">Новые лиды</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-yellow-400 font-mono">{count}</span>
                <TrendingUp size={14} className="text-yellow-400/50" />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
