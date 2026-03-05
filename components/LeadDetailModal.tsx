import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, User, Building2, Phone, Mail, Globe, TrendingUp,
    MessageSquare, Send, ChevronRight, Clock, CheckCircle2,
    AlertCircle, Video, Zap, ArrowUpRight, History, Tag,
    DollarSign, Calendar, Edit3, Save, XCircle
} from 'lucide-react';
import { ConversationTimeline } from './ConversationTimeline';
import { supabase } from '../lib/supabase';
import { Seller, SellerStatus } from '../types';

interface Interaction {
    id: string;
    seller_id: string | null;
    channel: 'TELEGRAM' | 'WHATSAPP' | 'EMAIL' | null;
    direction: 'OUTBOUND' | 'INBOUND' | null;
    content: string | null;
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'PENDING_SEND' | null;
    sent_at: string | null;
}

interface LeadDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    seller: Seller | null;
    projectId?: string;
    isSandbox?: boolean;
    onStatusChange?: (sellerId: string, newStatus: SellerStatus) => void;
    onSellerUpdated?: () => void;
}

const STATUS_FLOW: SellerStatus[] = ['NEW', 'QUALIFIED', 'CONTACTED', 'HOOK_SENT', 'REPLIED', 'ZOOM_BOOKED', 'CONVERTED'];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    NEW: { label: 'Новый', color: 'text-slate-300', bg: 'bg-slate-700/50', icon: <User size={14} /> },
    QUALIFIED: { label: 'Квалифицирован', color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <CheckCircle2 size={14} /> },
    CONTACTED: { label: 'Контакт', color: 'text-purple-400', bg: 'bg-purple-500/20', icon: <Send size={14} /> },
    HOOK_SENT: { label: 'Хук отправлен', color: 'text-indigo-400', bg: 'bg-indigo-500/20', icon: <Zap size={14} /> },
    REPLIED: { label: 'Ответил', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: <MessageSquare size={14} /> },
    ZOOM_BOOKED: { label: 'Зум назначен', color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: <Video size={14} /> },
    CONVERTED: { label: 'Конвертирован', color: 'text-green-400', bg: 'bg-green-500/20', icon: <DollarSign size={14} /> },
    REJECTED: { label: 'Отказ', color: 'text-red-400', bg: 'bg-red-500/20', icon: <XCircle size={14} /> },
};

