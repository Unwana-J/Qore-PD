import React, { useState } from 'react';
import { X, Plus, Trash2, GripVertical, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface MilestoneEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (milestones: string[]) => void;
  initialMilestones: string[];
  serviceName: string;
}

export const MilestoneEditorModal: React.FC<MilestoneEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMilestones,
  serviceName
}) => {
  const [milestones, setMilestones] = useState<string[]>(initialMilestones.length > 0 ? initialMilestones : ['']);

  const handleAdd = () => setMilestones([...milestones, '']);
  const handleRemove = (index: number) => {
    const newMilestones = milestones.filter((_, i) => i !== index);
    setMilestones(newMilestones.length > 0 ? newMilestones : ['']);
  };
  const handleChange = (index: number, value: string) => {
    const newMilestones = [...milestones];
    newMilestones[index] = value;
    setMilestones(newMilestones);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Configure Milestones</h3>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{serviceName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3 custom-scrollbar">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Implementation Steps</p>
          
          {milestones.map((m, i) => (
            <div key={i} className="flex gap-2 group">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 bg-slate-100 rounded-lg text-[10px] font-black text-slate-400">
                  {i + 1}
                </div>
                <input
                  autoFocus={i === milestones.length - 1 && m === ''}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                  placeholder="e.g. Technical Setup"
                  value={m}
                  onChange={e => handleChange(i, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdd()}
                />
              </div>
              <button 
                onClick={() => handleRemove(i)}
                className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}

          <button
            onClick={handleAdd}
            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-teal-500/30 hover:text-teal-600 hover:bg-teal-50/50 transition-all group"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:scale-125" />
            Add Milestone
          </button>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => onSave(milestones.filter(m => m.trim() !== ''))}
            className="flex-1 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-black rounded-2xl shadow-lg shadow-teal-600/20 transition-all active:scale-95"
          >
            Save Configuration
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3.5 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
