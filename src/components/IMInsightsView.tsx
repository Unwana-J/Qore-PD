import React, { useState, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, Legend, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, Activity, Clock, Users, Package, 
  ChevronDown, Calendar, Filter, Award, AlertTriangle, CheckCircle2, Layers
} from 'lucide-react';
import { ServiceExtension, User, AppConfig } from '../types';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface IMInsightsViewProps {
  extensions: ServiceExtension[];
  users: User[];
  config: AppConfig;
}

const PRODUCT_WEIGHTS: Record<string, number> = {
  'USSD': 2,
  'Transfers': 3,
  'Mobile/Internet Banking': 4,
  'Commercial Bank Cards': 4,
  'ASPFEP Suite': 5,
  'API Projects': 3,
};

export const IMInsightsView: React.FC<IMInsightsViewProps> = ({ extensions, users, config }) => {
  const [selectedQuarter, setSelectedQuarter] = useState<number | 'All'>('All');
  const [selectedMonth, setSelectedMonth] = useState<number | 'All'>('All');
  const theme = getThemeClasses(config.brand.themeColor);

  const quarters = [
    { label: 'All Quarters', value: 'All' },
    { label: 'Q1 (Jan-Mar)', value: 1 },
    { label: 'Q2 (Apr-Jun)', value: 2 },
    { label: 'Q3 (Jul-Sep)', value: 3 },
    { label: 'Q4 (Oct-Dec)', value: 4 },
  ];

  const months = [
    { label: 'All Months', value: 'All' },
    { label: 'January', value: 0 },
    { label: 'February', value: 1 },
    { label: 'March', value: 2 },
    { label: 'April', value: 3 },
    { label: 'May', value: 4 },
    { label: 'June', value: 5 },
    { label: 'July', value: 6 },
    { label: 'August', value: 7 },
    { label: 'September', value: 8 },
    { label: 'October', value: 9 },
    { label: 'November', value: 10 },
    { label: 'December', value: 11 },
  ];

  // 1. Filter Data
  const filteredData = useMemo(() => {
    return extensions.filter(ext => {
      const date = new Date(ext.startDate);
      const month = date.getMonth();
      const quarter = Math.floor(month / 3) + 1;

      if (selectedQuarter !== 'All' && quarter !== selectedQuarter) return false;
      if (selectedMonth !== 'All' && month !== selectedMonth) return false;
      return true;
    });
  }, [extensions, selectedQuarter, selectedMonth]);

  // 2. Product Metrics
  const productMetrics = useMemo(() => {
    const metrics: Record<string, { total: number, active: number, suspended: number, completed: number }> = {};
    
    filteredData.forEach(ext => {
      const name = ext.serviceName;
      if (!metrics[name]) metrics[name] = { total: 0, active: 0, suspended: 0, completed: 0 };
      
      metrics[name].total++;
      if (ext.status === 'Completed') metrics[name].completed++;
      else if (ext.status === 'Frozen') metrics[name].suspended++;
      else metrics[name].active++;
    });

    return metrics;
  }, [filteredData]);

  // 3. Team Metrics
  const ims = useMemo(() => users.filter(u => u.role === 'IM' || u.role === 'IM Lead'), [users]);
  
  const teamMetrics = useMemo(() => {
    const metrics: Record<string, { total: number, active: number, suspended: number, completed: number }> = {};
    
    ims.forEach(im => {
      metrics[im.name] = { total: 0, active: 0, suspended: 0, completed: 0 };
    });

    filteredData.forEach(ext => {
      if (metrics[ext.implementationManager]) {
        metrics[ext.implementationManager].total++;
        if (ext.status === 'Completed') metrics[ext.implementationManager].completed++;
        else if (ext.status === 'Frozen') metrics[ext.implementationManager].suspended++;
        else metrics[ext.implementationManager].active++;
      }
    });

    return metrics;
  }, [filteredData, ims]);

  // 4. KPI Calculations
  const kpis = useMemo(() => {
    const total = filteredData.length;
    const completed = filteredData.filter(e => e.status === 'Completed').length;
    const suspended = filteredData.filter(e => e.status === 'Frozen').length;
    const active = total - completed - suspended;

    const completionRate = total - suspended > 0 ? (completed / (total - suspended)) * 100 : 0;
    const activeRate = total > 0 ? (active / total) * 100 : 0;
    const suspensionRate = total > 0 ? (suspended / total) * 100 : 0;
    const avgPerIM = ims.length > 0 ? total / ims.length : 0;

    const getRating = (rate: number) => {
      if (rate >= 85) return { label: 'Excellent', color: 'text-emerald-600 bg-emerald-50' };
      if (rate >= 70) return { label: 'Good', color: 'text-blue-600 bg-blue-50' };
      if (rate >= 50) return { label: 'Fair', color: 'text-amber-600 bg-amber-50' };
      return { label: 'Underperforming', color: 'text-red-600 bg-red-50' };
    };

    return {
      total,
      completed,
      suspended,
      active,
      completionRate,
      activeRate,
      suspensionRate,
      avgPerIM,
      rating: getRating(completionRate)
    };
  }, [filteredData, ims]);

  // 5. Monthly Trends
  const monthlyTrends = useMemo(() => {
    const data: any[] = months.slice(1).map(m => ({
      name: m.label.substring(0, 3),
      started: 0,
      completed: 0,
      suspended: 0,
    }));

    extensions.forEach(ext => {
      const startMonth = new Date(ext.startDate).getMonth();
      data[startMonth].started++;
      
      if (ext.status === 'Completed') {
        // Assume completed in the same month if no completion date, or check milestones
        // For simplicity, we use the updatedAt month if completed
        const compMonth = new Date(ext.updatedAt || ext.startDate).getMonth();
        data[compMonth].completed++;
      }
      if (ext.status === 'Frozen') {
        const suspMonth = new Date(ext.updatedAt || ext.startDate).getMonth();
        data[suspMonth].suspended++;
      }
    });

    return data.map(d => ({
      ...d,
      rate: d.started > 0 ? (d.completed / d.started) * 100 : 0
    }));
  }, [extensions]);

  // 6. Weighted Performance
  const weightedPerformance = useMemo(() => {
    return ims.map(im => {
      const imExtensions = filteredData.filter(e => e.implementationManager === im.name);
      let totalWeight = 0;
      let weightedCompletion = 0;

      Object.entries(PRODUCT_WEIGHTS).forEach(([product, weight]) => {
        const productExtensions = imExtensions.filter(e => e.serviceName.includes(product));
        if (productExtensions.length > 0) {
          const completed = productExtensions.filter(e => e.status === 'Completed').length;
          const compRate = completed / productExtensions.length;
          weightedCompletion += compRate * weight;
          totalWeight += weight;
        }
      });

      const score = totalWeight > 0 ? weightedCompletion / totalWeight : 0;
      return {
        name: im.name,
        score,
        totalAssigned: imExtensions.length
      };
    }).sort((a, b) => b.score - a.score);
  }, [filteredData, ims]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Filters Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-2xl", theme.lightBg)}>
            <Filter className={cn("w-6 h-6", theme.text)} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Operational Filters</h3>
            <p className="text-xs font-bold text-slate-500">Slice performance data by reporting period.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Quarter</label>
            <select 
              value={selectedQuarter}
              onChange={e => setSelectedQuarter(e.target.value === 'All' ? 'All' : Number(e.target.value))}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 transition-all"
            >
              {quarters.map(q => <option key={q.value} value={q.value}>{q.label}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Month</label>
            <select 
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value === 'All' ? 'All' : Number(e.target.value))}
              className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-teal-500/10 transition-all"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard label="Completion Rate" value={`${kpis.completionRate.toFixed(1)}%`} rating={kpis.rating} icon={<CheckCircle2 />} color="emerald" />
        <KPICard label="Active Rate" value={`${kpis.activeRate.toFixed(1)}%`} subtext={`${kpis.active} projects active`} icon={<Activity />} color="blue" />
        <KPICard label="Suspension Rate" value={`${kpis.suspensionRate.toFixed(1)}%`} subtext={`${kpis.suspended} projects frozen`} icon={<AlertTriangle />} color="amber" />
        <KPICard label="Avg Projects / IM" value={kpis.avgPerIM.toFixed(1)} subtext={`Across ${ims.length} managers`} icon={<Users />} color="slate" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Product Metrics Table */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Package className="w-5 h-5 text-teal-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Product Performance</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product Line</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Active</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Susp.</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Comp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(Object.entries(productMetrics) as [string, any][]).map(([name, m]) => (
                  <tr key={name} className="group">
                    <td className="py-3 text-sm font-bold text-slate-700">{name}</td>
                    <td className="py-3 text-sm font-black text-slate-900 text-center">{m.total}</td>
                    <td className="py-3 text-sm font-bold text-blue-600 text-center">{m.active}</td>
                    <td className="py-3 text-sm font-bold text-amber-600 text-center">{m.suspended}</td>
                    <td className="py-3 text-sm font-bold text-emerald-600 text-center">{m.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Team Workload Table */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">IM Workload Breakdown</h3>
          </div>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Implementation Manager</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Active</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Susp.</th>
                  <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Comp.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {(Object.entries(teamMetrics) as [string, any][]).map(([name, m]) => (
                  <tr key={name} className="group">
                    <td className="py-3 text-sm font-bold text-slate-700">{name}</td>
                    <td className="py-3 text-sm font-black text-slate-900 text-center">{m.total}</td>
                    <td className="py-3 text-sm font-bold text-blue-600 text-center">{m.active}</td>
                    <td className="py-3 text-sm font-bold text-amber-600 text-center">{m.suspended}</td>
                    <td className="py-3 text-sm font-bold text-emerald-600 text-center">{m.completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Volume Distribution Grid */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 mb-6">
          <Layers className="w-5 h-5 text-sky-600" />
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">IM Volume Distribution by Product</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Implementation Manager</th>
                {Object.keys(PRODUCT_WEIGHTS).map(prod => (
                  <th key={prod} className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{prod}</th>
                ))}
                <th className="pb-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center bg-slate-50/50">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ims.map(im => {
                const imExtensions = filteredData.filter(e => e.implementationManager === im.name);
                return (
                  <tr key={im.id} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="py-3 text-sm font-bold text-slate-700">{im.name}</td>
                    {Object.keys(PRODUCT_WEIGHTS).map(prod => {
                      const count = imExtensions.filter(e => e.serviceName.includes(prod)).length;
                      return (
                        <td key={prod} className={cn("py-3 text-sm font-bold text-center", count > 0 ? "text-slate-900" : "text-slate-300")}>
                          {count}
                        </td>
                      );
                    })}
                    <td className="py-3 text-sm font-black text-slate-900 text-center bg-slate-50/50">
                      {imExtensions.length}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Monthly Trend Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-teal-600" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Execution Trends</h3>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-slate-200" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Started</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Completed</span>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyTrends}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}}
                />
                <Bar dataKey="started" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weighted Score Leaderboard */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Award className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Performance Score</h3>
          </div>
          <div className="space-y-4">
            {weightedPerformance.map((entry, idx) => (
              <div key={entry.name} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-black text-slate-400">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{entry.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.totalAssigned} Projects</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-black text-slate-900 leading-none">{(entry.score * 100).toFixed(1)}%</p>
                  <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-1">Weighted Score</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100">
            <p className="text-[10px] font-bold text-amber-700 leading-relaxed italic">
              * Score is weighted by product complexity: USSD(2), API(3), Transfers(3), Mobile(4), Cards(4), ASPFEP(5).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const KPICard = ({ label, value, subtext, rating, icon, color }: any) => {
  const colors: any = {
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    blue: 'text-blue-600 bg-blue-50 border-blue-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
    slate: 'text-slate-600 bg-slate-50 border-slate-100',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
        <div className={cn("p-2 rounded-xl border", colors[color])}>
          {React.cloneElement(icon, { className: 'w-4 h-4' })}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
        {rating && (
          <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider", rating.color)}>
            {rating.label}
          </span>
        )}
      </div>
      {subtext && <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{subtext}</p>}
    </div>
  );
};
