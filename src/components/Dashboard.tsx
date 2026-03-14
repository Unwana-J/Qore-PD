import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { Project, ProductLine } from '../types';
import { formatCurrency } from '../lib/utils';
import { TrendingUp, Briefcase, Layers, Award, DollarSign, Activity, Clock } from 'lucide-react';
import { getThemeClasses } from '../lib/theme';

interface DashboardProps {
  projects: Project[];
  themeColor?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ projects, themeColor = 'teal' }) => {
  const theme = getThemeClasses(themeColor);

  // Revenue Stats
  const totalIntake = projects.reduce((acc, p) => acc + p.value, 0);
  const totalPending = projects
    .filter(p => p.state !== 'Billed' && p.state !== 'Closed')
    .reduce((acc, p) => acc + p.value, 0);
  const totalAchieved = projects
    .filter(p => p.state === 'Billed' || p.state === 'Closed')
    .reduce((acc, p) => acc + p.value, 0);

  // Project Stats
  const activeCount = projects.filter(p => p.state === 'Active').length;
  const delayedCount = projects.filter(p => p.state === 'Delayed').length;
  const suspendedCount = projects.filter(p => p.state === 'Suspended').length;
  const closedCount = projects.filter(p => p.state === 'Closed').length;
  const atRiskCount = delayedCount + suspendedCount;

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
    const completed = pmProjects.filter(p => p.state === 'Closed').length;
    // Mock weighted score calculation
    const score = pmProjects.reduce((acc, p) => acc + (p.state === 'Closed' ? 2.5 : 0.5), 0);
    return { name: pm, projects: pmProjects.length, completed, score };
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard label="Total Intake" value={formatCurrency(totalIntake)} subValue="All time revenue" icon={<TrendingUp className="w-4 h-4" />} themeColor={themeColor} />
          <StatCard label="Total Pending" value={formatCurrency(totalPending)} subValue="Work in progress" icon={<Briefcase className="w-4 h-4" />} color="amber" themeColor={themeColor} />
          <StatCard label="Total Achieved" value={formatCurrency(totalAchieved)} subValue="Billed & Closed" icon={<Award className="w-4 h-4" />} color="emerald" themeColor={themeColor} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projects Panel */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Activity className={cn("w-5 h-5", theme.text)} />
            <h2 className="text-lg font-semibold text-slate-900">Project Status</h2>
          </div>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: activeCount },
                    { name: 'Delayed', value: delayedCount },
                    { name: 'Suspended', value: suspendedCount },
                    { name: 'Closed', value: closedCount },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {[
                    themeHex,
                    '#f59e0b', // Amber for Delayed
                    '#64748b', // Slate for Suspended
                    '#10b981', // Emerald for Closed
                  ].map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
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
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Award className={cn("w-5 h-5", theme.text)} />
            <h2 className="text-lg font-semibold text-slate-900">PM Performance Scorecard</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Project Manager</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Total Projects</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Completed</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Weighted Score</th>
                  <th className="pb-3 text-sm font-semibold text-slate-500 uppercase tracking-wider">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {pmStats.map((stat, i) => (
                  <tr key={i} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4 font-medium text-slate-900">{stat.name}</td>
                    <td className="py-4 text-slate-600">{stat.projects}</td>
                    <td className="py-4 text-slate-600">{stat.completed}</td>
                    <td className={cn("py-4 font-bold", theme.text)}>{stat.score.toFixed(1)}</td>
                    <td className="py-4">
                      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full", theme.bg)} 
                          style={{ width: `${(stat.completed / stat.projects) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

const StatCard = ({ label, value, subValue, icon, color = 'theme', themeColor = 'teal' }: any) => {
  const theme = getThemeClasses(themeColor);
  
  const colors: any = {
    theme: `${theme.lightBg} ${theme.lightText} ${theme.lightBorder}`,
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={cn("p-2 rounded-lg border", colors[color])}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{subValue}</p>
    </div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
