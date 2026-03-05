import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, User, Bot, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Message {
    id: string;
    seller_id: string;
    message_text: string;
    sender: 'agent' | 'lead' | 'operator';
    channel?: string;
    timestamp: string;
    intent?: string;
    sentiment_score?: number;
}

interface ConversationTimelineProps {
    sellerId: string;
    isSandbox?: boolean;
}

const INTENT_LABELS: Record<string, string> = {
    interested: 'Интерес',
    objection: 'Возражение',
    question: 'Вопрос',
    ready_for_zoom: 'Готов к Zoom',
    not_interested: 'Не интересно',
    spam: 'Спам',
};

const INTENT_COLORS: Record<string, string> = {
    interested: 'bg-green-500/20 text-green-400',
    objection: 'bg-amber-500/20 text-amber-400',
    question: 'bg-blue-500/20 text-blue-400',
    ready_for_zoom: 'bg-cyan-500/20 text-cyan-400',
    not_interested: 'bg-red-500/20 text-red-400',
    spam: 'bg-slate-500/20 text-slate-400',
};

export const ConversationTimeline: React.FC<ConversationTimelineProps> = ({ sellerId, isSandbox }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);

    const loadMessages = async () => {
        if (isSandbox) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('conversations')
                .select('*')
                .eq('seller_id', sellerId)
                .order('timestamp', { ascending: true });

            if (error) {
                if ((error as any).code !== '42P01') {
                    console.warn('ConversationTimeline error:', error.message);
                }
                setMessages([]);
            } else {
                setMessages((data as Message[]) || []);
            }
        } catch (e) {
            console.warn('ConversationTimeline exception:', e);
            setMessages([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMessages();

        if (isSandbox) return;

        const subscription = supabase
            .channel(`conversations:${sellerId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'conversations',
                filter: `seller_id=eq.${sellerId}`,
            }, () => {
                loadMessages();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [sellerId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-slate-500">
                <Loader2 className="animate-spin mr-2" size={16} />
                Загрузка диалога...
            </div>
        );
    }

    if (messages.length === 0) {
        return (
            <div className="text-center py-12">
                <MessageCircle size={32} className="mx-auto text-slate-700 mb-3" />
                <p className="text-slate-500 text-sm">История диалогов пуста</p>
                <p className="text-slate-600 text-xs mt-1">Сообщения появятся здесь после первого контакта</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-cyan-400" />
                    <span className="text-sm font-semibold text-white">
                        История диалога
                    </span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                        {messages.length}
                    </span>
                </div>
                <button
                    onClick={loadMessages}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                    title="Обновить"
                >
                    <RefreshCw size={13} />
                </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {messages.map((msg, idx) => {
                    const isLead = msg.sender === 'lead';
                    const isAgent = msg.sender === 'agent';

                    return (
                        <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className={`p-3 rounded-xl border text-sm ${
                                isLead
                                    ? 'bg-blue-500/10 border-blue-500/20 ml-0 mr-8'
                                    : isAgent
                                    ? 'bg-purple-500/10 border-purple-500/20 ml-8 mr-0'
                                    : 'bg-slate-800/50 border-white/10'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    {isLead ? (
                                        <User size={11} className="text-blue-400" />
                                    ) : (
                                        <Bot size={11} className="text-purple-400" />
                                    )}
                                    <span className={`text-[10px] font-bold uppercase ${isLead ? 'text-blue-400' : isAgent ? 'text-purple-400' : 'text-slate-400'}`}>
                                        {isLead ? 'Лид' : isAgent ? 'Агент' : 'Оператор'}
                                    </span>
                                    {msg.channel && (
                                        <span className="text-[9px] text-slate-600 uppercase">
                                            {msg.channel}
                                        </span>
                                    )}
                                </div>
                                <span className="text-[9px] text-slate-600 font-mono">
                                    {new Date(msg.timestamp).toLocaleString('ru-RU', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </span>
                            </div>

                            <p className="text-slate-200 leading-relaxed">{msg.message_text}</p>

                            {(msg.intent || msg.sentiment_score !== undefined) && (
                                <div className="mt-2 flex items-center gap-2">
                                    {msg.intent && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${INTENT_COLORS[msg.intent] || 'bg-slate-700 text-slate-400'}`}>
                                            {INTENT_LABELS[msg.intent] || msg.intent}
                                        </span>
                                    )}
                                    {msg.sentiment_score !== undefined && (
                                        <span className="text-[9px] text-slate-600">
                                            Sentiment: {(msg.sentiment_score * 100).toFixed(0)}%
                                        </span>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};
