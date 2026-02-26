import React from 'react';
import { Filter, X } from 'lucide-react';

export interface SourcesFilterState {
    revenue: string;
    category: string;
    health: string;
    status: string;
}

interface SourcesFilterProps {
    filters: SourcesFilterState;
    onFilterChange: (filters: SourcesFilterState) => void;
    onReset: () => void;
}

export const SourcesFilter: React.FC<SourcesFilterProps> = ({ filters, onFilterChange, onReset }) => {
    const hasActiveFilters = filters.revenue !== 'all' || filters.category !== 'all' || filters.health !== 'all' || filters.status !== 'all';

    return (
        <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-white">
                    <Filter size={16} />
                    <span className="text-sm font-medium">Фильтры</span>
                </div>
                {hasActiveFilters && (
                    <button
                        onClick={onReset}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                        <X size={14} />
                        Сбросить
                    </button>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Выручка (RUB/мес)</label>
                    <select
                        value={filters.revenue}
                        onChange={(e) => onFilterChange({ ...filters, revenue: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-neon-blue focus:outline-none transition-colors"
                    >
                        <option value="all">Все</option>
                        <option value="0-2">0 - 2M</option>
                        <option value="2-5">2M - 5M</option>
                        <option value="5-10">5M - 10M</option>
                        <option value="10+">10M+</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Категория</label>
                    <select
                        value={filters.category}
                        onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-neon-blue focus:outline-none transition-colors"
                    >
                        <option value="all">Все</option>
                        <option value="Электроника">Электроника</option>
                        <option value="Одежда">Одежда</option>
                        <option value="Косметика">Косметика</option>
                        <option value="Детские товары">Детские товары</option>
                        <option value="Спорт">Спорт</option>
                        <option value="Дом и сад">Дом и сад</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Health Status</label>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onFilterChange({ ...filters, health: filters.health === 'healthy' ? 'all' : 'healthy' })}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${filters.health === 'healthy'
                                    ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                                    : 'bg-slate-900 text-slate-400 border border-white/10 hover:border-green-500/30'
                                }`}
                        >
                            🟢
                        </button>
                        <button
                            onClick={() => onFilterChange({ ...filters, health: filters.health === 'warning' ? 'all' : 'warning' })}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${filters.health === 'warning'
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                                    : 'bg-slate-900 text-slate-400 border border-white/10 hover:border-yellow-500/30'
                                }`}
                        >
                            🟡
                        </button>
                        <button
                            onClick={() => onFilterChange({ ...filters, health: filters.health === 'critical' ? 'all' : 'critical' })}
                            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${filters.health === 'critical'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                                    : 'bg-slate-900 text-slate-400 border border-white/10 hover:border-red-500/30'
                                }`}
                        >
                            🔴
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-slate-400 mb-1">Статус</label>
                    <select
                        value={filters.status}
                        onChange={(e) => onFilterChange({ ...filters, status: e.target.value })}
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-neon-blue focus:outline-none transition-colors"
                    >
                        <option value="all">Все</option>
                        <option value="Processed">Processed</option>
                        <option value="Leads">Leads</option>
                    </select>
                </div>
            </div>
        </div>
    );
};
