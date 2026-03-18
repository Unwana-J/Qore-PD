import React, { useState, useMemo } from 'react';
import { Project, AppConfig, Role } from '../types';
import { calculateSPI, getActiveDaysCount, cn } from '../lib/utils';
import { ChevronDown, ChevronRight, AlertTriangle, TrendingDown, Clock, Search, Filter, Layers } from 'lucide-react';
import { differenceInDays, parseISO, isAfter, isBefore, subDays, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { getThemeClasses } from '../lib/theme';
import { StateBadge } from './ProjectList';

interface PMScorecardProps {
  projects: Project[];
  config: AppConfig;
  userRole: Role;
  onSelectProject?: (project: Project) => void;
  themeColor?: string;
}

export const PMScorecard: React.FC<PMScorecardProps> = ({ projects, config, userRole, themeColor = 'teal', onSelectProject }) => {
  const theme = getThemeClasses(themeColor);
  
  const [dateFilter, setDateFilter] = useState('All time');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Weighted Score');
  const [expandedPMs, setExpandedPMs] = useState<string[]>([]);
  const [isPackagePerformanceExpanded, setIsPackagePerformanceExpanded] = useState(false);
  
  if (userRole === 'PM') return null;

  const togglePM = (pm: string) => {
    setExpandedPMs(prev => prev.includes(pm) ? prev.filter(p => p !== pm) : [...prev, pm]);
  };

  const filteredProjects = useMemo(() => {
    const now = new Date();
    let filtered = projects;
    
    // Status Filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(p => p.state === statusFilter);
    }
    
    // Date Range Filter
    if (dateFilter !== 'All time') {
      let limitDate;
      if (dateFilter === 'Last 30 Days') limitDate = subDays(now, 30);
      else if (dateFilter === 'This Month') limitDate = startOfMonth(now);
      else if (dateFilter === 'This Quarter') limitDate = startOfQuarter(now);
      else if (dateFilter === 'This Year') limitDate = startOfYear(now);
      
      if (limitDate) {
        filtered = filtered.filter(p => parseISO(p.createdAt) >= limitDate!);
      }
    }
    
    // Role level filtering
    if (userRole === 'Team Lead') {
      // In a real app we would check PM hierarchy. Here we simulate Team Lead seeing some PMs.
      // E.g. restricting to a subset based on some logic. 
      // For POC, we'll just show all active PMs for them too or let's assume they manage exactly these.
    }
    
    return filtered;
  }, [projects, dateFilter, statusFilter, userRole]);

  // Aggregate PM Performance
  const pmStats = useMemo(() => {
    const grouped: Record<string, Project[]> = {};
    filteredProjects.forEach(p => {
      if (p.assignedPM) {
        if (!grouped[p.assignedPM]) grouped[p.assignedPM] = [];
        grouped[p.assignedPM].push(p);
      }
    });
    
    const pmList = Object.entries(grouped).map(([pm, pList]) => {
      const closed = pList.filter(p => p.state === 'Closed');
      const totalClosed = closed.length;
      
      // Delivery Rate: closed on or before expected
      let onTimeCount = 0;
      closed.forEach(p => {
        const expected = p.expectedCompletionDate || p.startDate;
        if (p.currentCompletionDate && expected) {
          if (p.currentCompletionDate <= expected) onTimeCount++;
        }
      });
      const deliveryRate = totalClosed > 0 ? onTimeCount / totalClosed : null;
      
      // Avg SPI
      let spiSum = 0;
      let spiCount = 0;
      pList.forEach(p => {
         const spiData = calculateSPI(p, config.spiThresholds);
         if (spiData.rawSpi !== null) {
           spiSum += spiData.rawSpi;
           spiCount++;
         }
      });
      const avgSpi = spiCount > 0 ? spiSum / spiCount : null;
      
      // Rebaseline Rate
      let rebCount = 0;
      pList.forEach(p => {
        if (p.rebaselineRequests && p.rebaselineRequests.length > 0) rebCount += p.rebaselineRequests.length;
      });
      const rebaselineRate = pList.length > 0 ? rebCount / pList.length : 0;
      
      // Stale Projects count
      const staleCount = pList.filter(p => differenceInDays(new Date(), parseISO(p.updatedAt)) >= config.staleThresholdDays).length;
      
      // Avg days to close
      let daysSum = 0;
      closed.forEach(p => {
         daysSum += getActiveDaysCount(p).days;
      });
      const avgDaysToClose = totalClosed > 0 ? daysSum / totalClosed : null;
      
      return {
         name: pm,
         projects: pList.length,
         activeProjects: pList.filter(p => p.state !== 'Closed').length,
         pList,
         deliveryRate,
         avgSpi,
         rebaselineRate,
         staleCount,
         avgDaysToClose,
         baseScore: 0,
         weightedScore: 0
      };
    });
    
    const avgProjectCount = pmList.length > 0 ? pmList.reduce((acc, pm) => acc + pm.projects, 0) / pmList.length : 0;
    
    pmList.forEach(pm => {
       const dr = pm.deliveryRate !== null ? pm.deliveryRate : 0; // IF no closed projects, default to 0 for score
       const as = pm.avgSpi !== null ? pm.avgSpi : 1.0; // default SPI 1.0 for new projects
       const rr = pm.rebaselineRate; // already 0-1 range approx, though could be >1. We cap it.
       const cappedRr = Math.min(rr, 1);
       
       const w1 = config.pmScorecardWeights?.deliveryRate || 0.4;
       const w2 = config.pmScorecardWeights?.avgSpi || 0.4;
       const w3 = config.pmScorecardWeights?.rebaselineRate || 0.2;
       
       pm.baseScore = (dr * w1) + (as * w2) + ((1 - cappedRr) * w3);
       
       // Weighted score scales by project relative volume
       const volumeMultiplier = avgProjectCount > 0 ? pm.projects / avgProjectCount : 1;
       pm.weightedScore = pm.baseScore * volumeMultiplier;
    });

    if (sortBy === 'Weighted Score') pmList.sort((a, b) => b.weightedScore - a.weightedScore);
    else if (sortBy === 'Delivery Rate') pmList.sort((a, b) => (b.deliveryRate || 0) - (a.deliveryRate || 0));
    else if (sortBy === 'Avg SPI') pmList.sort((a, b) => (b.avgSpi || 0) - (a.avgSpi || 0));
    else if (sortBy === 'Project Count') pmList.sort((a, b) => b.projects - a.projects);

    return pmList;
  }, [filteredProjects, sortBy, config]);

  // Summaries
  const topPM = [...pmStats].sort((a,b) => b.weightedScore - a.weightedScore)[0];
  const mostProjectsPM = [...pmStats].sort((a,b) => b.projects - a.projects)[0];
  const mostStalePM = [...pmStats].sort((a,b) => b.staleCount - a.staleCount)[0];
  const lowestSpiPM = [...pmStats].filter(p => p.avgSpi !== null).sort((a,b) => (a.avgSpi!) - (b.avgSpi!))[0];

  // Package Performance
  const packageStats = useMemo(() => {
    const services = config.serviceBaselines || [];
    return services.map(srv => {
      const srvName = srv.name;
      const baseline = srv.baselineDays;
      const projectsWithService = projects.filter(p => p.services.includes(srvName));
      const closedServiceProjects = projectsWithService.filter(p => p.serviceStates?.[srvName] === 'Closed');
      
      const compRate = projectsWithService.length > 0 ? closedServiceProjects.length / projectsWithService.length : null;
      
      let spiSum = 0; let spiCount = 0;
      projectsWithService.forEach(p => {
        const spiData = calculateSPI(p, config.spiThresholds);
        if (spiData.rawSpi !== null) { spiSum += spiData.rawSpi; spiCount++; }
      });
      const avgSpi = spiCount > 0 ? spiSum/spiCount : null;
      
      // Overrun = active days > baseline
      let overrunCount = 0;
      projectsWithService.forEach(p => {
        if (getActiveDaysCount(p).days > baseline) overrunCount++;
      });
      const overrunRate = projectsWithService.length > 0 ? overrunCount / projectsWithService.length : null;
      
      return { name: srvName, projectsWithService: projectsWithService.length, compRate, avgSpi, overrunRate };
    }).sort((a,b) => (b.overrunRate || 0) - (a.overrunRate || 0));
  }, [projects, config]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Scorecard Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Clock className={cn("w-5 h-5", theme.text)} />
          PM Performance Scorecard
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="bg-slate-50 text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 outline-none">
            <option>All time</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
            <option>This Quarter</option>
            <option>This Year</option>
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 outline-none">
            <option>All</option>
            <option value="Active">On-Track</option>
            <option>Closed</option>
            <option>Delayed</option>
            <option>Suspended</option>
          </select>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-slate-50 text-sm font-semibold border border-slate-200 rounded-lg px-3 py-2 outline-none">
            <option>Weighted Score</option>
            <option>Delivery Rate</option>
            <option>Avg SPI</option>
            <option>Project Count</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Best Performing PM</p>
          <p className="text-xl font-black text-slate-900">{topPM ? topPM.name : '-'}</p>
          {topPM && <p className="text-sm font-bold text-teal-600 mt-1">{topPM.weightedScore.toFixed(2)} Score</p>}
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Largest Portfolio</p>
          <p className="text-xl font-black text-slate-900">{mostProjectsPM ? mostProjectsPM.name : '-'}</p>
          {mostProjectsPM && <p className="text-sm font-bold text-blue-600 mt-1">{mostProjectsPM.projects} Projects</p>}
        </div>
        <div className={cn("bg-white p-5 rounded-3xl border shadow-sm", mostStalePM?.staleCount > 0 ? "border-red-200 bg-red-50/30" : "border-slate-200")}>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Most Stale Projects</p>
          <p className="text-xl font-black text-slate-900">{mostStalePM ? mostStalePM.name : '-'}</p>
          {mostStalePM && <p className={cn("text-sm font-bold mt-1", mostStalePM.staleCount > 0 ? "text-red-600" : "text-slate-500")}>
            {mostStalePM.staleCount} Stale
          </p>}
        </div>
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Lowest Avg SPI</p>
          <p className="text-xl font-black text-slate-900">{lowestSpiPM ? lowestSpiPM.name : '-'}</p>
          {lowestSpiPM && <p className={cn("text-sm font-bold mt-1", (lowestSpiPM.avgSpi||0) < config.spiThresholds.atRisk ? "text-red-600" : "text-amber-600")}>
            {lowestSpiPM.avgSpi?.toFixed(2) || 'N/A'} SPI
          </p>}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Project Manager</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Projects</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Delivery Rate</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Avg SPI</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Rebaselines</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-center">Stale</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">W. Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pmStats.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-slate-400">No performance data found for active filters.</td></tr>
              ) : pmStats.map((stat, i) => (
                <React.Fragment key={i}>
                  <tr 
                    onClick={() => togglePM(stat.name)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {expandedPMs.includes(stat.name) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm", theme.bg)}>
                          {stat.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-black text-slate-900">{stat.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <p className="text-sm font-bold text-slate-700">{stat.projects}</p>
                      <div className="w-16 h-1 bg-slate-100 rounded-full mx-auto mt-1 overflow-hidden">
                        <div className={cn("h-full", theme.bg)} style={{ width: `${((stat.projects - stat.activeProjects)/stat.projects)*100}%` }} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {stat.deliveryRate !== null ? (
                        <span className="text-sm font-bold text-slate-700">{(stat.deliveryRate * 100).toFixed(0)}%</span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic">No closed projects</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {stat.avgSpi !== null ? (
                        <span className={cn(
                          "px-2.5 py-1 text-xs font-black rounded-lg",
                          stat.avgSpi >= config.spiThresholds.onTrack ? "bg-emerald-50 text-emerald-600" :
                          stat.avgSpi >= config.spiThresholds.atRisk ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                        )}>
                          {stat.avgSpi.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {stat.rebaselineRate === 0 ? (
                        <span className="text-sm font-bold text-emerald-500">0%</span>
                      ) : (
                        <span className="text-sm font-bold text-slate-700">{(stat.rebaselineRate * 100).toFixed(0)}%</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={cn("text-sm font-black", stat.staleCount > 0 ? "text-red-500" : "text-slate-400")}>
                        {stat.staleCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn("text-lg font-black", theme.text)}>
                        {stat.weightedScore.toFixed(2)}
                      </span>
                    </td>
                  </tr>

                  {/* Expandable Content inside Table Row */}
                  {expandedPMs.includes(stat.name) && (
                    <tr className="bg-slate-50/50 outline-none">
                      <td colSpan={7} className="px-6 py-6 border-b border-slate-100 p-0">
                        <div className="ml-8 space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-2">Underlying Projects</p>
                          {stat.pList.length === 0 ? (
                             <p className="text-sm text-slate-500 italic pl-2">No projects match current filters.</p>
                          ) : stat.pList.map(p => {
                            const pSpi = calculateSPI(p, config.spiThresholds);
                            const pDays = getActiveDaysCount(p);
                            const hasPendingRebaseline = p.rebaselineRequests?.some(r => r.status === 'Pending');
                            const isStale = differenceInDays(new Date(), parseISO(p.updatedAt)) >= config.staleThresholdDays;
                            
                            return (
                              <div key={p.id} className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
                                <div className="flex flex-col gap-1 min-w-[200px]">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{p.clientName}</span>
                                    {isStale && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-black uppercase rounded">Stale</span>}
                                  </div>
                                  <div className="flex gap-2 items-center">
                                    <StateBadge state={p.state} />
                                    {hasPendingRebaseline && <span className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase px-1.5 py-0.5 rounded">Pending Rebaseline</span>}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-end gap-6 text-sm">
                                  <div className="text-center">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Progress</p>
                                    <p className="font-bold text-slate-700">{p.percentageComplete || 0}%</p>
                                  </div>
                                  <div className="text-center w-12">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SPI</p>
                                    <p className={cn("font-bold", pSpi.color)}>{pSpi.rawSpi !== null ? pSpi.value : '-'}</p>
                                  </div>
                                  <div className="text-center w-20">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Active Days</p>
                                    <p className="font-bold text-slate-700">{pDays.days} <span className="text-[10px] text-slate-400 font-medium">d</span></p>
                                  </div>
                                  <div className="text-right min-w-[100px]">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Target Date</p>
                                    <p className="font-bold text-slate-700">{p.currentCompletionDate || '-'}</p>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Performance */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 mb-6">
          <Layers className={cn("w-5 h-5", theme.text)} />
          Package Performance
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Service Name</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider text-center">Projects</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider text-center">Completion Rate</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider text-center">Avg SPI</th>
                <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider text-center">Overrun Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(isPackagePerformanceExpanded ? packageStats : packageStats.slice(0, 5)).map((pkg, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 font-bold text-slate-900">{pkg.name}</td>
                  <td className="py-4 text-center text-sm font-bold text-slate-600">{pkg.projectsWithService}</td>
                  <td className="py-4 text-center">
                    {pkg.compRate !== null ? (
                      <span className={cn("text-sm font-bold", pkg.compRate >= 0.8 ? "text-emerald-500" : pkg.compRate < 0.5 ? "text-red-500" : "text-amber-500")}>
                        {(pkg.compRate * 100).toFixed(0)}%
                      </span>
                    ) : <span className="text-xs text-slate-400 italic">No Data</span>}
                  </td>
                  <td className="py-4 text-center">
                    {pkg.avgSpi !== null ? (
                      <span className={cn(
                        "px-2.5 py-1 text-xs font-black rounded-lg",
                        pkg.avgSpi >= config.spiThresholds.onTrack ? "bg-emerald-50 text-emerald-600" :
                        pkg.avgSpi >= config.spiThresholds.atRisk ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"
                      )}>
                        {pkg.avgSpi.toFixed(2)}
                      </span>
                    ) : <span className="text-xs text-slate-400 italic">No Data</span>}
                  </td>
                  <td className="py-4 text-center">
                    {pkg.overrunRate !== null ? (
                      <span className={cn("text-sm font-bold", pkg.overrunRate <= 0.2 ? "text-emerald-500" : pkg.overrunRate >= 0.5 ? "text-red-500" : "text-amber-500")}>
                        {(pkg.overrunRate * 100).toFixed(0)}%
                      </span>
                    ) : <span className="text-xs text-slate-400 italic">No Data</span>}
                  </td>
                </tr>
              ))}
              {packageStats.length > 5 && (
                <tr>
                  <td colSpan={5} className="py-4 px-2">
                    <button 
                      onClick={() => setIsPackagePerformanceExpanded(!isPackagePerformanceExpanded)}
                      className="w-full py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-black text-slate-500 hover:text-slate-800 uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                    >
                      {isPackagePerformanceExpanded ? (
                        <>
                          <ChevronDown className="w-4 h-4 rotate-180" />
                          Show less services
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4" />
                          View all {packageStats.length} services
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
