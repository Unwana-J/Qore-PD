import React, { useState, useMemo } from 'react';
import { Project, Phase, Comment, Risk, Role, RebaselineRequest, ServiceState, PackageConfig, ServiceBaseline } from '../types';
import { StateBadge } from './ProjectList';
import { formatCurrency, cn, calculatePhaseScores, getActiveDaysCount, getValidTransitions, isRole, hasRole, getAutoProjectState, getPhaseListFromState, calculateSPI, calculateWorkingDays, resolveServiceIds, getServiceNames, getEffectiveServiceIds } from '../lib/utils';
import { 
  Calendar, 
  User, 
  Briefcase, 
  ChevronLeft, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MessageSquare, 
  Send,
  AlertTriangle,
  Plus,
  Shield,
  RefreshCw,
  X,
  Lock,
  Check,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  Pencil,
  Save
} from 'lucide-react';
import { PROJECT_STATES } from '../constants';
import { getThemeClasses } from '../lib/theme';
import { subDays, format } from 'date-fns';

interface PhaseViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  onSubmitRebaseline: (projectId: string, days: number, comment: string) => Promise<any>;
  onApproveRebaseline: (projectId: string, requestId: string, reviewerComment?: string) => Promise<any>;
  onDeclineRebaseline: (projectId: string, requestId: string, reviewerComment: string) => Promise<any>;
  userRole: Role;
  serviceBaselines: ServiceBaseline[];
  packages?: PackageConfig[];
  themeColor?: string;
  onReassign?: () => void;
  defaultPhases?: string[];
  spiThresholds: { onTrack: number, atRisk: number };
  validateStateTransition?: (project: Project, newState: string) => string | null;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  userName?: string;
}

