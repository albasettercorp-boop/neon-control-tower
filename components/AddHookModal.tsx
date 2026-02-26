import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface AddHookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const AddHookModal: React.FC<AddHookModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('hooks')
                .insert([{
                    title,
                    content,
                    category,
                    conversion_rate: 0
                }] as any);

            if (insertError) throw insertError;

            onSuccess();
            onClose();
            setTitle('');
            setContent('');
            setCategory('');
        } catch (err: any) {
            console.error('Error adding hook:', err);
            setError(err.message || 'Ошибка при сохранении хука');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="w-full max-w-md bg-[#0a0f1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                >
                    <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
                        <h3 className="text-lg font-bold text-white">Добавить Новый Хук</h3>
                        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{error}</div>
                        )}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Заголовок / Название</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Например: Агрессивный заход..."
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 outline-none transition-all placeholder:text-slate-600"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Категория</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 outline-none transition-all appearance-none"
                            >
                                <option value="" disabled>Выберите категорию</option>
                                <option value="Cold Outreach">Холодная рассылка</option>
                                <option value="Warm Follow-up">Тёплое напоминание</option>
                                <option value="Re-engagement">Реактивация</option>
                                <option value="Closer">Закрытие сделки</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-300">Текст сообщения</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="Привет! Видел вашу активность..."
                                rows={5}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-neon-purple focus:ring-1 focus:ring-neon-purple/50 outline-none transition-all placeholder:text-slate-600 resize-none"
                                required
                            />
                        </div>
                        <div className="pt-4 flex justify-end gap-3">
                            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Отмена</button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-neon-purple to-purple-600 text-white rounded-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                            >
                                {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                Сохранить
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