const CHANNEL_ICONS: Record<string, string> = {
    TELEGRAM: '📱',
    WHATSAPP: '💬',
    EMAIL: '📧',
};

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
    isOpen, onClose, seller, projectId, isSandbox, onStatusChange, onSellerUpdated
}) => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loadingInteractions, setLoadingInteractions] = useState(false);
    const [changingStatus, setChangingStatus] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [editData, setEditData] = useState<{
        contact_name: string;
        phone: string;
        email: string;
        pain_points: string;
    }>({ contact_name: '', phone: '', email: '', pain_points: '' });
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'dialog' | 'actions'>('overview');

    const fetchInteractions = useCallback(async () => {
        if (!seller || isSandbox) return;
        setLoadingInteractions(true);
        try {
            const { data, error } = await (supabase.from('interactions') as any)
                .select('*')
                .eq('seller_id', seller.id)
                .order('sent_at', { ascending: false })
                .limit(50);
            if (error) {
                // Table may not exist yet
                if ((error as any).code !== '42P01') {
                    console.warn('fetchInteractions error:', error.message);
                }
                setInteractions([]);
                return;
            }
            setInteractions((data as Interaction[]) || []);
        } catch (e) {
            console.warn('fetchInteractions exception:', e);
            setInteractions([]);
        } finally {
            setLoadingInteractions(false);
        }
    }, [seller, isSandbox]);

    useEffect(() => {
        if (isOpen && seller) {
            fetchInteractions();
            setEditData({
                contact_name: seller.contact_name || '',
                phone: seller.phone || '',
                email: seller.email || '',
                pain_points: Array.isArray(seller.pain_points) ? seller.pain_points.join(', ') : '',
            });
            setEditMode(false);
            setActiveTab('overview');
        }
    }, [isOpen, seller, fetchInteractions]);

    const handleStatusChange = async (newStatus: SellerStatus) => {
        if (!seller) return;
        setChangingStatus(true);
        try {
            if (isSandbox) {
                onStatusChange?.(seller.id, newStatus);
            } else {
                const { error } = await (supabase.from('sellers') as any)
                    .update({ status: newStatus, updated_at: new Date().toISOString() })
                    .eq('id', seller.id);
                if (error) {
                    console.error('Error updating seller status:', error);
                    alert('Ошибка обновления статуса');
                    return;
                }
                onSellerUpdated?.();
            }
        } catch (e) {
            console.error('Status change failed:', e);
        } finally {
            setChangingStatus(false);
        }
    };

    const handleSaveEdit = async () => {
        if (!seller) return;
        setSaving(true);
        try {
            const painArr = editData.pain_points
                .split(',')
                .map(s => s.trim())
                .filter(Boolean);

            if (isSandbox) {
                onSellerUpdated?.();
            } else {
                const { error } = await (supabase.from('sellers') as any)
                    .update({
                        contact_name: editData.contact_name || null,
                        phone: editData.phone || null,
                        email: editData.email || null,
                        pain_points: painArr.length > 0 ? painArr : null,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', seller.id);
                if (error) {
                    console.error('Error saving seller:', error);
                    alert('Ошибка сохранения');
                    return;
                }
                onSellerUpdated?.();
            }
            setEditMode(false);
        } catch (e) {
            console.error('Save failed:', e);
        } finally {
            setSaving(false);
        }
    };

    const getNextStatuses = (): SellerStatus[] => {
        if (!seller) return [];
        const currentIdx = STATUS_FLOW.indexOf(seller.status);
        const next: SellerStatus[] = [];
        if (currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1) {
            next.push(STATUS_FLOW[currentIdx + 1]);
        }
        if (seller.status !== 'REJECTED') {
            next.push('REJECTED');
        }
        return next;
    };

    const currentConfig = seller ? STATUS_CONFIG[seller.status] || STATUS_CONFIG.NEW : STATUS_CONFIG.NEW;
    const currentStepIdx = seller ? STATUS_FLOW.indexOf(seller.status) : 0;
    const progressPercent = seller
        ? seller.status === 'REJECTED'
            ? 0
            : ((currentStepIdx + 1) / STATUS_FLOW.length) * 100
        : 0;

    if (!isOpen || !seller) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 30 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-[#0a0a12] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-[0_20px_80px_rgba(139,92,246,0.15)] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-5 border-b border-white/10 bg-gradient-to-r from-[#0a0a12] to-[#120a20]">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-12 h-12 rounded-xl ${currentConfig.bg} flex items-center justify-center`}>
                                    <Building2 size={22} className={currentConfig.color} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{seller.brand_name}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${currentConfig.bg} ${currentConfig.color}`}>
                                            {currentConfig.label}
                                        </span>
                                        {seller.source && (
                                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase">
                                                {seller.source}
                                            </span>
                                        )}
                                        {seller.variant && (
                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${seller.variant === 'A' ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                                VAR {seller.variant}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-2">
                            <div className="flex items-center justify-between mb-2">
                                {STATUS_FLOW.map((status, idx) => {
                                    const cfg = STATUS_CONFIG[status];
                                    const isActive = idx <= currentStepIdx && seller.status !== 'REJECTED';
                                    const isCurrent = status === seller.status;
                                    return (
                                        <div key={status} className="flex items-center gap-1 flex-1">
                                            <div className={`flex items-center gap-1 ${isCurrent ? cfg.color : isActive ? 'text-slate-300' : 'text-slate-600'}`}>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${isCurrent ? cfg.bg : isActive ? 'bg-white/10' : 'bg-slate-800/50'}`}>
                                                    {idx + 1}
                                                </div>
                                                <span className="text-[8px] uppercase tracking-wider hidden xl:block">{cfg.label.slice(0, 6)}</span>
                                            </div>
                                            {idx < STATUS_FLOW.length - 1 && (
                                                <div className={`flex-1 h-0.5 mx-1 rounded ${isActive ? 'bg-gradient-to-r from-purple-500/50 to-purple-500/20' : 'bg-slate-800'}`} />
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPercent}%` }}
                                    transition={{ duration: 0.8, ease: 'easeOut' }}
                                    className="h-full bg-gradient-to-r from-purple-600 via-blue-500 to-green-500 rounded-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-white/10">
                        {([
                            { key: 'overview', label: 'Обзор', icon: <User size={14} /> },
                            { key: 'dialog', label: 'Диалог', icon: <MessageSquare size={14} /> },
                            { key: 'timeline', label: 'Взаимодействия', icon: <History size={14} /> },
                            { key: 'actions', label: 'Действия', icon: <ArrowUpRight size={14} /> },
                        ] as const).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${activeTab === tab.key
                                        ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                                        : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5'
                                    }`}
                            >
                                {tab.icon}
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {/* Overview Tab */}
                        {activeTab === 'overview' && (
                            <div className="p-5 space-y-5">
                                {/* Key Metrics */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                                        <TrendingUp size={16} className="mx-auto text-green-400 mb-1" />
                                        <div className="text-lg font-bold text-white font-mono">
                                            {seller.revenue_monthly ? `${(seller.revenue_monthly / 1000000).toFixed(1)}M` : '—'}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase">Выручка / мес</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                                        <Tag size={16} className="mx-auto text-purple-400 mb-1" />
                                        <div className="text-lg font-bold text-white">
                                            {seller.top_product_name ? seller.top_product_name.slice(0, 15) : '—'}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase">Топ товар</div>
                                    </div>
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
                                        <Calendar size={16} className="mx-auto text-blue-400 mb-1" />
                                        <div className="text-sm font-medium text-white">
                                            {seller.created_at
                                                ? new Date(seller.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
                                                : '—'}
                                        </div>
                                        <div className="text-[10px] text-slate-500 uppercase">Добавлен</div>
                                    </div>
                                </div>

                                {/* Contact Info */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                            <User size={14} className="text-purple-400" />
                                            Контактные данные
                                        </h3>
                                        <button
                                            onClick={() => setEditMode(!editMode)}
                                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                                        >
                                            <Edit3 size={14} />
                                        </button>
                                    </div>

                                    {editMode ? (
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Контактное лицо</label>
                                                <input
                                                    value={editData.contact_name}
                                                    onChange={e => setEditData(p => ({ ...p, contact_name: e.target.value }))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-purple-500 outline-none"
                                                    placeholder="Имя контактного лица"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Телефон</label>
                                                    <input
                                                        value={editData.phone}
                                                        onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))}
                                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-purple-500 outline-none"
                                                        placeholder="+7 ..."
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[10px] text-slate-500 uppercase mb-1 block">Email</label>
                                                    <input
                                                        value={editData.email}
                                                        onChange={e => setEditData(p => ({ ...p, email: e.target.value }))}
                                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-purple-500 outline-none"
                                                        placeholder="email@example.com"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-slate-500 uppercase mb-1 block">Боли клиента (через запятую)</label>
                                                <input
                                                    value={editData.pain_points}
                                                    onChange={e => setEditData(p => ({ ...p, pain_points: e.target.value }))}
                                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-purple-500 outline-none"
                                                    placeholder="масштабирование, лидогенерация, ..."
                                                />
                                            </div>
                                            <div className="flex gap-2 pt-1">
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={saving}
                                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm hover:shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50"
                                                >
                                                    <Save size={14} />
                                                    {saving ? 'Сохранение...' : 'Сохранить'}
                                                </button>
                                                <button
                                                    onClick={() => setEditMode(false)}
                                                    className="px-4 py-2 text-slate-400 hover:text-white text-sm transition-colors"
                                                >
                                                    Отмена
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-3 text-sm">
                                                <User size={14} className="text-slate-500" />
                                                <span className="text-slate-300">{(seller as any).contact_name || 'Не указано'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <Phone size={14} className="text-slate-500" />
                                                <span className="text-slate-300">{(seller as any).phone || 'Не указано'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 text-sm">
                                                <Mail size={14} className="text-slate-500" />
                                                <span className="text-slate-300">{(seller as any).email || 'Не указано'}</span>
                                            </div>
                                            {seller.inn && (
                                                <div className="flex items-center gap-3 text-sm">
                                                    <Building2 size={14} className="text-slate-500" />
                                                    <span className="text-slate-300 font-mono">ИНН: {seller.inn}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Pain Points */}
                                {seller.pain_points && (seller.pain_points as string[]).length > 0 && (
                                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                            <AlertCircle size={14} className="text-amber-400" />
                                            Боли клиента
                                        </h3>
                                        <div className="flex flex-wrap gap-2">
                                            {(seller.pain_points as string[]).map((pain, i) => (
                                                <span key={i} className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                                    {pain}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Dialog Tab */}
                        {activeTab === 'dialog' && (
                            <div className="p-5">
                                <ConversationTimeline sellerId={seller.id} isSandbox={isSandbox} />
                            </div>
                        )}

                        {/* Timeline Tab */}
                        {activeTab === 'timeline' && (
                            <div className="p-5">
                                {loadingInteractions ? (
                                    <div className="flex items-center justify-center py-12 text-slate-500">
                                        <div className="animate-spin w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full mr-3" />
                                        Загрузка истории...
                                    </div>
                                ) : interactions.length === 0 ? (
                                    <div className="text-center py-12">
                                        <History size={32} className="mx-auto text-slate-600 mb-3" />
                                        <p className="text-slate-500 text-sm">Нет записей в истории</p>
                                        <p className="text-slate-600 text-xs mt-1">Взаимодействия появятся здесь автоматически</p>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        {/* Timeline Line */}
                                        <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-blue-500/30 to-transparent" />

                                        <div className="space-y-4">
                                            {interactions.map((interaction, idx) => (
                                                <motion.div
                                                    key={interaction.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="relative pl-10"
                                                >
                                                    {/* Timeline Dot */}
                                                    <div className={`absolute left-2.5 top-3 w-3 h-3 rounded-full border-2 ${interaction.direction === 'OUTBOUND'
                                                            ? 'bg-purple-500/30 border-purple-500'
                                                            : 'bg-green-500/30 border-green-500'
                                                        }`} />

                                                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 hover:border-white/20 transition-colors">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm">
                                                                    {interaction.channel ? CHANNEL_ICONS[interaction.channel] || '📨' : '📨'}
                                                                </span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${interaction.direction === 'OUTBOUND'
                                                                        ? 'bg-purple-500/20 text-purple-400'
                                                                        : 'bg-green-500/20 text-green-400'
                                                                    }`}>
                                                                    {interaction.direction === 'OUTBOUND' ? 'Исходящее' : 'Входящее'}
                                                                </span>
                                                                {interaction.status && (
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase ${interaction.status === 'SENT' ? 'bg-blue-500/10 text-blue-400' :
                                                                            interaction.status === 'DELIVERED' ? 'bg-green-500/10 text-green-400' :
                                                                                interaction.status === 'READ' ? 'bg-emerald-500/10 text-emerald-400' :
                                                                                    interaction.status === 'FAILED' ? 'bg-red-500/10 text-red-400' :
                                                                                        'bg-yellow-500/10 text-yellow-400'
                                                                        }`}>
                                                                        {interaction.status}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                                                <Clock size={10} />
                                                                {interaction.sent_at
                                                                    ? new Date(interaction.sent_at).toLocaleString('ru-RU', {
                                                                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                                                                    })
                                                                    : 'N/A'}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-slate-300 leading-relaxed">
                                                            {interaction.content || 'Нет содержимого'}
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Actions Tab */}
                        {activeTab === 'actions' && (
                            <div className="p-5 space-y-5">
                                {/* Current Status */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3">Текущий статус</h3>
                                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${currentConfig.bg} ${currentConfig.color} text-sm font-bold`}>
                                        {currentConfig.icon}
                                        {currentConfig.label}
                                    </div>
                                </div>

                                {/* Move to Next Stage */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                        <ChevronRight size={14} className="text-purple-400" />
                                        Перевести на этап
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {getNextStatuses().map(status => {
                                            const cfg = STATUS_CONFIG[status];
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusChange(status)}
                                                    disabled={changingStatus}
                                                    className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-all text-sm font-medium disabled:opacity-50 ${status === 'REJECTED'
                                                            ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                            : 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                                                        }`}
                                                >
                                                    {cfg.icon}
                                                    {cfg.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                                        <Zap size={14} className="text-amber-400" />
                                        Быстрые действия
                                    </h3>
                                    <div className="space-y-2">
                                        {STATUS_FLOW.filter(s => s !== seller.status && s !== 'REJECTED').map(status => {
                                            const cfg = STATUS_CONFIG[status];
                                            const isBefore = STATUS_FLOW.indexOf(status) < STATUS_FLOW.indexOf(seller.status);
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => handleStatusChange(status)}
                                                    disabled={changingStatus}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border transition-all text-sm disabled:opacity-50 ${isBefore
                                                            ? 'border-white/5 bg-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/10'
                                                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:border-purple-500/30'
                                                        }`}
                                                >
                                                    <span className={`${cfg.color}`}>{cfg.icon}</span>
                                                    <span>{cfg.label}</span>
                                                    {isBefore && <span className="text-[10px] text-slate-600 ml-auto">← назад</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
