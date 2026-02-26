import React from 'react';
import { Plus, Command, MoreVertical } from 'lucide-react';
import { Client } from '../types';
import { motion } from 'framer-motion';

interface SidebarProps {
   clients: Client[];
   activeClientId: string;
   onClientSelect: (id: string) => void;
   onAddClient: () => void;
   onStartParsing: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ clients, activeClientId, onClientSelect, onAddClient, onStartParsing }) => {
   return (
      <div className="w-full md:w-72 h-full flex flex-col glass-panel rounded-2xl border-r border-white/5 relative overflow-hidden">
         {/* Header */}
         <div className="p-4 pb-3 border-b border-white/5">
            <button
               onClick={onAddClient}
               className="w-full bg-gradient-to-r from-neon-purple to-purple-600 text-white p-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300 group"
            >
               <Plus size={16} className="group-hover:rotate-90 transition-transform" />
               Add Client
            </button>
         </div>

         {/* Client List */}
         <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {clients.map((client) => {
               const isActive = activeClientId === client.id;
               return (
                  <motion.div
                     key={client.id}
                     whileHover={{ scale: 1.02 }}
                     whileTap={{ scale: 0.98 }}
                     onClick={() => onClientSelect(client.id)}
                     className={`p-3 rounded-xl cursor-pointer transition-all duration-300 border relative group overflow-hidden ${isActive
                        ? 'bg-white/10 border-neon-purple/50 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                        : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/10'
                        }`}
                  >
                     {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-purple shadow-[0_0_10px_#a855f7]" />}

                     <div className="flex items-center gap-2.5 mb-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${isActive ? 'bg-neon-purple text-white' : 'bg-slate-800 text-slate-400'}`}>
                           {client.initials}
                        </div>
                        <div>
                           <h3 className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-slate-300'}`}>{client.name}</h3>
                           <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${client.status === 'active' ? 'bg-neon-green animate-pulse' : 'bg-slate-500'}`} />
                              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{client.status}</span>
                           </div>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                           <div className="text-[10px] text-slate-500 mb-0.5">Active</div>
                           <div className="text-neon-blue font-mono text-xs">{client.activeCampaigns} Campaigns</div>
                        </div>
                        <div className="bg-black/20 rounded-lg p-2 border border-white/5">
                           <div className="text-[10px] text-slate-500 mb-0.5">Today</div>
                           <div className="text-neon-green font-mono text-xs">+{client.leadsToday} Leads</div>
                        </div>
                     </div>
                  </motion.div>
               );
            })}
         </div>

         {/* Footer */}
         <div className="p-4 border-t border-white/5 flex flex-col gap-3 text-center">
            <button
               onClick={onStartParsing}
               className="w-full py-2 px-3 bg-white/5 border border-white/10 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 hover:border-neon-purple/50 transition-all flex items-center justify-center gap-2 group"
            >
               <Command size={12} className="text-neon-purple" />
               COMMAND CENTER
            </button>
            <p className="text-[10px] text-slate-600 font-mono">CLIENT MANAGER V2.1</p>
         </div>
      </div>
   );
};
