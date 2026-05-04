import React, { useState, useMemo } from 'react';
import { ServiceExtension, ImplementationIssue } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, Shield, Clock, CheckCircle, Filter, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ImplementationIssuesLogProps {
  extensions: ServiceExtension[];
  onManage: (ext: ServiceExtension) => void;
}

export const ImplementationIssuesLog: React.FC<ImplementationIssuesLogProps> = ({ extensions, onManage }) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [searchTerm, setSearchTerm] = useState('');

  const allIssues = useMemo(() => {
    return extensions.flatMap(ext => 
      (ext.issues || []).map(issue => ({
        ...issue,
        clientName: ext.clientName,
        serviceName: ext.serviceName,
        extensionId: ext.id,
        manager: ext.implementationManager,
        extension: ext
      }))
    );
  }, [extensions]);

  const categories = useMemo(() => {
    const cats = allIssues.map(i => i.category || 'General');
    return Array.from(new Set(cats)).sort();
  }, [allIssues]);

  const filteredIssues = useMemo(() => {
    return allIssues.filter(issue => {
      if (filterStatus !== 'All' && issue.status !== filterStatus) return false;
      const cat = issue.category || 'General';
      if (filterCategory !== 'All' && cat !== filterCategory) return false;
      if (searchTerm && !issue.description.toLowerCase().includes(searchTerm.toLowerCase()) && !issue.clientName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [allIssues, filterStatus, filterCategory, searchTerm]);

  const impactColors = {
    High: 'bg-rose-100 text-rose-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-emerald-100 text-emerald-700'
  };

  const statusColors = {
    Open: 'text-rose-600 bg-rose-50 border-rose-100',
    Addressing: 'text-amber-600 bg-amber-50 border-amber-100',
    Closed: 'text-emerald-600 bg-emerald-50 border-emerald-100'
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            Implementation Issues Log
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-0.5">Tracking blockers and issues across ancillary services.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-rose-100 shadow-sm">
            <AlertTriangle className="w-3.5 h-3.5" />
            {allIssues.filter(r => r.status === 'Open').length} Open
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-emerald-100 shadow-sm">
            <CheckCircle className="w-3.5 h-3.5" />
            {allIssues.filter(r => r.status === 'Closed').length} Resolved
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
          <input
            type="text"
            placeholder="Search issues or clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Addressing">Addressing</option>
            <option value="Closed">Closed</option>
          </select>

          <select 
            className="px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Description</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Institution</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Impact</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-slate-400 font-bold">No issues found matching your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => onManage(issue.extension)}
                        className="text-left"
                      >
                        <p className="text-sm font-black text-slate-800 line-clamp-2 group-hover:text-teal-700 transition-colors">{issue.description}</p>
                        {issue.notes && <p className="text-[10px] text-slate-400 mt-1 line-clamp-1 italic">{issue.notes}</p>}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{issue.category || 'General'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-xs font-black text-slate-800">{issue.clientName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{issue.serviceName}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider", impactColors[issue.impact])}>
                          {issue.impact}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <span className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border", statusColors[issue.status])}>
                          {issue.status === 'Open' && <AlertTriangle className="w-3 h-3" />}
                          {issue.status === 'Addressing' && <Clock className="w-3 h-3" />}
                          {issue.status === 'Closed' && <CheckCircle className="w-3 h-3" />}
                          {issue.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {format(parseISO(issue.createdAt), 'dd MMM yyyy')}
                      </p>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
