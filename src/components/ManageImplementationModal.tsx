import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Circle, MapPin, Unlink, AlertCircle,
  ExternalLink, Loader2, Lock
} from 'lucide-react';
import { ServiceExtension, IMilestone, AppConfig } from '../types';
import { api } from '../lib/api';
import { cn, isRole } from '../lib/utils';
import { MapToProjectModal } from './MapToProjectModal';

interface ManageImplementationModalProps {
  extension: ServiceExtension;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: ServiceExtension) => void;
  userRole: string;
  userName: string;
  config: AppConfig;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

export const ManageImplementationModal: React.FC<ManageImplementationModalProps> = ({
  extension, isOpen, onClose, onUpdated, userRole, userName, config, onShowToast
}) => {
  const [milestones, setMilestones] = useState<IMilestone[]>(extension.milestones);
  const [saving, setSaving] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [unmapComment, setUnmapComment] = useState('');
  const [showUnmapDialog, setShowUnmapDialog] = useState(false);
  const [unmapping, setUnmapping] = useState(false);

  const isFrozen = extension.status === 'Frozen';
  const isLead = isRole(userRole, 'IM Lead') || isRole(userRole, 'Superadmin');

  const toggleMilestone = async (idx: number) => {
    if (isFrozen) {
      onShowToast('This implementation is frozen because the linked project is closed.', 'error');
      return;
    }
    const updated = milestones.map((m, i) => {
      if (i !== idx) return m;
      return {
        ...m,
        completed: !m.completed,
        completedAt: !m.completed ? new Date().toISOString() : null,
        completedBy: !m.completed ? userName : null,
      };
    });
    setMilestones(updated);

    // Derive new status
    const allDone = updated.every(m => m.completed);
    const anyDone = updated.some(m => m.completed);
    const newStatus = allDone ? 'Completed' : anyDone ? 'In Progress' : 'Not Started';

    setSaving(true);
    try {
      const result = await api.serviceExtensions.updateMilestones(
        extension.id,
        updated,
        newStatus,
        extension.mappingStatus === 'Approved' ? extension.linkedProjectId : null,
        extension.mappingStatus === 'Approved' ? extension.serviceVariant : undefined,
      );
      onUpdated(result);
      if (allDone) onShowToast('All milestones completed — implementation marked as Closed!');
    } catch (err: any) {
      onShowToast(err.message, 'error');
      // Revert local state on error
      setMilestones(extension.milestones);
    } finally {
      setSaving(false);
    }
  };

  const handleUnmap = async () => {
    if (!unmapComment.trim()) {
      onShowToast('Please provide a reason for unmapping.', 'error');
      return;
    }
    setUnmapping(true);
    try {
      await api.serviceExtensions.unmapFromProject(
        extension.id,
        unmapComment,
        extension.linkedProjectId!,
        extension.serviceVariant,
      );
      onShowToast('Extension unmapped from project successfully.');
      onClose();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setUnmapping(false);
    }
  };

  const progress = milestones.length > 0
    ? (milestones.filter(m => m.completed).length / milestones.length) * 100
    : 0;

  const mappingStatusColors: Record<string, string> = {
    None: 'bg-slate-100 text-slate-500',
    Pending: 'bg-amber-100 text-amber-700',
    Approved: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-600',
    Unmapped: 'bg-slate-200 text-slate-500',
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 sm:p-8 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-black text-slate-900 truncate">{extension.clientName}</h2>
                  {isFrozen && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-md">
                      <Lock className="w-3 h-3" /> Frozen
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  {extension.serviceName} — {extension.serviceVariant || 'Standard'}
                </p>
              </div>
              <button onClick={onClose} className="ml-4 p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Progress Bar */}
              <div className="px-8 pt-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Milestone Progress</span>
                  <span className="text-sm font-black text-slate-700">{Math.round(progress)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500",
                      progress === 100 ? 'bg-emerald-500' : 'bg-teal-500'
                    )}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Milestones */}
              <div className="px-8 pb-6 space-y-2">
                {milestones.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">
                    <Circle className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-bold text-sm">No milestones defined for this service.</p>
                    <p className="text-xs mt-1">Configure milestones in Settings → Packages & Services.</p>
                  </div>
                ) : (
                  milestones.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleMilestone(idx)}
                      disabled={saving || isFrozen}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all group",
                        m.completed
                          ? "bg-emerald-50/50 border-emerald-200"
                          : "bg-white border-slate-200 hover:border-teal-300 hover:bg-teal-50/20",
                        isFrozen && "opacity-60 cursor-not-allowed",
                      )}
                    >
                      {m.completed
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                        : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0 group-hover:text-teal-400 transition-colors" />
                      }
                      <div className="flex-1 min-w-0">
                        <span className={cn(
                          "text-sm font-bold block truncate",
                          m.completed ? "text-emerald-700 line-through" : "text-slate-700"
                        )}>{m.name}</span>
                        {m.completed && m.completedAt && (
                          <span className="text-[10px] font-bold text-emerald-500 block mt-0.5">
                            Completed by {m.completedBy} · {new Date(m.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {saving && idx === milestones.findIndex((_, i) => i === idx) && (
                        <Loader2 className="w-4 h-4 animate-spin text-slate-400 flex-shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Mapping Section */}
              <div className="mx-8 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Project Mapping</h3>
                  <span className={cn(
                    "px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md",
                    mappingStatusColors[extension.mappingStatus] || 'bg-slate-100 text-slate-500'
                  )}>
                    {extension.mappingStatus}
                  </span>
                </div>

                {extension.mappingStatus === 'None' && (
                  <div className="flex items-start justify-between gap-4">
                    <p className="text-sm text-slate-500 font-medium">
                      This implementation is standalone. You can request to map it to an existing project.
                    </p>
                    <button
                      onClick={() => setShowMapModal(true)}
                      className="flex-shrink-0 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Map to Project
                    </button>
                  </div>
                )}

                {extension.mappingStatus === 'Pending' && (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <p className="text-sm font-medium text-amber-800">
                      Mapping request pending PM approval. You can submit a new request once this is resolved.
                    </p>
                  </div>
                )}

                {extension.mappingStatus === 'Rejected' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-red-700">Mapping was rejected</p>
                        {extension.mappingRejectionComment && (
                          <p className="text-xs text-red-600 mt-0.5">"{extension.mappingRejectionComment}"</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowMapModal(true)}
                      className="px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center gap-1.5"
                    >
                      <MapPin className="w-3.5 h-3.5" /> Submit New Request
                    </button>
                  </div>
                )}

                {extension.mappingStatus === 'Approved' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <ExternalLink className="w-4 h-4 text-emerald-500" />
                      <p className="text-sm font-bold text-slate-700">
                        Mapped to project. Milestones sync to project's execution view.
                      </p>
                    </div>
                    {extension.mappingNotes && (
                      <p className="text-xs text-slate-500 bg-white border border-slate-100 rounded-xl p-3">
                        {extension.mappingNotes}
                      </p>
                    )}
                    {(isLead) && !showUnmapDialog && (
                      <button
                        onClick={() => setShowUnmapDialog(true)}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" /> Unmap from Project
                      </button>
                    )}
                    {showUnmapDialog && (
                      <div className="space-y-3 animate-in fade-in">
                        <textarea
                          className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl text-sm font-medium outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-400 transition-all resize-none"
                          placeholder="Reason for unmapping (required)..."
                          rows={3}
                          value={unmapComment}
                          onChange={e => setUnmapComment(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowUnmapDialog(false)}
                            className="px-4 py-2 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleUnmap}
                            disabled={unmapping || !unmapComment.trim()}
                            className="px-4 py-2 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {unmapping ? 'Unmapping...' : 'Confirm Unmap'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(extension.mappingStatus === 'Unmapped' || extension.mappingStatus === 'None') && extension.unmapComment && (
                  <div className="p-3 bg-white border border-slate-100 rounded-xl">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Previous Unmap Reason</p>
                    <p className="text-xs text-slate-500">"{extension.unmapComment}"</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {showMapModal && (
        <MapToProjectModal
          extension={extension}
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          onSuccess={() => {
            setShowMapModal(false);
            onClose();
          }}
          onShowToast={onShowToast}
        />
      )}
    </>
  );
};
