import React, { useState, useMemo } from 'react';
import { X, Search, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { Project, User, PackageConfig, ServiceBaseline } from '../types';
import { PMStat } from './resource/useResourceStats';
import { cn, getServiceNames } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface OffloadProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePm: PMStat;
  users: User[];
  projects: Project[];
  packages: PackageConfig[];
  serviceBaselines: ServiceBaseline[];
  getPMWorkload: (pmName: string) => Record<string, number>;
  workloadThresholds: Record<string, number>;
  onBulkReassign: (projectIds: string[], newPmName: string, reason?: string) => Promise<void>;
  themeColor?: string;
}

export const OffloadProjectsModal: React.FC<OffloadProjectsModalProps> = ({
  isOpen,
  onClose,
  sourcePm,
  users,
  projects,
  packages,
  serviceBaselines,
  getPMWorkload,
  workloadThresholds,
  onBulkReassign,
  themeColor = 'teal'
}) => {
  const [search, setSearch] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [targetPmName, setTargetPmName] = useState('');
  const [reason, setReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const theme = getThemeClasses(themeColor);

  if (!isOpen) return null;

  const activeProjects = sourcePm.activeProjects;

  // Extract unique packages from PM's active projects for filters
  const uniquePackages = useMemo(() => {
    const pkgs = new Set<string>();
    activeProjects.forEach(p => {
      if (p.packageName) pkgs.add(p.packageName);
    });
    return Array.from(pkgs).sort();
  }, [activeProjects]);

  // Filter projects list
  const filteredProjects = useMemo(() => {
    return activeProjects.filter(p => {
      const matchSearch = p.clientName.toLowerCase().includes(search.toLowerCase()) || 
                          p.packageName.toLowerCase().includes(search.toLowerCase());
      const matchPkg = !selectedPackage || p.packageName === selectedPackage;
      const matchPri = !selectedPriority || p.priority === selectedPriority;
      return matchSearch && matchPkg && matchPri;
    });
  }, [activeProjects, search, selectedPackage, selectedPriority]);

  // Checkbox selection states
  const visibleSelectedCount = useMemo(() => {
    return filteredProjects.filter(p => selectedProjectIds.includes(p.id)).length;
  }, [filteredProjects, selectedProjectIds]);

  const isAllVisibleSelected = filteredProjects.length > 0 && visibleSelectedCount === filteredProjects.length;

  const handleToggleAll = () => {
    if (isAllVisibleSelected) {
      // Remove all visible project IDs
      const visibleIds = filteredProjects.map(p => p.id);
      setSelectedProjectIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Add all visible project IDs
      const visibleIds = filteredProjects.map(p => p.id);
      setSelectedProjectIds(prev => {
        const next = [...prev];
        visibleIds.forEach(id => {
          if (!next.includes(id)) next.push(id);
        });
        return next;
      });
    }
  };

  const handleToggleProject = (id: string) => {
    setSelectedProjectIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Calculate selected project weight (unfinished services)
  const selectedWeight = useMemo(() => {
    return selectedProjectIds.reduce((sum, id) => {
      const outstandingCount = sourcePm.projectWeights[id] || 0;
      return sum + outstandingCount;
    }, 0);
  }, [selectedProjectIds, sourcePm.projectWeights]);

  // Selected priority counts
  const selectedPriorityCounts = useMemo(() => {
    const counts = { P1: 0, P2: 0, P3: 0 };
    selectedProjectIds.forEach(id => {
      const proj = projects.find(p => p.id === id);
      if (proj) {
        if (proj.priority === 'P1') counts.P1++;
        else if (proj.priority === 'P2') counts.P2++;
        else if (proj.priority === 'P3') counts.P3++;
      }
    });
    return counts;
  }, [selectedProjectIds, projects]);

  // List of active PMs to assign to
  const activePMs = useMemo(() => {
    return users.filter(u => 
      (u.role === 'PM' || u.role === 'Team Lead') && 
      u.status === 'Active' && 
      u.name !== sourcePm.name
    );
  }, [users, sourcePm.name]);

  // Calculate impact on target PM
  const targetPmStats = useMemo(() => {
    if (!targetPmName) return null;
    const targetUser = users.find(u => u.name === targetPmName);
    
    // Find active projects for target PM
    const pmActiveProjects = projects.filter(p => 
      p.assignedPM === targetPmName && 
      !['Closed', 'Billed', 'Signed Off'].includes(p.state)
    );
    
    let currentWeight = 0;
    pmActiveProjects.forEach(proj => {
      const outstanding = (proj.services || []).filter(
        s => proj.serviceStates?.[s] !== 'Closed'
      ).length;
      currentWeight += outstanding;
    });

    const wipLimit = targetUser?.wipLimit || 30;
    const projectedWeight = currentWeight + selectedWeight;
    const currentUtil = wipLimit > 0 ? (currentWeight / wipLimit) * 100 : 0;
    const projectedUtil = wipLimit > 0 ? (projectedWeight / wipLimit) * 100 : 0;

    // Check project tier counts
    const pmThresholds = targetUser?.workloadThresholds || workloadThresholds;
    const currentWorkload = getPMWorkload(targetPmName);
    
    const projectedP1 = currentWorkload.P1 + selectedPriorityCounts.P1;
    const projectedP2 = currentWorkload.P2 + selectedPriorityCounts.P2;
    const projectedP3 = currentWorkload.P3 + selectedPriorityCounts.P3;

    const overPriorityLimit = 
      projectedP1 > (pmThresholds.P1 || 0) ||
      projectedP2 > (pmThresholds.P2 || 0) ||
      projectedP3 > (pmThresholds.P3 || 0);

    return {
      wipLimit,
      currentWeight,
      projectedWeight,
      currentUtil,
      projectedUtil,
      projectedP1,
      projectedP2,
      projectedP3,
      thresholds: pmThresholds,
      currentWorkload,
      overLimit: projectedWeight > wipLimit || overPriorityLimit,
      wipOverLimit: projectedWeight > wipLimit,
      priOverLimit: overPriorityLimit
    };
  }, [targetPmName, projects, selectedWeight, selectedPriorityCounts, getPMWorkload, users, workloadThresholds]);

  const handleConfirm = async () => {
    if (selectedProjectIds.length === 0 || !targetPmName) return;
    setIsProcessing(true);
    try {
      await onBulkReassign(selectedProjectIds, targetPmName, reason);
      onClose();
    } catch (err) {
      console.error('Failed to offload projects', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-xl font-black text-slate-900">Offload Projects</h2>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Bulk reassign active projects from <span className="font-black text-slate-600 font-mono">{sourcePm.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Projects and Filters column (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-4 flex flex-col min-h-0">
            
            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search client or package..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white outline-none transition-all focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Package dropdown filter */}
              <select
                value={selectedPackage}
                onChange={e => setSelectedPackage(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">All Packages</option>
                {uniquePackages.map(pkg => (
                  <option key={pkg} value={pkg}>{pkg}</option>
                ))}
              </select>

              {/* Priority dropdown filter */}
              <select
                value={selectedPriority}
                onChange={e => setSelectedPriority(e.target.value)}
                className="w-full px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">All Priorities</option>
                <option value="P1">Tier 1 - Enterprise (P1)</option>
                <option value="P2">Tier 2 - Pro (P2)</option>
                <option value="P3">Tier 3 - Basic (P3)</option>
              </select>
            </div>

            {/* Project List Table wrapper */}
            <div className="flex-1 border border-slate-100 rounded-2xl overflow-hidden flex flex-col bg-slate-50/30 min-h-[250px] max-h-[400px]">
              <div className="overflow-auto flex-1">
                <table className="w-full text-left border-collapse min-w-[500px]">
                  <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 text-center w-12">
                        <input
                          type="checkbox"
                          checked={isAllVisibleSelected}
                          onChange={handleToggleAll}
                          className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                        />
                      </th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider">Project</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-20 text-center">Priority</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-24 text-center">Weight</th>
                      <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-wider w-28 text-center">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map(proj => {
                      const isChecked = selectedProjectIds.includes(proj.id);
                      const outstandingCount = sourcePm.projectWeights[proj.id] || 0;
                      return (
                        <tr
                          key={proj.id}
                          onClick={() => handleToggleProject(proj.id)}
                          className={cn(
                            "border-t border-slate-100 cursor-pointer hover:bg-slate-50/50 transition-colors",
                            isChecked && "bg-teal-50/10"
                          )}
                        >
                          <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleProject(proj.id)}
                              className="w-4 h-4 rounded text-teal-600 border-slate-300 focus:ring-teal-500"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900 text-xs">{proj.clientName}</p>
                            <p className="text-[10px] text-slate-400 font-semibold">{proj.packageName}</p>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              "text-[10px] font-black px-2 py-0.5 rounded-md border",
                              proj.priority === 'P1' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                              proj.priority === 'P2' ? "bg-amber-50 text-amber-700 border-amber-100" :
                              "bg-slate-50 text-slate-700 border-slate-100"
                            )}>
                              {proj.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className="text-xs font-black text-slate-600 font-mono">{outstandingCount}</span>
                            <span className="text-[9px] text-slate-400 font-semibold ml-0.5">pts</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn(
                              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
                              proj.state === 'On-Track' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                              proj.state === 'Delayed' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                              proj.state === 'Suspended' ? 'bg-slate-50 text-slate-600 border-slate-100' :
                              'bg-slate-100 text-slate-700 border-slate-200'
                            )}>
                              {proj.state}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredProjects.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs font-semibold text-slate-400 italic">
                          No active projects match your filters
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Selection Info Footer */}
            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <span className="text-xs font-black text-slate-600">
                Selected: {selectedProjectIds.length} of {activeProjects.length} projects
              </span>
              <span className="text-xs font-black text-slate-600">
                Total weight: <span className={cn('text-sm font-black', theme.text)}>{selectedWeight.toFixed(1)}</span> pts
              </span>
            </div>

          </div>

          {/* Target PM and Impact column (Right col) */}
          <div className="space-y-5 bg-slate-50/50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider">Offload Target</h3>

              {/* Target PM Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Assign Projects To</label>
                <select
                  value={targetPmName}
                  onChange={e => setTargetPmName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Select Target PM</option>
                  {activePMs.map(pm => {
                    const workload = getPMWorkload(pm.name);
                    const pmUser = users.find(u => u.name === pm.name);
                    const thresholds = pmUser?.workloadThresholds || workloadThresholds;
                    return (
                      <option key={pm.id} value={pm.name}>
                        {pm.name} (T1: {workload.P1}/{thresholds.P1 || 0} | T2: {workload.P2}/{thresholds.P2 || 0} | T3: {workload.P3}/{thresholds.P3 || 0})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Workload Impact Preview */}
              {targetPmStats && (
                <div className="space-y-3.5 border-t border-slate-100 pt-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Projected Workload Impact</h4>
                  
                  {/* Utilization comparison */}
                  <div className="bg-white border border-slate-100 rounded-2xl p-3.5 space-y-3 shadow-sm">
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-600">
                        <span>Total Service Weight WIP</span>
                        <span>{targetPmStats.projectedWeight.toFixed(1)} / {targetPmStats.wipLimit}</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-slate-300 transition-all" style={{ width: `${Math.min(100, targetPmStats.currentUtil)}%` }} />
                        {selectedWeight > 0 && (
                          <div className={cn("h-full transition-all animate-pulse", theme.bg)} style={{ width: `${Math.min(100 - targetPmStats.currentUtil, (selectedWeight / targetPmStats.wipLimit) * 100)}%` }} />
                        )}
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-wide">
                        <span>Current: {Math.round(targetPmStats.currentUtil)}%</span>
                        <span className={cn("flex items-center gap-0.5", theme.text)}>
                          Projected: {Math.round(targetPmStats.projectedUtil)}% <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    {/* Priority Tier limits preview */}
                    <div className="border-t border-slate-50 pt-2.5 space-y-1.5">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority count change</p>
                      <div className="grid grid-cols-3 gap-2">
                        {['P1', 'P2', 'P3'].map(pri => {
                          const key = pri as 'P1' | 'P2' | 'P3';
                          const change = selectedPriorityCounts[key];
                          const current = targetPmStats.currentWorkload[key];
                          const projected = targetPmStats.projectedP1; // default assignment placeholder
                          
                          let projCount = current + change;
                          const threshold = targetPmStats.thresholds[key] || 0;
                          const isOver = projCount > threshold;

                          return (
                            <div key={pri} className="bg-slate-50 rounded-xl p-2 text-center border border-slate-100">
                              <span className="text-[9px] font-black text-slate-400 uppercase">{pri}</span>
                              <div className="text-xs font-bold text-slate-700 mt-0.5">
                                {current} {change > 0 && <span className={cn("text-[10px] font-black", isOver ? "text-rose-500" : theme.text)}>+{change}</span>}
                              </div>
                              <span className={cn("text-[9px] font-bold block mt-0.5", isOver ? "text-rose-500" : "text-slate-400")}>
                                Limit: {threshold}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Overcapacity Warning */}
                  {targetPmStats.overLimit && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex gap-3 text-amber-700 text-xs font-semibold leading-relaxed animate-in fade-in slide-in-from-top-2 duration-300">
                      <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-black text-amber-900">Over-Capacity Warning</p>
                        <p className="text-[11px] text-amber-700/90 mt-0.5">
                          {targetPmStats.wipOverLimit && `This offload pushes the PM to ${Math.round(targetPmStats.projectedUtil)}% of their service weight limit. `}
                          {targetPmStats.priOverLimit && `PM will exceed tier project limits. `}
                          You can proceed with a Manager override.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reason Description */}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Reason for Offloading (Optional)</label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Reason for offloading (recorded in system activity logs)..."
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-teal-500/20 h-20 resize-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                disabled={isProcessing}
                onClick={onClose}
                className="flex-1 py-3 bg-slate-100 text-slate-600 text-xs font-black rounded-xl hover:bg-slate-200 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={selectedProjectIds.length === 0 || !targetPmName || isProcessing}
                onClick={handleConfirm}
                className={cn(
                  "flex-1 py-3 text-white text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5",
                  theme.bg, theme.hoverBg,
                  (selectedProjectIds.length === 0 || !targetPmName || isProcessing) && "opacity-50 grayscale"
                )}
              >
                {isProcessing ? 'Offloading...' : 'Offload Projects'}
                {!isProcessing && <Check className="w-4 h-4" />}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
