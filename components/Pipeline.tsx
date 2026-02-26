import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
   Database, Zap, MessageSquare, Video,
   ToggleRight, ToggleLeft, Plus, MoreHorizontal,
   Send, Edit2, RotateCcw, Archive
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Source, Hook, ActiveChat, ZoomCall } from '../types';
import { supabase } from '../lib/supabase';

interface PipelineGridProps {
   sources: Source[];
   hooks: Hook[];
   chats: ActiveChat[];
   zooms: ZoomCall[];
   qualifiedCount?: number;
   repliedCount?: number;
   convertedCount?: number;
   onStageClick: (stage: 'sources' | 'hooks' | 'chats' | 'zooms') => void;
   onAddSource?: () => void;
   onChatClick?: (chat: ActiveChat) => void;
   onGenerateSummary?: (zoom: ZoomCall) => void;
   onAddHook?: () => void;
   onHookUpdated?: () => void;
}

const SourcesStage: React.FC<{ sources: Source[]; onClick: () => void; onAddSource?: () => void }> = ({ sources, onClick, onAddSource }) => (
   <GlassCard className="h-full flex flex-col group cursor-pointer hover:border-neon-blue/30 transition-all" delay={0.1} onClick={onClick}>
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-2 text-neon-blue">
            <Database size={18} />
            <h3 className="font-semibold text-sm tracking-wider uppercase">Sources</h3>
         </div>
         <button
            className="text-slate-500 hover:text-neon-blue transition-colors"
            onClick={(e) => {
               e.stopPropagation();
               onAddSource?.();
            }}
         ><Plus size={16} /></button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
         {sources.map(source => {
            const healthStatus = source.active
               ? (source.total > 0 ? 'green' : 'yellow')
               : 'red';
            const healthColor = healthStatus === 'green'
               ? 'bg-neon-green'
               : healthStatus === 'yellow'
                  ? 'bg-yellow-500'
                  : 'bg-red-500';

            return (
               <div key={source.id} className="bg-slate-900/40 rounded-xl p-3 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                     <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${healthColor} ${healthStatus === 'green' ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 uppercase">{source.platform}</span>
                        <span className="text-sm font-medium text-slate-200">{source.name}</span>
                     </div>
                     <button className="text-neon-blue hover:text-neon-blue/80 transition-colors" onClick={(e) => e.stopPropagation()}>
                        {source.active ? <ToggleRight size={22} /> : <ToggleLeft size={22} className="text-slate-600" />}
                     </button>
                  </div>
                  <div className="space-y-1">
                     <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                        <span>Processed: {source.processed}</span>
                        <span>Total: {source.total}</span>
                     </div>
                     <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                           initial={{ width: 0 }}
                           animate={{ width: `${source.total > 0 ? (source.processed / source.total) * 100 : 0}%` }}
                           className="h-full bg-neon-blue rounded-full"
                        />
                     </div>
                  </div>
               </div>
            );
         })}
      </div>
      <div className="mt-4 text-center text-[10px] text-slate-500 group-hover:text-neon-blue transition-colors">
         Click to view details
      </div>
   </GlassCard>
);

interface HooksStageProps {
   hooks: Hook[];
   qualifiedCount?: number;
   onClick: () => void;
   onAddHook?: () => void;
   onHookUpdated?: () => void;
}

