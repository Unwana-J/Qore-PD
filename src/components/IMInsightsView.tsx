import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts';
import { TrendingUp, Activity, Users, Package, Filter, Award, AlertTriangle, CheckCircle2, Layers, Clock, Link, HelpCircle } from 'lucide-react';
import { ServiceExtension, User, AppConfig } from '../types';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface IMInsightsViewProps { 
  extensions: ServiceExtension[]; 
  users: User[]; 
  config: AppConfig; 
  onFilter?: (status: string, manager?: string) => void;
  onManage?: (projectId: string) => void;
}

// Product Weights moved to dynamic config
const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const rating = (r: number, inv=false) => {
  const v = inv ? 100-r : r;
  if(v>=85) return {l:'Excellent', c:'text-emerald-700 bg-emerald-50 border-emerald-200'};
  if(v>=70) return {l:'Good', c:'text-blue-700 bg-blue-50 border-blue-200'};
  if(v>=50) return {l:'Fair', c:'text-amber-700 bg-amber-50 border-amber-200'};
  return {l:'Under', c:'text-red-700 bg-red-50 border-red-200'};
};

const KPI = ({label,value,sub,rate,inv,icon,color,onClick}:any) => {
  const r = rate!=null ? rating(rate,inv) : null;
  const cs:any = {emerald:'text-emerald-600 bg-emerald-50',blue:'text-blue-600 bg-blue-50',amber:'text-amber-600 bg-amber-50',slate:'text-slate-600 bg-slate-50',red:'text-red-600 bg-red-50',teal:'text-teal-600 bg-teal-50',indigo:'text-indigo-600 bg-indigo-50'};
  return (
    <div 
      onClick={onClick}
      className={cn(
        "bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group",
        onClick && "cursor-pointer hover:border-teal-300 active:scale-95"
      )}
    >
      <div className="flex justify-between items-start mb-3">
        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{label}</p>
        <div className={cn("p-2 rounded-xl transition-colors",cs[color]||cs.slate, onClick && "group-hover:bg-teal-600 group-hover:text-white")}>
          {React.cloneElement(icon,{className:'w-4 h-4'})}
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <h4 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h4>
        {r && <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-md border uppercase tracking-wider",r.c)}>{r.l}</span>}
      </div>
      {sub && <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{sub}</p>}
    </div>
  );
};

export const IMInsightsView: React.FC<IMInsightsViewProps> = ({ extensions=[], users=[], config, onFilter, onManage }) => {
  const [yr, setYr] = useState<number|'All'>(new Date().getFullYear());
  const [mo, setMo] = useState<number|'All'>('All');
  const [q, setQ] = useState<number|'All'>('All');
  const [isCustom, setIsCustom] = useState(false);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [expandedIM, setExpandedIM] = useState<string|null>(null);
  const [showApiInfo, setShowApiInfo] = useState(false);
  const theme = getThemeClasses(config.brand.themeColor);
  const today = new Date();

  const years = useMemo(() => {
    const ys = new Set<number>();
    extensions.forEach(e => {
      if (e.startDate) ys.add(new Date(e.startDate).getFullYear());
    });
    return Array.from(ys).sort((a,b) => b - a);
  }, [extensions]);

  const fd = useMemo(() => (extensions || []).filter(ext => {
    if (!ext.startDate) return false;
    const d = new Date(ext.startDate);
    
    if (isCustom && customRange.start && customRange.end) {
      const start = new Date(customRange.start);
      const end = new Date(customRange.end);
      end.setHours(23, 59, 59, 999);
      return d >= start && d <= end;
    }

    const y = d.getFullYear(), m = d.getMonth(), qr = Math.floor(m/3)+1;
    if(yr!=='All' && y!==yr) return false;
    if(q!=='All' && qr!==q) return false;
    if(mo!=='All' && m!==mo) return false;
    return true;
  }), [extensions, yr, q, mo, isCustom, customRange]);

  const ims = useMemo(() => {
    // Get known IMs from users list
    const baseIms = (users || []).filter(u=>u.role==='IM'||u.role==='IM Lead'||u.role==='Superadmin');
    
    // Also capture any managers mentioned in the data but missing from the users list
    const dataManagers = Array.from(new Set(fd.map(e => e.implementationManager)));
    const knownNames = new Set(baseIms.map(u => u.name));
    
    const additionalIms = dataManagers
      .filter(name => name && !knownNames.has(name))
      .map(name => ({ id: name, name, role: 'IM' as any }));
      
    return [...baseIms, ...additionalIms];
  }, [fd, users]);

  const kpis = useMemo(() => {
    const total=fd.length, completed=fd.filter(e=>e.status==='Completed').length;
    const suspended=fd.filter(e=>e.status==='Suspended').length, active=total-completed-suspended;
    const overdue=fd.filter(e=>
      e.status!=='Completed' && 
      e.status!=='Suspended' && 
      !e.serviceName.toLowerCase().includes('api') &&
      new Date(e.targetClosureDate) < today
    ).length;
    const mapped=fd.filter(e=>e.mappingStatus==='Approved').length;
    return {
      total, completed, suspended, active, overdue, mapped,
      completionRate: total-suspended>0 ? (completed/(total-suspended))*100 : 0,
      activeRate: total>0 ? (active/total)*100 : 0,
      suspensionRate: total>0 ? (suspended/total)*100 : 0,
      avgPerIM: ims.length>0 ? total/ims.length : 0,
      mappingRatio: total>0 ? (mapped/total)*100 : 0,
      pendingMappings: fd.filter(e => e.mappingStatus === 'Pending').length,
      pendingExtensions: fd.filter(e => e.extensionRequest !== null).length,
    };
  }, [fd, ims]);

  const pm = useMemo(() => {
    const m: Record<string,{total:number;active:number;suspended:number;completed:number}> = {};
    fd.forEach(ext => {
      if(!m[ext.serviceName]) m[ext.serviceName]={total:0,active:0,suspended:0,completed:0};
      m[ext.serviceName].total++;
      if(ext.status==='Completed') m[ext.serviceName].completed++;
      else if(ext.status==='Suspended') m[ext.serviceName].suspended++;
      else m[ext.serviceName].active++;
    });
    return m;
  }, [fd]);

  const tm = useMemo(() => {
    const m: Record<string,{total:number;active:number;suspended:number;completed:number;overdue:number}> = {};
    ims.forEach(im => { m[im.name]={total:0,active:0,suspended:0,completed:0,overdue:0}; });
    fd.forEach(ext => {
      if(!m[ext.implementationManager]) m[ext.implementationManager]={total:0,active:0,suspended:0,completed:0,overdue:0};
      const t=m[ext.implementationManager];
      t.total++;
      if(ext.status==='Completed') t.completed++;
      else if(ext.status==='Suspended') t.suspended++;
      else t.active++;
      if(ext.status!=='Completed'&&ext.status!=='Suspended'&& !ext.serviceName.toLowerCase().includes('api') && new Date(ext.targetClosureDate)<today) t.overdue++;
    });
    return m;
  }, [fd, ims]);

  const trends = useMemo(() => {
    const d = MN.map(n=>({name:n,started:0,completed:0,suspended:0,rate:0}));
    fd.forEach(ext => {
      const month = new Date(ext.startDate).getMonth();
      if (!isNaN(month)) {
        d[month].started++;
        const compDate = new Date(ext.updatedAt || ext.startDate);
        const compMonth = compDate.getMonth();
        if (!isNaN(compMonth)) {
          if(ext.status==='Completed') d[compMonth].completed++;
          if(ext.status==='Suspended') d[compMonth].suspended++;
        }
      }
    });
    return d.map(r=>({...r, rate: r.started>0 ? Math.round((r.completed/r.started)*100) : 0}));
  }, [fd]);

  const ytd = useMemo(() => {
    const s=trends.reduce((a,m)=>a+m.started,0);
    const c=trends.reduce((a,m)=>a+m.completed,0);
    const su=trends.reduce((a,m)=>a+m.suspended,0);
    return {started:s, completed:c, suspended:su, rate: s>0?Math.round((c/s)*100):0};
  }, [trends]);

const getIMStoryPoint = (w: number | undefined | null): number => {
  if (w == null) return 1;
  if (w <= 1.2) return 1;
  if (w <= 2.2) return 2;
  return 3; // Max 3 for IM services
};

const weightMap = useMemo(() => {
  const map: Record<string, number> = {};
  config.serviceBaselines.forEach(sb => {
    map[sb.name] = getIMStoryPoint(sb.complexityWeight);
    sb.subServices?.forEach(ss => {
      map[ss.name] = getIMStoryPoint(ss.complexityWeight || sb.complexityWeight);
    });
  });
  return map;
}, [config.serviceBaselines]);

  const wp = useMemo(() => {
    const rows = (ims || []).map(im => {
      const exts = fd.filter(e => e.implementationManager === im.name);
      let ws = 0, tw = 0;
      const bd: Record<string,number|null> = {};
      
      // Calculate breakdown for leaderboard
      Object.keys(weightMap).forEach((prod)=>{
        const pe=exts.filter(e=>e.serviceName.includes(prod) || e.serviceVariant.includes(prod));
        if(pe.length>0){ 
          const r=pe.filter(e=>e.status==='Completed').length/pe.length; 
          bd[prod]=Math.round(r*100); 
        } else bd[prod]=null;
      });

      let totalUtilizedPoints = 0;
      let activeApiPoints = 0;

      exts.forEach(ext => {
        if (ext.status === 'Suspended') return;

        // Find most specific weight and map it to a max-3 Fibonacci score
        const pkg = config.packages?.find(p => p.name === ext.serviceName || p.name === ext.serviceVariant);
        const rawWeight = pkg?.storyPoints || weightMap[ext.serviceVariant] || weightMap[ext.serviceName] || 
                          Object.entries(weightMap).find(([k]) => ext.serviceName.includes(k))?.[1] || 1;
        const baseWeight = getIMStoryPoint(rawWeight);
        
        const isApi = ext.serviceName.toLowerCase().includes('api') || ext.serviceVariant.toLowerCase().includes('api');

        let progress = 0;
        if (ext.status === 'Completed') progress = 1;
        else {
          const totalMilestones = ext.milestones?.length || 0;
          const completedMilestones = ext.milestones?.filter(m => m.completed).length || 0;
          progress = totalMilestones > 0 ? (completedMilestones / totalMilestones) : 0.1;
        }
        let penalty = 0;
        if (ext.status !== 'Completed' && !isApi && new Date(ext.targetClosureDate) < today) penalty = 0.15; 
        
        ws += (progress - penalty) * baseWeight;

        // If it's an active API, only include its progressive weight in the denominator
        // to avoid diluting the completion index, while still rewarding progress in the numerator!
        if (isApi && ext.status !== 'Completed') {
          tw += progress * baseWeight;
          activeApiPoints += progress * baseWeight;
        } else {
          tw += baseWeight;
        }

        // Calculate remaining effort for active projects only
        if (ext.status !== 'Completed') {
          totalUtilizedPoints += baseWeight * (1 - progress);
        }
      });

      const score = tw > 0 ? Math.max(0, (ws / tw)) : 0;
      const wipLimit = im.wipLimit || 30;
      const utilizationPct = (totalUtilizedPoints / wipLimit) * 100;

      return {
        name: im.name, 
        score, 
        total: exts.length,
        active: exts.filter(e => e.status !== 'Completed' && e.status !== 'Suspended').length,
        suspended: exts.filter(e => e.status === 'Suspended').length,
        completed: exts.filter(e => e.status === 'Completed').length,
        overdue: exts.filter(e => e.status !== 'Completed' && !e.serviceName.toLowerCase().includes('api') && new Date(e.targetClosureDate) < today).length,
        bd,
        totalUtilizedPoints,
        wipLimit,
        utilizationPct,
        activeApiPoints
      };
    }).sort((a,b)=>b.score-a.score);
    
    const avg = rows.length > 0 ? rows.reduce((s,r)=>s+r.score,0)/rows.length : 0;
    return { rows, avg };
  }, [fd, ims, weightMap]);

  const globalPerformance = useMemo(() => {
    let globalWs = 0;
    let globalTw = 0;
    fd.forEach(ext => {
      if (ext.status === 'Suspended') return;

      const pkg = config.packages?.find(p => p.name === ext.serviceName || p.name === ext.serviceVariant);
      const rawWeight = pkg?.storyPoints || weightMap[ext.serviceVariant] || weightMap[ext.serviceName] || 
                        Object.entries(weightMap).find(([k]) => ext.serviceName.includes(k))?.[1] || 1;
      const baseWeight = getIMStoryPoint(rawWeight);
      const isApi = ext.serviceName.toLowerCase().includes('api') || ext.serviceVariant.toLowerCase().includes('api');

      let progress = 0;
      if (ext.status === 'Completed') progress = 1;
      else {
        const totalM = ext.milestones?.length || 0;
        const completedM = ext.milestones?.filter(m => m.completed).length || 0;
        progress = totalM > 0 ? (completedM / totalM) : 0.1;
      }
      let penalty = 0;
      if (ext.status !== 'Completed' && !isApi && new Date(ext.targetClosureDate) < today) penalty = 0.15; 
      
      globalWs += (progress - penalty) * baseWeight;
      if (isApi && ext.status !== 'Completed') {
        globalTw += progress * baseWeight;
      } else {
        globalTw += baseWeight;
      }
    });
    return globalTw > 0 ? Math.max(0, (globalWs / globalTw)) * 100 : 0;
  }, [fd, config.packages, weightMap]);

  const overdue = useMemo(() =>
    fd.filter(e=>e.status!=='Completed' && !e.serviceName.toLowerCase().includes('api') && new Date(e.targetClosureDate)<today)
      .sort((a,b)=>new Date(a.targetClosureDate).getTime()-new Date(b.targetClosureDate).getTime()),
  [fd]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-2xl",theme.lightBg)}><Filter className={cn("w-5 h-5",theme.text)}/></div>
          <div><h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Operational Filters</h3><p className="text-xs font-bold text-slate-500">Slice data by reporting period</p></div>
        </div>
        <div className="flex items-center gap-3">
          {!isCustom ? (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Year</label>
                <select value={yr} onChange={e=>setYr(e.target.value==='All'?'All':Number(e.target.value))} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value="All">All Years</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Quarter</label>
                <select value={q} onChange={e=>setQ(e.target.value==='All'?'All':Number(e.target.value))} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value="All">All Quarters</option>{[1,2,3,4].map(n=><option key={n} value={n}>Q{n}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Month</label>
                <select value={mo} onChange={e=>setMo(e.target.value==='All'?'All':Number(e.target.value))} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none">
                  <option value="All">All Months</option>{MN.map((n,i)=><option key={i} value={i}>{n}</option>)}
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">From</label>
                <input 
                  type="date" 
                  value={customRange.start} 
                  onChange={e => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">To</label>
                <input 
                  type="date" 
                  value={customRange.end} 
                  onChange={e => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none" 
                />
              </div>
            </>
          )}
          
          <div className="h-10 w-px bg-slate-100 mx-2" />
          
          <button 
            onClick={() => setIsCustom(!isCustom)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
              isCustom ? "bg-teal-600 text-white shadow-lg" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            )}
          >
            {isCustom ? 'Standard Period' : 'Custom Period'}
          </button>
        </div>
      </div>

      {/* KPI Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KPI label="Completion Rate" value={`${globalPerformance.toFixed(1)}%`} rate={globalPerformance} icon={<CheckCircle2/>} color="emerald"/>
        <KPI 
          label="In Progress" 
          value={kpis.active} 
          sub="Ongoing tasks" 
          icon={<Activity/>} 
          color="blue"
          onClick={() => onFilter?.('All')}
        />
        <KPI label="Active Rate" value={`${kpis.activeRate.toFixed(1)}%`} sub={`${kpis.active} active`} rate={kpis.activeRate} icon={<Activity/>} color="blue"/>
        <KPI label="Suspension Rate" value={`${kpis.suspensionRate.toFixed(1)}%`} sub={`${kpis.suspended} frozen`} rate={kpis.suspensionRate} inv icon={<AlertTriangle/>} color="amber" onClick={() => onFilter?.('Suspended')}/>
        <KPI label="Pending Requests" value={kpis.pendingMappings + kpis.pendingExtensions} sub="Mappings & Extensions" icon={<Clock/>} color="indigo" onClick={() => onFilter?.('Mapping Pending')}/>
      </div>

      {/* KPI Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Started (Period)" value={fd.length} sub="Total in window" icon={<TrendingUp/>} color="teal" onClick={() => onFilter?.('All')}/>
        <KPI label="Completed (Period)" value={kpis.completed} sub={`of ${fd.length} total`} rate={globalPerformance} icon={<CheckCircle2/>} color="emerald" onClick={() => onFilter?.('Completed')}/>
        <KPI label="Overdue / At-Risk" value={kpis.overdue} sub="Past target date" icon={<Clock/>} color="red" onClick={() => onFilter?.('Delayed')}/>
        <KPI label="Mapping Ratio" value={`${kpis.mappingRatio.toFixed(0)}%`} sub={`${kpis.mapped} linked to projects`} icon={<Link/>} color="teal"/>
      </div>

      {/* Product + Team tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-5"><Package className="w-4 h-4 text-teal-600"/><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Product Performance</h3></div>
          <table className="w-full text-left">
            <thead><tr className="border-b border-slate-100">{['Product','Total','Active','Susp.','Comp.','Susp%'].map(h=><th key={h} className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center first:text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(Object.entries(pm) as [string,any][]).map(([name,m])=>{
                const susp_rate = m.total>0?Math.round((m.suspended/m.total)*100):0;
                const hotspot = susp_rate > 40;
                return (
                  <tr key={name} className={cn("group",hotspot&&"bg-red-50/40")}>
                    <td className="py-2.5 text-sm font-bold text-slate-700 flex items-center gap-1.5">{name}{hotspot&&<AlertTriangle className="w-3 h-3 text-red-500" title="Suspension hotspot"/>}</td>
                    <td className="py-2.5 text-sm font-black text-slate-900 text-center">{m.total}</td>
                    <td className="py-2.5 text-sm font-bold text-blue-600 text-center">{m.active}</td>
                    <td className="py-2.5 text-sm font-bold text-amber-600 text-center">{m.suspended}</td>
                    <td className="py-2.5 text-sm font-bold text-emerald-600 text-center">{m.completed}</td>
                    <td className="py-2.5 text-center"><span className={cn("px-1.5 py-0.5 text-[10px] font-black rounded",hotspot?"bg-red-100 text-red-700":"bg-slate-100 text-slate-500")}>{susp_rate}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-teal-600"/>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">IM Workload & Performance</h3>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowApiInfo(!showApiInfo); }}
                className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-teal-600 transition-colors"
                title="Learn how Performance & API scoring works"
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* API and Performance Scoring Guide Popover */}
          {showApiInfo && (
            <div className="mb-5 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <p className="font-black text-slate-800 uppercase tracking-wider">Performance & API Scoring Guide</p>
                <button onClick={(e) => { e.stopPropagation(); setShowApiInfo(false); }} className="text-slate-400 hover:text-slate-600 font-bold">×</button>
              </div>
              <div className="space-y-2 leading-relaxed text-slate-600">
                <p>
                  <strong>📊 Standard Services:</strong> Rated on completed milestones. Active projects count proportionally (e.g. 50% milestones = 50% weight). Past-due dates incur a small score penalty.
                </p>
                <p>
                  <strong>🔌 API Integrations:</strong> Because APIs have open-ended timelines, they <em>never</em> drag down your index! Active APIs contribute at a perfect 1.0 ratio for whatever progress is completed. Effort is fully rewarded without penalizing the manager for the project remaining open.
                </p>
              </div>
            </div>
          )}
          <table className="w-full text-left">
            <thead><tr className="border-b border-slate-100">{['Manager','Active WIP','Susp.','Comp.','Overdue','Bandwidth Utilization','Performance'].map(h=><th key={h} className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center first:text-left last:text-right">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {(wp.rows || []).map((m)=>(
                <tr 
                  key={m.name} 
                  className="group hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onFilter?.('All', m.name)}
                >
                  <td className="py-2.5 text-sm font-bold text-slate-700 group-hover:text-teal-600 transition-colors flex items-center gap-2">
                    {m.name}
                    {m.activeApiPoints > 0 && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-600 text-[9px] font-black rounded-md" title={`API Effort Earned: ${m.activeApiPoints.toFixed(1)} PTS`}>
                        <Link className="w-2.5 h-2.5" />
                        +{m.activeApiPoints.toFixed(1)} API
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-sm font-bold text-blue-600 text-center">{m.active} <span className="text-[10px] text-slate-400">of {m.total}</span></td>
                  <td className="py-2.5 text-sm font-bold text-amber-600 text-center">{m.suspended}</td>
                  <td className="py-2.5 text-sm font-bold text-emerald-600 text-center">{m.completed}</td>
                  <td className="py-2.5 text-center"><span className={cn("px-1.5 py-0.5 text-[10px] font-black rounded",m.overdue>0?"bg-red-100 text-red-700":"bg-slate-100 text-slate-500")}>{m.overdue}</span></td>
                  <td className="py-2.5">
                    <div className="flex flex-col items-center justify-center w-28 mx-auto">
                      <div className="flex justify-between w-full text-[9px] font-black tracking-widest mb-1">
                        <span className={m.utilizationPct > 100 ? "text-red-500" : "text-slate-400"}>{m.totalUtilizedPoints.toFixed(1)}</span>
                        <span className="text-slate-300">/ {m.wipLimit}</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all", m.utilizationPct > 100 ? "bg-red-500" : m.utilizationPct > 85 ? "bg-amber-500" : "bg-teal-500")}
                          style={{ width: `${Math.min(m.utilizationPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    {(() => {
                      const scorePct = m.score * 100;
                      const r = rating(scorePct);
                      return (
                        <div className="flex flex-col items-end">
                          <span className={cn("px-2 py-0.5 text-[10px] font-black rounded-md border uppercase tracking-wider", r.c)}>
                            {r.l}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 mt-0.5">{Math.round(scorePct)}% Index</span>
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Center & Overdue panel */}
      {(overdue.length > 0 || kpis.pendingMappings > 0 || kpis.pendingExtensions > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {overdue.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4"><Clock className="w-4 h-4 text-red-600"/><h3 className="text-xs font-black text-red-900 uppercase tracking-widest">At-Risk / Overdue ({overdue.length})</h3></div>
              <div className="space-y-3">
                {overdue.slice(0,3).map(ext=>{
                  const days = Math.floor((today.getTime()-new Date(ext.targetClosureDate).getTime())/(1000*60*60*24));
                  return (
                    <div 
                      key={ext.id} 
                      className={cn(
                        "bg-white rounded-2xl p-4 border border-red-100 shadow-sm flex items-center justify-between",
                        onManage && "cursor-pointer hover:border-red-300 hover:shadow-md transition-all active:scale-[0.98]"
                      )}
                      onClick={() => onManage?.(ext.id)}
                    >
                      <div>
                        <p className="text-sm font-black text-slate-900 truncate">{ext.clientName}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{ext.serviceName} · {ext.implementationManager}</p>
                      </div>
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black rounded-md">{days}d</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(kpis.pendingMappings > 0 || kpis.pendingExtensions > 0) && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4"><Activity className="w-4 h-4 text-indigo-600"/><h3 className="text-xs font-black text-indigo-900 uppercase tracking-widest">Action Required</h3></div>
              <div className="grid grid-cols-2 gap-4">
                {kpis.pendingMappings > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm">
                    <p className="text-2xl font-black text-indigo-600">{kpis.pendingMappings}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Pending Mappings</p>
                  </div>
                )}
                {kpis.pendingExtensions > 0 && (
                  <div className="bg-white rounded-2xl p-4 border border-indigo-100 shadow-sm">
                    <p className="text-2xl font-black text-indigo-600">{kpis.pendingExtensions}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Date Extensions</p>
                  </div>
                )}
              </div>
              <p className="text-[10px] text-indigo-400 mt-4 italic font-medium uppercase tracking-widest">Review these in the Ancillary table</p>
            </div>
          )}
        </div>
      )}

      {/* Volume Distribution */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 mb-5"><Layers className="w-4 h-4 text-sky-600"/><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Ancillary Volume Distribution</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead><tr className="border-b border-slate-100">
              <th className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>
              {config.serviceBaselines.map(sb=><th key={sb.id} className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">{sb.name}</th>)}
              <th className="pb-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center bg-slate-50/50">Total</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {ims.map(im=>{
                const exts=fd.filter(e=>e.implementationManager===im.name);
                return <tr key={im.id} className="hover:bg-slate-50/30 transition-colors">
                  <td className="py-2.5 text-sm font-bold text-slate-700">{im.name}</td>
                  {config.serviceBaselines.map(sb=>{
                    const cnt=exts.filter(e=>e.serviceName.includes(sb.name)).length;
                    return <td key={sb.id} className={cn("py-2.5 text-sm font-bold text-center",cnt>0?"text-slate-900":"text-slate-200")}>{cnt||'—'}</td>;
                  })}
                  <td className="py-2.5 text-sm font-black text-slate-900 text-center bg-slate-50/50">{exts.length}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Monthly Trends */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4 text-teal-600"/><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Monthly Execution Trends</h3></div>
          <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block"/>Started</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Completed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>Suspended</span>
            <span className="flex items-center gap-1"><span className="w-2 h-1 border-t-2 border-dashed border-teal-500 inline-block"/>Rate %</span>
          </div>
        </div>
        <div className="h-[280px] mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:10,fontWeight:700}}/>
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:10}}/>
              <YAxis yAxisId="right" orientation="right" domain={[0,100]} axisLine={false} tickLine={false} tick={{fill:'#94a3b8',fontSize:10}} tickFormatter={(v)=>`${v}%`}/>
              <Tooltip contentStyle={{borderRadius:'16px',border:'none',boxShadow:'0 20px 25px -5px rgb(0 0 0 / 0.1)'}}/>
              <Bar yAxisId="left" dataKey="started" fill="#e2e8f0" radius={[4,4,0,0]} name="Started"/>
              <Bar yAxisId="left" dataKey="completed" fill="#10b981" radius={[4,4,0,0]} name="Completed"/>
              <Bar yAxisId="left" dataKey="suspended" fill="#fbbf24" radius={[4,4,0,0]} name="Suspended"/>
              <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#14b8a6" strokeWidth={2} strokeDasharray="5 3" dot={false} name="Rate %"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* YTD Summary Row */}
        <div className="grid grid-cols-4 gap-3 pt-4 border-t border-slate-100">
          {[{l:'YTD Started',v:ytd.started,c:'text-slate-900'},{l:'YTD Completed',v:ytd.completed,c:'text-emerald-600'},{l:'YTD Suspended',v:ytd.suspended,c:'text-amber-600'},{l:'Overall Rate',v:`${ytd.rate}%`,c:'text-teal-600'}].map(x=>(
            <div key={x.l} className="text-center p-3 bg-slate-50 rounded-2xl">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{x.l}</p>
              <p className={cn("text-xl font-black mt-1",x.c)}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weighted Performance Leaderboard */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500"/><h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Complexity-Weighted Performance</h3></div>
          <div className="px-3 py-1 bg-slate-100 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest">Team Avg: {(wp.avg*100).toFixed(1)}%</div>
        </div>
        <div className="space-y-3">
          {wp.rows.map((entry,idx)=>(
            <div key={entry.name} className="border border-slate-100 rounded-2xl overflow-hidden">
              <button onClick={()=>setExpandedIM(expandedIM===entry.name?null:entry.name)} className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-xs font-black",idx===0?"bg-amber-100 text-amber-700":idx===1?"bg-slate-100 text-slate-600":"bg-slate-50 text-slate-400")}>{idx+1}</div>
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-900">{entry.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.total} implementations</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full" style={{width:`${entry.score*100}%`}}/>
                  </div>
                  <span className="text-base font-black text-slate-900 w-14 text-right">{(entry.score*100).toFixed(1)}%</span>
                </div>
              </button>
              {expandedIM===entry.name && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-50 grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {config.serviceBaselines.slice(0, 12).map((sb)=>{
                    const val=entry.bd[sb.name];
                    return <div key={sb.id} className="text-center p-2 bg-slate-50 rounded-xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{sb.name}</p>
                      <p className={cn("text-sm font-black mt-0.5",val==null?"text-slate-300":val>=70?"text-emerald-600":val>=50?"text-amber-600":"text-red-600")}>{val!=null?`${val}%`:'—'}</p>
                    </div>;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-4 italic">* Complexity weights are configured in Settings. Click a row to see per-product breakdown.</p>
      </div>

    </div>
  );
};
