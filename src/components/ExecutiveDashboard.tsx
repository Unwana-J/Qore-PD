import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  TrendingUp, Activity, Award, AlertTriangle, Clock, 
  Layers, DollarSign, Target, Zap, ShieldAlert,
  ChevronRight, Calendar, User as UserIcon, Briefcase, AlertCircle
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Project, Role, RevenueTrend, ProjectState, ProjectPriority, User } from '../types';
import { MOCK_REVENUE_TREND } from '../mockData';
import { formatCurrency, cn, calculateSPI } from '../lib/utils';
import { PROJECT_STATE_COLORS, PRIORITY_COLORS, getThemeClasses } from '../lib/theme';

interface ExecutiveDashboardProps {
  projects: Project[];
  users: User[];
  themeColor?: string;
  onSelectProject: (p: Project) => void;
  staleThresholdDays: number;
  spiThresholds: { onTrack: number; atRisk: number };
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  projects,
  users,
  themeColor = 'teal',
  onSelectProject,
  spiThresholds
}) => {
  const [currencyFilter, setCurrencyFilter] = useState<'All' | 'NGN' | 'USD'>('All');
  const [globalFilter, setGlobalFilter] = useState<'All' | 'Enterprise' | 'Initiative'>('All');
  const theme = getThemeClasses(themeColor);
  const now = new Date();

  // --- Filtering Logic ---
  const filteredProjects = useMemo(() => {
    switch (globalFilter) {
      case 'Enterprise':
        return projects.filter(p => !p.isInternalInitiative && p.priority === 'P1');
      case 'Initiative':
        return projects.filter(p => p.isInternalInitiative);
      default:
        return projects;
    }
  }, [projects, globalFilter]);

  // --- Computations ---

  // Row 1: Project Counts
  const projectCounts = useMemo(() => {
    return {
      total: filteredProjects.length,
      onTrack: filteredProjects.filter(p => p.state === 'On-Track').length,
      delayed: filteredProjects.filter(p => p.state === 'Delayed').length,
      onHold: filteredProjects.filter(p => p.state === 'Suspended').length,
      readyForBilling: filteredProjects.filter(p => p.state === 'Signed Off').length,
      billed: filteredProjects.filter(p => p.state === 'Billed').length,
      closed: filteredProjects.filter(p => p.state === 'Closed').length,
      initiatives: filteredProjects.filter(p => p.isInternalInitiative).length,
    };
  }, [filteredProjects]);

  // Row 2: Revenue Stats
  const revenueStats = useMemo(() => {
    const sumFiltered = (currency: 'NGN'|'USD', states: ProjectState[]) => 
      filteredProjects.filter(p => !p.isInternalInitiative && p.currency === currency && states.includes(p.state)).reduce((acc, p) => acc + p.value, 0);
    const sumAll = (currency: 'NGN'|'USD') => 
      filteredProjects.filter(p => !p.isInternalInitiative && p.currency === currency).reduce((acc, p) => acc + p.value, 0);

    return {
      total: { NGN: sumAll('NGN'), USD: sumAll('USD') },
      recognized: { NGN: sumFiltered('NGN', ['Billed', 'Closed']), USD: sumFiltered('USD', ['Billed', 'Closed']) },
      atRisk: { NGN: sumFiltered('NGN', ['Delayed', 'Suspended']), USD: sumFiltered('USD', ['Delayed', 'Suspended']) },
      onTrack: { NGN: sumFiltered('NGN', ['On-Track', 'Signed Off']), USD: sumFiltered('USD', ['On-Track', 'Signed Off']) }
    };
  }, [filteredProjects]);

  // Charts: Revenue Trend
  const trendData = useMemo(() => {
    if (currencyFilter === 'All') {
      return MOCK_REVENUE_TREND.map(t => ({
        ...t,
        intake: t.intakeNGN + (t.intakeUSD * 1500),
        achieved: t.achievedNGN + (t.achievedUSD * 1500)
      }));
    }
    return MOCK_REVENUE_TREND.map(t => ({
      month: t.month,
      intake: currencyFilter === 'NGN' ? t.intakeNGN : t.intakeUSD,
      achieved: currencyFilter === 'NGN' ? t.achievedNGN : t.achievedUSD,
    }));
  }, [currencyFilter]);

  // Charts: Portfolio Health (Donut)
  const healthData = useMemo(() => {
    const states: { name: string, state: ProjectState }[] = [
      { name: 'On-Track', state: 'On-Track' },
      { name: 'Delayed', state: 'Delayed' },
      { name: 'On Hold', state: 'Suspended' },
      { name: 'Signed Off', state: 'Signed Off' },
      { name: 'Billed', state: 'Billed' },
      { name: 'Closed', state: 'Closed' }
    ];
    return states.map(s => ({
      name: s.name,
      value: filteredProjects.filter(p => p.state === s.state).length
    }));
  }, [filteredProjects]);

  // Charts: Package Revenue
  const packageRevenue = useMemo(() => {
    // If 'All' is selected, don't aggregate invalid numbers (USD + NGN together)
    if (currencyFilter === 'All') return [];

    const pkgMap = new Map<string, { name: string, achieved: number, pending: number, total: number }>();
    filteredProjects.forEach(p => {
      // ONLY process projects matching the exact currency filter
      if (p.currency !== currencyFilter) return;

      const pkg = p.packageName || 'Unknown Package';
      if (!pkgMap.has(pkg)) pkgMap.set(pkg, { name: pkg, achieved: 0, pending: 0, total: 0 });
      
      const stats = pkgMap.get(pkg)!;
      const isAchieved = (p.state === 'Billed' || p.state === 'Closed');
      
      if (isAchieved) stats.achieved += p.value;
      else stats.pending += p.value;
      stats.total += p.value;
    });

    return Array.from(pkgMap.values())
      .sort((a, b) => b.total - a.total)
      .filter(p => p.total > 0);
  }, [filteredProjects, currencyFilter]);

  // Schedule Performance
  const schedulePerformance = useMemo(() => {
    const activeProjects = filteredProjects.filter(p => !['Signed Off', 'Billed', 'Closed'].includes(p.state));
    const validSpis = activeProjects.map(p => calculateSPI(p, spiThresholds).rawSpi).filter(val => val !== null) as number[];
    const avgSpi = validSpis.length > 0 ? validSpis.reduce((a, b) => a + b, 0) / validSpis.length : 0;
    const completionRate = filteredProjects.length > 0 ? (projectCounts.closed / filteredProjects.length) * 100 : 0;

    return { avgSpi, completionRate };
  }, [filteredProjects, projectCounts.closed, spiThresholds]);

  // At-Risk Table
  const atRiskProjects = useMemo(() => {
    return filteredProjects
      .filter(p => p.state === 'Delayed')
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredProjects]);

  const getDaysDelayed = (p: Project) => {
    const closurePhase = p.phases.find(m => m.name === 'Closure');
    if (!closurePhase || !closurePhase.completionDate) return 0;
    const target = parseISO(closurePhase.completionDate);
    if (target < now && closurePhase.status !== 'Completed') {
      return differenceInDays(now, target);
    }
    return 0;
  };

  const getStatusRatio = (count: number) => filteredProjects.length > 0 ? (count / filteredProjects.length) * 100 : 0;

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto pb-20">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 mb-2">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
            {format(now, 'EEEE, d MMMM yyyy')}
          </p>
        </div>

        {/* Portfolio Filter Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {[
            { id: 'All', label: 'All Portfolio' },
            { id: 'Enterprise', label: 'Tier 1 - Enterprise' },
            { id: 'Initiative', label: 'Internal Initiatives' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setGlobalFilter(f.id as any)}
              className={cn(
                "px-5 py-2.5 rounded-xl text-xs font-black transition-all",
                globalFilter === f.id
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Currency Filter Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {(['All', 'NGN', 'USD'] as const).map(c => (
            <button
              key={c}
              onClick={() => setCurrencyFilter(c)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black transition-all",
                currencyFilter === c
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {c === 'All' ? 'ALL' : c === 'NGN' ? '₦ NGN' : '$ USD'}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Project Counts */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPIBox
          label="Total Projects"
          val={projectCounts.total}
          subtitle="Across all statuses"
          variant="neutral"
        />
        <KPIBox
          label="Internal Initiatives"
          val={projectCounts.initiatives}
          subtitle="Strategic tasks"
          variant="violet"
        />
        <KPIBox
          label="On-Track"
          val={projectCounts.onTrack}
          subtitle="On-Track & performing"
          variant="green"
        />
        <KPIBox
          label="Delayed"
          val={projectCounts.delayed}
          subtitle="At-risk schedules"
          variant="red"
        />
        <KPIBox
          label="On Hold"
          val={projectCounts.onHold}
          subtitle="Suspended"
          variant="slate"
        />
        <KPIBox
          label="Ready to Bill"
          val={projectCounts.readyForBilling}
          subtitle="Awaiting Finance"
          variant="amber"
        />
      </div>

      {/* Row 2: Revenue Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <RevenueBox
          label="Total Portfolio Revenue"
          ngn={revenueStats.total.NGN}
          usd={revenueStats.total.USD}
          subtitle="All contracted value"
          currencyFilter={currencyFilter}
          variant="neutral"
        />
        <RevenueBox
          label="Recognized Revenue"
          ngn={revenueStats.recognized.NGN}
          usd={revenueStats.recognized.USD}
          subtitle="Billed & Closed projects"
          currencyFilter={currencyFilter}
          variant="green"
        />
        <RevenueBox
          label="Receivable At-Risk"
          ngn={revenueStats.atRisk.NGN}
          usd={revenueStats.atRisk.USD}
          subtitle="Delayed & Suspended projects"
          currencyFilter={currencyFilter}
          variant="red"
        />
        <RevenueBox
          label="Receivable On-Track"
          ngn={revenueStats.onTrack.NGN}
          usd={revenueStats.onTrack.USD}
          subtitle="On-Track & Ready for Billing"
          currencyFilter={currencyFilter}
          variant="green"
        />
      </div>

      {/* Project Status Breakdown (Horizontal Bar) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Portfolio Status Breakdown</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Single-line overview of all projects</p>
        </div>
        
        {/* The stacked bar */}
        <div className="w-full h-8 flex rounded-xl overflow-hidden mb-6 shadow-inner ring-1 ring-slate-100 ring-inset">
          <div className="h-full bg-emerald-500 transition-all hover:opacity-90" style={{ width: `${getStatusRatio(projectCounts.onTrack)}%` }} title={`On-Track: ${projectCounts.onTrack}`} />
          <div className="h-full bg-red-500 transition-all hover:opacity-90" style={{ width: `${getStatusRatio(projectCounts.delayed)}%` }} title={`Delayed: ${projectCounts.delayed}`} />
          <div className="h-full bg-slate-800 transition-all hover:opacity-90" style={{ width: `${getStatusRatio(projectCounts.onHold)}%` }} title={`On Hold: ${projectCounts.onHold}`} />
          <div className="h-full bg-amber-500 transition-all hover:opacity-90" style={{ width: `${getStatusRatio(projectCounts.readyForBilling)}%` }} title={`Ready for Billing: ${projectCounts.readyForBilling}`} />
          <div className="h-full bg-blue-600 transition-all hover:opacity-90" style={{ width: `${getStatusRatio(projectCounts.billed)}%` }} title={`Billed: ${projectCounts.billed}`} />
          <div className="h-full bg-slate-400 transition-all hover:opacity-90" style={{ width: `${getStatusRatio(projectCounts.closed)}%` }} title={`Closed: ${projectCounts.closed}`} />
        </div>

        {/* Legend / Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <BreakdownStat label="On-Track" count={projectCounts.onTrack} total={filteredProjects.length} color="text-emerald-500" />
          <BreakdownStat label="Delayed" count={projectCounts.delayed} total={filteredProjects.length} color="text-red-500" />
          <BreakdownStat label="On Hold" count={projectCounts.onHold} total={filteredProjects.length} color="text-slate-800" />
          <BreakdownStat label="Ready to Bill" count={projectCounts.readyForBilling} total={filteredProjects.length} color="text-amber-500" />
          <BreakdownStat label="Billed" count={projectCounts.billed} total={filteredProjects.length} color="text-blue-600" />
          <BreakdownStat label="Closed" count={projectCounts.closed} total={filteredProjects.length} color="text-slate-400" />
        </div>
      </div>

      {/* Row 3: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-900">Revenue Performance</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Intake vs Recognized (Last 12 Months)</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}}
                  tickFormatter={(v) => currencyFilter === 'USD' ? `$${v/1000}k` : `₦${v/1000000}m`}
                />
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                  formatter={(v: any) => [currencyFilter === 'USD' ? formatCurrency(v, 'USD') : formatCurrency(v, 'NGN'), '']}
                />
                <Line 
                  type="monotone" 
                  dataKey="intake" 
                  stroke="#cbd5e1" 
                  strokeWidth={2} 
                  strokeDasharray="5 5" 
                  dot={false}
                  name="Intake Revenue"
                />
                <Line 
                  type="monotone" 
                  dataKey="achieved" 
                  stroke="#14b8a6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#14b8a6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="Recognized Revenue"
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: 20, fontSize: 10, fontWeight: 700, textTransform: 'uppercase'}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Portfolio Health */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-900">Portfolio Health</h2>
          </div>
          <div className="flex-1 relative min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={healthData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {healthData.map((entry, index) => {
                    const stateStyles: any = {
                      'On-Track': '#10b981',      // emerald-500
                      'Delayed': '#ef4444',       // red-500
                      'On Hold': '#1e293b',       // slate-800
                      'Signed Off': '#f59e0b',    // amber-500
                      'Billed': '#3b82f6',        // blue-600
                      'Closed': '#94a3b8'         // slate-400
                    };
                    return (
                      <Cell key={`cell-${index}`} fill={stateStyles[entry.name]} />
                    );
                  })}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
              <span className="text-3xl font-black text-slate-900 leading-none">{projects.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total Projects</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-2 mt-4">
            {healthData.map((d) => {
               const stateStyles: any = {
                  'On-Track': '#10b981',
                  'Delayed': '#ef4444',
                  'On Hold': '#1e293b',
                  'Signed Off': '#f59e0b',
                  'Billed': '#3b82f6',
                  'Closed': '#94a3b8'
                };
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: stateStyles[d.name]}} />
                  <span className="text-[10px] font-bold text-slate-600 truncate">{d.name} ({Math.round((d.value / filteredProjects.length || 0) * 100)}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Package Revenue Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm lg:col-span-1 flex flex-col">
          <div className="mb-6 shrink-0">
            <h2 className="text-lg font-black text-slate-900">Revenue by Package</h2>
          </div>
          <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar border-y border-slate-50 relative">
            {currencyFilter === 'All' ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                 <AlertCircle className="w-8 h-8 text-slate-200 mb-3" />
                 <p className="text-sm font-bold text-slate-600 mb-1">Select a Currency</p>
                 <p className="text-xs text-slate-400">Please choose NGN or USD in the portfolio filter to view accurate distribution.</p>
              </div>
            ) : packageRevenue.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                 <p className="text-sm font-bold text-slate-400 italic">No {currencyFilter} intake logged for active packages.</p>
              </div>
            ) : (
              <div style={{ height: `${Math.max(100, packageRevenue.length * 45)}px`, minHeight: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={packageRevenue} layout="vertical" margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                      width={90}
                    />
                    <Tooltip 
                       cursor={{fill: '#f8fafc'}}
                       contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold'}}
                       formatter={(value: number) => [`${currencyFilter === 'NGN' ? '₦' : '$'}${value.toLocaleString()}`, 'Revenue']}
                    />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: 10, fontSize: 10, fontWeight: 700}} />
                    <Bar dataKey="achieved" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Recognized" barSize={12} />
                    <Bar dataKey="pending" fill="#99f6e4" radius={[0, 4, 4, 0]} name="Pending" barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>

        {/* Schedule Performance section */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Schedule Performance</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Delivery efficiency across all active portfolios</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[250px] content-center">
            
            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-100 relative overflow-hidden">
               <Activity className={cn("absolute -top-4 -right-4 w-32 h-32 opacity-[0.03]", schedulePerformance.avgSpi >= 1 ? "text-emerald-500" : schedulePerformance.avgSpi >= 0.8 ? "text-amber-500" : "text-red-500")} />
               <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Portfolio Average SPI</p>
               <span className={cn(
                 "text-6xl font-black tracking-tighter mb-2",
                 schedulePerformance.avgSpi >= 1.0 ? "text-emerald-500" : 
                 schedulePerformance.avgSpi >= 0.8 ? "text-amber-500" : "text-red-500"
               )}>
                 {schedulePerformance.avgSpi.toFixed(2)}
               </span>
               <p className="text-[10px] font-bold text-slate-400 uppercase">Average across all active projects</p>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
               <p className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4">Project Completion Rate</p>
               <span className="text-6xl font-black tracking-tighter text-slate-800 mb-4">{Math.round(schedulePerformance.completionRate)}%</span>
               
               <div className="w-full max-w-[200px] h-3 bg-slate-200 rounded-full overflow-hidden shadow-inner mb-2">
                 <div className="h-full bg-slate-800 transition-all duration-1000" style={{ width: `${schedulePerformance.completionRate}%` }} />
               </div>
               <p className="text-[10px] font-bold text-slate-400 uppercase">Projects reached closed status</p>
            </div>

          </div>
        </div>
      </div>

      {/* Row 4: At-Risk Projects Table */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-red-500" />
              At-Risk Projects
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sorted by revenue exposure</p>
          </div>
          {atRiskProjects.length > 10 && (
            <button className="text-xs font-black text-teal-600 hover:text-teal-700 hover:underline">
              View all {atRiskProjects.length} delayed projects →
            </button>
          )}
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client / Project</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Priority</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">PM</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Days Delayed</th>
                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Current SPI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {atRiskProjects.length > 0 ? atRiskProjects.map(p => {
                const delayed = getDaysDelayed(p);
                const pm = users.find(u => u.name === p.assignedPM);
                const isInactive = pm?.status === 'Inactive';
                const spi = calculateSPI(p, spiThresholds);

                return (
                  <tr 
                    key={p.id} 
                    onClick={() => onSelectProject(p)}
                    className="hover:bg-slate-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-5">
                      <p className="text-sm font-black text-slate-900 group-hover:text-teal-600 transition-colors">{p.clientName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.packageName}</p>
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-black border",
                        p.priority === 'P1' ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-100 text-slate-600 border-slate-200"
                      )}>{p.priority === 'P1' ? 'Tier 1 - Enterprise' : p.priority === 'P2' ? 'Tier 2 - Pro' : 'Tier 3 - Basic'}</span>
                    </td>
                    <td className="px-4 py-5 font-bold text-sm text-slate-600">
                      <div className="flex flex-col">
                        <span>{p.assignedPM}</span>
                        {isInactive && (
                          <span className="text-[9px] font-black text-red-500 uppercase tracking-tighter bg-red-50 border border-red-100 rounded px-1.5 w-fit mt-0.5">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-5 text-right font-black text-sm text-slate-900">
                      {formatCurrency(p.value, p.currency)}
                    </td>
                    <td className="px-4 py-5 text-center">
                      <span className={cn(
                        "font-black text-sm",
                        delayed > 29 ? "text-red-600" : delayed > 14 ? "text-amber-600" : "text-slate-500"
                      )}>{delayed}d</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className={cn("px-2 py-1 rounded text-[10px] font-black border", spi.color)}>
                        {spi.value}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Award className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900">No delayed projects</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Portfolio on track ✓</p>
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

/* --- Helpers --- */

const BreakdownStat = ({ label, count, total, color }: { label: string, count: number, total: number, color: string }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-xl font-black", color)}>{count}</span>
        <span className="text-[10px] font-bold text-slate-400">({pct}%)</span>
      </div>
    </div>
  );
};

const KPIBox = ({ label, val, subtitle, variant = 'neutral' }: any) => {
  const styles: any = {
    neutral: "bg-white border-slate-200 text-slate-900 icon-bg-slate-50 icon-text-slate-400 border-b-4 border-b-slate-800",
    green: "bg-white border-emerald-100 text-emerald-900 icon-bg-emerald-50 icon-text-emerald-500 border-b-4 border-b-emerald-500",
    red: "bg-white border-red-100 text-slate-900 icon-bg-red-50 icon-text-red-500 border-b-4 border-b-red-500",
    slate: "bg-slate-50 border-slate-200 text-slate-600 icon-bg-white icon-text-slate-400 border-b-4 border-b-slate-400",
    amber: "bg-white border-amber-100 text-slate-900 icon-bg-amber-50 icon-text-amber-500 border-b-4 border-b-amber-500",
    violet: "bg-white border-violet-100 text-violet-900 icon-bg-violet-50 icon-text-violet-500 border-b-4 border-b-violet-500",
  };

  const IconMap: any = {
    neutral: Briefcase,
    green: Award,
    red: AlertTriangle,
    slate: Clock,
    amber: Target,
    violet: Layers
  };
  const Icon = IconMap[variant];

  return (
    <div className={cn("p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:-translate-y-1 hover:shadow-md h-full relative overflow-hidden", styles[variant])}>
      <div className="flex justify-between items-start mb-6">
        <div className={cn("p-2 rounded-xl backdrop-blur-sm", variant === 'slate' ? "bg-white" : "bg-slate-50")}>
          <Icon className={cn("w-4 h-4 opacity-80", styles[variant].match(/icon-text-[a-z0-9-]+/)![0].replace('icon-text-', 'text-'))} />
        </div>
      </div>
      <div>
        <p className="text-4xl font-black tracking-tighter mb-1 relative z-10">{val}</p>
        <p className="text-[11px] font-black uppercase tracking-widest relative z-10 mb-0.5">{label}</p>
        <p className="text-[9px] font-bold opacity-60 uppercase relative z-10">{subtitle}</p>
      </div>
      <Icon className={cn("absolute -bottom-4 -right-4 w-24 h-24 opacity-5 transition-transform group-hover:scale-110", styles[variant].match(/icon-text-[a-z0-9-]+/)![0].replace('icon-text-', 'text-'))} />
    </div>
  );
};

const RevenueBox = ({ label, ngn, usd, subtitle, variant = 'neutral', themeColor = 'teal', currencyFilter = 'All' }: any) => {
  const theme = getThemeClasses(themeColor);
  const styles: any = {
    neutral: "bg-white border-slate-200 text-slate-900 border-b-4 border-b-slate-800",
    green: "bg-emerald-50 border-emerald-100 text-slate-900 border-b-4 border-b-emerald-500",
    red: "bg-red-50 border-red-100 text-slate-900 border-b-4 border-b-red-500",
    teal: cn("bg-white border-slate-200 text-slate-900 border-b-4", theme.borderB),
  };

  return (
    <div className={cn("p-5 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md h-full", styles[variant])}>
      <div className="mb-4">
        <p className="text-[11px] font-black uppercase tracking-widest">{label}</p>
        <p className="text-[9px] font-bold text-slate-500 opacity-80 uppercase mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-1 overflow-hidden">
        {(currencyFilter === 'All' || currencyFilter === 'NGN') && (
          <p 
            title={formatCurrency(ngn, 'NGN')}
            className={cn(
              "font-black leading-none tracking-tighter truncate",
              currencyFilter === 'NGN' ? "text-3xl" : "text-xl"
            )}
          >
            {formatCurrency(ngn, 'NGN')}
          </p>
        )}
        {(currencyFilter === 'All' || currencyFilter === 'USD') && (
          <p 
            title={formatCurrency(usd, 'USD')}
            className={cn(
              "font-black tracking-tighter truncate opacity-70",
              currencyFilter === 'USD' ? "text-3xl" : "text-sm"
            )}
          >
            {formatCurrency(usd, 'USD')}
          </p>
        )}
      </div>
    </div>
  );
};

