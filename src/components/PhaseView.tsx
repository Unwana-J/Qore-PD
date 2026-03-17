import React, { useState } from 'react';
import { Project, Phase, Comment, Risk, Role, RebaselineRequest, ServiceState } from '../types';
import { StateBadge } from './ProjectList';
import { formatCurrency, cn, calculatePhaseScores } from '../lib/utils';
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
  Check
} from 'lucide-react';
import { PROJECT_STATES } from '../constants';
import { getThemeClasses } from '../lib/theme';

interface PhaseViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  onSubmitRebaseline: (projectId: string, days: number, comment: string) => Promise<any>;
  onApproveRebaseline: (projectId: string, requestId: string, reviewerComment?: string) => Promise<any>;
  onDeclineRebaseline: (projectId: string, requestId: string, reviewerComment: string) => Promise<any>;
  userRole: Role;
  currencies: any[];
  themeColor?: string;
  onReassign?: () => void;
  defaultPhases?: string[];
}

export const PhaseView: React.FC<PhaseViewProps> = ({ 
  project, onBack, onUpdateProject, onSubmitRebaseline, 
  onApproveRebaseline, onDeclineRebaseline, 
  userRole, currencies = [], themeColor = 'teal', onReassign, defaultPhases = [] 
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [commentText, setCommentText] = useState('');
  const [isAddingRisk, setIsAddingRisk] = useState(false);
  const [newRisk, setNewRisk] = useState({ description: '', impact: 'Medium' as Risk['impact'] });
  
  const [isRebaselineModalOpen, setIsRebaselineModalOpen] = useState(false);
  const [rebaselineDays, setRebaselineDays] = useState(1);
  const [rebaselineComment, setRebaselineComment] = useState('');
  const [isSubmittingRebaseline, setIsSubmittingRebaseline] = useState(false);

  const theme = getThemeClasses(themeColor);
  const scores = calculatePhaseScores(project);

  const isOwner = project.assignedPM === 'Sarah Jenkins';
  const canEdit = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead' || (userRole === 'PM' && isOwner);
  const canEditPhase = userRole === 'Superadmin' || (userRole === 'PM' && isOwner);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value as any;
    onUpdateProject({ ...project, state: newState });
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
      if (p) p.status = 'Pending';
    } else if (phaseId === 'Closure') {
       onUpdateProject({ ...project, phases: updatedPhases, state: 'Closed' });
       return;
    }

    onUpdateProject({ ...project, phases: updatedPhases });
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
      author: userRole === 'PM' ? 'Sarah Jenkins' : 'Admin User',
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

  const canChangeState = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead' || (userRole === 'PM' && isOwner) || userRole === 'Finance';
  const canEditValue = (userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Finance') && 
                       (project.state === 'Active' || project.state === 'Delayed' || project.state === 'Suspended');
  const canEditCurrency = userRole === 'Superadmin' || userRole === 'Manager';
  const canReassign = ['Superadmin', 'Manager', 'Team Lead'].includes(userRole);
  const canRequestRebaseline = userRole === 'PM' && isOwner;

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
            <h2 className="text-2xl font-bold text-slate-900">{project.clientName}</h2>
            <div className="flex items-center gap-3 mt-1">
              <StateBadge state={project.state} />
              <span className="text-sm text-slate-500 font-medium">{project.packageName}</span>
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

        {canChangeState && (
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-xs font-bold text-slate-400 uppercase ml-2">Update Status:</span>
            <select 
              value={project.state}
              onChange={handleStatusChange}
              className={cn(
                "bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2",
                theme.ring
              )}
            >
              {PROJECT_STATES.map(state => {
                const isBilled = state === 'Billed';
                const isFinance = userRole === 'Finance';
                const isPM = userRole === 'PM';

                if (isFinance && !isBilled) return null;
                
                if (isPM && isBilled) return (
                  <option key={state} value={state} disabled>
                    {state} (Finance Only)
                  </option>
                );

                return (
                  <option key={state} value={state}>
                    {state}
                  </option>
                );
              })}
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'overview' ? (
            <>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-8">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Project Completion</h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Overall progress based on phase completion</p>
                  </div>
                  <span className={cn("text-3xl font-black tracking-tighter", theme.text)}>
                    {scores.totalPercentage}%
                  </span>
                </div>
                <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${scores.initiationScore}%` }} />
                  <div className="h-full bg-indigo-500 transition-all duration-500" style={{ width: `${scores.planningScore}%` }} />
                  <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${scores.executionScore}%` }} />
                  <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${scores.closureScore}%` }} />
                </div>
                <div className="flex justify-between mt-3 text-[10px] uppercase font-black tracking-widest text-slate-400">
                  <span>Initiation ({project.phaseWeights?.initiation || 10}%)</span>
                  <span>Planning ({project.phaseWeights?.planning || 10}%)</span>
                  <span>Execution ({project.phaseWeights?.execution || 60}%)</span>
                  <span>Closure ({project.phaseWeights?.closure || 20}%)</span>
                </div>
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
                    const weight = project.phaseWeights?.[phase.id.toLowerCase() as keyof typeof project.phaseWeights] || 0;
                    
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
                                  <div className="flex items-center gap-3">
                                    <button 
                                      disabled={!canEditPhase}
                                      onClick={handleTogglePID}
                                      className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                                        project.pidSignedOffDate ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300",
                                        canEditPhase && !project.pidSignedOffDate ? "hover:border-emerald-500" : ""
                                      )}
                                    >
                                      {project.pidSignedOffDate && <Check className="w-3.5 h-3.5 text-white" />}
                                    </button>
                                    <div>
                                      <p className="text-sm font-bold text-slate-900">PID Sign-off</p>
                                      <p className="text-xs text-slate-500">Must be completed before proceeding</p>
                                    </div>
                                  </div>
                                  {project.pidSignedOffDate && (
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                      {project.pidSignedOffDate}
                                    </span>
                                  )}
                                </div>
                              )}

                              {phase.id === 'Execution' && (
                                <div className="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                  {project.services.length === 0 ? (
                                    <p className="text-sm text-slate-500 italic">No services selected.</p>
                                  ) : (
                                    project.services.map(service => {
                                      const state = project.serviceStates?.[service] || 'Not Started';
                                      return (
                                        <div key={service} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                          <span className="text-sm font-bold text-slate-700">{service}</span>
                                          {canEditPhase ? (
                                            <div className="flex bg-slate-200 p-1 rounded-lg">
                                              {(['Not Started', 'In Progress', 'Closed'] as ServiceState[]).map(s => (
                                                <button
                                                  key={s}
                                                  onClick={() => handleServiceChange(service, s)}
                                                  className={cn(
                                                    "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-md transition-all",
                                                    state === s 
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
                                              "px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg",
                                              state === 'Closed' ? "bg-emerald-100 text-emerald-700" :
                                              state === 'In Progress' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                                            )}>
                                              {state}
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                  {project.services.length > 0 && !isCompleted && (
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2 text-right">
                                      Auto-completes when all services are Closed
                                    </p>
                                  )}
                                </div>
                              )}

                              {phase.id === 'Planning' && (
                                <p className="text-sm text-slate-500">Plan resources, create schedules, and prepare for execution.</p>
                              )}

                              {phase.id === 'Closure' && (
                                <p className="text-sm text-slate-500">Finalize documentation, hand over deliverables, and close the project.</p>
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
            <h3 className="text-lg font-bold text-slate-900 mb-6">Project Details</h3>
            <div className="space-y-4">
              <DetailItem icon={<User className="w-4 h-4" />} label="Assigned PM" value={project.assignedPM} />
              
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Value & Currency</p>
                  <div className="flex gap-2 mt-1">
                    {canEditValue ? (
                      <input 
                        type="number"
                        className={cn(
                          "flex-1 text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-100 rounded px-2 py-1 outline-none focus:ring-1",
                          theme.ringStatic
                        )}
                        value={project.value}
                        onChange={(e) => onUpdateProject({ ...project, value: parseFloat(e.target.value) })}
                      />
                    ) : (
                      <p className="text-sm font-semibold text-slate-900 py-1">{formatCurrency(project.value, project.currency)}</p>
                    )}
                    
                    {canEditCurrency ? (
                      <select
                        className={cn(
                          "text-[10px] font-bold uppercase bg-slate-50 border border-slate-100 rounded px-1 py-1 outline-none focus:ring-1",
                          theme.ringStatic
                        )}
                        value={project.currency}
                        onChange={(e) => onUpdateProject({ ...project, currency: e.target.value })}
                      >
                        {currencies.map(c => (
                          <option key={c.code} value={c.code}>{c.code}</option>
                        ))}
                      </select>
                    ) : (
                       canEditValue && <span className="text-xs font-bold text-slate-500 py-1">{project.currency}</span>
                    )}
                  </div>
                </div>
              </div>

              <DetailItem icon={<Calendar className="w-4 h-4" />} label="Start Date" value={project.startDate} />

              <div className="pt-2 grid grid-cols-2 gap-4 border-t border-slate-100 mt-2 pt-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Expected Duration</p>
                  <p className="text-sm font-semibold text-slate-900">{project.expectedDuration || 0} Working Days</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Exp. Completion</p>
                  <p className="text-sm font-semibold text-slate-900">{project.expectedCompletionDate || project.startDate}</p>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Current Completion Date</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-sm font-extrabold text-teal-600">{project.currentCompletionDate || project.expectedCompletionDate || project.startDate}</p>
                  {canRequestRebaseline && (
                    <button 
                      onClick={() => setIsRebaselineModalOpen(true)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 bg-slate-50 text-[10px] font-bold rounded-lg hover:bg-slate-100 transition-colors border border-slate-200",
                        theme.text
                      )}
                    >
                      <Plus className="w-3 h-3" />
                      Request
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
