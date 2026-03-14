import React, { useState } from 'react';
import { X, ChevronRight, AlertTriangle } from 'lucide-react';
import { Project, Role, User } from '../types';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface ReassignModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  users: User[];
  getPMWorkload: (pmName: string) => Record<string, number>;
  workloadThresholds: Record<string, number>;
  onReassign: (projectId: string, newPmName: string, reason?: string) => Promise<any>;
  themeColor?: string;
}

export const ReassignModal: React.FC<ReassignModalProps> = ({ 
  isOpen, 
  onClose, 
  project, 
  users, 
  getPMWorkload, 
  workloadThresholds, 
  onReassign, 
  themeColor = 'teal' 
}) => {
  const [selectedPm, setSelectedPm] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const theme = getThemeClasses(themeColor);

  if (!isOpen) return null;

  const activePMs = users.filter(u => 
    u.role === 'PM' && 
    u.status === 'Active' && 
    u.name !== project.assignedPM
  );

  const handleConfirm = async () => {
    if (!selectedPm) return;
    setIsProcessing(true);
    try {
      await onReassign(project.id, selectedPm, reason);
      onClose();
    } catch (error) {
      console.error('Reassignment failed', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedPmWorkload = selectedPm ? getPMWorkload(selectedPm) : null;
  const currentLoad = selectedPmWorkload ? selectedPmWorkload[project.priority] : 0;
  const limit = workloadThresholds[project.priority];
  const isAtLimit = selectedPmWorkload ? currentLoad >= limit : false;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900">Reassign Project</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Project</span>
                <span className="text-sm font-bold text-slate-900">{project.clientName} — {project.packageName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-bold text-slate-400 uppercase">Current PM</span>
                <span className="text-sm font-bold text-slate-600 font-mono">{project.assignedPM}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Reassign To</label>
              <select 
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                  theme.ring, theme.focusBorder
                )}
                value={selectedPm}
                onChange={e => setSelectedPm(e.target.value)}
              >
                <option value="">Select a new PM</option>
                {activePMs.map(pm => {
                  const workload = getPMWorkload(pm.name);
                  return (
                    <option key={pm.id} value={pm.name}>
                      {pm.name} (P1: {workload.P1}/{workloadThresholds.P1} | P2: {workload.P2}/{workloadThresholds.P2} | P3: {workload.P3}/{workloadThresholds.P3})
                    </option>
                  );
                })}
              </select>
            </div>

            {isAtLimit && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-700">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <p className="text-xs font-bold leading-tight">
                  This PM is at their {project.priority} limit ({currentLoad}/{limit}). You can still reassign as a Manager override.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Reason (Optional)</label>
              <textarea 
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all h-24 resize-none",
                  theme.ring, theme.focusBorder
                )}
                placeholder="Why is this project being reassigned?"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              disabled={isProcessing}
              onClick={onClose}
              className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              disabled={!selectedPm || isProcessing}
              onClick={handleConfirm}
              className={cn(
                "flex-1 py-3 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2",
                theme.bg, theme.hoverBg, theme.shadow,
                (!selectedPm || isProcessing) && "opacity-50 grayscale"
              )}
            >
              {isProcessing ? 'Processing...' : 'Confirm Reassignment'}
              {!isProcessing && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
