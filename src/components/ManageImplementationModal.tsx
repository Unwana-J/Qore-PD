import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CheckCircle2, Circle, MapPin, Unlink, AlertCircle,
  ExternalLink, Loader2, Lock, Clock, Calendar, UserPlus,
  RefreshCw, Briefcase, Check, Shield, AlertTriangle, Plus,
  Pencil, Trash2
} from 'lucide-react';
import { ServiceExtension, IMilestone, AppConfig, User, ImplementationIssue } from '../types';
import { api } from '../lib/api';
import { cn, isRole } from '../lib/utils';
import { MapToProjectModal } from './MapToProjectModal';
import { ReassignModal, ExtensionRequestModal } from './IMWorkflowModals';

interface ManageImplementationModalProps {
  extension: ServiceExtension;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updated: ServiceExtension) => void;
  userRole: string;
  userName: string;
  config: AppConfig;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
  onViewProject?: (projectId: string) => void;
}

export const ManageImplementationModal: React.FC<ManageImplementationModalProps> = ({
  extension, isOpen, onClose, onUpdated, userRole, userName, config, onShowToast, onViewProject
}) => {
  const [milestones, setMilestones] = useState<IMilestone[]>(extension.milestones);
  const [saving, setSaving] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [unmapping, setUnmapping] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [processingSuspension, setProcessingSuspension] = useState(false);
  const [processingExtension, setProcessingExtension] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const isLead = isRole(userRole, 'IM Lead') || isRole(userRole, 'Superadmin');
  const isSuspended = extension.status === 'Suspended';

  const [unmapComment, setUnmapComment] = useState('');
  const [showUnmapDialog, setShowUnmapDialog] = useState(false);
  
  const [newComment, setNewComment] = useState('');
  const [addingComment, setAddingComment] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const [isReassigning, setIsReassigning] = useState(false);
  const [newIM, setNewIM] = useState(extension.implementationManager);
  const [processingReassign, setProcessingReassign] = useState(false);

  const [isAddingIssue, setIsAddingIssue] = useState(false);
  const [newIssue, setNewIssue] = useState({ description: '', impact: 'Medium' as ImplementationIssue['impact'], category: 'General' });

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  const handleEditComment = async (commentId: string) => {
    if (!editingContent.trim()) return;
    setSaving(true);
    try {
      const result = await api.serviceExtensions.editComment(extension.id, commentId, editingContent);
      onUpdated(result);
      setEditingCommentId(null);
      setEditingContent('');
      onShowToast('Comment updated');
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    setSaving(true);
    try {
      const result = await api.serviceExtensions.deleteComment(extension.id, commentId);
      onUpdated(result);
      onShowToast('Comment deleted');
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  React.useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const data = await api.users.getAll();
        setUsers(data);
      } catch (err) {
        console.error('Failed to load users for reassignment', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    if (isLead && isOpen) loadUsers();
  }, [isLead, isOpen]);

  const toggleMilestone = async (idx: number) => {
    if (isSuspended) {
      onShowToast('This implementation is suspended.', 'error');
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

  const handleRequestExtension = async (newDate: string, reason: string) => {
    setProcessingExtension(true);
    try {
      await api.serviceExtensions.requestExtension(extension.id, { newTargetDate: newDate, reason, requestedBy: userName });
      onShowToast('Extension request submitted to IM Lead.');
      setShowExtensionModal(false);
      onClose();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setProcessingExtension(false);
    }
  };

  const handleApproveExtension = async () => {
    setProcessingExtension(true);
    try {
      await api.serviceExtensions.approveExtension(extension.id, userName);
      onShowToast('Extension approved successfully.');
      onClose();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setProcessingExtension(false);
    }
  };

  const handleRejectExtension = async () => {
    if (!rejectionReason.trim()) {
      onShowToast('Please provide a reason for rejection.', 'error');
      return;
    }
    setProcessingExtension(true);
    try {
      await api.serviceExtensions.rejectExtension(extension.id, rejectionReason);
      onShowToast('Extension request rejected.');
      onClose();
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setProcessingExtension(false);
      setIsRejecting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setAddingComment(true);
    try {
      const result = await api.serviceExtensions.addComment(extension.id, userName, newComment);
      onUpdated(result);
      setNewComment('');
      onShowToast('Comment added');
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setAddingComment(false);
    }
  };

  const handleReassign = async () => {
    if (newIM === extension.implementationManager) {
      setIsReassigning(false);
      return;
    }
    setProcessingReassign(true);
    try {
      await api.serviceExtensions.reassign(extension.id, newIM, extension.implementationManager, userName);
      const updated = { ...extension, implementationManager: newIM };
      onUpdated(updated);
      onShowToast(`Reassigned to ${newIM}`);
      setIsReassigning(false);
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setProcessingReassign(false);
    }
  };

  const handleAddIssue = async () => {
    if (!newIssue.description.trim()) return;
    setSaving(true);
    try {
      const result = await api.serviceExtensions.addIssue(
        extension.id,
        newIssue.description,
        newIssue.impact,
        newIssue.category
      );
      onUpdated(result);
      setNewIssue({ description: '', impact: 'Medium', category: 'General' });
      setIsAddingIssue(false);
      onShowToast('Issue logged successfully');
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleIssueStatusChange = async (issueId: string, status: ImplementationIssue['status']) => {
    setSaving(true);
    try {
      const result = await api.serviceExtensions.updateIssue(extension.id, issueId, {
        status,
        resolvedAt: status === 'Closed' ? new Date().toISOString() : undefined
      });
      onUpdated(result);
      onShowToast(`Issue marked as ${status}`);
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setSaving(false);
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
            <div className="flex items-start justify-between p-6 sm:p-8 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-black text-slate-900 truncate">{extension.clientName}</h2>
                  {isSuspended && (
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-md">
                      <Lock className="w-3 h-3" /> Suspended
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
              <div className="px-8 pt-6 pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Implementation Progress</span>
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

              {extension.extensionRequest ? (
                <div className="mx-8 mb-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl animate-in zoom-in-95">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Pending Extension Request</span>
                    </div>
                    <span className="text-[10px] font-bold text-amber-500">Requested {new Date(extension.extensionRequest.requestedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-bold text-amber-900">
                      New Target: {new Date(extension.extensionRequest.newTargetDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-amber-700 bg-white/50 p-3 rounded-xl border border-amber-100 italic">
                      "{extension.extensionRequest.reason}"
                    </p>
                    {isLead ? (
                      <div className="space-y-3">
                        {!isRejecting ? (
                          <div className="flex gap-2">
                            <button onClick={handleApproveExtension} disabled={processingExtension} className="flex-1 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/10">Approve</button>
                            <button onClick={() => setIsRejecting(true)} disabled={processingExtension} className="flex-1 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/10">Reject</button>
                          </div>
                        ) : (
                          <div className="space-y-2 animate-in slide-in-from-top-1">
                            <textarea
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              placeholder="Reason for rejection (required)..."
                              className="w-full p-3 bg-white border border-red-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-red-500/20"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => { setIsRejecting(false); setRejectionReason(''); }} className="px-3 py-1.5 text-slate-500 text-[10px] font-bold uppercase">Cancel</button>
                              <button onClick={handleRejectExtension} disabled={processingExtension || !rejectionReason.trim()} className="flex-1 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg">Confirm Reject</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-amber-500 text-center uppercase tracking-widest">Awaiting IM Lead Approval</p>
                    )}
                  </div>
                </div>
              ) : (
                !isSuspended && extension.status !== 'Completed' && !extension.suspensionRequest && (
                  <div className="px-8 mb-6 space-y-3">
                    {(extension.mappingStatus === 'Approved') && (
                      <button
                        onClick={() => setShowExtensionModal(true)}
                        className="w-full py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-amber-600 hover:border-amber-200 hover:bg-amber-50/30 transition-all flex items-center justify-center gap-2"
                      >
                        <Calendar className="w-3.5 h-3.5" /> Request Date Extension
                      </button>
                    )}
                    {(extension.mappingStatus === 'None' || extension.mappingStatus === 'Rejected' || extension.mappingStatus === 'Unmapped') && (
                      !showSuspensionModal ? (
                        <button
                          onClick={() => setShowSuspensionModal(true)}
                          className="w-full py-3 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-orange-600 hover:border-orange-200 hover:bg-orange-50/30 transition-all flex items-center justify-center gap-2"
                        >
                          <Lock className="w-3.5 h-3.5" /> Request Suspension
                        </button>
                      ) : (
                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-3 animate-in fade-in">
                          <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Suspension Request</p>
                          <textarea
                            className="w-full px-3 py-2.5 bg-white border border-orange-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 transition-all resize-none"
                            placeholder="Provide a reason for suspension (required)..."
                            rows={3}
                            value={suspensionReason}
                            onChange={e => setSuspensionReason(e.target.value)}
                          />
                          <div className="flex gap-2">
                            <button onClick={() => { setShowSuspensionModal(false); setSuspensionReason(''); }} className="px-4 py-2 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors">Cancel</button>
                            <button
                              onClick={async () => {
                                if (!suspensionReason.trim()) return;
                                setProcessingSuspension(true);
                                try {
                                  await api.serviceExtensions.requestSuspension(extension.id, suspensionReason, userName);
                                  onShowToast('Suspension request submitted for approval.');
                                  setShowSuspensionModal(false);
                                  setSuspensionReason('');
                                  onClose();
                                } catch (err: any) {
                                  onShowToast(err.message, 'error');
                                } finally {
                                  setProcessingSuspension(false);
                                }
                              }}
                              disabled={processingSuspension || !suspensionReason.trim()}
                              className="px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                            >
                              {processingSuspension ? <><Loader2 className="w-3 h-3 animate-spin" /> Submitting...</> : 'Submit Request'}
                            </button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )
              )}

              {extension.suspensionRequest?.status === 'Pending' && (
                <div className="px-8 mb-6">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      <p className="text-[10px] font-black text-orange-700 uppercase tracking-widest">Pending Suspension Request</p>
                    </div>
                    <p className="text-sm text-orange-800 font-medium">"{extension.suspensionRequest.reason}"</p>
                    <p className="text-[10px] text-orange-500">Requested by {extension.suspensionRequest.requestedBy}</p>
                    {isLead ? (
                      <div className="space-y-3">
                         {!isRejecting ? (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={async () => {
                                setProcessingSuspension(true);
                                try { await api.serviceExtensions.approveSuspension(extension.id, userName); onShowToast('Suspension approved.'); onClose(); }
                                catch (err: any) { onShowToast(err.message, 'error'); }
                                finally { setProcessingSuspension(false); }
                              }}
                              disabled={processingSuspension}
                              className="flex-1 py-2 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-orange-700 shadow-lg shadow-orange-600/10"
                            >Approve Suspension</button>
                            <button
                              onClick={() => setIsRejecting(true)}
                              disabled={processingSuspension}
                              className="flex-1 py-2 bg-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-300"
                            >Reject</button>
                          </div>
                        ) : (
                          <div className="space-y-2 animate-in slide-in-from-top-1">
                            <textarea
                              value={rejectionReason}
                              onChange={e => setRejectionReason(e.target.value)}
                              placeholder="Reason for rejection (required)..."
                              className="w-full p-3 bg-white border border-orange-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-orange-500/20"
                              rows={2}
                            />
                            <div className="flex gap-2">
                              <button onClick={() => { setIsRejecting(false); setRejectionReason(''); }} className="px-3 py-1.5 text-slate-500 text-[10px] font-bold uppercase">Cancel</button>
                              <button 
                                onClick={async () => {
                                  if (!rejectionReason.trim()) return;
                                  setProcessingSuspension(true);
                                  try { await api.serviceExtensions.rejectSuspension(extension.id, rejectionReason, userName); onShowToast('Suspension request rejected.'); onClose(); }
                                  catch (err: any) { onShowToast(err.message, 'error'); }
                                  finally { setProcessingSuspension(false); setIsRejecting(false); }
                                }}
                                disabled={processingSuspension || !rejectionReason.trim()}
                                className="flex-1 py-1.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg"
                              >Confirm Reject</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[10px] font-bold text-orange-500 text-center uppercase tracking-widest">Awaiting IM Lead Approval</p>
                    )}
                  </div>
                </div>
              )}

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
                      disabled={saving || isSuspended}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border text-left transition-all group",
                        m.completed
                          ? "bg-emerald-50/50 border-emerald-200"
                          : "bg-white border-slate-200 hover:border-teal-300 hover:bg-teal-50/20",
                        isSuspended && "opacity-60 cursor-not-allowed",
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

              <div className="mx-8 mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Project Mapping</h3>
                  <div className="flex items-center gap-2">
                    {extension.linkedProjectId ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1.5 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-200">Mapped to Project</span>
                        {onViewProject && (
                          <button 
                            onClick={() => onViewProject(extension.linkedProjectId!)}
                            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-1.5"
                          >
                            <Briefcase className="w-3 h-3" />
                            View Overview
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className={cn(
                        "px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md",
                        mappingStatusColors[extension.mappingStatus] || 'bg-slate-100 text-slate-500'
                      )}>
                        {extension.mappingStatus}
                      </span>
                    )}
                  </div>
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

              {isLead && (
                <div className="mx-8 mb-8 p-6 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-500">
                        {extension.implementationManager.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Manager</p>
                        {isReassigning ? (
                          <div className="flex items-center gap-2 mt-1">
                            <select 
                              value={newIM} 
                              onChange={e => setNewIM(e.target.value)}
                              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-teal-500/20"
                            >
                              {users.filter(u => u.role === 'IM' || u.role === 'IM Lead').map(u => (
                                <option key={u.id} value={u.name}>{u.name}</option>
                              ))}
                            </select>
                            <button onClick={handleReassign} disabled={processingReassign} className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700">
                              {processingReassign ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </button>
                            <button onClick={() => setIsReassigning(false)} className="p-1.5 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-slate-900">{extension.implementationManager}</p>
                            {isLead && (
                              <button onClick={() => setIsReassigning(true)} className="p-1 text-slate-400 hover:text-teal-600 transition-colors">
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-px h-8 bg-indigo-200/50" />
                    {(extension.assignmentHistory?.length ?? 0) > 0 && (
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Recent History</p>
                        <p className="text-[10px] text-indigo-700 font-medium truncate">
                          {extension.assignmentHistory[extension.assignmentHistory.length - 1].from} → {extension.assignmentHistory[extension.assignmentHistory.length - 1].to}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="px-8 pb-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5" /> Issue Log
                  </h3>
                  <button
                    onClick={() => setIsAddingIssue(!isAddingIssue)}
                    className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Log New Issue
                  </button>
                </div>

                {isAddingIssue && (
                  <div className="mb-6 p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 animate-in slide-in-from-top-2">
                    <textarea
                      value={newIssue.description}
                      onChange={e => setNewIssue({ ...newIssue, description: e.target.value })}
                      placeholder="Describe the issue or blocker..."
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500/20 transition-all resize-none"
                      rows={2}
                    />
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Impact</label>
                        <select
                          value={newIssue.impact}
                          onChange={e => setNewIssue({ ...newIssue, impact: e.target.value as any })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        >
                          <option value="Low">Low Impact</option>
                          <option value="Medium">Medium Impact</option>
                          <option value="High">High Impact</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5 ml-1">Category</label>
                        <select
                          value={newIssue.category}
                          onChange={e => setNewIssue({ ...newIssue, category: e.target.value })}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none"
                        >
                          <option value="General">General</option>
                          <option value="Client">Client Side</option>
                          <option value="Technical">Technical</option>
                          <option value="Third-Party">Third-Party</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => setIsAddingIssue(false)} className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancel</button>
                      <button
                        onClick={handleAddIssue}
                        disabled={saving || !newIssue.description.trim()}
                        className="px-6 py-2 bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-teal-700 shadow-lg shadow-teal-600/10 transition-all"
                      >
                        {saving ? 'Logging...' : 'Log Issue'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {(extension.issues || []).length === 0 ? (
                    <p className="text-center text-xs font-bold text-slate-300 py-6 italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">No issues logged.</p>
                  ) : (
                    (extension.issues || []).map(issue => (
                      <div key={issue.id} className="p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all group">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                                issue.impact === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                                issue.impact === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                'bg-blue-50 text-blue-600 border border-blue-100'
                              )}>
                                {issue.impact}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{issue.category || 'General'}</span>
                              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest ml-auto">{new Date(issue.createdAt).toLocaleDateString()}</span>
                            </div>
                            <p className={cn("text-sm font-bold leading-relaxed", issue.status === 'Closed' ? 'text-slate-400 line-through' : 'text-slate-700')}>
                              {issue.description}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2">
                            {issue.status !== 'Closed' ? (
                              <>
                                <button
                                  onClick={() => handleIssueStatusChange(issue.id, 'Closed')}
                                  className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                  title="Mark as Resolved"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                {issue.status === 'Open' && (
                                  <button
                                    onClick={() => handleIssueStatusChange(issue.id, 'Addressing')}
                                    className="p-1.5 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                                    title="Mark as Addressing"
                                  >
                                    <Clock className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            ) : (
                              <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                            )}
                          </div>
                        </div>
                        {issue.status === 'Closed' && issue.resolvedAt && (
                          <div className="mt-3 pt-3 border-t border-slate-50 flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 uppercase tracking-widest">
                            <Check className="w-2.5 h-2.5" /> Resolved on {new Date(issue.resolvedAt).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="px-8 pb-12">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-4">Implementation Trail & Comments</h3>
                
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-black text-teal-700 shrink-0">
                      {userName[0]}
                    </div>
                    <div className="flex-1 space-y-2">
                      <textarea
                        value={newComment}
                        onChange={e => setNewComment(e.target.value)}
                        placeholder="Add a comment or update..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all resize-none"
                        rows={2}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={addingComment || !newComment.trim()}
                        className="px-4 py-2 bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-teal-700 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {addingComment && <Loader2 className="w-3 h-3 animate-spin" />}
                        Post Comment
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {(extension.comments || []).length === 0 ? (
                      <p className="text-center text-xs font-bold text-slate-400 py-8 italic">No comments yet. Start the trail!</p>
                    ) : (
                      [...(extension.comments || [])].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(c => (
                        <div key={c.id} className="flex gap-3 group animate-in slide-in-from-top-2 duration-300">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 shrink-0 group-hover:bg-teal-50 group-hover:text-teal-600 transition-colors">
                            {(c.author || 'System')[0]}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-900">{c.author}</span>
                                {c.updatedAt && <span className="text-[9px] font-black text-teal-500 uppercase tracking-widest bg-teal-50 px-1 rounded">Edited</span>}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(c.createdAt).toLocaleDateString()} · {new Date(c.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                {c.author === userName && !editingCommentId && (
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => { setEditingCommentId(c.id); setEditingContent(c.content); }}
                                      className="p-1 text-slate-400 hover:text-teal-600 transition-colors"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className={cn(
                              "p-3 bg-slate-50 rounded-2xl rounded-tl-none border border-slate-100 group-hover:border-slate-200 transition-colors",
                              editingCommentId === c.id && "bg-white border-teal-200 ring-2 ring-teal-500/10"
                            )}>
                              {editingCommentId === c.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={editingContent}
                                    onChange={e => setEditingContent(e.target.value)}
                                    className="w-full bg-transparent text-sm text-slate-700 outline-none resize-none"
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button 
                                      onClick={() => setEditingCommentId(null)}
                                      className="px-2 py-1 text-[9px] font-black uppercase text-slate-400 hover:text-slate-600"
                                    >
                                      Cancel
                                    </button>
                                    <button 
                                      onClick={() => handleEditComment(c.id)}
                                      disabled={saving || !editingContent.trim() || editingContent === c.content}
                                      className="px-3 py-1 bg-teal-600 text-white text-[9px] font-black uppercase rounded-lg hover:bg-teal-700 transition-all disabled:opacity-50"
                                    >
                                      {saving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{c.content || (c as any).text}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {showReassignModal && (
        <ReassignModal 
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          onConfirm={handleReassign}
          extension={extension}
          users={users}
          loading={saving}
        />
      )}

      {showExtensionModal && (
        <ExtensionRequestModal 
          isOpen={showExtensionModal}
          onClose={() => setShowExtensionModal(false)}
          onConfirm={handleRequestExtension}
          extension={extension}
          loading={processingExtension}
        />
      )}

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