export const PhaseView: React.FC<PhaseViewProps> = ({ 
  project: rawProject, onBack, onUpdateProject, onSubmitRebaseline, 
  onApproveRebaseline, onDeclineRebaseline, 
  userRole, currencies = [], serviceBaselines = [], packages = [], themeColor = 'teal', onReassign, defaultPhases = [],
  spiThresholds, validateStateTransition, onShowToast, userName
}) => {
  const effectiveIds = getEffectiveServiceIds(rawProject, packages, serviceBaselines);

  // Dynamic Scope Sync: Filter out services that are neither in the package nor in milestones
  // This cleans up ghost tags like "Bankone" from legacy imports.
  const syncedServiceIds = useMemo(() => {
    const pkg = packages.find(p => p.name === rawProject.packageName);
    const pkgServiceIds = pkg ? resolveServiceIds(pkg.services || [], serviceBaselines) : [];
    
    return effectiveIds.filter(id => {
      const isInPackage = pkgServiceIds.includes(id);
      const hasMilestone = (rawProject.milestones || []).some(m => m.id === id);
      // Keep if it's in the package OR if it has work (milestone) associated with it
      return isInPackage || hasMilestone;
    });
  }, [effectiveIds, packages, rawProject.packageName, rawProject.milestones, serviceBaselines]);

  // 2. Defensive fallbacks for imported legacy projects that might lack these arrays
  // Resilience Layer: Auto-initialize phases if they are missing
  const phases = (rawProject.phases && rawProject.phases.length > 0) 
    ? rawProject.phases 
    : getPhaseListFromState(
        rawProject.intakeType === 'Old' ? 'Execution' : 'Initiation',
        rawProject.state === 'Closed' || rawProject.state === 'Billed',
        rawProject.startDate,
        rawProject.actualCompletionDate
      );

  // Universal Milestones: Use package-default services if milestones are empty
  const getInitialMilestones = () => {
    if (rawProject.milestones && rawProject.milestones.length > 0) return rawProject.milestones;
    
    // Check package or project services
    const pkg = packages.find(p => p.name === rawProject.packageName);
    const serviceIds = pkg ? pkg.services : syncedServiceIds;
    
    return serviceIds.map(sid => {
      const sb = serviceBaselines.find(b => b.id === sid);
      const name = sb ? sb.name : sid;
      return {
        id: sid,
        name: name,
        status: (rawProject.serviceStates?.[sid] || rawProject.serviceStates?.[name] || 'Not Started') as ServiceState
      };
    });
  };

  // 3. Dynamic Duration Calculation: STRICTLY derive from current configuration via IDs
  const dynamicDuration = syncedServiceIds.reduce((acc, sid) => {
    const sb = serviceBaselines.find(b => b.id === sid);
    return acc + (sb ? sb.baselineDays : 0);
  }, 0);

  const dynamicExpCompletion = rawProject.startDate 
    ? calculateWorkingDays(rawProject.startDate, dynamicDuration) 
    : (rawProject.expectedCompletionDate || rawProject.startDate);

  const project = {
    ...rawProject,
    services: syncedServiceIds,
    expectedDuration: dynamicDuration, // STICK TO THE CONFIG!
    expectedCompletionDate: dynamicExpCompletion,
    phases,
    milestones: getInitialMilestones(),
    risks: rawProject.risks || [],
    comments: rawProject.comments || [],
    activities: rawProject.activities || [],
    serviceStates: rawProject.serviceStates || {},
    suspensionCycles: rawProject.suspensionCycles || []
  };

  // Auto-Persist pruned scope if it changed (important for fixing ghost tags globally)
  React.useEffect(() => {
    if (JSON.stringify(rawProject.services) !== JSON.stringify(syncedServiceIds)) {
      console.log(`[Sync] Pruning ghost services for ${project.clientName}:`, 
        (rawProject.services || []).filter(id => !syncedServiceIds.includes(id)));
      onUpdateProject(project);
    }
  }, [syncedServiceIds, rawProject.services, project, onUpdateProject]);

  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [commentText, setCommentText] = useState('');
  const [isAddingRisk, setIsAddingRisk] = useState(false);
  const [newRisk, setNewRisk] = useState({ description: '', impact: 'Medium' as Risk['impact'] });
  
  const [isRebaselineModalOpen, setIsRebaselineModalOpen] = useState(false);
  const [rebaselineDays, setRebaselineDays] = useState(1);
  const [rebaselineComment, setRebaselineComment] = useState('');
  const [isSubmittingRebaseline, setIsSubmittingRebaseline] = useState(false);
  
  const [phaseCommentInputs, setPhaseCommentInputs] = useState<Record<string, string>>({});
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');

  // Inline edit state for Project Details card
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    packageName: string;
    priority: string;
    value: number;
    currency: string;
  }>({
    packageName: project.packageName || '',
    priority: project.priority || 'P3',
    value: project.value || 0,
    currency: project.currency || 'NGN',
  });

  const handleOpenEdit = () => {
    setEditDraft({
      packageName: project.packageName || '',
      priority: project.priority || 'P3',
      value: project.value || 0,
      currency: project.currency || 'NGN',
    });
    setIsEditingDetails(true);
  };

  const handleSaveDetails = () => {
    onUpdateProject({
      ...project,
      packageName: editDraft.packageName,
      priority: editDraft.priority as any,
      value: editDraft.value,
      currency: editDraft.currency,
    });
    setIsEditingDetails(false);
    onShowToast?.('Project details updated', 'success');
  };

  const theme = getThemeClasses(themeColor);
  const scores = calculatePhaseScores(project);

  const isOwner = project.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase();
  const canEdit = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']) || (isRole(userRole, 'PM') && isOwner);
  const canEditPhase = canEdit; // Relaxed for testing ease, initially restricted to Superadmin/PM

  const handleStatusChange = (newState: string) => {
    // Validate transition
    if (validateStateTransition) {
      const error = validateStateTransition(project, newState);
      if (error) {
        onShowToast?.(error, 'error');
        return;
      }
    }
    onUpdateProject({ ...project, state: newState as any });
  };

  const handleTogglePID = () => {
    if (!canEditPhase) return;
    const newDate = project.pidSignedOffDate ? undefined : new Date().toISOString().split('T')[0];
    onUpdateProject({ ...project, pidSignedOffDate: newDate });
  };

  const handleCompletePhase = (phaseId: string) => {
    if (!canEditPhase) return;
    const updatedPhases = project.phases.map(p => 
      p.id === phaseId ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
    );
    
    if (phaseId === 'Initiation') {
      const p = updatedPhases.find(x => x.id === 'Planning');
      if (p) p.status = 'In Progress';
    } else if (phaseId === 'Planning') {
      const p = updatedPhases.find(x => x.id === 'Execution');
      if (p) p.status = 'In Progress';
    } else if (phaseId === 'Execution') {
      const p = updatedPhases.find(x => x.id === 'Closure');
      if (p) p.status = 'In Progress';
    } else if (phaseId === 'Closure') {
       onUpdateProject({ ...project, phases: updatedPhases, state: 'Signed Off' });
       return;
    }

    onUpdateProject({ ...project, phases: updatedPhases });
  };

  const handleMilestoneChange = (milestoneId: string, state: ServiceState) => {
    if (!canEditPhase) return;
    const updatedMilestones = (project.milestones || []).map(m => 
      m.id === milestoneId ? { ...m, status: state } : m
    );
    const allClosed = updatedMilestones.every(m => m.status === 'Closed');
    
    let updatedPhases = [...project.phases];
    if (allClosed && updatedMilestones.length > 0) {
      updatedPhases = updatedPhases.map(p => 
        p.id === 'Execution' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure && (closure.status === 'Locked' || closure.status === 'Pending')) closure.status = 'In Progress';
    } else {
      const exec = updatedPhases.find(x => x.id === 'Execution');
      if (exec && exec.status === 'Completed') {
        exec.status = 'In Progress';
        exec.completionDate = undefined;
        const closure = updatedPhases.find(x => x.id === 'Closure');
        if (closure) closure.status = 'Locked';
      }
    }

    onUpdateProject({ ...project, milestones: updatedMilestones, phases: updatedPhases });
  };

  const handleAddMilestone = (name: string) => {
    if (!name.trim()) return;
    const next = [...(project.milestones || []), {
      id: Math.random().toString(36).substr(2, 9),
      name,
      status: 'Not Started' as const
    }];
    
    // Recalculate phase status if currently completed
    let updatedPhases = [...project.phases];
    const exec = updatedPhases.find(x => x.id === 'Execution');
    if (exec && exec.status === 'Completed') {
      exec.status = 'In Progress';
      exec.completionDate = undefined;
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure) closure.status = 'Locked';
    }

    onUpdateProject({ ...project, milestones: next, phases: updatedPhases });
    setNewMilestoneName('');
    setShowAddMilestone(false);
    onShowToast?.('Milestone added', 'success');
  };
  const handleDeleteMilestone = (id: string) => {
    // 1. Prune the services list
    const nextServices = (project.services || []).filter(sid => sid !== id);
    
    // 2. Remove from milestones
    const nextMilestones = (project.milestones || []).filter(m => m.id !== id);
    
    // 3. RECALCULATE Duration/Completion (CRITICAL for persistence)
    const nextDuration = nextServices.reduce((acc, sid) => {
      const sb = serviceBaselines.find(b => b.id === sid);
      return acc + (sb ? sb.baselineDays : 0);
    }, 0);
    
    const nextExpCompletion = rawProject.startDate 
      ? calculateWorkingDays(rawProject.startDate, nextDuration) 
      : (rawProject.expectedCompletionDate || rawProject.startDate);
    
    // 4. Check for phase completion
    const allClosed = nextMilestones.every(m => m.status === 'Closed');
    let updatedPhases = [...project.phases];
    if (allClosed && nextMilestones.length > 0) {
      updatedPhases = updatedPhases.map(p => 
        p.id === 'Execution' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure && (closure.status === 'Locked' || closure.status === 'Pending')) closure.status = 'In Progress';
    }
    
    // Persist NEWLY CALCULATED duration and services
    onUpdateProject({ 
      ...project, 
      milestones: nextMilestones, 
      services: nextServices, 
      expectedDuration: nextDuration,
      expectedCompletionDate: nextExpCompletion,
      phases: updatedPhases 
    });
  };

  const handleSavePhaseComment = (phaseId: string) => {
    const text = phaseCommentInputs[phaseId];
    if (!text?.trim()) return;

    if (phaseId === 'Closure' && project.isInternalInitiative && text.trim().length < 10) {
      onShowToast?.('Closure comment must be at least 10 characters', 'error');
      return;
    }

    const comment = {
      author: isRole(userRole, 'PM') ? project.assignedPM : 'Admin',
      text: text.trim(),
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    };

    const nextComments = { ...project.phaseComments, [phaseId]: comment };
    
    if (phaseId === 'Closure') {
      // Completion for all projects upon closure comment
      const updatedPhases = project.phases.map(p => 
        p.id === 'Closure' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      onUpdateProject({ ...project, phaseComments: nextComments, phases: updatedPhases as Phase[], state: 'Closed' });
      onShowToast?.('Project closed', 'success');
    } else {
      onUpdateProject({ ...project, phaseComments: nextComments });
    }
    
    setPhaseCommentInputs({ ...phaseCommentInputs, [phaseId]: '' });
  };

  const handleServiceChange = (service: string, state: ServiceState) => {
    if (!canEditPhase) return;
    const newStates = { ...project.serviceStates, [service]: state };
    const allServicesClosed = project.services.every(s => newStates[s] === 'Closed');
    
    let updatedPhases = [...project.phases];
    if (allServicesClosed && project.services.length > 0) {
      updatedPhases = updatedPhases.map(p => 
        p.id === 'Execution' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure && closure.status === 'Locked') closure.status = 'Pending';
    } else {
      const exec = updatedPhases.find(x => x.id === 'Execution');
      if (exec && exec.status === 'Completed') {
        exec.status = 'In Progress';
        exec.completionDate = undefined;
        const closure = updatedPhases.find(x => x.id === 'Closure');
        if (closure) closure.status = 'Locked';
      }
    }

    onUpdateProject({ ...project, serviceStates: newStates, phases: updatedPhases });
  };

  const handleRiskStatusChange = (riskId: string, newStatus: Risk['status']) => {
    const updatedRisks = project.risks.map(r => 
      r.id === riskId ? { ...r, status: newStatus } : r
    );
    onUpdateProject({ ...project, risks: updatedRisks });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const comment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      author: isRole(userRole, 'PM') ? 'Sarah Jenkins' : 'Admin User',
      text: commentText,
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    };

    onUpdateProject({
      ...project,
      comments: [comment, ...project.comments]
    });
    setCommentText('');
  };

  const handleAddRisk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRisk.description.trim()) return;

    const risk: Risk = {
      id: Math.random().toString(36).substr(2, 9),
      description: newRisk.description,
      impact: newRisk.impact,
      status: 'Open',
      createdAt: new Date().toISOString().split('T')[0]
    };

    onUpdateProject({
      ...project,
      risks: [risk, ...project.risks]
    });
    setNewRisk({ description: '', impact: 'Medium' });
    setIsAddingRisk(false);
  };

  const handleRebaselineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rebaselineDays <= 0 || !rebaselineComment.trim()) return;

    setIsSubmittingRebaseline(true);
    try {
      await onSubmitRebaseline(project.id, rebaselineDays, rebaselineComment);
      setIsRebaselineModalOpen(false);
      setRebaselineDays(1);
      setRebaselineComment('');
    } catch (error) {
      console.error('Failed to submit rebaseline', error);
    } finally {
      setIsSubmittingRebaseline(false);
    }
  };

  const canChangeState = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead', 'Finance']) || (isRole(userRole, 'PM') && isOwner);
  const canEditDetails = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']) || (isRole(userRole, 'PM') && isOwner);
  const canReassign = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']);
  const canRequestRebaseline = isRole(userRole, 'PM') && isOwner;

  return (
    <div className="p-6 space-y-8 animate-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{project.clientName}</h2>
              {project.intakeType === 'New' && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200">
                  New Project
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <StateBadge state={getAutoProjectState(project, spiThresholds)} />
              <span className="text-sm text-slate-500 font-medium">{project.isInternalInitiative ? "Internal Initiative" : project.packageName}</span>
              {canReassign && (
                <button 
                  onClick={onReassign}
                  className={cn(
                    "ml-2 flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold transition-all",
                    theme.text, theme.hoverBg, "hover:text-white hover:border-transparent"
                  )}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reassign Project
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              activeTab === 'overview' ? cn(theme.bg, "text-white shadow-md") : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              activeTab === 'activity' ? cn(theme.bg, "text-white shadow-md") : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Activity Feed
          </button>
        </div>

        {/* Status Control — role-aware state machine */}
        {(() => {
          const state = project.state;
          const transitions = getValidTransitions(project, userRole);
          const isClosed = state === 'Closed';
          const isSignedOff = state === 'Signed Off' && userRole !== 'Finance';
          const canAct = !isClosed && !isSignedOff;

          if (isClosed) {
            return (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">Project Closed</span>
              </div>
            );
          }

          if (isSignedOff) {
            return (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-4 py-2 rounded-2xl">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-bold text-amber-700">Awaiting Finance</span>
              </div>
            );
          }

          if (transitions.length === 0) return null;

          return (
            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase ml-2">Update Status:</span>
              {transitions.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleStatusChange(t.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl border transition-all",
                    t.value === 'Closed' ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700" :
                    t.value === 'Billed' ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700" :
                    t.value === 'Signed Off' ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" :
                    t.value === 'Suspended' ? "bg-slate-800 text-white border-slate-900 hover:bg-slate-900" :
                    t.value === 'On-Track' ? cn(theme.bg, 'text-white', theme.hoverBg) :
                    "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'overview' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Project Completion</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Overall progress based on phase completion</p>
                    </div>
                    <span className={cn("text-3xl font-black tracking-tighter", theme.text)}>
                      {scores.totalPercentage}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-6">
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Initiation</span>
                        <span className="sm:hidden">Init</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.initiationScore / (project.phaseWeights?.initiation || 10)) * 100}%` }} />
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.initiation || 10}%</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Planning</span>
                        <span className="sm:hidden">Plan</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.planningScore / (project.phaseWeights?.planning || 10)) * 100}%` }} />
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.planning || 10}%</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Execution</span>
                        <span className="sm:hidden">Exec</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.executionScore / (project.phaseWeights?.execution || 60)) * 100}%` }} />
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.execution || 60}%</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Closure</span>
                        <span className="sm:hidden">Close</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.closureScore / (project.phaseWeights?.closure || 20)) * 100}%` }} />
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.closure || 20}%</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const activeStats = getActiveDaysCount(project);
                  const isVisible = userRole === 'PM' ? isOwner : userRole !== 'Stakeholder';
                  
                  if (!isVisible) return null;

                  return (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between" title="Counts working days only. Paused during any suspension periods.">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Clock className={cn("w-5 h-5", theme.text)} />
                            {activeStats.label}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-1">Excludes weekends and holidays</p>
                        </div>
                      </div>
                      <div className="flex items-end gap-3 mt-auto pt-4">
                        {activeStats.isStarted ? (
                          <>
                            <span className={cn("text-4xl font-black tracking-tighter leading-none", activeStats.isSuspended ? "text-slate-400" : theme.text)}>
                              {activeStats.days}
                            </span>
                            <span className="text-sm font-bold text-slate-500 pb-1">working days</span>
                            {activeStats.isSuspended && (
                               <span className="mb-1 ml-auto text-[10px] font-black px-2 py-1 bg-slate-100 text-slate-500 uppercase tracking-widest rounded border border-slate-200">
                                 Suspended
                               </span>
                            )}
                          </>
                        ) : (
                           <span className={cn("text-lg font-black tracking-tighter", theme.text)}>
                             {activeStats.text}
                           </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const spiNow = calculateSPI(project, spiThresholds);
                  const isVisible = userRole === 'PM' ? isOwner : userRole !== 'Stakeholder';
                  if (!isVisible) return null;

                  const hasRebaseline = project.rebaselineRequests?.find(r => r.status === 'Approved');
                  const rebaselineLabel = hasRebaseline ? `Rebaselined ${format(new Date(hasRebaseline.reviewedAt || ''), 'MMM d')}` : null;

                  return (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between" title={spiNow.tooltip}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Activity className={cn("w-5 h-5", theme.text)} />
                            SPI
                          </h3>
                          <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Schedule Performance Index</p>
                        </div>
                        <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border", spiNow.color)}>
                          {spiNow.badge}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center my-auto">
                        <span className={cn("text-5xl font-black tracking-tighter", 
                          spiNow.badge === 'On Track' ? 'text-emerald-500' :
                          spiNow.badge === 'At Risk' ? 'text-amber-500' :
                          spiNow.badge === 'Delayed' ? 'text-red-500' : 'text-slate-400'
                        )}>
                          {spiNow.value}
                        </span>
                        {spiNow.isAnomaly && (
                           <AlertTriangle className="w-5 h-5 text-rose-500 mt-2" title="SPI is unusually high — consider reviewing completion data" />
                        )}
                        {rebaselineLabel && (
                          <span className="mt-3 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                            {rebaselineLabel}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">EV</p>
                          <p className="text-lg font-black text-slate-700">{spiNow.ev.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PV</p>
                          <p className="text-lg font-black text-slate-700">{spiNow.pv.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Clock className={cn("w-5 h-5", theme.text)} />
                  Phase Tracking
                </h3>
                
                <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {project.phases.map((phase) => {
                    const isLocked = phase.status === 'Locked';
                    const isCompleted = phase.status === 'Completed';
                    const isInProgress = phase.status === 'In Progress' || phase.status === 'Pending';
                    const weight = project.phaseWeights?.[phase.id.toLowerCase() as keyof typeof project.phaseWeights] ?? (
                      phase.id === 'Initiation' ? 10 :
                      phase.id === 'Planning' ? 10 :
                      phase.id === 'Execution' ? 60 : 20
                    );
                    
                    return (
                      <div key={phase.id} className="relative pl-12 group">
                        <div className={cn(
                          "absolute left-0 top-1 w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white transition-all duration-300",
                          isCompleted ? "bg-emerald-500 text-white" : 
                          isInProgress ? cn(theme.bg, "text-white shadow-lg", theme.shadow) : "bg-slate-100 text-slate-400"
                        )}>
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                           isLocked ? <Lock className="w-4 h-4" /> : <Clock className="w-5 h-5" />}
                        </div>
                        
                        <div className={cn(
                          "bg-slate-50 p-5 rounded-2xl border transition-all duration-300",
                          isLocked ? "border-transparent opacity-60 grayscale" : 
                          isInProgress ? cn(theme.border, theme.lightBg) : "border-slate-100 hover:border-slate-200"
                        )}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-exrabold text-slate-900 text-base">{phase.name}</h4>
                                <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500 uppercase">
                                  {weight}% Weight
                                </span>
                              </div>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                isCompleted ? "text-emerald-500" :
                                isLocked ? "text-slate-400" : theme.text
                              )}>
                                {phase.status} {phase.completionDate && `• ${phase.completionDate}`}
                              </span>
                            </div>

                            {/* Phase Completion Button */}
                              {canEditPhase && !isLocked && !isCompleted && phase.id !== 'Execution' && (
                                <button
                                  onClick={() => handleCompletePhase(phase.id)}
                                  disabled={phase.id === 'Initiation' && !project.pidSignedOffDate}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                    theme.bg, "text-white hover:shadow-lg"
                                  )}
                                >
                                  Mark Complete
                                </button>
                              )}
                          </div>

                          {/* Phase Specific Content */}
                          {!isLocked && (
                            <div className="bg-white rounded-xl p-4 border border-slate-100">
                              {phase.id === 'Initiation' && (
                                <div className="flex items-center justify-between">
                                  <div 
                                    className={cn("flex items-center gap-3", canEditPhase && !isCompleted && "cursor-pointer group")}
                                    onClick={() => canEditPhase && !isCompleted && handleTogglePID()}
                                  >
                                    <button 
                                      disabled={!canEditPhase || isCompleted}
                                      className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm",
                                        project.pidSignedOffDate || isCompleted ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300",
                                        canEditPhase && !project.pidSignedOffDate && !isCompleted ? "group-hover:border-emerald-500" : ""
                                      )}
                                    >
                                      {(project.pidSignedOffDate || isCompleted) && <Check className="w-3.5 h-3.5 text-white" />}
                                    </button>
                                    <div>
                                      <p className={cn("text-sm font-bold transition-colors flex items-center gap-2", 
                                        !isCompleted && canEditPhase ? "group-hover:text-emerald-700 text-slate-900" : "text-slate-900"
                                      )}>
                                        PID Sign-off
                                        {(isCompleted || project.pidSignedOffDate) && (
                                          <span className="text-slate-400 font-medium text-xs">Signed off · {project.pidSignedOffDate || project.startDate}</span>
                                        )}
                                      </p>
                                      <p className="text-xs text-slate-500">Must be completed before proceeding</p>
                                    </div>
                                  </div>
                                  
                                  {/* Phase Comments */}
                                  {(canEdit || !project.isInternalInitiative) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                       {project.phaseComments?.Initiation ? (
                                         <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                              {project.phaseComments.Initiation.author.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900">{project.phaseComments.Initiation.author}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{project.phaseComments.Initiation.timestamp}</span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">{project.phaseComments.Initiation.text}</p>
                                            </div>
                                         </div>
                                       ) : canEdit && !isCompleted && (
                                          <div className="flex gap-2">
                                            <input 
                                              placeholder="Initiation notes (optional)..."
                                              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-300"
                                              value={phaseCommentInputs.Initiation || ''}
                                              onChange={e => setPhaseCommentInputs({...phaseCommentInputs, Initiation: e.target.value})}
                                            />
                                            <button 
                                              onClick={() => handleSavePhaseComment('Initiation')}
                                              className={cn("p-1.5 rounded-lg text-white transition-all shadow-sm active:scale-95", theme.bg)}
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {phase.id === 'Execution' && (
                                <div className="space-y-4 pr-2 custom-scrollbar">
                                  {/* Unified: Milestones are now standard for ALL projects */}
                                  <>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                          Execution Score: {Math.round(scores.executionScore)}% / {project.phaseWeights.execution}%
                                        </span>
                                        {canEdit && !isCompleted && (
                                           <button 
                                             onClick={() => setShowAddMilestone(!showAddMilestone)}
                                             className={cn("px-3 py-1 bg-white border rounded-lg text-[10px] font-black uppercase transition-all", theme.text, theme.border, theme.hoverBg, "hover:text-white")}
                                           >
                                             {showAddMilestone ? "Cancel" : "+ Add Milestone"}
                                           </button>
                                        )}
                                      </div>
                                      
                                      {showAddMilestone && (
                                         <div className="flex gap-2 animate-in fade-in zoom-in duration-200 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <input 
                                              autoFocus
                                              placeholder="Milestone name..."
                                              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1"
                                              value={newMilestoneName}
                                              onChange={e => setNewMilestoneName(e.target.value)}
                                              onKeyDown={e => e.key === 'Enter' && handleAddMilestone(newMilestoneName)}
                                            />
                                            <button 
                                              onClick={() => handleAddMilestone(newMilestoneName)}
                                              className={cn("px-4 py-1.5 text-white rounded-lg text-xs font-bold transition-all", theme.bg)}
                                            >
                                              Add
                                            </button>
                                         </div>
                                      )}

                                      <div className="space-y-2">
                                        {(project.milestones || []).length === 0 ? (
                                          <div className="p-4 border-2 border-dashed border-slate-100 rounded-xl text-center">
                                            <p className="text-xs text-slate-400 italic font-medium">At least one milestone is required. Add a milestone to continue.</p>
                                          </div>
                                        ) : (
                                          project.milestones?.map(milestone => {
                                            const weightPerMilestone = project.phaseWeights.execution / (project.milestones?.length || 1);
                                            return (
                                              <div key={milestone.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors group">
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-bold text-slate-900">{milestone.name}</span>
                                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Contributing {weightPerMilestone.toFixed(1)}% of 60%</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  {canEditPhase ? (
                                                    <div className="flex bg-slate-200 p-1 rounded-lg">
                                                      {(['Not Started', 'In Progress', 'Closed'] as ServiceState[]).map(s => (
                                                        <button
                                                          key={s}
                                                          onClick={() => handleMilestoneChange(milestone.id, s)}
                                                          className={cn(
                                                            "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all",
                                                            milestone.status === s 
                                                              ? s === 'Closed' ? "bg-emerald-500 text-white shadow-sm"
                                                              : s === 'In Progress' ? "bg-amber-500 text-white shadow-sm"
                                                              : "bg-slate-400 text-white shadow-sm"
                                                              : "text-slate-500 hover:text-slate-700"
                                                          )}
                                                        >
                                                          {s}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <span className={cn(
                                                      "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg",
                                                      milestone.status === 'Closed' ? "bg-emerald-100 text-emerald-700" :
                                                      milestone.status === 'In Progress' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                                                    )}>
                                                      {milestone.status}
                                                    </span>
                                                  )}
                                                  {canEdit && !isCompleted && (
                                                     <button 
                                                       onClick={() => handleDeleteMilestone(milestone.id)}
                                                       className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                     >
                                                       <X className="w-4 h-4" />
                                                     </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </>
                                  </div>
                                )}

                            {phase.id === 'Planning' && (
                              <div className="space-y-4">
                                <p className="text-sm text-slate-500">Plan resources, create schedules, and prepare for execution.</p>
                                {canEditPhase && (
                                  <div className={cn("mt-4 pt-4 border-t border-slate-100")}>
                                     {project.phaseComments?.Planning ? (
                                         <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                              {project.phaseComments.Planning.author.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900">{project.phaseComments.Planning.author}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{project.phaseComments.Planning.timestamp}</span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">{project.phaseComments.Planning.text}</p>
                                            </div>
                                         </div>
                                       ) : canEdit && !isCompleted && (
                                          <div className="flex gap-2">
                                            <input 
                                              placeholder="Planning notes (optional)..."
                                              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-300"
                                              value={phaseCommentInputs.Planning || ''}
                                              onChange={e => setPhaseCommentInputs({...phaseCommentInputs, Planning: e.target.value})}
                                            />
                                            <button 
                                              onClick={() => handleSavePhaseComment('Planning')}
                                              className={cn("p-1.5 rounded-lg text-white transition-all shadow-sm active:scale-95", theme.bg)}
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {phase.id === 'Closure' && (
                                <div className="space-y-4">
                                  <p className="text-sm text-slate-500">Finalize documentation, hand over deliverables, and close the project.</p>
                                  {(canEdit) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                       {project.phaseComments?.Closure ? (
                                         <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                              {project.phaseComments.Closure.author.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900">{project.phaseComments.Closure.author}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{project.phaseComments.Closure.timestamp}</span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">{project.phaseComments.Closure.text}</p>
                                            </div>
                                         </div>
                                       ) : canEdit && !isCompleted && (
                                          <div className="flex flex-col gap-2">
                                            <textarea 
                                              placeholder="Closure notes (optional)..."
                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-300 min-h-[60px]"
                                              value={phaseCommentInputs.Closure || ''}
                                              onChange={e => setPhaseCommentInputs({...phaseCommentInputs, Closure: e.target.value})}
                                            />
                                            <button 
                                              onClick={() => handleSavePhaseComment('Closure')}
                                              className={cn("self-end px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2", theme.bg)}
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              {project.isInternalInitiative ? "Confirm & Close Initiative" : "Save Closure Notes"}
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Risks & Issues
                  </h3>
                  {canEdit && (
                    <button 
                      onClick={() => setIsAddingRisk(!isAddingRisk)}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isAddingRisk && (
                  <form onSubmit={handleAddRisk} className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <input 
                      autoFocus
                      placeholder="Describe the risk or issue..."
                      className="w-full px-4 py-2 bg-white border border-red-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                      value={newRisk.description}
                      onChange={e => setNewRisk({...newRisk, description: e.target.value})}
                    />
                    <div className="flex gap-3">
                      <select 
                        className="flex-1 px-3 py-2 bg-white border border-red-200 rounded-xl text-sm outline-none"
                        value={newRisk.impact}
                        onChange={e => setNewRisk({...newRisk, impact: e.target.value as any})}
                      >
                        <option value="Low">Low Impact</option>
                        <option value="Medium">Medium Impact</option>
                        <option value="High">High Impact</option>
                      </select>
                      <button type="submit" className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl text-sm">Log Risk</button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {project.risks.map(risk => (
                    <div key={risk.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{risk.description}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Logged on {risk.createdAt}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          risk.impact === 'High' ? "bg-red-100 text-red-700" : 
                          risk.impact === 'Medium' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {risk.impact}
                        </span>
                        {canEdit ? (
                          <select 
                            value={risk.status}
                            onChange={(e) => handleRiskStatusChange(risk.id, e.target.value as any)}
                            className={cn(
                              "text-[10px] font-bold uppercase flex items-center gap-1 bg-transparent outline-none cursor-pointer border border-transparent hover:border-slate-300 rounded px-1 transition-all",
                              risk.status === 'Open' ? "text-red-500" : 
                              risk.status === 'Addressing' ? "text-amber-500" : "text-slate-400"
                            )}
                          >
                            <option value="Open">Open</option>
                            <option value="Addressing">Addressing</option>
                            <option value="Closed">Closed</option>
                          </select>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-bold uppercase flex items-center gap-1",
                            risk.status === 'Open' ? "text-red-500" : 
                            risk.status === 'Addressing' ? "text-amber-500" : "text-slate-400"
                          )}>
                            <AlertTriangle className="w-3 h-3" />
                            {risk.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {project.risks.length === 0 && (
                    <div className="py-8 text-center text-slate-400">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm italic">No risks documented for this project.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[500px]">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className={cn("w-5 h-5", theme.text)} />
                Activity Timeline
              </h3>
              <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {project.activities?.map((activity) => (
                  <div key={activity.id} className="relative pl-10">
                    <div className={cn(
                      "absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center z-10 border-4 border-white shadow-sm",
                      activity.type === 'StateChange' ? "bg-blue-500 text-white" :
                      activity.type === 'Phase' ? "bg-emerald-500 text-white" :
                      activity.type === 'Risk' ? "bg-red-500 text-white" :
                      activity.type === 'Comment' ? "bg-purple-500 text-white" :
                      activity.type === 'Rebaseline' ? "bg-amber-500 text-white" : "bg-slate-400 text-white"
                    )}>
                      {activity.type === 'StateChange' ? <RefreshCw className="w-4 h-4" /> :
                       activity.type === 'Phase' ? <CheckCircle2 className="w-4 h-4" /> :
                       activity.type === 'Risk' ? <AlertTriangle className="w-4 h-4" /> :
                       activity.type === 'Comment' ? <MessageSquare className="w-4 h-4" /> :
                       activity.type === 'Rebaseline' ? <RefreshCw className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">{activity.user}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{activity.timestamp}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed shadow-sm">
                        {activity.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Project Details</h3>
              {canEditDetails && !isEditingDetails && (
                <button
                  onClick={handleOpenEdit}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-white"
                  )}
                  title="Edit project details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {isEditingDetails && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveDetails}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all", theme.bg)}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingDetails(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assigned PM</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">{project.assignedPM}</p>
                </div>
              </div>

              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Package</p>
                {isEditingDetails ? (
                  <select
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.packageName}
                    onChange={e => setEditDraft(d => ({ ...d, packageName: e.target.value }))}
                  >
                    <option value="">— Select package —</option>
                    {packages.map(pkg => (
                      <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">{project.packageName || '—'}</p>
                )}
              </div>

              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tier / Priority</p>
                {isEditingDetails ? (
                  <select
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.priority}
                    onChange={e => setEditDraft(d => ({ ...d, priority: e.target.value }))}
                  >
                    <option value="P1">P1 — Tier 1 Enterprise</option>
                    <option value="P2">P2 — Tier 2 Pro</option>
                    <option value="P3">P3 — Tier 3 Basic</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">
                    {project.priority === 'P1' ? 'P1 — Tier 1 Enterprise' :
                     project.priority === 'P2' ? 'P2 — Tier 2 Pro' :
                     project.priority === 'P3' ? 'P3 — Tier 3 Basic' : project.priority || '—'}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Value</p>
                {isEditingDetails ? (
                  <input
                    type="number"
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.value}
                    onChange={e => setEditDraft(d => ({ ...d, value: parseFloat(e.target.value) || 0 }))}
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">{project.value > 0 ? project.value.toLocaleString() : '0'}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Currency</p>
                {isEditingDetails ? (
                  <select
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.currency}
                    onChange={e => setEditDraft(d => ({ ...d, currency: e.target.value }))}
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">{project.currency}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Start Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">{project.startDate}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expected Duration</p>
                <p className="text-sm font-semibold text-slate-900">{project.expectedDuration || 0} Working Days</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exp. Completion</p>
                <p className="text-sm font-semibold text-slate-900">{project.expectedCompletionDate || project.startDate}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Completion</p>
                <div className="flex items-center justify-between">
                  <p className={cn(
                    "text-sm font-bold",
                    project.currentCompletionDate !== project.expectedCompletionDate ? theme.text : "text-slate-900"
                  )}>
                    {project.currentCompletionDate || project.expectedCompletionDate || project.startDate}
                  </p>
                  {canRequestRebaseline && (
                    <button
                      onClick={() => setIsRebaselineModalOpen(true)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-[10px] font-bold rounded hover:bg-slate-100 transition-colors border border-slate-200",
                        theme.text
                      )}
                      title="Request Rebaseline"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MessageSquare className={cn("w-5 h-5", theme.text)} />
              Project Comments
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {project.comments.map(comment => (
                <div key={comment.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900">{comment.author}</span>
                    <span className="text-[10px] text-slate-400">{comment.timestamp}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && (
              <form onSubmit={handleAddComment} className="relative">
                <input 
                  placeholder="Add a comment..."
                  className={cn(
                    "w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                />
                <button type="submit" className={cn("absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white rounded-xl shadow-md", theme.bg)}>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {isRebaselineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Request Rebaseline</h2>
              <button onClick={() => setIsRebaselineModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleRebaselineSubmit} className="p-6 space-y-6">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 leading-relaxed font-medium">
                  Rebaselining should be requested for significant scope changes or unexpected delays. This request will be reviewed by your Team Lead or Manager.
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Date</label>
                  <p className="text-sm font-bold text-slate-900">{project.currentCompletionDate}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Extension</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      min="1"
                      className={cn("w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none font-bold", theme.ring)}
                      value={rebaselineDays}
                      onChange={e => setRebaselineDays(parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xs font-bold text-slate-500">Working Days</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for Extension</label>
                <textarea 
                  required
                  rows={3}
                  className={cn("w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 outline-none text-sm transition-all resize-none", theme.ring)}
                  value={rebaselineComment}
                  onChange={e => setRebaselineComment(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsRebaselineModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingRebaseline || !rebaselineComment.trim()} className={cn("flex-1 px-6 py-3 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50", theme.bg)}>
                  {isSubmittingRebaseline ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const DetailItem = ({ icon, label, value }: any) => (
  <div className="flex items-center gap-3">
    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  </div>
);
