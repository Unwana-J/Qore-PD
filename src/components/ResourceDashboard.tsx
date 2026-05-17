import React, { useMemo, useState } from 'react';
import { Project, User, PackageConfig, ServiceBaseline } from '../types';
import { calculatePhaseScores, getServiceNames } from '../lib/utils';
import { BarChart3, Activity, Briefcase, CheckCircle2, AlertTriangle, Clock, Pencil, Flame } from 'lucide-react';
import { cn } from '../lib/utils';

interface ResourceDashboardProps {
  projects: Project[];
  users: User[];
  packages: PackageConfig[];
  serviceBaselines: ServiceBaseline[];
  onUpdateProject?: (project: Project) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onUpdateUser?: (userId: string, updates: Partial<User>) => Promise<void>;
}

export const ResourceDashboard: React.FC<ResourceDashboardProps> = ({
  projects,
  users,
  packages,
  serviceBaselines,
  onUpdateProject,
  onShowToast,
  onUpdateUser
}) => {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editWipLimitValue, setEditWipLimitValue] = useState<number>(30);
  const [isSavingWipLimit, setIsSavingWipLimit] = useState<boolean>(false);

  const handleSaveWipLimit = async (userId: string) => {
    if (!onUpdateUser) return;
    setIsSavingWipLimit(true);
    try {
      await onUpdateUser(userId, { wipLimit: editWipLimitValue });
      onShowToast?.("WIP Limit updated successfully!", "success");
      setEditingUserId(null);
    } catch (err) {
      onShowToast?.("Failed to update WIP Limit", "error");
    } finally {
      setIsSavingWipLimit(false);
    }
  };

  const pendingRequests = useMemo(() => {
    return projects.filter(p => p.pendingStoryPointsRequest != null);
  }, [projects]);

  // 1. Group active projects by PM and calculate metrics
  const pmStats = useMemo(() => {
    const pms = users.filter(u => u.role === 'PM' || u.role === 'Team Lead');
    
    return pms.map(pm => {
      const pmProjects = projects.filter(p => p.assignedPM === pm.name);
      const activeProjects = pmProjects.filter(p => p.state !== 'Closed' && p.state !== 'Billed' && p.state !== 'Signed Off');
      
      const initiatedCount = pmProjects.length;
      const completedCount = pmProjects.filter(p => p.state === 'Closed' || p.state === 'Billed' || p.state === 'Signed Off').length;
      const completionRate = initiatedCount > 0 ? (completedCount / initiatedCount) * 100 : 0;
      
      let totalUtilizedPoints = 0;
      const activeServiceCounts: Record<string, number> = {};

      activeProjects.forEach(project => {
        // Find package base points (default to 0 if not found)
        const pkg = packages.find(p => p.name === project.packageName);
        const basePoints = project.storyPoints || pkg?.storyPoints || 0;
        
        // Calculate completion progress
        const scores = calculatePhaseScores(project);
        const completionPct = scores.totalPercentage / 100;
        
        // Remaining effort is what counts towards WIP utilization
        const remainingPoints = basePoints * (1 - completionPct);
        totalUtilizedPoints += remainingPoints;

        // Track active services
        const serviceNames = getServiceNames(project.services || [], serviceBaselines);
        serviceNames.forEach(sName => {
          activeServiceCounts[sName] = (activeServiceCounts[sName] || 0) + 1;
        });
      });

      const wipLimit = pm.wipLimit || 30; // Default to 30 if not set
      const utilizationPct = (totalUtilizedPoints / wipLimit) * 100;

      // Calculate oldest active project to determine overload duration
      let oldestActiveProjectDate: Date | null = null;
      activeProjects.forEach(p => {
        if (p.startDate) {
          const date = new Date(p.startDate);
          if (!isNaN(date.getTime())) {
            if (!oldestActiveProjectDate || date < oldestActiveProjectDate) {
              oldestActiveProjectDate = date;
            }
          }
        }
      });

      let daysOverloaded = 0;
      if (utilizationPct > 100 && oldestActiveProjectDate) {
        const diffTime = Math.abs(new Date().getTime() - oldestActiveProjectDate.getTime());
        daysOverloaded = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      const isBurnedOut = utilizationPct > 100 && daysOverloaded >= 14;

      return {
        ...pm,
        initiatedCount,
        completedCount,
        completionRate,
        activeProjectsCount: activeProjects.length,
        totalUtilizedPoints,
        wipLimit,
        utilizationPct,
        activeServiceCounts,
        daysOverloaded,
        isBurnedOut
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct); // Sort by highest utilization
  }, [projects, users, packages, serviceBaselines]);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-500" />
          Resource Management
        </h2>
        <p className="text-sm font-bold text-slate-500">
          Real-time PM utilization and WIP tracking based on Agile Story Points and completion status.
        </p>
      </div>

      {/* Pending Story Point Adjustments queue */}
      {pendingRequests.length > 0 && (
        <div className="bg-indigo-50/50 border-2 border-indigo-100 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
              <h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Pending Story Point Adjustments ({pendingRequests.length})</h3>
            </div>
            <span className="text-[9px] font-black uppercase text-indigo-500 tracking-wider">Requires Manager Review</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRequests.map(project => {
              const req = project.pendingStoryPointsRequest!;
              const defaultPoints = packages.find(p => p.name === project.packageName)?.storyPoints || 0;
              const currentPoints = project.storyPoints || defaultPoints;

              return (
                <div key={project.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm truncate max-w-[150px]">{project.clientName}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{project.packageName || 'Customization'}</p>
                      </div>
                      <span className="text-xs font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg border border-indigo-100">
                        {currentPoints} → {req.requestedPoints} PTS
                      </span>
                    </div>
                    
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50">
                      <p className="text-xs font-semibold text-slate-600 italic line-clamp-3">"{req.reason}"</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-wider">
                        Requested by {req.requestedBy}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        if (!onUpdateProject) return;
                        try {
                          const updated = {
                            ...project,
                            storyPoints: req.requestedPoints,
                            pendingStoryPointsRequest: undefined
                          };
                          await onUpdateProject(updated);
                          onShowToast?.("Story points request approved!", "success");
                        } catch (err) {
                          onShowToast?.("Failed to approve request", "error");
                        }
                      }}
                      className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        if (!onUpdateProject) return;
                        try {
                          const updated = {
                            ...project,
                            pendingStoryPointsRequest: undefined
                          };
                          await onUpdateProject(updated);
                          onShowToast?.("Story points request declined", "info");
                        } catch (err) {
                          onShowToast?.("Failed to decline request", "error");
                        }
                      }}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-black rounded-xl transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {pmStats.map(stat => {
          const isOverloaded = stat.utilizationPct > 100;
          const isHealthy = stat.utilizationPct > 0 && stat.utilizationPct <= 85;
          const isWarning = stat.utilizationPct > 85 && stat.utilizationPct <= 100;

          return (
            <div 
              key={stat.id} 
              className={cn(
                "bg-white rounded-3xl border-2 transition-all shadow-sm hover:shadow-md overflow-hidden flex flex-col",
                isOverloaded ? "border-rose-500" : "border-slate-100"
              )}
            >
              <div className="p-6 flex-1 space-y-6">
                {/* Header: PM Name & Avatar */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center font-black text-lg",
                      isOverloaded ? "bg-rose-100 text-rose-600" : "bg-indigo-50 text-indigo-600"
                    )}>
                      {stat.avatar || stat.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-black text-slate-900 text-lg">{stat.name}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.role}</p>
                    </div>
                  </div>
                  {isOverloaded && (
                    <div className="bg-rose-100 text-rose-600 p-2 rounded-xl" title="WIP Limit Exceeded">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  )}
                </div>

                {/* Utilization Progress Bar */}
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400">Current Bandwidth</span>
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "text-sm font-black",
                        isOverloaded ? "text-rose-600" : (isWarning ? "text-amber-500" : "text-indigo-600")
                      )}>
                        {stat.totalUtilizedPoints.toFixed(1)} / 
                      </span>
                      {editingUserId === stat.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min="1"
                            disabled={isSavingWipLimit}
                            className="w-12 px-1 py-0.5 border border-slate-300 rounded text-xs font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                            value={editWipLimitValue}
                            onChange={e => setEditWipLimitValue(parseInt(e.target.value) || 0)}
                            onBlur={() => handleSaveWipLimit(stat.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveWipLimit(stat.id);
                              if (e.key === 'Escape') setEditingUserId(null);
                            }}
                            autoFocus
                          />
                          <span className="text-[10px] font-bold text-slate-400">PTS</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingUserId(stat.id);
                            setEditWipLimitValue(stat.wipLimit);
                          }}
                          className="group flex items-center gap-0.5 hover:text-indigo-600 transition-colors"
                          title="Click to adjust WIP Limit"
                        >
                          <span className={cn(
                            "text-sm font-black",
                            isOverloaded ? "text-rose-600" : (isWarning ? "text-amber-500" : "text-indigo-600")
                          )}>
                            {stat.wipLimit}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">PTS</span>
                          <Pencil className="w-2.5 h-2.5 text-slate-300 group-hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isOverloaded ? "bg-rose-500" : (isWarning ? "bg-amber-500" : "bg-indigo-500")
                      )}
                      style={{ width: `${Math.min(stat.utilizationPct, 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400">
                    {stat.utilizationPct.toFixed(0)}% Utilized
                  </p>
                </div>

                {/* Completion Rate & Active Projects */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Completion</span>
                    </div>
                    <div className="flex items-end gap-1">
                      <span className={cn(
                        "text-xl font-black",
                        stat.completionRate >= 85 ? "text-emerald-600" : (stat.completionRate >= 70 ? "text-amber-600" : "text-rose-600")
                      )}>
                        {stat.completionRate.toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{stat.completedCount} of {stat.initiatedCount} total</p>
                  </div>
                  
                  <div className="bg-slate-50 p-4 rounded-2xl">
                    <div className="flex items-center gap-2 text-slate-400 mb-1">
                      <Activity className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Active WIP</span>
                    </div>
                    <span className="text-xl font-black text-slate-700">
                      {stat.activeProjectsCount}
                    </span>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">Projects ongoing</p>
                  </div>
                </div>

                {/* Active Services Breakdown */}
                {Object.keys(stat.activeServiceCounts).length > 0 && (
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Services In Progress</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(stat.activeServiceCounts).map(([service, count]) => (
                        <div key={service} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                          <span className="text-xs font-bold text-slate-600">{service}</span>
                          <span className="px-1.5 py-0.5 bg-white text-slate-400 text-[10px] font-black rounded-md border border-slate-100">
                            {count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Burnout Alert Banner */}
                {stat.isBurnedOut && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-3 flex gap-2.5 items-start mt-4 animate-pulse">
                    <Flame className="w-4.5 h-4.5 text-rose-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest leading-none">Severe Burnout Alert</p>
                      <p className="text-[10px] font-semibold text-rose-600 mt-1 leading-relaxed">
                        Operating at {stat.utilizationPct.toFixed(0)}% capacity for {stat.daysOverloaded} consecutive days. Immediate offloading recommended.
                      </p>
                    </div>
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {pmStats.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-bold">
            No Project Managers found.
          </div>
        )}
      </div>
    </div>
  );
};
