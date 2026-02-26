import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, TrendingUp, AlertTriangle, User, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateAgentResponse, inferPainPointsFromText, LeadContext } from '../lib/chatAgent';
import { supabase } from '../lib/supabase';
import { ActiveChat } from '../types';

interface Message {
    role: 'user' | 'agent';
    content: string;
    timestamp: Date;
}

interface ChatInterfaceProps {
    isOpen: boolean;
    onClose: () => void;
    leadName: string;
    leadId: string;
    chat?: ActiveChat;
    projectId?: string;
    clientCompanyName?: string;
}

const PAIN_LABELS: Record<string, string> = {
    low_rating: '⭐ Низкий рейтинг',
    stock_issues: '📦 Проблемы со стоками',
    low_trust: '🤝 Мало отзывов',
    high_returns: '↩️ Высокие возвраты',
    poor_seo: '🔍 Плохое SEO',
};

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ isOpen, onClose, leadName, leadId, chat, projectId, clientCompanyName }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [leadContext, setLeadContext] = useState<LeadContext | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Fetch lead context from Supabase when dialog opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchLeadContext = async () => {
            let ctx: LeadContext = { id: leadId, name: leadName, projectId, clientCompanyName };

            // If we have a leadId, try to get full seller data from Supabase
            if (leadId && leadId !== 'sandbox') {
                try {
                    const { data } = await (supabase.from('sellers') as any)
                        .select('brand_name, revenue_monthly, top_product_name, source, telegram_username, phone, email')
                        .eq('id', leadId)
                        .single();

                    if (data) {
                        ctx = {
                            id: leadId,
                            name: data.brand_name || leadName,
                            brandName: data.brand_name,
                            revenue: data.revenue_monthly,
                            topProduct: data.top_product_name,
                            source: data.source,
                            painPoints: (data as any).pain_points || undefined,
                            projectId,
                            clientCompanyName,
                        };
                    }
                } catch (e) {
                    console.warn('[ChatInterface] Could not fetch lead context:', e);
                }
            }

            // Also take pain points from pipeline context if available
            if (chat?.painPoints && chat.painPoints.length > 0) {
                ctx.painPoints = chat.painPoints;
            }

            // Try to derive pain points from previous funnel stage interactions
            if (!ctx.painPoints || ctx.painPoints.length === 0) {
                try {
                    const { data: interactions } = await (supabase.from('interactions') as any)
                        .select('content, channel, status')
                        .eq('seller_id', leadId)
                        .order('sent_at', { ascending: false })
                        .limit(8);

                    const interactionText = (interactions || []).map((row: any) => row.content || '').join(' ');
                    const inferred = inferPainPointsFromText(interactionText);
                    if (inferred.length > 0) {
                        ctx.painPoints = inferred;
                    }
                } catch (error) {
                    console.warn('[ChatInterface] Could not infer pain points from interactions:', error);
                }
            }

            setLeadContext(ctx);

            // Generate opening message based on context
            const openingMsg = generateOpeningMessage(ctx);
            setMessages([
                {
                    role: 'agent',
                    content: openingMsg,
                    timestamp: new Date(),
                },
            ]);
        };

        fetchLeadContext();
    }, [isOpen, leadId, leadName, chat, projectId, clientCompanyName]);

    const generateOpeningMessage = (ctx: LeadContext): string => {
        const name = ctx.brandName || ctx.name;
        const revenue = ctx.revenue;
        const painPoints = ctx.painPoints || [];
        const company = ctx.clientCompanyName || 'вашей команды';

        if (painPoints.length > 0 && revenue) {
            const revenueStr = revenue >= 1_000_000 ? `${(revenue / 1_000_000).toFixed(1)}M` : `${revenue}`;
            const topPain = painPoints[0];
            const painLabel = PAIN_LABELS[topPain] || topPain;
            return `Здравствуйте, ${name}! 👋 Пишу от лица ${company}. Вижу, что оборот около ${revenueStr} RUB/мес и есть проблема: ${painLabel}. Расскажите, как давно это влияет на продажи?`;
        }

        if (revenue && revenue > 3_000_000) {
            return `Здравствуйте, ${name}! 👋 Пишу от лица ${company}. Оборот на WB впечатляет. Какой сейчас главный затык в продажах, который тормозит рост?`;
        }

        return `Здравствуйте! Пишу от лица ${company}. Вижу, что вы продаёте на Wildberries. Какая сейчас самая острая проблема в продажах? 😊`;
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: Message = {
            role: 'user',
            content: inputValue.trim(),
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const agentReply = await generateAgentResponse(
                userMessage.content,
                messages,
                leadContext || { name: leadName }
            );
            const agentMessage: Message = {
                role: 'agent',
                content: agentReply,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, agentMessage]);

            // Log interaction to Supabase if we have a real leadId
            if (leadId && leadId !== 'sandbox') {
                try {
                    await (supabase.from('interactions') as any).insert({
                        seller_id: leadId,
                        channel: 'CHAT_SIM',
                        direction: 'OUTBOUND',
                        content: agentReply,
                        status: 'SENT',
                    });
                } catch (e) {
                    // Non-critical, ignore
                }
            }
        } catch (error) {
            console.error('Failed to get agent response:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'agent',
                    content: 'Извините, произошла ошибка. Попробуйте ещё раз.',
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const [isSendingTelegram, setIsSendingTelegram] = useState(false);

    const handleSendToTelegram = async () => {
        const lastAgentMsg = [...messages].reverse().find((m) => m.role === 'agent');
        if (!lastAgentMsg || !leadId || leadId === 'sandbox') return;

        setIsSendingTelegram(true);
        try {
            // Write queue interaction; supports both new schema (PENDING_SEND) and legacy schema fallback.
            const queued = {
                seller_id: leadId,
                channel: 'TELEGRAM',
                direction: 'OUTBOUND',
                content: lastAgentMsg.content,
                status: 'PENDING_SEND',
            };

            const { error } = await (supabase.from('interactions') as any).insert(queued);

            if (error) {
                // Legacy schema fallback where interactions.status does not support PENDING_SEND.
                const fallbackPayload = {
                    ...queued,
                    content: `[[PENDING_SEND]] ${lastAgentMsg.content}`,
                    status: 'FAILED',
                };
                const { error: fallbackError } = await (supabase.from('interactions') as any).insert(fallbackPayload);
                if (fallbackError) throw fallbackError;
            }

            // Visual feedback
            setMessages((prev) => [
                ...prev,
                {
                    role: 'agent',
                    content: '✅ Сообщение поставлено в очередь для отправки в Telegram. Worker подхватит его в течение 30 секунд.',
                    timestamp: new Date(),
                },
            ]);
        } catch (error) {
            console.error('Failed to queue Telegram message:', error);
            setMessages((prev) => [
                ...prev,
                {
                    role: 'agent',
                    content: '❌ Ошибка при постановке в очередь. Проверьте подключение к БД.',
                    timestamp: new Date(),
                },
            ]);
        } finally {
            setIsSendingTelegram(false);
        }
    };

    const displayRevenue = leadContext?.revenue
        ? leadContext.revenue >= 1_000_000
            ? `${(leadContext.revenue / 1_000_000).toFixed(1)}M RUB/мес`
            : `${leadContext.revenue.toLocaleString()} RUB/мес`
        : null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Chat Window */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl h-[650px] shadow-2xl flex flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-neon-purple to-purple-800 flex items-center justify-center">
                                        <User size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-semibold text-white">{leadContext?.brandName || leadName}</h3>
                                        <p className="text-[10px] text-slate-400">Live Chat Simulation • AI Agent (Zoom Target)</p>
                                    </div>
                                </div>
                                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Lead Context Bar */}
                            {leadContext && (displayRevenue || (leadContext.painPoints && leadContext.painPoints.length > 0)) && (
                                <div className="flex items-center gap-4 px-4 py-2 bg-slate-800/50 border-b border-white/5 text-[11px] flex-wrap">
                                    {displayRevenue && (
                                        <span className="flex items-center gap-1 text-neon-green">
                                            <TrendingUp size={11} />
                                            {displayRevenue}
                                        </span>
                                    )}
                                    {leadContext.painPoints?.map((p) => (
                                        <span key={p} className="flex items-center gap-1 text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                                            <AlertTriangle size={10} />
                                            {PAIN_LABELS[p] || p}
                                        </span>
                                    ))}
                                    {leadContext.topProduct && (
                                        <span className="text-slate-500">📦 {leadContext.topProduct}</span>
                                    )}
                                </div>
                            )}

                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                {messages.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div
                                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${msg.role === 'user'
                                                ? 'bg-gradient-to-r from-neon-purple to-purple-600 text-white'
                                                : 'bg-slate-800 text-slate-200 border border-white/5'
                                                }`}
                                        >
                                            {msg.role === 'agent' && (
                                                <p className="text-[9px] text-slate-500 mb-1 font-medium uppercase tracking-wide">
                                                    Antigravity Agent
                                                </p>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                            <p className="text-[10px] mt-1 opacity-50 text-right">
                                                {msg.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-slate-800 border border-white/5 rounded-2xl px-4 py-3 flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin text-neon-purple" />
                                            <span className="text-[11px] text-slate-400">Agent is typing...</span>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            <div className="p-4 border-t border-white/10">
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder="Симулируйте ответ клиента..."
                                        disabled={isLoading}
                                        className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-neon-purple focus:outline-none disabled:opacity-50 text-sm"
                                    />
                                    <button
                                        onClick={handleSend}
                                        disabled={!inputValue.trim() || isLoading}
                                        className="bg-gradient-to-r from-neon-purple to-purple-600 text-white px-6 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Send size={18} />
                                    </button>
                                    <button
                                        onClick={handleSendToTelegram}
                                        disabled={isSendingTelegram || !messages.some((m) => m.role === 'agent') || leadId === 'sandbox'}
                                        title="Отправить последнее сообщение агента в Telegram"
                                        className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-4 py-3 rounded-xl hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                                    >
                                        <MessageCircle size={16} />
                                        <span className="text-xs font-medium">TG</span>
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-600 mt-2 text-center">
                                    Симуляция клиента • <span className="text-sky-500">TG</span> — отправить в Telegram реальному лиду
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
