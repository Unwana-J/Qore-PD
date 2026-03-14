import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  TrendingUp, Activity, Award, AlertTriangle, Clock, 
  Layers, DollarSign, Target, Zap, ShieldAlert,
  ChevronRight, Calendar, User as UserIcon, Briefcase
} from 'lucide-react';
import { format } from 'date-fns';
import { Project, Role, RevenueTrend, ProjectState, ProjectPriority, User } from '../types';
import { MOCK_REVENUE_TREND } from '../mockData';
import { formatCurrency, cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface ExecutiveDashboardProps {
  projects: Project[];
  users: User[];
  themeColor?: string;
  onSelectProject: (p: Project) => void;
  staleThresholdDays: number;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({ 
  projects, 
  users,
  themeColor = 'teal', 
  onSelectProject,
  staleThresholdDays
}) => {
  const [currencyFilter, setCurrencyFilter] = useState<'All' | 'NGN' | 'USD'>('All');
  const theme = getThemeClasses(themeColor);
  const now = new Date();

  // --- Computations ---

  const filteredByCurrency = useMemo(() => {
    if (currencyFilter === 'All') return projects;
    return projects.filter(p => p.currency === currencyFilter);
  }, [projects, currencyFilter]);

  // Row 1: KPI Stats
  const kpiStats = useMemo(() => {
    const totalNGN = projects.filter(p => p.currency === 'NGN').reduce((acc, p) => acc + p.value, 0);
    const totalUSD = projects.filter(p => p.currency === 'USD').reduce((acc, p) => acc + p.value, 0);
    
    const achievedNGN = projects.filter(p => p.currency === 'NGN' && (p.state === 'Billed' || p.state === 'Closed')).reduce((acc, p) => acc + p.value, 0);
    const achievedUSD = projects.filter(p => p.currency === 'USD' && (p.state === 'Billed' || p.state === 'Closed')).reduce((acc, p) => acc + p.value, 0);

    const atRiskNGN = projects.filter(p => p.currency === 'NGN' && p.state === 'Delayed').reduce((acc, p) => acc + p.value, 0);
    const atRiskUSD = projects.filter(p => p.currency === 'USD' && p.state === 'Delayed').reduce((acc, p) => acc + p.value, 0);

    const activeCount = projects.filter(p => p.state === 'Active').length;
    const attentionCount = projects.filter(p => p.state === 'Delayed' || p.state === 'Suspended').length;

    return {
      total: { NGN: totalNGN, USD: totalUSD },
      achieved: { NGN: achievedNGN, USD: achievedUSD },
      atRisk: { NGN: atRiskNGN, USD: atRiskUSD },
      activeCount,
      attentionCount
    };
  }, [projects]);

  // Row 2 Left: Revenue Trend Data
  const trendData = useMemo(() => {
    if (currencyFilter === 'All') {
      return MOCK_REVENUE_TREND.map(t => ({
        ...t,
        intake: t.intakeNGN + (t.intakeUSD * 1500), // Simple blended for 'All' view if needed, or just separate lines
        achieved: t.achievedNGN + (t.achievedUSD * 1500)
      }));
    }
    return MOCK_REVENUE_TREND.map(t => ({
      month: t.month,
      intake: currencyFilter === 'NGN' ? t.intakeNGN : t.intakeUSD,
      achieved: currencyFilter === 'NGN' ? t.achievedNGN : t.achievedUSD,
    }));
  }, [currencyFilter]);

  // Row 2 Right: Portfolio Health (Donut)
  const healthData = useMemo(() => {
    const states: ProjectState[] = ['Active', 'Delayed', 'Suspended', 'Ready for Billing', 'Billed', 'Closed'];
    return states.map(s => ({
      name: s,
      value: projects.filter(p => p.state === s).length
    }));
  }, [projects]);

  const stateColors: Record<ProjectState, string> = {
    'Active': '#14b8a6', // teal-500
    'Delayed': '#f59e0b', // amber-500
    'Suspended': '#94a3b8', // slate-400
    'Ready for Billing': '#3b82f6', // blue-500
    'Billed': '#10b981', // emerald-500
    'Closed': '#1e293b', // slate-800
  };

  // Row 3 Left: Revenue by Product Line
  const productLineRevenue = useMemo(() => {
    const plines: any[] = ['Bankone', 'Channels', 'Recova', 'Cluster'];
    return plines.map(pl => {
      const plProjects = projects.filter(p => p.productLines.includes(pl));
      const achieved = plProjects
        .filter(p => (p.state === 'Billed' || p.state === 'Closed') && (currencyFilter === 'All' || p.currency === currencyFilter))
        .reduce((acc, p) => acc + p.value, 0);
      const pending = plProjects
        .filter(p => (p.state !== 'Billed' && p.state !== 'Closed') && (currencyFilter === 'All' || p.currency === currencyFilter))
        .reduce((acc, p) => acc + p.value, 0);
      return { name: pl, achieved, pending };
    });
  }, [projects, currencyFilter]);

  // Row 3 Right: Projected Revenue Q1 2026
  const projectedRevenue = useMemo(() => {
    const activeStates: ProjectState[] = ['Active', 'Delayed', 'Ready for Billing'];
    const q1Projects = projects.filter(p => {
      if (!activeStates.includes(p.state)) return false;
      const signOff = p.milestones.find(m => m.name === 'Sign Off');
      if (!signOff) return false;
      const date = new Date(signOff.targetDate);
      return date >= new Date('2026-01-01') && date <= new Date('2026-03-31');
    });

    const ngn = q1Projects.filter(p => p.currency === 'NGN');
    const usd = q1Projects.filter(p => p.currency === 'USD');

    return {
      ngn: { val: ngn.reduce((acc, p) => acc + p.value, 0), count: ngn.length },
      usd: { val: usd.reduce((acc, p) => acc + p.value, 0), count: usd.length }
    };
  }, [projects]);

  // Row 4: Delivery Performance
  const deliveryMetrics = useMemo(() => {
    // Avg Completion Time (simplified)
    const closed = projects.filter(p => p.state === 'Closed');
    const avgDays = closed.length === 0 ? 0 : 75; // Mock for now

    // Milestone Adherence (simplified)
    const completedMilestones = projects.flatMap(p => p.milestones).filter(m => m.status === 'Completed');
    const onTime = completedMilestones.filter(m => m.completionDate && m.completionDate <= m.targetDate).length;
    const adherence = completedMilestones.length === 0 ? 0 : (onTime / completedMilestones.length) * 100;

    // Billing Velocity
    const velocity = 4; // Mock days

    // Stale Projects
    const stale = projects.filter(p => {
      const diff = (new Date().getTime() - new Date(p.updatedAt).getTime()) / (1000 * 3600 * 24);
      return diff >= staleThresholdDays;
    }).length;

    return { avgDays, adherence, velocity, stale };
  }, [projects, staleThresholdDays]);

  // Row 5: Priority Tier
  const priorityMetrics = useMemo(() => {
    const tiers: ProjectPriority[] = ['P1', 'P2', 'P3'];
    return tiers.map(t => {
      const activeProjects = projects.filter(p => p.priority === t && ['Active', 'Delayed', 'Suspended'].includes(p.state));
      const ngnVal = activeProjects.filter(p => p.currency === 'NGN').reduce((acc, p) => acc + p.value, 0);
      const usdVal = activeProjects.filter(p => p.currency === 'USD').reduce((acc, p) => acc + p.value, 0);
      return { tier: t, count: activeProjects.length, ngn: ngnVal, usd: usdVal };
    });
  }, [projects]);

  // Row 5: Team Utilisation
  const utilisation = useMemo(() => {
    // Mock Capacity Calculation
    // Total PMs could be the number of active PMs in MOCK_USERS
    const totalPMs = 3; 
    const thresholds = { P1: 3, P2: 10, P3: 50 }; // from config
    return {
      P1: { used: projects.filter(p => p.priority === 'P1' && ['Active', 'Delayed', 'Suspended'].includes(p.state)).length, max: totalPMs * thresholds.P1 },
      P2: { used: projects.filter(p => p.priority === 'P2' && ['Active', 'Delayed', 'Suspended'].includes(p.state)).length, max: totalPMs * thresholds.P2 },
      P3: { used: projects.filter(p => p.priority === 'P3' && ['Active', 'Delayed', 'Suspended'].includes(p.state)).length, max: totalPMs * thresholds.P3 },
    };
  }, [projects]);

  // Row 6: At-Risk Table
  const atRiskProjects = useMemo(() => {
    return projects
      .filter(p => p.state === 'Delayed')
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [projects]);

  const getDaysDelayed = (p: Project) => {
    const signOff = p.milestones.find(m => m.name === 'Sign Off');
    if (!signOff) return 0;
    const target = new Date(signOff.targetDate);
    if (target < now && signOff.status !== 'Completed') {
      return Math.floor((now.getTime() - target.getTime()) / (1000 * 3600 * 24));
    }
    return 0;
  };

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

      {/* Row 1: KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KPIBox 
          label="Total Portfolio Revenue" 
          ngn={kpiStats.total.NGN} 
          usd={kpiStats.total.USD} 
          subtitle="All contracted revenue"
        />
        <KPIBox 
          label="Achieved Revenue" 
          ngn={kpiStats.achieved.NGN} 
          usd={kpiStats.achieved.USD} 
          subtitle="Billed & closed"
          variant="green"
        />
        <KPIBox 
          label="At-Risk Revenue" 
          ngn={kpiStats.atRisk.NGN} 
          usd={kpiStats.atRisk.USD} 
          subtitle="Revenue in delayed projects"
          variant="red"
        />
        <KPIBox 
          label="Active Projects" 
          val={kpiStats.activeCount}
          subtitle="Currently in delivery"
          variant="teal"
          themeColor={themeColor}
        />
        <KPIBox 
          label="Delayed + Suspended" 
          val={kpiStats.attentionCount}
          subtitle="Needs attention"
          variant="amber"
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Trend */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-900">Revenue Performance — Last 12 Months</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intake vs Achieved</p>
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
                  name="Achieved Revenue"
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
                  {healthData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={stateColors[entry.name as ProjectState]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
              <span className="text-3xl font-black text-slate-900Leading-none">{projects.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Projects</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-y-2 mt-4">
            {healthData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{backgroundColor: stateColors[d.name as ProjectState]}} />
                <span className="text-[10px] font-bold text-slate-600 truncate">{d.name} ({Math.round(d.value / projects.length * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Product Line & Currency Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Line Bar Chart */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-900">Revenue by Product Line</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productLineRevenue} layout="vertical">
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 11, fontWeight: 700}} 
                  width={80}
                />
                <Tooltip 
                   cursor={{fill: '#f8fafc'}}
                   contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{paddingBottom: 10, fontSize: 10, fontWeight: 700}} />
                <Bar dataKey="achieved" fill="#14b8a6" radius={[0, 4, 4, 0]} name="Achieved" barSize={12} />
                <Bar dataKey="pending" fill="#99f6e4" radius={[0, 4, 4, 0]} name="Pending" barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Currency Table */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-teal-600" />
            <h2 className="text-lg font-black text-slate-900">Revenue by Currency</h2>
          </div>
          <div className="space-y-6">
            {(['NGN', 'USD'] as const).map(curr => {
              const intake = projects.filter(p => p.currency === curr).reduce((acc, p) => acc + p.value, 0);
              const achieved = projects.filter(p => p.currency === curr && (p.state === 'Billed' || p.state === 'Closed')).reduce((acc, p) => acc + p.value, 0);
              const pending = intake - achieved;
              return (
                <div key={curr} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black text-slate-600">{curr}</div>
                    <div className="h-px flex-1 bg-slate-100" />
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-xs">
                      <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Intake</p>
                      <p className="font-black text-slate-900">{formatCurrency(intake, curr)}</p>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <p className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Pending</p>
                      <p className="font-black text-slate-700">{formatCurrency(pending, curr)}</p>
                    </div>
                    <div className="flex justify-between items-center text-xs p-2 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="font-bold text-emerald-600 uppercase tracking-widest text-[9px]">Achieved</p>
                      <p className="font-black text-emerald-700">{formatCurrency(achieved, curr)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Projected Revenue */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 rounded-full -mr-16 -mt-16 opacity-50" />
          <div className="relative">
            <div className="mb-2">
              <h2 className="text-lg font-black text-slate-900 leading-tight">Projected Revenue — This Quarter</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Based on active project Sign Off dates</p>
            </div>
            <div className="mt-8 space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Q1 2026 Pipeline</p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xl font-black text-slate-900">{formatCurrency(projectedRevenue.ngn.val, 'NGN')}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Across {projectedRevenue.ngn.count} projects</p>
                  </div>
                  <div className="h-px bg-slate-200" />
                  <div>
                    <p className="text-xl font-black text-slate-900">{formatCurrency(projectedRevenue.usd.val, 'USD')}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Across {projectedRevenue.usd.count} projects</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: Delivery Performance scorecard */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="mb-8">
          <h2 className="text-lg font-black text-slate-900 tracking-tight">Delivery Performance</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">All time · Updated in real time</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
           <MetricItem 
            label="Avg Completion Time" 
            value={`${deliveryMetrics.avgDays} Days`} 
            status={deliveryMetrics.avgDays < 90 ? 'good' : deliveryMetrics.avgDays <= 120 ? 'warning' : 'critical'}
            thresholds="< 90d / 90-120d / 120d+"
          />
           <MetricItem 
            label="Milestone Adherence" 
            value={`${Math.round(deliveryMetrics.adherence)}%`} 
            status={deliveryMetrics.adherence > 80 ? 'good' : deliveryMetrics.adherence >= 60 ? 'warning' : 'critical'}
            thresholds="> 80% / 60-80% / < 60%"
          />
           <MetricItem 
            label="Billing Velocity" 
            value={`${deliveryMetrics.velocity} Days`} 
            status={deliveryMetrics.velocity < 5 ? 'good' : deliveryMetrics.velocity <= 10 ? 'warning' : 'critical'}
            thresholds="< 5d / 5-10d / 10d+"
          />
           <MetricItem 
            label="Stale Projects" 
            value={deliveryMetrics.stale.toString()} 
            status={deliveryMetrics.stale === 0 ? 'good' : deliveryMetrics.stale <= 3 ? 'warning' : 'critical'}
            thresholds="0 / 1-3 / 4+"
          />
        </div>
      </div>

      {/* Row 5: Priority & Capacity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Tier */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Active Projects by Priority</h2>
          </div>
          <div className="space-y-4">
            {priorityMetrics.map(p => {
              const maxCount = Math.max(...priorityMetrics.map(m => m.count));
              return (
                <div key={p.tier} className="group">
                  <div className="flex justify-between items-end mb-2">
                    <div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-widest",
                        p.tier === 'P1' ? "bg-red-50 text-red-600 border-red-100" :
                        p.tier === 'P2' ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-sky-50 text-sky-600 border-sky-100"
                      )}>
                        {p.tier} Tier
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">{p.count} Projects</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {currencyFilter === 'USD' ? formatCurrency(p.usd, 'USD') : formatCurrency(p.ngn, 'NGN')}
                      </p>
                    </div>
                  </div>
                  <div className="h-4 w-full bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000 group-hover:opacity-80",
                        p.tier === 'P1' ? "bg-red-500" : p.tier === 'P2' ? "bg-amber-500" : "bg-sky-500"
                      )} 
                      style={{ width: `${(p.count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PM Utilisation */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="mb-6 flex justify-between items-start">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Team Capacity Utilisation</h2>
            <Target className="w-5 h-5 text-slate-300" />
          </div>
          <div className="space-y-6">
            {(['P1', 'P2', 'P3'] as const).map(tier => {
              const { used, max } = utilisation[tier];
              const pct = Math.round((used / max) * 100);
              const statusColor = pct < 70 ? 'bg-emerald-500' : pct < 90 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={tier}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">{tier} Allocation</span>
                    <span className={cn("text-xs font-black", pct > 90 ? "text-red-600" : "text-slate-900")}>
                      {used} / {max} slots used ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all duration-1000", statusColor)}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-8 p-3 bg-blue-50 rounded-xl text-[10px] font-bold text-blue-600 border border-blue-100 flex items-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            BASED ON ACTIVE PMs × TIER THRESHOLDS
          </p>
        </div>
      </div>

      {/* Row 6: At-Risk Projects Table */}
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
          <table className="w-full text-left min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client / Project</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Priority</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">PM</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Value</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Days Delayed</th>
                <th className="px-4 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Milestone</th>
                <th className="px-6 pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Last Activity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {atRiskProjects.length > 0 ? atRiskProjects.map(p => {
                const delayed = getDaysDelayed(p);
                const currMilestone = p.milestones.find(m => m.status === 'In Progress') || p.milestones.find(m => m.status === 'Pending') || { name: 'N/A' };
                const pm = users.find(u => u.name === p.assignedPM);
                const isInactive = pm?.status === 'Inactive';

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
                      )}>{p.priority}</span>
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
                        delayed > 14 ? "text-red-600" : "text-amber-600"
                      )}>{delayed}d</span>
                    </td>
                    <td className="px-4 py-5">
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                         <span className="text-[11px] font-bold text-slate-600">{currMilestone.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right text-[11px] font-bold text-slate-400">
                      {p.updatedAt}
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={7} className="px-6 py-20 text-center">
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

const KPIBox = ({ label, ngn, usd, val, subtitle, variant = 'neutral', themeColor = 'teal' }: any) => {
  const theme = getThemeClasses(themeColor);
  const styles: any = {
    neutral: "bg-white border-slate-200 text-slate-900 icon-bg-slate-50 icon-text-slate-400",
    green: "bg-white border-emerald-100 text-slate-900 icon-bg-emerald-50 icon-text-emerald-500 border-b-4 border-b-emerald-500",
    red: "bg-white border-red-100 text-slate-900 icon-bg-red-50 icon-text-red-500 border-b-4 border-b-red-500",
    teal: `bg-white border-teal-100 text-slate-900 icon-bg-teal-50 icon-text-teal-600 border-b-4 border-b-teal-500`,
    amber: "bg-white border-amber-100 text-slate-900 icon-bg-amber-50 icon-text-amber-500 border-b-4 border-b-amber-500",
  };

  const IconMap: any = {
    neutral: Briefcase,
    green: Award,
    red: AlertTriangle,
    teal: Zap,
    amber: Clock
  };
  const Icon = IconMap[variant];

  return (
    <div className={cn("p-4 rounded-3xl border shadow-sm flex flex-col justify-between transition-all hover:shadow-md", styles[variant])}>
      <div className="flex justify-between items-start mb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">{label}</p>
        <Icon className="w-4 h-4 text-slate-300" />
      </div>
      <div>
        {val !== undefined ? (
          <p className="text-3xl font-black tracking-tighter">{val}</p>
        ) : (
          <div className="space-y-0.5">
            <p className="text-lg font-black leading-none">{formatCurrency(ngn, 'NGN')}</p>
            <p className="text-sm font-black text-slate-400">{formatCurrency(usd, 'USD')}</p>
          </div>
        )}
        <p className="text-[10px] font-bold text-slate-400 uppercase mt-2">{subtitle}</p>
      </div>
    </div>
  );
};

const MetricItem = ({ label, value, status, thresholds }: { label: string, value: string, status: 'good' | 'warning' | 'critical', thresholds: string }) => {
  const colors = {
    good: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    warning: "bg-amber-50 text-amber-600 ring-amber-100",
    critical: "bg-red-50 text-red-600 ring-red-100"
  };
  
  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-4">
        <div className={cn("px-4 py-2 rounded-2xl text-xl font-black ring-4", colors[status])}>
          {value}
        </div>
        <div>
          <div className="flex gap-1 mb-1">
            <div className={cn("w-2 h-2 rounded-full", status === 'good' ? "bg-emerald-500" : "bg-slate-200")} />
            <div className={cn("w-2 h-2 rounded-full", status === 'warning' ? "bg-amber-500" : "bg-slate-200")} />
            <div className={cn("w-2 h-2 rounded-full", status === 'critical' ? "bg-red-500" : "bg-slate-200")} />
          </div>
          <p className="text-[9px] font-black text-slate-400 uppercase">{thresholds}</p>
        </div>
      </div>
    </div>
  );
};
