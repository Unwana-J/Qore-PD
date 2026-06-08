import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Project, AppConfig, Role, User } from '../types';
import { calculateSPI, getActiveDaysCount, cn, resolveServiceIds, getEffectiveServiceIds, calculatePhaseScores, getLatestInteractionDate } from '../lib/utils';
import { ChevronDown, ChevronRight, AlertTriangle, TrendingDown, Clock, Search, Filter, Layers, Flame } from 'lucide-react';
import { differenceInDays, parseISO, isAfter, isBefore, subDays, startOfMonth, startOfQuarter, startOfYear } from 'date-fns';
import { getThemeClasses } from '../lib/theme';
import { StateBadge } from './ProjectList';
import { useResourceStats } from './resource/useResourceStats';

interface PMScorecardProps {
  projects: Project[];
  users: User[];
  config: AppConfig;
  userRole: Role;
  onSelectProject?: (project: Project) => void;
  themeColor?: string;
}

export const PMScorecard: React.FC<PMScorecardProps> = ({ projects, users = [], config, userRole, themeColor = 'teal', onSelectProject }) => {
  const theme = getThemeClasses(themeColor);
  
  const { data: extensions = [] } = useQuery({
    queryKey: ['serviceExtensions'],
    queryFn: () => api.serviceExtensions.getAll(),
    staleTime: 30000,
  });

  const pmResourceStats = useResourceStats(
    projects,
    users,
    config.packages || [],
    config.serviceBaselines || []
  );

  const burnedOutPMs = useMemo(() => {
    return pmResourceStats.filter(stat => stat.isBurnedOut);
  }, [pmResourceStats]);

  const [selectedYear, setSelectedYear] = useState<string>('All Years');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('All Quarters');
  const [selectedMonth, setSelectedMonth] = useState<string>('All Months');
  const [sortBy, setSortBy] = useState('Weighted Score');
  const [expandedPMs, setExpandedPMs] = useState<string[]>([]);
  const [isServicePerformanceExpanded, setIsServicePerformanceExpanded] = useState(false);
  
  const togglePM = (pm: string) => {
    setExpandedPMs(prev => prev.includes(pm) ? prev.filter(p => p !== pm) : [...prev, pm]);
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    projects.forEach(p => {
      if (p.startDate) {
        const year = p.startDate.split('-')[0];
        if (year && year.length === 4) years.add(year);
      }
      if (p.createdAt) {
        const year = p.createdAt.split('-')[0];
        if (year && year.length === 4) years.add(year);
      }
    });
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [projects]);

  const periodRange = useMemo(() => {
    if (selectedYear === 'All Years') return null;
    
    let startMonth = 0;
    let endMonth = 11;
    
    if (selectedMonth !== 'All Months') {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const mIdx = monthNames.indexOf(selectedMonth);
      if (mIdx !== -1) {
        startMonth = mIdx;
        endMonth = mIdx;
      }
    } else if (selectedQuarter !== 'All Quarters') {
      const qNum = parseInt(selectedQuarter.replace('Q', ''));
      startMonth = (qNum - 1) * 3;
      endMonth = startMonth + 2;
    }
    
    const periodStart = new Date(Date.UTC(parseInt(selectedYear), startMonth, 1));
    const periodEnd = new Date(Date.UTC(parseInt(selectedYear), endMonth + 1, 0, 23, 59, 59, 999));
    
    return { start: periodStart, end: periodEnd };
  }, [selectedYear, selectedQuarter, selectedMonth]);

  const filteredProjects = useMemo(() => {
    let filtered = projects;
    
    if (periodRange) {
      const startStr = periodRange.start.toISOString().split('T')[0];
      const endStr = periodRange.end.toISOString().split('T')[0];
      
      filtered = filtered.filter(p => {
        if (p.startDate && p.startDate > endStr) return false;
        
        const isCompleted = ['Closed', 'Billed'].includes(p.state);
        if (isCompleted) {
          const compDate = p.actualCompletionDate || p.signedOffAt || p.billedAt || p.currentCompletionDate;
          if (compDate && compDate < startStr) return false;
        }
        
        return true;
      });
    }
    
    // Role level filtering
    if (userRole === 'Team Lead') {
      // In a real app we would check PM hierarchy. Here we simulate Team Lead seeing some PMs.
      // E.g. restricting to a subset based on some logic. 
      // For POC, we'll just show all active PMs for them too or let's assume they manage exactly these.
    }
    
    return filtered;
  }, [projects, periodRange, userRole]);

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
      const staleCount = pList.filter(p => 
        !['Closed', 'Billed', 'Signed Off', 'Suspended'].includes(p.state) &&
        differenceInDays(new Date(), getLatestInteractionDate(p)) >= config.staleThresholdDays
      ).length;
      // Execution Mapping Ratio
      const execProjects = pList.filter(p => p.phases?.find(ph => ph.id === 'Execution')?.status === 'In Progress');
      const mappedExecProjects = execProjects.filter(p =>
        extensions.some(e => e.linkedProjectId === p.id && e.mappingStatus === 'Approved')
      );
      const mappingRatio = execProjects.length > 0 ? (mappedExecProjects.length / execProjects.length) * 100 : null;

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
         mappingRatio,
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
    else if (sortBy === 'Map Rate') pmList.sort((a, b) => (b.mappingRatio ?? -1) - (a.mappingRatio ?? -1));

    return pmList;
  }, [filteredProjects, sortBy, config, extensions]);

  // Summaries
  const topPM = [...pmStats].sort((a,b) => b.weightedScore - a.weightedScore)[0];
  const mostProjectsPM = [...pmStats].sort((a,b) => b.projects - a.projects)[0];
  const mostStalePM = [...pmStats].sort((a,b) => b.staleCount - a.staleCount)[0];
  const lowestSpiPM = [...pmStats].filter(p => p.avgSpi !== null).sort((a,b) => (a.avgSpi!) - (b.avgSpi!))[0];

  // Service Performance Tracker: Grouped by IDs to handle name renames
  const packageStats = useMemo(() => {
    const baselines = config.serviceBaselines || [];
    return baselines.map(srv => {
      const srvId = srv.id;
      const srvName = srv.name;
      const srvBaseline = srv.baselineDays;
      
      // Resolve projects that use this service (Correctly handles inheritance and de-scoping)
      const projectsWithService = projects.filter(p => {
        const pServiceIds = getEffectiveServiceIds(p, config.packages || [], baselines);
        return pServiceIds.includes(srvId);
      });

      const closedServiceProjects = projectsWithService.filter(p => {
        // 1. If parent project is closed/billed/signed off, all its services are completed
        if (p.state === 'Closed' || p.state === 'Billed' || p.state === 'Signed Off') {
          return true;
        }
        // 2. Check interactive milestones first
        const milestone = p.milestones?.find(m => m.id === srvId || m.name === srvName);
        if (milestone) {
          return milestone.status === 'Closed';
        }
        // 3. Fallback to legacy serviceStates
        const status = p.serviceStates?.[srvId] || p.serviceStates?.[srvName];
        return status === 'Closed';
      });
      
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
        if (getActiveDaysCount(p).days > srvBaseline) overrunCount++;
      });
      const overrunRate = projectsWithService.length > 0 ? overrunCount / projectsWithService.length : null;
      
      return { 
        name: srvName, 
        projectsWithService: projectsWithService.length, 
        compRate, 
        avgSpi, 
        overrunRate 
      };
    }).sort((a,b) => (b.overrunRate || 0) - (a.overrunRate || 0));
  }, [projects, config]);

  if (userRole === 'PM') return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Scorecard Filters */}
      <div className="flex flex-wrap items-center justify-between gap-6 glass-card p-5 rounded-[24px] shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5 tracking-tight">
          <Clock className={cn("w-5 h-5", theme.text)} />
          PM Performance Scorecard
        </h2>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Year</span>
            <select 
              value={selectedYear} 
              onChange={e => {
                setSelectedYear(e.target.value);
                if (e.target.value === 'All Years') {
                  setSelectedQuarter('All Quarters');
                  setSelectedMonth('All Months');
                }
              }} 
              className="bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer hover:bg-slate-100/50 transition-colors"
            >
              <option>All Years</option>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Quarter</span>
            <select 
              value={selectedQuarter} 
              disabled={selectedYear === 'All Years'}
              onChange={e => {
                setSelectedQuarter(e.target.value);
                setSelectedMonth('All Months');
              }} 
              className="bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-slate-100/50 transition-colors"
            >
              <option>All Quarters</option>
              <option>Q1</option>
              <option>Q2</option>
              <option>Q3</option>
              <option>Q4</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Month</span>
            <select 
              value={selectedMonth} 
              disabled={selectedYear === 'All Years'}
              onChange={e => {
                setSelectedMonth(e.target.value);
                if (e.target.value !== 'All Months') {
                  const mIdx = [
                    'January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'
                  ].indexOf(e.target.value);
                  if (mIdx !== -1) {
                    const qNum = Math.floor(mIdx / 3) + 1;
                    setSelectedQuarter(`Q${qNum}`);
                  }
                }
              }} 
              className="bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:enabled:bg-slate-100/50 transition-colors"
            >
              <option>All Months</option>
              <option>January</option>
              <option>February</option>
              <option>March</option>
              <option>April</option>
              <option>May</option>
              <option>June</option>
              <option>July</option>
              <option>August</option>
              <option>September</option>
              <option>October</option>
              <option>November</option>
              <option>December</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 border-l border-slate-200 pl-4 ml-1">
            <span className="font-bold text-slate-400 uppercase tracking-wider">Sort By</span>
            <select 
              value={sortBy} 
              onChange={e => setSortBy(e.target.value)} 
              className="bg-slate-50 text-sm font-semibold text-slate-700 border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer hover:bg-slate-100/50 transition-colors"
            >
              <option>Weighted Score</option>
              <option>Delivery Rate</option>
              <option>Map Rate</option>
              <option>Avg SPI</option>
              <option>Project Count</option>
            </select>
          </div>
        </div>
      </div>

      {/* Critical Burnout Alerts */}
      {burnedOutPMs.length > 0 && (
        <div className="bg-rose-50/40 backdrop-blur-md border border-rose-100 p-6 rounded-[24px] shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-600 animate-pulse" />
            <h3 className="font-bold text-rose-900 text-base tracking-tight">Critical Burnout Alerts</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
            {burnedOutPMs.map(pm => (
              <div key={pm.id} className="bg-white/80 backdrop-blur-sm border border-rose-100/60 p-5 rounded-2xl flex items-center justify-between gap-4 shadow-[0_4px_12px_rgba(244,63,94,0.02)] hover:shadow-[0_8px_20px_rgba(244,63,94,0.06)] hover:border-rose-200 transition-all duration-300 group">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm group-hover:text-rose-600 transition-colors">{pm.name}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    Overloaded for <span className="text-rose-600 font-bold">{pm.daysOverloaded} days</span>
                  </p>
                </div>
                <div className="flex items-center gap-5 text-right">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">WIP / Limit</p>
                    <p className="text-sm font-bold text-slate-700">{pm.serviceWeight} / {pm.wipLimit}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Utilization</p>
                    <p className="text-sm font-extrabold text-rose-600">{pm.utilizationPct.toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card glass-card-hover p-6 rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Best Performing PM</p>
          <p className="text-xl font-bold text-slate-900">{topPM ? topPM.name : '-'}</p>
          {topPM && <p className="text-xs font-semibold text-teal-600 mt-1.5">{topPM.weightedScore.toFixed(2)} Score</p>}
        </div>
        <div className="glass-card glass-card-hover p-6 rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Largest Portfolio</p>
          <p className="text-xl font-bold text-slate-900">{mostProjectsPM ? mostProjectsPM.name : '-'}</p>
          {mostProjectsPM && <p className="text-xs font-semibold text-blue-600 mt-1.5">{mostProjectsPM.projects} Projects</p>}
        </div>
        <div className={cn("glass-card glass-card-hover p-6 rounded-[24px] shadow-sm transition-all duration-300", mostStalePM?.staleCount > 0 ? "border-red-100 bg-red-50/20" : "")}>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Most Stale Projects</p>
          <p className="text-xl font-bold text-slate-900">{mostStalePM && mostStalePM.staleCount > 0 ? mostStalePM.name : 'None'}</p>
          <p className={cn("text-xs font-semibold mt-1.5", mostStalePM?.staleCount > 0 ? "text-red-600" : "text-slate-500")}>
            {mostStalePM ? mostStalePM.staleCount : 0} Stale
          </p>
        </div>
        <div className="glass-card glass-card-hover p-6 rounded-[24px] shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Lowest Avg SPI</p>
          <p className="text-xl font-bold text-slate-900">{lowestSpiPM ? lowestSpiPM.name : '-'}</p>
          {lowestSpiPM && <p className={cn("text-xs font-semibold mt-1.5", (lowestSpiPM.avgSpi||0) < config.spiThresholds.atRisk ? "text-red-600" : "text-amber-600")}>
            {lowestSpiPM.avgSpi?.toFixed(2) || 'N/A'} SPI
          </p>}
        </div>
      </div>

      {/* Main Table */}
      <div className="glass-card rounded-[24px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100">
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Project Manager</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Projects</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Delivery Rate</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Map Rate</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Avg SPI</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Rebaselines</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Stale</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Burnout</th>
                <th className="px-6 py-4.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">W. Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60">
              {pmStats.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-slate-400">No performance data found for active filters.</td></tr>
              ) : pmStats.map((stat, i) => (
                <React.Fragment key={i}>
                  <tr 
                    onClick={() => togglePM(stat.name)}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {expandedPMs.includes(stat.name) ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm", theme.bg)}>
                          {stat.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-teal-600 transition-colors">{stat.name}</span>
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
                      {stat.mappingRatio !== null ? (
                        <span className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-lg border",
                          stat.mappingRatio >= 80 ? "bg-emerald-50/50 text-emerald-600 border-emerald-100" :
                          stat.mappingRatio >= 55 ? "bg-amber-50/50 text-amber-600 border-amber-100" : "bg-rose-50/50 text-rose-600 border-rose-100"
                        )}>
                          {stat.mappingRatio.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium italic">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {stat.avgSpi !== null ? (
                        <span className={cn(
                          "px-2.5 py-1 text-xs font-bold rounded-lg border",
                          stat.avgSpi >= config.spiThresholds.onTrack ? "bg-emerald-50/50 text-emerald-600 border-emerald-100" :
                          stat.avgSpi >= config.spiThresholds.atRisk ? "bg-amber-50/50 text-amber-600 border-amber-100" : "bg-rose-50/50 text-rose-600 border-rose-100"
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
                      <span className={cn("text-sm font-bold", stat.staleCount > 0 ? "text-red-500" : "text-slate-400")}>
                        {stat.staleCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {pmResourceStats.find(rs => rs.name === stat.name)?.isBurnedOut ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded bg-rose-50 text-rose-600 border border-rose-100 shadow-sm">
                          <Flame className="w-3 h-3 text-rose-500 animate-pulse" />
                          Burnout
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-semibold italic">Normal</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={cn("text-lg font-extrabold", theme.text)}>
                        {stat.weightedScore.toFixed(2)}
                      </span>
                    </td>
                  </tr>

                  {/* Expandable Content inside Table Row */}
                  {expandedPMs.includes(stat.name) && (
                    <tr className="bg-slate-50/30 outline-none">
                      <td colSpan={9} className="px-6 py-6 border-b border-slate-100 p-0">
                        <div className="ml-8 space-y-3">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2">Underlying Projects</p>
                          {stat.pList.length === 0 ? (
                             <p className="text-sm text-slate-500 italic pl-2">No projects match current filters.</p>
                          ) : stat.pList.map(p => {
                             const pSpi = calculateSPI(p, config.spiThresholds);
                             const pDays = getActiveDaysCount(p);
                             const hasPendingRebaseline = p.rebaselineRequests?.some(r => r.status === 'Pending');
                             const isStale = !['Closed', 'Billed', 'Signed Off', 'Suspended'].includes(p.state) && 
                                             differenceInDays(new Date(), getLatestInteractionDate(p)) >= config.staleThresholdDays;
                             
                             return (
                               <div key={p.id} className="bg-white/80 backdrop-blur-sm px-4 py-3 rounded-2xl border border-slate-200/80 shadow-sm flex flex-wrap items-center justify-between gap-4">
                                 <div className="flex flex-col gap-1 min-w-[200px]">
                                   <div className="flex items-center gap-2">
                                     <span className="text-sm font-semibold text-slate-900 truncate max-w-[200px]">{p.clientName}</span>
                                     {isStale && <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold uppercase rounded">Stale</span>}
                                   </div>
                                   <div className="flex gap-2 items-center">
                                     <StateBadge state={p.state} />
                                     {hasPendingRebaseline && <span className="bg-amber-100 text-amber-700 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">Pending Rebaseline</span>}
                                   </div>
                                 </div>
                                 <div className="flex flex-wrap items-center justify-end gap-6 text-sm">
                                   <div className="text-center">
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Progress</p>
                                     <p className="font-semibold text-slate-700">{calculatePhaseScores(p).totalPercentage}%</p>
                                   </div>
                                   <div className="text-center w-12">
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">SPI</p>
                                     <p className={cn("font-bold", pSpi.color)}>{pSpi.rawSpi !== null ? pSpi.value : '-'}</p>
                                   </div>
                                   <div className="text-center w-20">
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Active Days</p>
                                     <p className="font-semibold text-slate-700">{pDays.days} <span className="text-[10px] text-slate-400 font-medium">d</span></p>
                                   </div>
                                   <div className="text-right min-w-[100px]">
                                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Target Date</p>
                                     <p className="font-semibold text-slate-700">{p.currentCompletionDate || '-'}</p>
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

      {/* Service Performance */}
      <div className="glass-card p-6 rounded-[24px] shadow-sm">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2.5 mb-6 tracking-tight">
          <Layers className={cn("w-5 h-5", theme.text)} />
          Service Performance
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
              {(isServicePerformanceExpanded ? packageStats : packageStats.slice(0, 5)).map((pkg, i) => (
                <tr key={i} className="hover:bg-slate-50/50 transition-colors">
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
                        "px-2.5 py-1 text-xs font-bold rounded-lg border",
                        pkg.avgSpi >= config.spiThresholds.onTrack ? "bg-emerald-50/50 text-emerald-600 border-emerald-100" :
                        pkg.avgSpi >= config.spiThresholds.atRisk ? "bg-amber-50/50 text-amber-600 border-amber-100" : "bg-rose-50/50 text-rose-600 border-rose-100"
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
                      onClick={() => setIsServicePerformanceExpanded(!isServicePerformanceExpanded)}
                      className="w-full py-3 bg-slate-50 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                    >
                      {isServicePerformanceExpanded ? (
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
