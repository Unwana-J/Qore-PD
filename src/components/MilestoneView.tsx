import React, { useState } from 'react';
import { Project, Milestone, Comment, Risk, Role } from '../types';
import { StateBadge } from './ProjectList';
import { formatCurrency, cn } from '../lib/utils';
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
  RefreshCw
} from 'lucide-react';
import { PROJECT_STATES } from '../constants';
import { getThemeClasses } from '../lib/theme';

interface MilestoneViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  userRole: Role;
  currencies: any[];
  themeColor?: string;
  onReassign?: () => void;
}

export const MilestoneView: React.FC<MilestoneViewProps> = ({ project, onBack, onUpdateProject, userRole, currencies = [], themeColor = 'teal', onReassign }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [commentText, setCommentText] = useState('');
  const [isAddingRisk, setIsAddingRisk] = useState(false);
  const [newRisk, setNewRisk] = useState({ description: '', impact: 'Medium' as Risk['impact'] });

  const theme = getThemeClasses(themeColor);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newState = e.target.value as any;
    onUpdateProject({ ...project, state: newState });
  };

  const handleMilestoneStatusChange = (milestoneId: string, newStatus: Milestone['status']) => {
    const updatedMilestones = project.milestones.map(m => 
      m.id === milestoneId ? { ...m, status: newStatus } : m
    );
    onUpdateProject({ ...project, milestones: updatedMilestones });
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

  const isOwner = project.assignedPM === 'Sarah Jenkins'; // In POC, Sarah is the logged-in PM
  const canEdit = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead' || (userRole === 'PM' && isOwner);
  const canChangeState = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead' || (userRole === 'PM' && isOwner) || userRole === 'Finance';
  const canEditValue = (userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Finance') && 
                       (project.state === 'Active' || project.state === 'Delayed' || project.state === 'Suspended');
  const canEditCurrency = userRole === 'Superadmin' || userRole === 'Manager';
  const canReassign = ['Superadmin', 'Manager', 'Team Lead'].includes(userRole);

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
                const isAdmin = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead';

                // Finance can ONLY trigger Billed
                if (isFinance && !isBilled) return null;
                
                // PM cannot trigger Billed
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
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'overview' ? (
            <>
              {/* Milestones */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Clock className={cn("w-5 h-5", theme.text)} />
                  Project Milestones
                </h3>
                <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {project.milestones.map((milestone) => (
                    <div key={milestone.id} className="relative pl-12">
                      <div className={cn(
                        "absolute left-0 top-1 w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white",
                        milestone.status === 'Completed' ? "bg-emerald-500 text-white" : 
                        milestone.status === 'In Progress' ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
                      )}>
                        {milestone.status === 'Completed' ? <CheckCircle2 className="w-5 h-5" /> : 
                         milestone.status === 'In Progress' ? <Clock className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                      </div>
                      
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-slate-900">{milestone.name}</h4>
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Target: {milestone.targetDate}
                          </p>
                        </div>
                        <div className="text-right">
                          {canEdit ? (
                            <select 
                              value={milestone.status}
                              onChange={(e) => handleMilestoneStatusChange(milestone.id, e.target.value as any)}
                              className={cn(
                                "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider outline-none cursor-pointer border border-transparent hover:border-slate-300 transition-all",
                                milestone.status === 'Completed' ? "bg-emerald-100 text-emerald-700" : 
                                milestone.status === 'In Progress' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                              )}
                            >
                              <option value="Pending">Pending</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                            </select>
                          ) : (
                            <span className={cn(
                              "px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider",
                              milestone.status === 'Completed' ? "bg-emerald-100 text-emerald-700" : 
                              milestone.status === 'In Progress' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                            )}>
                              {milestone.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Risks & Issues Section */}
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
                      activity.type === 'Milestone' ? "bg-emerald-500 text-white" :
                      activity.type === 'Risk' ? "bg-red-500 text-white" :
                      activity.type === 'Comment' ? "bg-purple-500 text-white" : "bg-slate-400 text-white"
                    )}>
                      {activity.type === 'StateChange' ? <RefreshCw className="w-4 h-4" /> :
                       activity.type === 'Milestone' ? <CheckCircle2 className="w-4 h-4" /> :
                       activity.type === 'Risk' ? <AlertTriangle className="w-4 h-4" /> :
                       activity.type === 'Comment' ? <MessageSquare className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
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
                {!project.activities?.length && (
                  <div className="text-center py-20 text-slate-400">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-10" />
                    <p className="italic">No activity recorded yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Info Column: Details & Comments */}
        <div className="space-y-8">
          {/* Project Details */}
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
            </div>
            
            <div className="mt-6 pt-6 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Scope</h4>
              <div className="flex flex-wrap gap-2">
                {project.services.map(s => (
                  <span key={s} className={cn("px-2 py-1 text-[10px] font-bold rounded-md", theme.lightBg, theme.lightText)}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[500px]">
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
              {project.comments.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-10" />
                  <p className="text-sm italic">No comments yet. PMs can add updates here.</p>
                </div>
              )}
            </div>

            {canEdit && (
              <form onSubmit={handleAddComment} className="relative">
                <input 
                  placeholder="Add a project update or comment..."
                  className={cn(
                    "w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                />
                <button 
                  type="submit"
                  className={cn(
                    "absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white rounded-xl transition-all shadow-md",
                    theme.bg, theme.hoverBg, theme.shadow
                  )}
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
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
