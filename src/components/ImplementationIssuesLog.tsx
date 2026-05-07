import React, { useState, useMemo, useEffect } from 'react';
import { ServiceExtension, ImplementationIssue } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, Shield, Clock, CheckCircle, Filter, Search, Users, Calendar, X } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

interface ImplementationIssuesLogProps {
  extensions: ServiceExtension[];
  onManage: (ext: ServiceExtension) => void;
  isLead?: boolean;
  config?: any;
}

export const ImplementationIssuesLog: React.FC<ImplementationIssuesLogProps> = ({ extensions, onManage, isLead, config }) => {
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [filterIM, setFilterIM] = useState<string>('All');
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterCategory, filterIM, filterMonth, startDate, endDate, searchTerm]);

  const allIssues = useMemo(() => {
    const issues = extensions.flatMap(ext => 
      (ext.issues || []).map(issue => ({
        ...issue,
        clientName: ext.clientName,
        serviceName: ext.serviceName,
        extensionId: ext.id,
        manager: ext.implementationManager,
        extension: ext
      }))
    );
    return issues.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [extensions]);

  const categories = useMemo(() => {
    if (config?.issueCategories && config.issueCategories.length > 0) {
      return [...config.issueCategories].sort();
    }
    const defaultCats = ['Technical', 'Client', 'Process', 'Access', 'Data', 'Other'];
    return defaultCats.sort();
  }, [config?.issueCategories]);

  const managers = useMemo(() => {
    const ims = extensions.map(ext => ext.implementationManager).filter(Boolean);
    return Array.from(new Set(ims)).sort();
  }, [extensions]);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const filteredIssues = useMemo(() => {
    return allIssues.filter(issue => {
      // Multiple filters check
      if (filterStatus !== 'All' && issue.status !== filterStatus) return false;
      
      const cat = issue.category || 'General';
      if (filterCategory !== 'All' && cat !== filterCategory) return false;
      
      if (filterIM !== 'All' && issue.manager !== filterIM) return false;
      
      const loggedDate = parseISO(issue.createdAt);
      
      if (filterMonth !== 'All') {
        if (loggedDate.getMonth() !== parseInt(filterMonth)) return false;
      }
      
      if (startDate || endDate) {
        try {
          const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
          const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
          if (!isWithinInterval(loggedDate, { start, end })) return false;
        } catch (e) {
          // Ignore invalid dates
        }
      }
      
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const inDesc = issue.description.toLowerCase().includes(search);
        const inClient = issue.clientName.toLowerCase().includes(search);
        const inService = issue.serviceName.toLowerCase().includes(search);
        if (!inDesc && !inClient && !inService) return false;
      }
      
      return true;
    });
  }, [allIssues, filterStatus, filterCategory, filterIM, filterMonth, startDate, endDate, searchTerm]);

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

  const clearFilters = () => {
    setFilterStatus('All');
    setFilterCategory('All');
    setFilterIM('All');
    setFilterMonth('All');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const hasFilters = filterStatus !== 'All' || filterCategory !== 'All' || filterIM !== 'All' || filterMonth !== 'All' || startDate || endDate || searchTerm;

  const paginatedIssues = filteredIssues.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredIssues.length / pageSize);

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

      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        {/* Row 1: Search & Status/Category */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
            <input
              type="text"
              placeholder="Search issues, clients, or services..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select 
                className="pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer appearance-none"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Addressing">Addressing</option>
                <option value="Closed">Closed</option>
              </select>
            </div>

            <div className="relative group">
              <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select 
                className="pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer appearance-none"
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
        </div>

        {/* Row 2: IM & Time Filters */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-50">
          {isLead && (
            <div className="relative group min-w-[180px]">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <select 
                className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer appearance-none"
                value={filterIM}
                onChange={(e) => setFilterIM(e.target.value)}
              >
                <option value="All">All Managers</option>
                {managers.map(im => (
                  <option key={im} value={im}>{im}</option>
                ))}
              </select>
            </div>
          )}

          <div className="relative group min-w-[150px]">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select 
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 transition-all cursor-pointer appearance-none"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            >
              <option value="All">All Months</option>
              {months.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Period:</span>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <span className="text-slate-300">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {hasFilters && (
            <button 
              onClick={clearFilters}
              className="ml-auto flex items-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <X className="w-4 h-4" />
              Clear All
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="w-[35%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Issue Description</th>
                <th className="w-[12%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Category</th>
                <th className="w-[20%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">Institution & Manager</th>
                <th className="w-[10%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center truncate">Impact</th>
                <th className="w-[13%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center truncate">Status</th>
                <th className="w-[10%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right truncate">Logged</th>
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
                paginatedIssues.map((issue) => (
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
                    <td className="px-6 py-4 min-w-0">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block truncate" title={issue.category || 'General'}>{issue.category || 'General'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <p className="text-xs font-black text-slate-800 truncate" title={issue.clientName}>{issue.clientName}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate" title={issue.serviceName}>{issue.serviceName}</p>
                        <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest truncate mt-0.5" title={issue.manager}>{issue.manager}</p>
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

      {/* Pagination Controls */}
      {filteredIssues.length > pageSize && (
        <div className="flex items-center justify-between bg-white px-8 py-4 rounded-2xl border border-slate-200 shadow-sm mt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * pageSize, filteredIssues.length)}</span> of <span className="text-slate-900">{filteredIssues.length}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    "w-8 h-8 rounded-lg text-xs font-black transition-all",
                    currentPage === i + 1 ? "bg-teal-600 text-white shadow-lg shadow-teal-600/20 scale-110" : "text-slate-400 hover:bg-slate-100"
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
