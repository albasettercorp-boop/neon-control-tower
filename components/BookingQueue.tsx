/**
 * Booking Queue - Утверждение встреч
 * Supabase direct integration + real-time updates
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, CheckCircle, XCircle, User, TrendingUp, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface BookingRequest {
    id: string;
    seller_id: string;
    conversation_summary: string | null;
    proposed_times: string[] | null;
    lead_quality_score: number | null;
    status: string;
    created_at: string;
    seller?: {
        brand_name: string;
        revenue_monthly: number | null;
    } | null;
}

const QUALITY_COLOR = (score: number | null) => {
    if (!score) return 'text-slate-400';
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
};

export function BookingQueue() {
    const [bookings, setBookings] = useState<BookingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadBookings = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('booking_requests')
                .select(`
                    *,
                    seller:sellers(brand_name, revenue_monthly)
                `)
                .eq('status', 'pending_approval')
                .order('created_at', { ascending: false });

            if (error) {
                if ((error as any).code !== '42P01') {
                    console.error('Error loading bookings:', error);
                }
                setBookings([]);
            } else {
                setBookings((data as BookingRequest[]) || []);
            }
        } catch (e) {
            console.error('loadBookings exception:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBookings();

        const subscription = supabase
            .channel('booking_requests_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'booking_requests',
            }, () => {
                loadBookings();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleApprove = async (id: string, time: string) => {
        setActionLoading(id + time);
        try {
            const { error } = await supabase
                .from('booking_requests')
                .update({
                    status: 'confirmed',
                    approved_time: time,
                    approved_by: 'manager',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) throw error;
            await loadBookings();
        } catch (error) {
            console.error('Error approving:', error);
            alert('Ошибка утверждения');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('Отклонить заявку на Zoom?')) return;
        setActionLoading(id);
        try {
            const { error } = await supabase
                .from('booking_requests')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id);

            if (error) throw error;
            await loadBookings();
        } catch (error) {
            console.error('Error rejecting:', error);
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="h-full flex flex-col bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            {/* Header */}
            <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-cyan-400" />
                        <h2 className="text-lg font-bold text-white">Booking Queue</h2>
                        {!loading && (
                            <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full font-mono">
                                {bookings.length}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">Заявки на Zoom — требуют утверждения</p>
                </div>
                <button
                    onClick={loadBookings}
                    disabled={loading}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
                    title="Обновить"
                >
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-500">
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Загрузка заявок...
                    </div>
                ) : bookings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-600">
                        <Calendar size={48} className="text-slate-800 mb-4" />
                        <p className="text-slate-500 font-medium">Нет заявок на утверждение</p>
                        <p className="text-slate-600 text-xs mt-1">Новые заявки появятся автоматически</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {bookings.map((booking, idx) => (
                            <motion.div
                                key={booking.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-cyan-500/30 transition-colors"
                            >
                                <div className="grid md:grid-cols-3 gap-5">
                                    {/* Lead Info */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-600/30 to-blue-600/30 border border-white/10 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                                                {(booking.seller?.brand_name || '?').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-semibold text-white">
                                                    {booking.seller?.brand_name || 'Unknown'}
                                                </h3>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <TrendingUp size={10} className="text-slate-500" />
                                                    <span className="text-[10px] text-slate-500">
                                                        {booking.seller?.revenue_monthly
                                                            ? `${(booking.seller.revenue_monthly / 1000000).toFixed(1)}M ₽/мес`
                                                            : '—'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-3">
                                            <span className="text-[10px] text-slate-500">Качество лида:</span>
                                            <span className={`text-sm font-bold font-mono ${QUALITY_COLOR(booking.lead_quality_score)}`}>
                                                {booking.lead_quality_score?.toFixed(1) ?? '—'}/10
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-600 mt-1 font-mono">
                                            {new Date(booking.created_at).toLocaleString('ru-RU', {
                                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase mb-2">Сводка диалога</p>
                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            {booking.conversation_summary || 'Сводка отсутствует'}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div>
                                        <p className="text-[10px] text-slate-500 uppercase mb-2 flex items-center gap-1">
                                            <Clock size={10} /> Предложенное время
                                        </p>
                                        <div className="space-y-2">
                                            {booking.proposed_times && booking.proposed_times.length > 0 ? (
                                                booking.proposed_times.map((time: string, i: number) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => handleApprove(booking.id, time)}
                                                        disabled={!!actionLoading}
                                                        className="w-full px-3 py-2 bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/20 hover:border-green-500/40 rounded-lg flex items-center gap-2 text-xs font-medium transition-all disabled:opacity-50"
                                                    >
                                                        {actionLoading === booking.id + time ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            <CheckCircle size={12} />
                                                        )}
                                                        {new Date(time).toLocaleString('ru-RU', {
                                                            weekday: 'short', day: 'numeric', month: 'short',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </button>
                                                ))
                                            ) : (
                                                <p className="text-xs text-slate-600 italic">Нет слотов</p>
                                            )}

                                            <button
                                                onClick={() => handleReject(booking.id)}
                                                disabled={!!actionLoading}
                                                className="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-lg flex items-center justify-center gap-2 text-xs font-medium transition-all disabled:opacity-50 mt-1"
                                            >
                                                {actionLoading === booking.id ? (
                                                    <Loader2 size={12} className="animate-spin" />
                                                ) : (
                                                    <XCircle size={12} />
                                                )}
                                                Отклонить
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
