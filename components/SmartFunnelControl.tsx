import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { GlassCard } from './GlassCard';
import { Zap, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface SmartFunnelControlProps {
    projectId?: string;
}

export const SmartFunnelControl: React.FC<SmartFunnelControlProps> = ({ projectId }) => {
    const [stats, setStats] = useState<Record<string, number>>({});
    const [processing, setProcessing] = useState(false);
    const [lastProcessed, setLastProcessed] = useState(0);
    const [lastSource, setLastSource] = useState<string>('ALL');

    useEffect(() => {
        fetchStats();

        const channel = supabase
            .channel('smart_funnel_stats')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'sellers' },
                () => {
                    fetchStats();
                }
            )
            .subscribe();

        // Fallback polling in case realtime misses an event
        const interval = setInterval(fetchStats, 15000);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [projectId]);

    const fetchStats = async () => {
        try {
            let query = supabase
                .from('sellers')
                .select('source, status')
                .eq('status', 'NEW');

            if (projectId) {
                query = query.eq('project_id', projectId);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Group by source
            const grouped: Record<string, number> = {};
            data?.forEach(seller => {
                const source = seller.source || 'UNKNOWN';
                grouped[source] = (grouped[source] || 0) + 1;
            });

            setStats(grouped);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const processBatch = async (source: string, limit: number) => {
        setProcessing(true);

        try {
            const params: Record<string, any> = {
                mode: 'smart_funnel_batch',
                source,
                limit,
            };
            if (projectId) {
                params.project_id = projectId;
            }

            const { data: command, error: commandError } = await (supabase.from('worker_commands') as any)
                .insert({
                    action: 'outreach',
                    params,
                    status: 'pending',
                })
                .select('id')
                .single();

            if (commandError) throw commandError;

            const commandId = command?.id;
            if (!commandId) {
                throw new Error('Failed to create smart funnel command');
            }

            let processedCount = 0;
            for (let attempt = 0; attempt < 20; attempt++) {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                const { data: state, error: stateError } = await (supabase.from('worker_commands') as any)
                    .select('status,result,error')
                    .eq('id', commandId)
                    .single();

                if (stateError) throw stateError;

                if (state?.status === 'failed') {
                    throw new Error(state?.error || 'Worker command failed');
                }

                if (state?.status === 'completed') {
                    const result = typeof state.result === 'string'
                        ? JSON.parse(state.result)
                        : state.result || {};
                    processedCount = Number(result.processed || 0);
                    break;
                }
            }

            setLastProcessed(processedCount);
            setLastSource(source);
            await fetchStats();

            console.log(`✅ Smart funnel processed ${processedCount} leads from ${source}`);
        } catch (err: any) {
            console.error('Error processing batch:', err);
            alert(`Error: ${err.message}`);
        } finally {
            setProcessing(false);
        }
    };

    const totalNew = Object.values(stats).reduce((sum: number, count: number) => sum + count, 0);

    return (
        <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <Zap className="w-6 h-6 text-yellow-400" />
                <h2 className="text-xl font-bold text-white">Smart Funnel</h2>
            </div>

            <div className="mb-6">
                <div className="text-sm text-gray-400 mb-2">NEW Leads by Source</div>
                <div className="grid grid-cols-2 gap-3">
                    {Object.entries(stats).map(([source, count]) => (
                        <div key={source} className="bg-white/5 rounded-lg p-3">
                            <div className="text-xs text-gray-400">{source}</div>
                            <div className="text-2xl font-bold text-white">{count}</div>
                        </div>
                    ))}
                    <div className="bg-purple-500/20 rounded-lg p-3 border border-purple-500/50">
                        <div className="text-xs text-purple-300">TOTAL</div>
                        <div className="text-2xl font-bold text-white">{totalNew}</div>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                {Object.entries(stats).map(([source, count]) => (
                    <button
                        key={source}
                        onClick={() => processBatch(source, 10)}
                        disabled={processing || count === 0}
                        className="w-full bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-between"
                    >
                        <span>Process 10 from {source}</span>
                        <span className="text-xs text-slate-300">{count} NEW</span>
                    </button>
                ))}

                <button
                    onClick={() => processBatch('ALL', 20)}
                    disabled={processing || totalNew === 0}
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                    {processing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            <Zap className="w-5 h-5" />
                            Process 20 Leads (All Sources)
                        </>
                    )}
                </button>

                {lastProcessed > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center text-sm text-green-400"
                    >
                        ✅ Processed {lastProcessed} leads ({lastSource})
                    </motion.div>
                )}
            </div>
        </GlassCard>
    );
};
