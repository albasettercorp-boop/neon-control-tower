import React, { useEffect, useState } from 'react';
import { X, Save, Database, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DEFAULT_KNOWLEDGE_BASE, getKnowledgeBase, saveKnowledgeBase, KnowledgeBase } from '../lib/knowledgeBase';

interface KnowledgeBaseEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  clientName?: string;
}

export const KnowledgeBaseEditor: React.FC<KnowledgeBaseEditorProps> = ({ isOpen, onClose, projectId, clientName }) => {
  const [kb, setKb] = useState<KnowledgeBase>(DEFAULT_KNOWLEDGE_BASE);
  const [activeTab, setActiveTab] = useState<'agency' | 'cases' | 'utp' | 'objections'>('agency');

  useEffect(() => {
    if (!isOpen) return;
    setKb(getKnowledgeBase(projectId, clientName));
  }, [isOpen, projectId, clientName]);

  const handleSave = () => {
    if (!projectId) {
      alert('Невозможно сохранить: не выбран проект клиента');
      return;
    }
    saveKnowledgeBase(projectId, kb);
    alert('✅ Knowledge Base сохранена для текущего клиента');
    onClose();
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
            <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Database className="text-neon-purple" size={24} />
                  <h3 className="text-xl font-semibold text-white">Knowledge Base Editor</h3>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex gap-2 p-4 border-b border-white/10">
                {(['agency', 'cases', 'utp', 'objections'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                        ? 'bg-neon-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                      }`}
                  >
                    {tab === 'agency' && '🏢 Агентство'}
                    {tab === 'cases' && '📊 Кейсы'}
                    {tab === 'utp' && '⭐ УТП'}
                    {tab === 'objections' && '🛡️ Возражения'}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {activeTab === 'agency' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Название агентства</label>
                      <input
                        type="text"
                        value={kb.agency.name}
                        onChange={(e) => setKb({ ...kb, agency: { ...kb.agency, name: e.target.value } })}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-neon-purple focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Год основания</label>
                      <input
                        type="number"
                        value={kb.agency.foundedYear}
                        onChange={(e) => setKb({ ...kb, agency: { ...kb.agency, foundedYear: parseInt(e.target.value) } })}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-neon-purple focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Опыт и описание</label>
                      <textarea
                        value={kb.agency.experience}
                        onChange={(e) => setKb({ ...kb, agency: { ...kb.agency, experience: e.target.value } })}
                        rows={4}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-neon-purple focus:outline-none transition-colors resize-none"
                      />
                    </div>
                  </div>
                )}
                {activeTab === 'cases' && (
                  <div className="space-y-4">
                    {kb.cases.map((caseItem, idx) => (
                      <div key={idx} className="bg-slate-800/50 border border-white/5 rounded-lg p-4 hover:border-neon-purple/30 transition-colors">
                        <div className="text-xs text-slate-500 mb-2">Кейс #{idx + 1}</div>
                        <input
                          type="text"
                          value={caseItem.clientName}
                          onChange={(e) => {
                            const newCases = [...kb.cases];
                            newCases[idx].clientName = e.target.value;
                            setKb({ ...kb, cases: newCases });
                          }}
                          placeholder="Название клиента"
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white mb-2 focus:border-neon-purple focus:outline-none transition-colors"
                        />
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <input
                            type="text"
                            value={caseItem.before}
                            onChange={(e) => {
                              const newCases = [...kb.cases];
                              newCases[idx].before = e.target.value;
                              setKb({ ...kb, cases: newCases });
                            }}
                            placeholder="До"
                            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-purple focus:outline-none transition-colors"
                          />
                          <input
                            type="text"
                            value={caseItem.after}
                            onChange={(e) => {
                              const newCases = [...kb.cases];
                              newCases[idx].after = e.target.value;
                              setKb({ ...kb, cases: newCases });
                            }}
                            placeholder="После"
                            className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-purple focus:outline-none transition-colors"
                          />
                        </div>
                        <textarea
                          value={caseItem.result}
                          onChange={(e) => {
                            const newCases = [...kb.cases];
                            newCases[idx].result = e.target.value;
                            setKb({ ...kb, cases: newCases });
                          }}
                          placeholder="Результат"
                          rows={2}
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-purple focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'utp' && (
                  <div className="space-y-3">
                    <div className="text-sm text-slate-400 mb-4">Уникальные торговые предложения (УТП)</div>
                    {kb.utp.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start">
                        <div className="text-neon-purple font-bold mt-2">{idx + 1}.</div>
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => {
                            const newUtp = [...kb.utp];
                            newUtp[idx] = e.target.value;
                            setKb({ ...kb, utp: newUtp });
                          }}
                          className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-4 py-2 text-white focus:border-neon-purple focus:outline-none transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                )}
                {activeTab === 'objections' && (
                  <div className="space-y-4">
                    <div className="text-sm text-slate-400 mb-4">Обработчики возражений для AI-агента</div>
                    {Object.entries(kb.objectionHandlers).map(([objection, response]) => (
                      <div key={objection} className="bg-slate-800/50 border border-white/5 rounded-lg p-4 hover:border-neon-purple/30 transition-colors">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="text-sm font-medium text-neon-purple">Возражение:</div>
                          <div className="text-sm text-white">"{objection}"</div>
                        </div>
                        <textarea
                          value={response}
                          onChange={(e) => {
                            setKb({
                              ...kb,
                              objectionHandlers: {
                                ...kb.objectionHandlers,
                                [objection]: e.target.value
                              }
                            });
                          }}
                          rows={3}
                          placeholder="Ответ на возражение..."
                          className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-purple focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-white/10">
                <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Отмена</button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-neon-purple to-purple-600 text-white rounded-lg hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] transition-all"
                >
                  <Save size={18} />
                  Сохранить
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
