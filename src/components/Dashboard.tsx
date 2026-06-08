import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LabelList, Label
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { Project, ProductLine, Role, AppConfig, User, ProjectState } from '../types';
import { cn, formatCurrency, formatCompactCurrency, calculateSPI } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { TrendingUp, Briefcase, Layers, Award, DollarSign, Activity, Clock, RefreshCw, ChevronRight } from 'lucide-react';
import { getThemeClasses } from '../lib/theme';
import { PMScorecard } from './PMScorecard';
import { SetupBanner } from './SetupBanner';

interface DashboardProps {
  projects: Project[];
  users: User[];
  workloadThresholds: Record<string, number>;
  currencies: any[];
  themeColor?: string;
  userRole?: Role;
  onReassignProject?: (project: Project) => void;
  config: AppConfig;
  onUpdateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  onNavigateToSettings: (tab: string) => void;
  onNavigateToProjects?: (stateFilter: ProjectState | 'All' | 'At-Risk') => void;
  loading?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ 
  projects, 
  users,
  workloadThresholds, 
  themeColor = 'teal', 
  userRole, 
  onReassignProject, 
  config,
  onUpdateConfig,
  onNavigateToSettings,
  onNavigateToProjects,
  loading = false
}) => {
  const theme = getThemeClasses(themeColor);
  const [chartCurrency, setChartCurrency] = useState<'NGN' | 'USD'>('NGN');

  // Revenue Stats Grouped by Currency
  const getGroupedRevenue = (filterFn: (p: Project) => boolean) => {
    const totals: Record<string, number> = {};
    projects.filter(filterFn).forEach(p => {
      totals[p.currency] = (totals[p.currency] || 0) + p.value;
    });
    return totals;
  };

  const intakeGroups = getGroupedRevenue(() => true);
  const pendingGroups = getGroupedRevenue(p => p.state !== 'Billed' && p.state !== 'Closed');
  const achievedGroups = getGroupedRevenue(p => p.state === 'Billed' || p.state === 'Closed');

  // ── Postgres RPC: server-side aggregation of project counts ──────────────
  // get_dashboard_metrics is a read-only PLPGSQL function (only SELECTs).
  // If it fails or is unavailable we fall back to client-side counts below.
  const { data: rpcMetrics } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard_metrics', {});
      if (error) {
        console.warn('[Dashboard] get_dashboard_metrics RPC unavailable, using client-side counts:', error.message);
        return null;
      }
      return data as {
        projectCounts: {
          total: number;
          onTrack: number;
          delayed: number;
          onHold: number;
          readyForBilling: number;
          billed: number;
          closed: number;
        };
        revenueStats: {
          total: Record<string, number>;
          recognized: Record<string, number>;
          atRisk: Record<string, number>;
        };
        schedulePerformance: { completionRate: number };
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — matches the projects query
    retry: 1,
  });

  // Client-side counts (used as fallback when RPC is unavailable)
  const activeCount = rpcMetrics?.projectCounts.onTrack ?? projects.filter(p => p.state === 'On-Track').length;
  const delayedCount = rpcMetrics?.projectCounts.delayed ?? projects.filter(p => p.state === 'Delayed').length;
  const suspendedCount = rpcMetrics?.projectCounts.onHold ?? projects.filter(p => p.state === 'Suspended').length;
  const closedCount = rpcMetrics?.projectCounts.closed ?? projects.filter(p => p.state === 'Closed').length;
  const atRiskCount = delayedCount + suspendedCount;
  
  // Priority Stats
  const p1Count = projects.filter(p => p.priority === 'P1' && p.state === 'On-Track').length;
  const p2Count = projects.filter(p => p.priority === 'P2' && p.state === 'On-Track').length;
  const p3Count = projects.filter(p => p.priority === 'P3' && p.state === 'On-Track').length;

  // Package Stats
  const packageData = React.useMemo(() => {
    const pkgMap = new Map<string, { count: number, revenue: number }>();
    projects.forEach(p => {
      if (p.currency !== chartCurrency) return;
      
      const pkg = p.packageName || 'Unknown Package';
      if (!pkgMap.has(pkg)) pkgMap.set(pkg, { count: 0, revenue: 0 });
      const stats = pkgMap.get(pkg)!;
      stats.count += 1;
      stats.revenue += p.value;
    });
    const revenues = Array.from(pkgMap.values()).map(v => v.revenue);
    const maxRev = Math.max(...revenues, 1);
    
    const result = Array.from(pkgMap.entries())
      .map(([name, stats]) => {
        // Restore robust clamped linear scaling (0-100)
        // Ensure any package with revenue has at least 5% width so it's visible
        const visualValue = stats.revenue > 0 
          ? Math.max(5, (stats.revenue / maxRev) * 100) 
          : 0;
        return { name, ...stats, visualValue };
      })
      .sort((a, b) => b.revenue - a.revenue);
    return result;
  }, [projects, chartCurrency]);

  // Performance Stats (Simplified for POC)
  const pmStats = Array.from(new Set(projects.map(p => p.assignedPM))).map(pm => {
    const pmProjects = projects.filter(p => p.assignedPM === pm);
    const activeProjects = pmProjects.filter(p => ['On-Track', 'Delayed', 'Suspended', 'Signed Off'].includes(p.state));
    const workload = {
      P1: activeProjects.filter(p => p.priority === 'P1').length,
      P2: activeProjects.filter(p => p.priority === 'P2').length,
      P3: activeProjects.filter(p => p.priority === 'P3').length,
    };
    const completed = pmProjects.filter(p => p.state === 'Closed').length;
    const score = pmProjects.reduce((acc, p) => acc + (p.state === 'Closed' ? 2.5 : 0.5), 0);
    return { name: pm, projects: pmProjects.length, completed, score, workload };
  });

  // Color mapping for Recharts
  const themeHexMap: Record<string, string> = {
    indigo: '#6366f1',
    teal: '#14b8a6',
    emerald: '#10b981',
    rose: '#f43f5e',
    amber: '#f59e0b',
    sky: '#0ea5e9',
    violet: '#8b5cf6',
    orange: '#f97316',
    pink: '#ec4899',
    slate: '#64748b',
  };

  const themeHex = themeHexMap[themeColor] || themeHexMap.teal;

  return (
    <div className="space-y-6 lg:space-y-8 p-6 lg:p-8">
      <SetupBanner 
        config={config} 
        userRole={userRole!} 
        onUpdateConfig={onUpdateConfig}
        onNavigateToSettings={onNavigateToSettings}
        themeColor={themeColor}
      />

      {loading && (
        <div className="flex items-center gap-2 px-1 text-slate-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Synchronizing latest project data...</span>
        </div>
      )}

      {/* Revenue Panel */}
      <section id="revenue">
        <div className="flex items-center gap-2 mb-5">
          <DollarSign className={cn("w-5 h-5", theme.text)} />
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Revenue Overview</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8">
          <StatCard label="Total Intake" values={intakeGroups} subValue="All time revenue" icon={<TrendingUp className="w-4 h-4" />} themeColor={themeColor} />
          <StatCard 
            label="On-Track Priorities" 
            value={`${p1Count} / ${p2Count} / ${p3Count}`} 
            subValue="Enterprise / Pro / Basic On-Track" 
            icon={<Activity className="w-4 h-4" />} 
            color="emerald" 
            themeColor={themeColor} 
          />
          <StatCard label="Total Achieved" values={achievedGroups} subValue="Billed & Closed" icon={<Award className="w-4 h-4" />} color="emerald" themeColor={themeColor} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Projects Panel */}
        <div className="glass-card p-6 rounded-[20px] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Activity className={cn("w-5 h-5", theme.text)} />
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Project Status</h2>
            </div>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'On-Track', value: activeCount },
                      { name: 'Delayed', value: delayedCount },
                      { name: 'Suspended', value: suspendedCount },
                      { name: 'Signed Off', value: projects.filter(p => p.state === 'Signed Off').length },
                      { name: 'Billed', value: projects.filter(p => p.state === 'Billed').length },
                      { name: 'Closed', value: closedCount },
                    ]}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      '#10b981', // On-Track - Emerald
                      '#ef4444', // Delayed - Red
                      '#1e293b', // Suspended - Slate
                      '#f59e0b', // Signed Off - Amber
                      '#3b82f6', // Billed - Blue
                      '#94a3b8', // Closed - Blue-grey
                    ].map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                    <Label 
                      value={`${projects.length}`} 
                      position="center" 
                      fill="#0f172a"
                      style={{ fontSize: '22px', fontWeight: '800', fontFamily: 'var(--font-sans)' }}
                    />
                  </Pie>
                  <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 shadow-[inset_0_2px_4px_rgba(0,0,0,0.01)]">
              <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total Projects</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-1">{projects.length}</p>
            </div>
            <div 
              onClick={() => onNavigateToProjects?.('At-Risk')}
              className="p-4 bg-red-50/50 rounded-2xl border border-red-100/80 cursor-pointer hover:bg-red-50 hover:border-red-200 transition-all duration-300 flex items-center justify-between group"
            >
              <div>
                <p className="text-xs text-red-500 uppercase font-semibold tracking-wider">At Risk</p>
                <p className="text-3xl font-extrabold text-red-600 mt-1">{atRiskCount}</p>
              </div>
              <span className="text-[10px] font-bold text-red-600 flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                View <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>

        {/* Package Panel */}
        <div className="glass-card p-6 rounded-[20px] shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6 shrink-0 gap-4">
              <div className="flex items-center gap-2">
                <Layers className={cn("w-5 h-5", theme.text)} />
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Package Distribution</h2>
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setChartCurrency('NGN')}
                  className={cn("px-2.5 py-1 text-[10px] font-bold tracking-wider rounded transition-all", chartCurrency === 'NGN' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  NGN
                </button>
                <button 
                  onClick={() => setChartCurrency('USD')}
                  className={cn("px-2.5 py-1 text-[10px] font-bold tracking-wider rounded transition-all", chartCurrency === 'USD' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
                >
                  USD
                </button>
              </div>
            </div>
            <div className="h-[250px] overflow-y-auto pr-2 custom-scrollbar border-y border-slate-50 relative">
              <div style={{ height: `${Math.max(100, packageData.length * 45)}px`, minHeight: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  {packageData.length > 0 ? (
                    <BarChart data={packageData} layout="vertical" margin={{ left: 10, right: 30, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{fill: '#64748b', fontSize: 10, fontWeight: 700}} 
                        width={150}
                      />
                      <Tooltip 
                        cursor={{fill: '#f8fafc'}}
                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold'}}
                        formatter={(value: number, name: string, props: any) => [
                          `${chartCurrency === 'NGN' ? '₦' : '$'}${props.payload.revenue.toLocaleString()} (${props.payload.count} Projects)`, 
                          'Revenue'
                        ]}
                      />
                      <Bar dataKey="visualValue" fill={themeHex} radius={[0, 4, 4, 0]} barSize={16}>
                        <LabelList 
                          dataKey="count" 
                          position="right" 
                          content={(props: any) => (
                             <text x={props.x + 8} y={props.y + 12} fill="#64748b" style={{ fontSize: '10px', fontWeight: 'bold' }}>
                               {props.value} P
                             </text>
                          )}
                        />
                      </Bar>
                    </BarChart>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                       <p className="text-xs font-bold text-slate-400 italic">No {chartCurrency} intake logged for active packages.</p>
                    </div>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <p className="mt-4 text-xs font-medium text-slate-400 text-center italic shrink-0">Revenue contribution per package</p>
        </div>
      </div>

      {/* Performance Panel */}
      <section id="performance">
        <PMScorecard 
          projects={projects}
          users={users}
          config={config}
          userRole={userRole!}
          themeColor={themeColor}
          onSelectProject={onReassignProject}
        />
      </section>
    </div>
  );
};

const StatCard = ({ label, value, values, subValue, icon, color = 'theme', themeColor = 'teal' }: any) => {
  const theme = getThemeClasses(themeColor);
  
  const colors: any = {
    theme: `${theme.lightBg} ${theme.lightText} ${theme.lightBorder}`,
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="glass-card glass-card-hover p-6 rounded-[20px] cursor-default flex flex-col justify-between h-full group">
      <div>
        <div className="flex justify-between items-start mb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
          <div className={cn("p-2.5 rounded-xl border transition-all duration-300 group-hover:scale-105", colors[color])}>
            {icon}
          </div>
        </div>
        <div className="space-y-1.5 mt-1">
          {values ? (
            <div className="flex flex-col gap-1">
              {Object.entries(values).map(([code, amount]: any) => (
                <p 
                  key={code} 
                  title={`${code === 'NGN' ? 'Revenue in Naira: ' : code === 'USD' ? 'Revenue in Dollars: ' : ''}${formatCurrency(amount, code)}`}
                  className={cn(
                    "font-extrabold tracking-tight text-slate-900 leading-none cursor-help",
                    Object.keys(values).length > 1 ? "text-xl first:text-2xl" : "text-3xl"
                  )}
                >
                  {formatCompactCurrency(amount, code)}
                </p>
              ))}
              {Object.keys(values).length === 0 && <p className="text-3xl font-extrabold text-slate-900">-</p>}
            </div>
          ) : (
            <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
          )}
        </div>
      </div>
      <div className="text-[11px] font-semibold text-slate-400 mt-4 pt-3 border-t border-slate-100/60 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", color === 'emerald' ? "bg-emerald-400" : theme.bg)}></span>
          <span className={cn("relative inline-flex rounded-full h-2 w-2", color === 'emerald' ? "bg-emerald-500" : theme.bg)}></span>
        </span>
        {subValue}
      </div>
    </div>
  );
};

const PMReassignButton = ({ pmName, pmProjects, onSelectProject, theme }: { pmName: string, pmProjects: Project[], onSelectProject: (p: Project) => void, theme: any }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn("p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors", isOpen && "bg-slate-100 text-slate-600")}
        title="Reassign projects from this PM"
      >
        <RefreshCw className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[50]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reassign from {pmName}</p>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {pmProjects.length > 0 ? pmProjects.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    onSelectProject(p);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 group"
                >
                  <p className="text-sm font-bold text-slate-900 group-hover:text-teal-600 transition-colors">{p.clientName}</p>
                  <p className="text-[10px] text-slate-500">{p.packageName}</p>
                </button>
              )) : (
                <div className="px-4 py-6 text-center text-xs text-slate-400 italic">
                  No active projects to reassign
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const WorkloadBar = ({ label, current, max, color }: { label: string, current: number, max: number, color: string }) => {
  const percentage = Math.min((current / max) * 100, 100);
  const isOver = current > max;

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] items-center">
        <span className="font-bold text-slate-500">{label}</span>
        <span className={cn("font-medium", isOver ? "text-red-600" : "text-slate-400")}>
          {current}/{max}
        </span>
      </div>
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-red-600" : color)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

