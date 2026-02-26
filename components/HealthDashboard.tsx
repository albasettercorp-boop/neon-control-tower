import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GlassCard } from './GlassCard';
import { Activity, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface HealthStatus {
    id: string;
    service_name: string;
    status: 'healthy' | 'degraded' | 'down';
    last_check: string;
    error_message?: string;
}

export const HealthDashboard: React.FC = () => {
    const [healthData, setHealthData] = useState<HealthStatus[]>([]);
    const [loading, setLoading] = useState(true);

    const TARGET_SERVICES = useMemo(() => ['WB_API', 'TELEGRAM', 'WORKER'], []);

    const fetchHealth = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('account_health')
                .select('*')
                .in('service_name', TARGET_SERVICES)
                .order('service_name', { ascending: true });

            if (error) throw error;

            const rows = (data || []) as HealthStatus[];
            const byName = new Map(rows.map((row) => [row.service_name, row]));
            const normalized = TARGET_SERVICES.map((serviceName) => {
                const existing = byName.get(serviceName);
                if (existing) return existing;
                return {
                    id: `missing-${serviceName}`,
                    service_name: serviceName,
                    status: 'down' as const,
                    last_check: new Date(0).toISOString(),
                    error_message: 'Нет данных health check',
                };
            });
            setHealthData(normalized);
        } catch (err) {
            console.error('Error fetching health:', err);
        } finally {
            setLoading(false);
        }
    }, [TARGET_SERVICES]);

    useEffect(() => {
        fetchHealth();

        // Realtime subscription
        const channel = supabase
            .channel('health-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'account_health' },
                () => {
                    fetchHealth();
                }
            )
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle className="w-5 h-5 text-green-400" />;
            case 'degraded':
                return <AlertCircle className="w-5 h-5 text-yellow-400" />;
            case 'down':
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return <Activity className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'healthy':
                return 'bg-green-500/20 border-green-500/50';
            case 'degraded':
                return 'bg-yellow-500/20 border-yellow-500/50';
            case 'down':
                return 'bg-red-500/20 border-red-500/50';
            default:
                return 'bg-gray-500/20 border-gray-500/50';
        }
    };

    if (loading) {
        return (
            <GlassCard className="p-6">
                <div className="flex items-center justify-center">
                    <Activity className="w-6 h-6 animate-spin text-purple-400" />
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">System Health</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthData.map((service) => (
                    <motion.div
                        key={service.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border ${getStatusColor(service.status)}`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-white">
                                {service.service_name}
                            </span>
                            {getStatusIcon(service.status)}
                        </div>

                        <div className="text-sm text-gray-400">
                            Last check: {new Date(service.last_check).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>

                        {service.error_message && (
                            <div className="mt-2 text-xs text-red-300">
                                {service.error_message}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>

            {healthData.length === 0 && (
                <div className="text-center text-gray-400 py-8">
                    No health data available
                </div>
            )}
        </GlassCard>
    );
};