const HooksStage: React.FC<HooksStageProps> = ({ hooks, qualifiedCount = 0, onClick, onAddHook, onHookUpdated }) => {
   const [openMenuId, setOpenMenuId] = useState<string | null>(null);
   const menuRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            setOpenMenuId(null);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const handleEditHook = async (hook: Hook) => {
      setOpenMenuId(null);
      const currentText = hook.text || hook.content || '';
      const newText = prompt(`Редактировать хук "${hook.name || hook.title}":`, currentText);
      if (newText === null || newText === currentText) return;
      try {
         await (supabase.from('hooks') as any).update({ content: newText, title: hook.name || hook.title }).eq('id', hook.id);
         onHookUpdated?.();
      } catch (e) {
         console.error('[Hooks] Edit failed:', e);
      }
   };

   const handleResetStats = async (hook: Hook) => {
      setOpenMenuId(null);
      if (!confirm(`Сбросить статистику хука "${hook.name || hook.title}"?`)) return;
      try {
         await (supabase.from('hooks') as any).update({ conversion_rate: 0 }).eq('id', hook.id);
         onHookUpdated?.();
      } catch (e) {
         console.error('[Hooks] Reset stats failed:', e);
      }
   };

   const handleArchiveHook = async (hook: Hook) => {
      setOpenMenuId(null);
      if (!confirm(`Архивировать хук "${hook.name || hook.title}"?`)) return;
      try {
         await (supabase.from('hooks') as any).update({ status: 'archived', active: false }).eq('id', hook.id);
         onHookUpdated?.();
      } catch (e) {
         console.error('[Hooks] Archive failed:', e);
      }
   };

   const handleToggleActive = async (e: React.MouseEvent, hook: Hook) => {
      e.stopPropagation();
      try {
         await (supabase.from('hooks') as any).update({ active: !hook.active }).eq('id', hook.id);
         onHookUpdated?.();
      } catch (err) {
         console.error('[Hooks] Toggle failed:', err);
      }
   };

   return (
      <GlassCard className="h-full flex flex-col cursor-pointer hover:border-neon-purple/30 transition-all group" delay={0.2} onClick={onClick}>
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-neon-purple">
               <Zap size={18} />
               <h3 className="font-semibold text-sm tracking-wider uppercase">Hooks (A/B)</h3>
            </div>
            <div className="flex gap-2">
               <button
                  onClick={(e) => { e.stopPropagation(); onAddHook?.(); }}
                  className="flex items-center gap-1 px-2 py-1 bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/30 rounded-lg text-xs text-neon-purple transition-all"
               >
                  <Plus size={14} />
                  Добавить
               </button>
               <span className="text-[10px] bg-neon-purple/10 text-neon-purple px-2 py-0.5 rounded border border-neon-purple/20">{qualifiedCount} QUALIFIED</span>
            </div>
         </div>

         <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 pb-10">
            {hooks.map(hook => (
               <div key={hook.id} className="relative bg-slate-900/40 rounded-xl p-3 border border-white/5 hover:border-neon-purple/30 transition-all">
                  <div className="flex items-center justify-between mb-2">
                     <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${hook.variant === 'A' ? 'bg-neon-pink/10 text-neon-pink' : 'bg-neon-blue/10 text-neon-blue'}`}>
                        VAR {hook.variant}
                     </span>
                     <span className="text-xs font-mono text-neon-green">{hook.conversion || hook.conversion_rate || 0}% Conv</span>
                  </div>
                  <p className="text-xs text-slate-300 italic mb-3 line-clamp-2 pl-2 border-l-2 border-slate-700">
                     "{hook.text || hook.content}"
                  </p>
                  <div className="flex items-center justify-between border-t border-white/5 pt-2">
                     <span className="text-[10px] text-slate-500">{hook.name || hook.title}</span>
                     <div className="flex gap-2 relative">
                        <button
                           onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === hook.id ? null : hook.id); }}
                           className="text-slate-500 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                        >
                           <MoreHorizontal size={14} />
                        </button>
                        <button
                           className={`transition-colors ${hook.active !== false ? 'text-neon-purple hover:text-neon-purple/80' : 'text-slate-600 hover:text-slate-400'}`}
                           onClick={(e) => handleToggleActive(e, hook)}
                        >
                           {hook.active !== false ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>

                        <AnimatePresence>
                           {openMenuId === hook.id && (
                              <motion.div
                                 ref={menuRef}
                                 initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                 animate={{ opacity: 1, scale: 1, y: 0 }}
                                 exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                 className="absolute right-0 top-8 w-40 bg-[#0a0a0a] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                                 onClick={(e) => e.stopPropagation()}
                              >
                                 <div className="p-1 space-y-0.5">
                                    <button onClick={() => handleEditHook(hook)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-2">
                                       <Edit2 size={12} /> Редактировать
                                    </button>
                                    <button onClick={() => handleResetStats(hook)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-white/10 rounded flex items-center gap-2">
                                       <RotateCcw size={12} /> Сбросить статы
                                    </button>
                                    <button onClick={() => handleArchiveHook(hook)} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2">
                                       <Archive size={12} /> Архивировать
                                    </button>
                                 </div>
                              </motion.div>
                           )}
                        </AnimatePresence>
                     </div>
                  </div>
               </div>
            ))}
         </div>
         <div className="text-center text-[10px] text-slate-500 group-hover:text-neon-purple transition-colors">
            Click to view details
         </div>
      </GlassCard>
   );
};

const ChatsStage: React.FC<{ chats: ActiveChat[]; repliedCount?: number; onClick: () => void; onChatClick?: (chat: ActiveChat) => void }> = ({ chats, repliedCount = 0, onClick, onChatClick }) => (
   <GlassCard className="h-full flex flex-col hover:border-red-500/30 transition-all group" delay={0.3}>
      <div className="flex items-center justify-between mb-4">
         <div className="flex items-center gap-2 text-white">
            <MessageSquare size={18} />
            <h3 className="font-semibold text-sm tracking-wider uppercase">Live Chats</h3>
         </div>
         <span className="bg-red-500/20 text-red-400 text-[10px] px-1.5 py-0.5 rounded animate-pulse">
            {repliedCount} REPLIED
         </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
         {chats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 text-xs py-8">
               <MessageSquare size={24} className="mb-2 opacity-30" />
               <p>Нет активных чатов</p>
            </div>
         )}
         {chats.map(chat => {
            let progressColor = 'bg-red-500';
            let statusText = 'Needs Attention';
            let textColor = 'text-red-400';

            if (chat.progress >= 80) {
               progressColor = 'bg-neon-green';
               statusText = 'Hot Lead';
               textColor = 'text-neon-green';
            } else if (chat.progress >= 30) {
               progressColor = 'bg-yellow-500';
               statusText = 'In Progress';
               textColor = 'text-yellow-400';
            }

            return (
               <div
                  key={chat.id}
                  onClick={() => onChatClick?.(chat)}
                  className="p-3 rounded-xl bg-slate-900/40 border border-white/5 hover:bg-white/5 hover:border-neon-purple/30 transition-all cursor-pointer group"
               >
                  <div className="flex justify-between items-center mb-2">
                     <h4 className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">{chat.clientName}</h4>
                     <button
                        className="p-1.5 rounded-full bg-white/5 hover:bg-neon-blue/20 hover:text-neon-blue transition-colors"
                        onClick={(e) => { e.stopPropagation(); onChatClick?.(chat); }}
                     >
                        <Send size={12} />
                     </button>
                  </div>
                  <div className="flex items-center gap-3 mb-1">
                     <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <motion.div
                           initial={{ width: 0 }}
                           animate={{ width: `${chat.progress}%` }}
                           className={`h-full rounded-full ${progressColor} shadow-[0_0_8px_currentColor]`}
                        />
                     </div>
                     <span className="text-[10px] font-mono text-slate-400 w-8 text-right">{chat.progress}%</span>
                  </div>
                  <div className={`text-[10px] font-medium ${textColor} text-right mt-1`}>{statusText}</div>
               </div>
            );
         })}
      </div>
      <div className="mt-4 text-center text-[10px] text-slate-500 group-hover:text-white transition-colors cursor-pointer" onClick={onClick}>
         Click to view all chats
      </div>
   </GlassCard>
);

const ZoomsStage: React.FC<{ zooms: ZoomCall[]; convertedCount?: number; onGenerateSummary?: (zoom: ZoomCall) => void }> = ({ zooms, convertedCount = 0, onGenerateSummary }) => {
   const approved = zooms.filter(z => z.status === 'confirmed');
   const pending = zooms.filter(z => z.status === 'pending');

   return (
      <GlassCard className="h-full flex flex-col" delay={0.4}>
         <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-neon-green">
               <Video size={18} />
               <h3 className="font-semibold text-sm tracking-wider uppercase">Zoom Calls</h3>
            </div>
            <span className="text-[10px] bg-neon-green/10 text-neon-green px-2 py-0.5 rounded border border-neon-green/20">
               {convertedCount} CONVERTED
            </span>
         </div>

         {zooms.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 text-slate-600 text-xs py-8">
               <Video size={24} className="mb-2 opacity-30" />
               <p>Нет запланированных звонков</p>
            </div>
         )}

         <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
            {approved.length > 0 && (
               <div>
                  <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Approved</h4>
                  <div className="space-y-2">
                     {approved.map(zoom => (
                        <div key={zoom.id} className="p-2.5 rounded-lg bg-neon-green/5 border border-neon-green/10">
                           <div className="flex justify-between items-center mb-2">
                              <div>
                                 <div className="text-sm font-medium text-white">{zoom.clientName}</div>
                                 <div className="text-xs text-neon-green">{zoom.date} • {zoom.time}</div>
                              </div>
                              <div className="h-2 w-2 rounded-full bg-neon-green shadow-[0_0_5px_#10b981]" />
                           </div>
                           <button
                              onClick={() => onGenerateSummary?.(zoom)}
                              className="w-full mt-2 px-3 py-1.5 bg-neon-purple/20 hover:bg-neon-purple/30 border border-neon-purple/30 rounded-lg text-xs text-neon-purple hover:text-white transition-all"
                           >
                              📱 Собрать инфо
                           </button>
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {pending.length > 0 && (
               <div>
                  <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-wider">Pending</h4>
                  <div className="space-y-2">
                     {pending.map(zoom => (
                        <div key={zoom.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 flex justify-between items-center opacity-70 hover:opacity-100 transition-opacity">
                           <div>
                              <div className="text-sm font-medium text-slate-300">{zoom.clientName}</div>
                              <div className="text-xs text-yellow-500">Waiting confirmation</div>
                           </div>
                           <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                        </div>
                     ))}
                  </div>
               </div>
            )}
         </div>
      </GlassCard>
   );
};

export const PipelineGrid: React.FC<PipelineGridProps> = ({ sources, hooks, chats, zooms, qualifiedCount = 0, repliedCount = 0, convertedCount = 0, onStageClick, onAddSource, onChatClick, onGenerateSummary, onAddHook, onHookUpdated }) => {
   return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 h-full">
         <SourcesStage sources={sources} onClick={() => onStageClick('sources')} onAddSource={onAddSource} />
         <HooksStage
            hooks={hooks}
            qualifiedCount={qualifiedCount}
            onClick={() => onStageClick('hooks')}
            onAddHook={onAddHook}
            onHookUpdated={onHookUpdated}
         />
         <ChatsStage chats={chats} repliedCount={repliedCount} onClick={() => onStageClick('chats')} onChatClick={onChatClick} />
         <ZoomsStage zooms={zooms} convertedCount={convertedCount} onGenerateSummary={onGenerateSummary} />
      </div>
   );
};
