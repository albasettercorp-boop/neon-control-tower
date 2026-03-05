
import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface ParserModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId?: string;
    sandboxMode?: boolean;
    onSandboxJobCreated?: (job: { id: string; query: string; category: string; leadsCount: number }) => void;
}

export const ParserModal: React.FC<ParserModalProps> = ({ isOpen, onClose, projectId, sandboxMode = false, onSandboxJobCreated }) => {
    const [query, setQuery] = useState('');
    const [minRevenue, setMinRevenue] = useState('0');
    const [category, setCategory] = useState('');
    const [maxResults, setMaxResults] = useState('50');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [progress, setProgress] = useState(0);
    const [currentJobId, setCurrentJobId] = useState<string | null>(null);
    const [resultCount, setResultCount] = useState(0);
    const channelRef = useRef<any>(null);

    const applyJobStatus = (job: any) => {
        if (!job) return;

        if (job.status === 'processing') {
            setProgress((prev) => Math.max(prev, 50));
            return;
        }

        if (job.status === 'completed') {
            setProgress(100);
            setResultCount(job.result_count || 0);
            setStatus('success');
            setLoading(false);

            setTimeout(() => {
                onClose();
                setStatus('idle');
                setProgress(0);
                setCurrentJobId(null);
            }, 3000);
            return;
        }

        if (job.status === 'failed') {
            setStatus('error');
            setLoading(false);
            setProgress(0);
        }
    };

    // Realtime subscription for parser_jobs updates
    useEffect(() => {
        if (!currentJobId || sandboxMode) return;

        const channel = supabase
            .channel(`parser_job_${currentJobId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'parser_jobs',
                    filter: `id=eq.${currentJobId}`
                },
                (payload) => applyJobStatus(payload.new as any)
            )
            .subscribe();

        channelRef.current = channel;

        const pollJob = async () => {
            try {
                const { data } = await (supabase.from('parser_jobs') as any)
                    .select('id,status,result_count,error_log')
                    .eq('id', currentJobId)
                    .single();
                applyJobStatus(data);
            } catch (error) {
                console.error('Parser job polling failed:', error);
            }
        };

        pollJob();
        const pollTimer = setInterval(pollJob, 3000);

        return () => {
            clearInterval(pollTimer);
            channel.unsubscribe();
        };
    }, [currentJobId, sandboxMode, onClose]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setStatus('idle');
        setProgress(0);

        try {
            if (sandboxMode) {
                const categories = ['Электроника', 'Одежда', 'Косметика', 'Детские товары', 'Спорт', 'Дом и сад'];
                const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                const leadsCount = Math.floor(Math.random() * 36) + 15;

                for (let i = 0; i <= 20; i++) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                    setProgress((i / 20) * 100);
                }

                onSandboxJobCreated?.({
                    id: `sandbox-${Date.now()}`,
                    query,
                    category: randomCategory,
                    leadsCount
                });

                setStatus('success');
                setQuery('');
                setTimeout(() => {
                    onClose();
                    setStatus('idle');
                    setProgress(0);
                }, 1500);
                setLoading(false);
                return;
            }

            // Real mode: write to Supabase and subscribe to updates
            const { data, error } = await supabase
                .from('parser_jobs')
                .insert({
                    query: query,
                    min_revenue: parseInt(minRevenue) || 0,
                    category: category || null,
                    max_results: parseInt(maxResults) || 50,
                    status: 'pending',
                    project_id: projectId
                } as any)
                .select()
                .single();

            if (error) throw error;

            if (data) {
                setCurrentJobId(data.id);
                setProgress(10);
            }

            setQuery('');
        } catch (error) {
            console.error('Error starting parser:', error);
            setStatus('error');
            setLoading(false);
        }
    };

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

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    >
                        <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                            {/* Header */}
                            <div className="flex items-center justify-between p-6 border-b border-white/10">
                                <div className="flex items-center gap-2">
                                    <Search className="text-neon-blue" size={24} />
                                    <h3 className="text-xl font-semibold text-white">Новый поиск селлеров</h3>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="text-slate-400 hover:text-white transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6">
                                {/* Query */}
                                <div className="mb-5">
                                    <label className="block text-sm text-slate-400 mb-2">
                                        Поисковый запрос Wildberries
                                    </label>
                                    <input
                                        type="text"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder="напр. 'женские платья' или 'спортивный костюм'"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-neon-blue focus:outline-none transition-colors"
                                        disabled={loading}
                                    />
                                </div>

                                {/* Min Revenue */}
                                <div className="mb-5">
                                    <label className="block text-sm text-slate-400 mb-2">
                                        Мин. выручка (₽){' '}
                                        <span className="text-slate-500 font-normal">— 0 = без ограничений</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={minRevenue}
                                        onChange={(e) => setMinRevenue(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        step="50000"
                                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-neon-blue focus:outline-none transition-colors"
                                        disabled={loading}
                                    />
                                    {parseInt(minRevenue) > 0 && (
                                        <p className="mt-1 text-xs text-slate-500">
                                            Фильтр: от {Number(minRevenue).toLocaleString('ru-RU')} ₽/мес
                                        </p>
                                    )}
                                </div>

                                {/* Category + Max Results */}
                                <div className="grid grid-cols-2 gap-4 mb-5">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">
                                            Категория <span className="text-slate-500">(необяз.)</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={category}
                                            onChange={(e) => setCategory(e.target.value)}
                                            placeholder="напр. Электроника"
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-neon-blue focus:outline-none transition-colors"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-2">
                                            Макс. результатов
                                        </label>
                                        <input
                                            type="number"
                                            value={maxResults}
                                            onChange={(e) => setMaxResults(e.target.value)}
                                            placeholder="50"
                                            min="1"
                                            max="500"
                                            className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-neon-blue focus:outline-none transition-colors"
                                            disabled={loading}
                                        />
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                {loading && (
                                    <div className="mb-5">
                                        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                                            <span>Парсинг продолжается...</span>
                                            <span>{Math.round(progress)}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-gradient-to-r from-neon-blue to-blue-500"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 0.3 }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Status Messages */}
                                {status === 'success' && (
                                    <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
                                        ✓ {sandboxMode
                                            ? 'Тестовый поиск завершён!'
                                            : `Готово! Найдено ${resultCount} подходящих селлеров.`}
                                    </div>
                                )}
                                {status === 'error' && (
                                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                        ✗ Не удалось запустить поиск. Проверьте соединение.
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="flex-1 px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                        disabled={loading}
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || !query.trim()}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-gradient-to-r from-neon-blue to-blue-600 text-white rounded-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 size={18} className="animate-spin" />
                                                {sandboxMode ? 'Симуляция...' : 'Запускаем...'}
                                            </>
                                        ) : (
                                            <>
                                                <Play size={18} />
                                                Запустить поиск
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};
