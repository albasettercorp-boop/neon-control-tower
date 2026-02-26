import React from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, AlertTriangle } from 'lucide-react';

interface CampaignGoalWidgetProps {
  achieved: number;
  goal: number;
}

export const CampaignGoalWidget: React.FC<CampaignGoalWidgetProps> = ({ achieved, goal }) => {
  const percentage = Math.min(100, Math.round((achieved / goal) * 100));

  // Logic for color coding based on progress
  let colorClass = 'bg-neon-green shadow-[0_0_15px_#10b981]';
  let textColorClass = 'text-neon-green';
  let Icon = TrendingUp;

  if (percentage < 30) {
    colorClass = 'bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse';
    textColorClass = 'text-red-500';
    Icon = AlertTriangle;
  } else if (percentage < 70) {
    colorClass = 'bg-yellow-500 shadow-[0_0_15px_#eab308]';
    textColorClass = 'text-yellow-500';
    Icon = Target;
  }

  return (
    <div className="w-full glass-panel rounded-xl p-3 flex flex-col md:flex-row items-center gap-4 relative overflow-hidden group">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-1 h-full bg-white/10" />

      {/* Icon & Label */}
      <div className="flex items-center gap-3 min-w-fit w-full md:w-auto">
        <div className={`p-2 rounded-lg bg-white/5 ${textColorClass} transition-colors duration-500`}>
          <Target size={20} />
        </div>
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Campaign Goal</div>
          <div className="text-lg font-bold text-white flex items-baseline gap-1">
            {achieved} <span className="text-sm text-slate-500 font-normal">/ {goal} Clients</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex-1 w-full">
        <div className="flex justify-between mb-2">
          <span className={`text-xs font-mono font-bold ${textColorClass} transition-colors duration-500`}>
            {percentage}% Completion
          </span>
          <span className="text-[10px] text-slate-500">Project Health</span>
        </div>
        <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden border border-white/5 relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          />
        </div>
      </div>

      {/* Status Label */}
      <div className="hidden md:block min-w-fit text-right">
        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Project Status</div>
        <div className="text-sm font-medium text-white flex items-center justify-end gap-2 mt-1">
          <Icon size={14} className={textColorClass} />
          <span className={percentage < 30 ? 'text-red-400' : percentage < 70 ? 'text-yellow-400' : 'text-neon-green'}>
            {percentage < 30 ? 'Critical' : percentage < 70 ? 'In Progress' : 'On Track'}
          </span>
        </div>
      </div>
    </div>
  );
};