import React, { useMemo } from 'react';
import { Project, User, PackageConfig, ServiceBaseline } from '../types';
import { calculatePhaseScores, getServiceNames } from '../lib/utils';
import { BarChart3, Activity, Briefcase, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface ResourceDashboardProps {
  projects: Project[];
  users: User[];
  packages: PackageConfig[];
  serviceBaselines: ServiceBaseline[];
}

export const ResourceDashboard: React.FC<ResourceDashboardProps> = ({
  projects,
  users,
  packages,
  serviceBaselines
}) => {
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

      return {
        ...pm,
        initiatedCount,
        completedCount,
        completionRate,
        activeProjectsCount: activeProjects.length,
        totalUtilizedPoints,
        wipLimit,
        utilizationPct,
        activeServiceCounts
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
                    <span className={cn(
                      "text-sm font-black",
                      isOverloaded ? "text-rose-600" : (isWarning ? "text-amber-500" : "text-indigo-600")
                    )}>
                      {stat.totalUtilizedPoints.toFixed(1)} / {stat.wipLimit} PTS
                    </span>
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
