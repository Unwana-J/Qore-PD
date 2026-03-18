import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Project, ProductLine, Role, AppConfig } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { TrendingUp, Briefcase, Layers, Award, DollarSign, Activity, Clock, RefreshCw } from 'lucide-react';
import { getThemeClasses } from '../lib/theme';
import { PMScorecard } from './PMScorecard';

interface DashboardProps {
  projects: Project[];
  workloadThresholds: Record<string, number>;
  currencies: any[];
  themeColor?: string;
  userRole?: Role;
  onReassignProject?: (project: Project) => void;
  config: AppConfig;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, workloadThresholds, themeColor = 'teal', userRole, onReassignProject, config }) => {
  const theme = getThemeClasses(themeColor);

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

  // Project Stats
  const activeCount = projects.filter(p => p.state === 'Active').length;
  const delayedCount = projects.filter(p => p.state === 'Delayed').length;
  const suspendedCount = projects.filter(p => p.state === 'Suspended').length;
  const closedCount = projects.filter(p => p.state === 'Closed').length;
  const atRiskCount = delayedCount + suspendedCount;
  
  // Priority Stats
  const p1Count = projects.filter(p => p.priority === 'P1' && ['Active', 'Delayed', 'Suspended'].includes(p.state)).length;
  const p2Count = projects.filter(p => p.priority === 'P2' && ['Active', 'Delayed', 'Suspended'].includes(p.state)).length;
  const p3Count = projects.filter(p => p.priority === 'P3' && ['Active', 'Delayed', 'Suspended'].includes(p.state)).length;

  // Product Line Stats
  const productLineData = (['Bankone', 'Channels', 'Recova', 'Cluster'] as ProductLine[]).map(pl => {
    const plProjects = projects.filter(p => p.productLines.includes(pl));
    return {
      name: pl,
      count: plProjects.length,
      revenue: plProjects.reduce((acc, p) => acc + p.value, 0)
    };
  });

  // Performance Stats (Simplified for POC)
  const pmStats = Array.from(new Set(projects.map(p => p.assignedPM))).map(pm => {
    const pmProjects = projects.filter(p => p.assignedPM === pm);
    const activeProjects = pmProjects.filter(p => ['Active', 'Delayed', 'Suspended', 'Signed Off'].includes(p.state));
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
    <div className="space-y-6 p-6">
      {/* Revenue Panel */}
      <section id="revenue">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className={cn("w-5 h-5", theme.text)} />
          <h2 className="text-xl font-semibold text-slate-900">Revenue Overview</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
          <StatCard label="Total Intake" values={intakeGroups} subValue="All time revenue" icon={<TrendingUp className="w-4 h-4" />} themeColor={themeColor} />
          <StatCard 
            label="Active Priorities" 
            value={`${p1Count} / ${p2Count} / ${p3Count}`} 
            subValue="P1 / P2 / P3 Active" 
            icon={<Activity className="w-4 h-4" />} 
            color="theme" 
            themeColor={themeColor} 
          />
          <StatCard label="Total Achieved" values={achievedGroups} subValue="Billed & Closed" icon={<Award className="w-4 h-4" />} color="emerald" themeColor={themeColor} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Activity className={cn("w-5 h-5", theme.text)} />
            <h2 className="text-lg font-semibold text-slate-900">Project Status</h2>
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: activeCount },
                    { name: 'Delayed', value: delayedCount },
                    { name: 'Suspended', value: suspendedCount },
                    { name: 'Closed', value: closedCount },
                  ]}
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    '#3b82f6', // Active - Blue
                    '#ef4444', // Delayed - Red
                    '#0f172a', // Suspended - Slate
                    '#10b981', // Closed - Emerald
                  ].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Projects</p>
              <p className="text-2xl font-bold text-slate-900">{projects.length}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-xs text-red-500 uppercase font-semibold">At Risk</p>
              <p className="text-2xl font-bold text-red-600">{atRiskCount}</p>
            </div>
          </div>
        </div>

        {/* Product Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Layers className={cn("w-5 h-5", theme.text)} />
            <h2 className="text-lg font-semibold text-slate-900">Product Line Distribution</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productLineData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="revenue" fill={themeHex} radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-4 text-sm text-slate-500 text-center italic">Revenue contribution per product line</p>
        </div>
      </div>

      {/* Performance Panel */}
      <section id="performance">
        <PMScorecard 
          projects={projects}
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
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-300 group cursor-default">
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{label}</p>
        <div className={cn("p-2 rounded-xl border transition-colors group-hover:scale-110", colors[color])}>
          {icon}
        </div>
      </div>
      <div className="space-y-1 mt-1">
        {values ? (
          <div className="flex flex-col">
            {Object.entries(values).map(([code, amount]: any, idx) => (
              <p key={code} className={cn(
                "font-black tracking-tighter text-slate-900 leading-none",
                Object.keys(values).length > 1 ? "text-lg first:text-xl" : "text-3xl"
              )}>
                {formatCurrency(amount, code)}
              </p>
            ))}
            {Object.keys(values).length === 0 && <p className="text-3xl font-black text-slate-900">-</p>}
          </div>
        ) : (
          <p className="text-3xl font-black text-slate-900 tracking-tighter">{value}</p>
        )}
      </div>
      <p className="text-[11px] font-bold text-slate-500 mt-3 flex items-center gap-1">
        <div className={cn("w-1.5 h-1.5 rounded-full", color === 'emerald' ? "bg-emerald-500" : theme.bg)} />
        {subValue}
      </p>
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

