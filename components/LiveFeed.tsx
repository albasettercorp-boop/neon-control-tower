import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FeedItem } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, MessageCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LiveFeedProps {
  items?: FeedItem[];
  projectId?: string;
}

interface SystemLogRow {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  created_at: string;
  project_id?: string | null;
}

const getStatusIcon = (status: FeedItem['status']) => {
  switch (status) {
    case 'success': return <CheckCircle2 size={16} className="text-neon-green" />;
    case 'positive': return <MessageCircle size={16} className="text-neon-blue" />;
    case 'negative': return <XCircle size={16} className="text-red-500" />;
    default: return <Clock size={16} className="text-slate-500" />;
  }
};

const getStatusColor = (status: FeedItem['status']) => {
   switch (status) {
    case 'success': return 'bg-neon-green/10 border-neon-green/20';
    case 'positive': return 'bg-neon-blue/10 border-neon-blue/20';
    case 'negative': return 'bg-red-500/10 border-red-500/20';
    default: return 'bg-slate-800/30 border-slate-700/30';
  }
};

export const LiveFeed: React.FC<LiveFeedProps> = ({ items = [], projectId }) => {
  const [logItems, setLogItems] = useState<FeedItem[]>([]);

  const toFeedItem = useCallback((row: SystemLogRow): FeedItem => {
    const date = new Date(row.created_at);
    const status: FeedItem['status'] = row.level === 'error' || row.level === 'critical'
      ? 'negative'
      : row.level === 'warning'
        ? 'neutral'
        : 'success';

    return {
      id: row.id,
      agent: 'Artem',
      action: 'Reply',
      target: row.message,
      time: date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      status,
    };
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      let query = (supabase.from('system_logs') as any)
        .select('id,level,source,message,created_at,project_id')
        .order('created_at', { ascending: false })
        .limit(30);

      if (projectId) {
        query = query.or(`project_id.eq.${projectId},project_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapped = ((data as SystemLogRow[]) || []).map(toFeedItem);
      setLogItems(mapped);
    } catch (e) {
      console.error('LiveFeed fetch logs failed:', e);
    }
  }, [projectId, toFeedItem]);

  useEffect(() => {
    fetchLogs();

    const channel = supabase
      .channel('live_feed_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'system_logs' }, (payload) => {
        const row = payload.new as SystemLogRow;
        if (projectId && row.project_id && row.project_id !== projectId) {
          return;
        }
        setLogItems((prev) => [toFeedItem(row), ...prev].slice(0, 30));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs, projectId, toFeedItem]);

  const mergedItems = useMemo(() => {
    if (logItems.length > 0) return logItems;
    return items;
  }, [items, logItems]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          Live Feed
        </h3>
        <span className="text-xs text-slate-500 font-mono">REAL-TIME</span>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 relative">
        <AnimatePresence initial={false}>
          {mergedItems.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className="mb-3"
            >
              <div className={`p-3 rounded-xl border backdrop-blur-sm flex items-center gap-3 ${getStatusColor(item.status)}`}>
                <div className="flex-shrink-0">
                  {getStatusIcon(item.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <p className="text-sm font-medium text-white truncate">{item.target}</p>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">{item.time}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                     <p className="text-xs text-slate-300 truncate pr-2">
                        {item.agent} • {item.action}
                     </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {mergedItems.length === 0 && (
           <div className="text-center text-slate-600 text-sm py-10">Waiting for activity...</div>
        )}
      </div>
    </div>
  );
};
