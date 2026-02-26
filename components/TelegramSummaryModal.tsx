import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface TelegramSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    leadData?: {
        brandName: string;
        revenue: number;
        pain?: string;
        date: string;
    };
}

export const TelegramSummaryModal: React.FC<TelegramSummaryModalProps> = ({ isOpen, onClose, leadData }) => {
    const [copied, setCopied] = useState(false);

    if (!leadData) return null;

    const summary = `🔥 НОВЫЙ ЛИД: ${leadData.brandName}
💰 Оборот: ${(leadData.revenue / 1_000_000).toFixed(1)}M RUB
💬 Боль: ${leadData.pain || 'Не указана'}
📅 Время: ${new Date(leadData.date).toLocaleString('ru-RU')}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-white">Сводка для Telegram</h3>
                                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="bg-black/40 border border-white/5 rounded-lg p-4 mb-4 font-mono text-sm text-slate-300 whitespace-pre-line">
                                {summary}
                            </div>
                            <button
                                onClick={handleCopy}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${copied
                                    ? 'bg-neon-green/20 text-neon-green border border-neon-green/30'
                                    : 'bg-gradient-to-r from-neon-purple to-purple-600 text-white hover:shadow-[0_0_20px_rgba(139,92,246,0.4)]'}`}
                            >
                                {copied ? (<><Check size={18} />Скопировано!</>) : (<><Copy size={18} />Копировать</>)}
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
