import React, { useState, useMemo } from 'react';
import { Project, Risk } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, Shield, Clock, CheckCircle, Filter } from 'lucide-react';

interface RisksTableProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  riskCategories?: string[];
}

export const RisksTable: React.FC<RisksTableProps> = ({ projects, onSelectProject, riskCategories = [] }) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterPM, setFilterPM] = useState<string>('All');

  const allRisks = useMemo(() => {
    return projects.flatMap(project => 
      (project.risks || []).map(risk => ({
        ...risk,
        clientName: project.clientName,
        packageName: project.packageName,
        projectId: project.id,
        assignedPM: project.assignedPM,
        project: project
      }))
    );
  }, [projects]);

  const categories = useMemo(() => {
    const fromRisks = allRisks.map(r => r.category || 'General');
    return Array.from(new Set([...riskCategories, ...fromRisks])).sort();
  }, [allRisks, riskCategories]);
  const pms = useMemo(() => Array.from(new Set(allRisks.map(r => r.assignedPM))).sort(), [allRisks]);

  const filteredRisks = useMemo(() => {
    return allRisks.filter(risk => {
      if (filterStatus !== 'All' && risk.status !== filterStatus) return false;
      const cat = risk.category || 'General';
      if (filterCategory !== 'All' && cat !== filterCategory) return false;
      if (filterPM !== 'All' && risk.assignedPM !== filterPM) return false;
      return true;
    });
  }, [allRisks, filterStatus, filterCategory, filterPM]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" />
          Risks & Issues
        </h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            {allRisks.filter(r => r.status === 'Open').length} Open
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-wider border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5" />
            {allRisks.filter(r => r.status === 'Closed').length} Resolved
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 px-3 text-slate-400">
          <Filter className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Filter by:</span>
        </div>
        
        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="All">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Addressing">Addressing</option>
          <option value="Closed">Closed</option>
        </select>

        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
        >
          <option value="All">All Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all cursor-pointer"
          value={filterPM}
          onChange={(e) => setFilterPM(e.target.value)}
        >
          <option value="All">All PMs</option>
          {pms.map(pm => (
            <option key={pm} value={pm}>{pm}</option>
          ))}
        </select>
        
        {(filterStatus !== 'All' || filterCategory !== 'All' || filterPM !== 'All') && (
          <button 
            onClick={() => {
              setFilterStatus('All');
              setFilterCategory('All');
              setFilterPM('All');
            }}
            className="ml-auto px-4 py-2 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-1"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Risk Description</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Institution</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Impact</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRisks.map((risk) => (
                <tr key={risk.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{risk.description}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{risk.assignedPM}</p>
                  </td>
                  <td className="px-6 py-4">
                    {risk.category ? (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                        {risk.category}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold uppercase">General</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => onSelectProject(risk.project)}
                      className="text-sm font-bold text-slate-600 hover:text-indigo-600 hover:underline transition-colors"
                    >
                      {risk.clientName}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">{risk.packageName}</td>
                  <td className="px-6 py-4">
                    <ImpactBadge impact={risk.impact} />
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={risk.status} />
                  </td>
                  <td className="px-6 py-4 text-[10px] text-slate-400 font-bold font-mono tracking-tighter">{risk.createdAt}</td>
                </tr>
              ))}
              {filteredRisks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-32 text-center bg-white">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
                      <Shield className="w-10 h-10" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">No Risks Found</h3>
                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] max-w-[200px] mx-auto">No risks match the current filter criteria.</p>
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

const ImpactBadge = ({ impact }: { impact: Risk['impact'] }) => {
  const styles = {
    'High': 'bg-red-100 text-red-700',
    'Medium': 'bg-amber-100 text-amber-700',
    'Low': 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", styles[impact])}>
      {impact}
    </span>
  );
};

const StatusBadge = ({ status }: { status: Risk['status'] }) => {
  const styles = {
    'Open': 'text-red-500',
    'Addressing': 'text-amber-500',
    'Closed': 'text-slate-400',
  };
  const icons = {
    'Open': <AlertTriangle className="w-3 h-3" />,
    'Addressing': <Clock className="w-3 h-3" />,
    'Closed': <CheckCircle className="w-3 h-3" />,
  };
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase", styles[status])}>
      {icons[status]}
      {status}
    </div>
  );
};
