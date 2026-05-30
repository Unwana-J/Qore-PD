import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ServiceExtension, ImplementationIssue, GeneralIssue, GeneralIssueComment, ServiceState } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, Shield, Clock, CheckCircle, Filter, Search, Users, Calendar, X, ChevronDown, Wrench, Plus, Loader2, Layers, Trash2, Edit3, MessageSquare, Send, Flame } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, differenceInDays } from 'date-fns';
import { api } from '../lib/api';

interface ImplementationIssuesLogProps {
  extensions: ServiceExtension[];
  onManage: (ext: ServiceExtension) => void;
  isLead?: boolean;
  config?: any;
  userName?: string;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Reusable multi-select dropdown ────────────────────────────────────────────
interface MultiSelectProps {
  label: string;
  icon?: React.ReactNode;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}

const MultiSelect: React.FC<MultiSelectProps> = ({ label, icon, options, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (val: string) => {
    onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  };

  const displayLabel = selected.length === 0
    ? label
    : selected.length === 1
    ? selected[0]
    : `${selected.length} selected`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-2 pl-3 pr-3 py-2.5 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-600 outline-none transition-all cursor-pointer whitespace-nowrap',
          open ? 'border-teal-400 ring-2 ring-teal-500/20' : 'border-slate-100 hover:border-slate-300',
          selected.length > 0 && 'border-teal-300 bg-teal-50 text-teal-700'
        )}
      >
        {icon && <span className="text-slate-400">{icon}</span>}
        <span>{displayLabel}</span>
        {selected.length > 0 && (
          <span
            onClick={e => { e.stopPropagation(); onChange([]); }}
            className="ml-1 w-4 h-4 rounded-full bg-teal-200 text-teal-700 flex items-center justify-center hover:bg-teal-300 transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </span>
        )}
        <ChevronDown className={cn('w-3 h-3 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-[180px] bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden">
          {options.map(opt => (
            <label
              key={opt}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                className="w-3.5 h-3.5 accent-teal-600 cursor-pointer"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
              />
              <span className="text-xs font-bold text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main component ─────────────────────────────────────────────────────────────
export const ImplementationIssuesLog: React.FC<ImplementationIssuesLogProps> = ({ extensions, onManage, isLead, config, userName, onShowToast }) => {
  const [generalIssues, setGeneralIssues] = useState<GeneralIssue[]>([]);
  const [loadingGeneral, setLoadingGeneral] = useState(false);
  const [isLoggingGeneralIssue, setIsLoggingGeneralIssue] = useState(false);
  const [savingGeneral, setSavingGeneral] = useState(false);

  // Form state for new general issue
  const [newGeneralIssue, setNewGeneralIssue] = useState({
    description: '',
    impact: 'Medium' as GeneralIssue['impact'],
    category: 'General',
    affectedServices: [] as string[],
    notes: '',
    affectedExtensionIds: [] as string[]
  });

  const [viewingGeneralIssue, setViewingGeneralIssue] = useState<GeneralIssue | null>(null);
  const [updatingGeneral, setUpdatingGeneral] = useState(false);

  // Comment state
  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const [filterServices, setFilterServices] = useState<string[]>([]);
  const [filterIMs, setFilterIMs] = useState<string[]>([]);
  const [filterMonth, setFilterMonth] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    fetchGeneralIssues();
  }, []);

  const fetchGeneralIssues = async () => {
    setLoadingGeneral(true);
    try {
      const data = await api.generalIssues.getAll();
      setGeneralIssues(data);
    } catch (err) {
      console.error('Failed to fetch general issues:', err);
    } finally {
      setLoadingGeneral(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatuses, filterCategories, filterServices, filterIMs, filterMonth, startDate, endDate, searchTerm]);

  const allIssues = useMemo(() => {
    // IMs only see issues from their own implementations
    const scopedExtensions = isLead
      ? extensions
      : extensions.filter(ext =>
          ext.implementationManager?.trim().toLowerCase() === userName?.trim().toLowerCase()
        );

    const extIssues = scopedExtensions.flatMap(ext =>
      (ext.issues || []).map(issue => ({
        ...issue,
        clientName: ext.clientName,
        serviceName: ext.serviceName,
        extensionId: ext.id,
        manager: ext.implementationManager,
        extension: ext,
        isGeneral: false
      }))
    );

    // General issues are visible to everyone (Leads and IMs) since they affect shared services
    const filteredGeneral = generalIssues;

    const genIssuesMapped = filteredGeneral.map(gi => ({
      ...gi,
      clientName: 'General',
      serviceName: gi.affectedServices.join(', '),
      extensionId: undefined,
      manager: gi.loggedBy,
      extension: undefined,
      isGeneral: true
    }));

    const combined = [...extIssues, ...genIssuesMapped];
    return combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [extensions, generalIssues, isLead, userName]);

  const categories = useMemo(() => {
    if (config?.issueCategories && config.issueCategories.length > 0) {
      return [...config.issueCategories].sort();
    }
    return ['Technical', 'Client', 'Process', 'Access', 'Data', 'Other', 'General'].sort();
  }, [config?.issueCategories]);

  const availableServices = useMemo(() => {
    if (config?.serviceBaselines) {
      return config.serviceBaselines.map((sb: any) => sb.name).sort();
    }
    return [];
  }, [config?.serviceBaselines]);

  const servicesForFilter = useMemo(() => {
    const names = allIssues.map(i => i.serviceName).filter(Boolean);
    const unique = Array.from(new Set(names.flatMap(n => n.split(', ')))).sort();
    return unique;
  }, [allIssues]);

  const managers = useMemo(() => {
    const ims = [...extensions.map(ext => ext.implementationManager), ...generalIssues.map(gi => gi.loggedBy)].filter(Boolean);
    return Array.from(new Set(ims)).sort();
  }, [extensions, generalIssues]);

  const months = ["January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"];

  const filteredIssues = useMemo(() => {
    return allIssues.filter(issue => {
      if (filterStatuses.length > 0 && !filterStatuses.includes(issue.status)) return false;

      const cat = issue.category || 'General';
      if (filterCategories.length > 0 && !filterCategories.includes(cat)) return false;

      if (filterServices.length > 0) {
        const issueServices = issue.serviceName.split(', ');
        if (!filterServices.some(s => issueServices.includes(s))) return false;
      }

      if (filterIMs.length > 0 && !filterIMs.includes(issue.manager)) return false;

      const loggedDate = parseISO(issue.createdAt);

      if (filterMonth !== 'All') {
        if (loggedDate.getMonth() !== parseInt(filterMonth)) return false;
      }

      if (startDate || endDate) {
        try {
          const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
          const end = endDate ? endOfDay(parseISO(endDate)) : new Date(864000000000000000);
          if (!isWithinInterval(loggedDate, { start, end })) return false;
        } catch (e) { /* ignore invalid dates */ }
      }

      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        if (!issue.description.toLowerCase().includes(s) &&
            !issue.clientName.toLowerCase().includes(s) &&
            !issue.serviceName.toLowerCase().includes(s)) return false;
      }

      return true;
    });
  }, [allIssues, filterStatuses, filterCategories, filterServices, filterIMs, filterMonth, startDate, endDate, searchTerm]);

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
    setFilterStatuses([]);
    setFilterCategories([]);
    setFilterServices([]);
    setFilterIMs([]);
    setFilterMonth('All');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const handleLogGeneralIssue = async () => {
    if (!newGeneralIssue.description.trim() || newGeneralIssue.affectedServices.length === 0) {
      onShowToast?.('Please provide a description and at least one affected service.', 'error');
      return;
    }

    setSavingGeneral(true);
    try {
      await api.generalIssues.create({
        ...newGeneralIssue,
        loggedBy: userName || 'Unknown',
        status: 'Open'
      });
      await fetchGeneralIssues();
      setIsLoggingGeneralIssue(false);
      setNewGeneralIssue({
        description: '',
        impact: 'Medium',
        category: 'General',
        affectedServices: [],
        notes: '',
        affectedExtensionIds: []
      });
      onShowToast?.('General issue logged successfully.', 'success');
    } catch (err) {
      console.error('Failed to log general issue:', err);
      onShowToast?.('Failed to log general issue.', 'error');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleUpdateGeneralIssue = async (id: string, updates: Partial<GeneralIssue>) => {
    // Optimistic Update: Update local state immediately
    setGeneralIssues(prev => prev.map(gi => gi.id === id ? { ...gi, ...updates } : gi));
    if (viewingGeneralIssue?.id === id) {
      setViewingGeneralIssue(prev => prev ? { ...prev, ...updates } : null);
    }

    setUpdatingGeneral(true);
    try {
      await api.generalIssues.update(id, updates);
      // We don't strictly need to fetchGeneralIssues() here if we trust our local update, 
      // but we can do it in the background to ensure consistency.
      api.generalIssues.getAll().then(data => setGeneralIssues(data)).catch(() => {});
      onShowToast?.('General issue updated successfully.', 'success');
    } catch (err) {
      console.error('Failed to update general issue:', err);
      onShowToast?.('Failed to update general issue.', 'error');
      // Rollback on error
      fetchGeneralIssues();
    } finally {
      setUpdatingGeneral(false);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !viewingGeneralIssue) return;
    setPostingComment(true);
    try {
      const updated = await api.generalIssues.addComment(
        viewingGeneralIssue.id,
        viewingGeneralIssue,
        userName || 'Unknown',
        newCommentText
      );
      // Update both the modal state and the list
      setViewingGeneralIssue(updated);
      setGeneralIssues(prev => prev.map(gi => gi.id === updated.id ? updated : gi));
      setNewCommentText('');
      // Scroll to newest comment
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Failed to post comment:', err);
      onShowToast?.('Failed to post comment.', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteGeneralIssue = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this general issue?')) return;
    
    setUpdatingGeneral(true);
    try {
      await api.generalIssues.delete(id);
      await fetchGeneralIssues();
      setViewingGeneralIssue(null);
      onShowToast?.('General issue deleted.', 'info');
    } catch (err) {
      console.error('Failed to delete general issue:', err);
      onShowToast?.('Failed to delete general issue.', 'error');
    } finally {
      setUpdatingGeneral(false);
    }
  };

  const hasFilters = filterStatuses.length > 0 || filterCategories.length > 0 ||
    filterServices.length > 0 || filterIMs.length > 0 ||
    filterMonth !== 'All' || startDate || endDate || searchTerm;

  const paginatedIssues = filteredIssues.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalPages = Math.ceil(filteredIssues.length / pageSize);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-rose-600" />
            Implementation Issues Log
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-0.5">Tracking blockers and issues across ancillary services.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsLoggingGeneralIssue(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-teal-700 transition-all shadow-lg shadow-teal-600/20"
          >
            <Plus className="w-4 h-4" /> Log General Issue
          </button>
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
      </div>

      {/* Filter Panel */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        {/* Row 1: Search */}
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
          <input
            type="text"
            placeholder="Search issues, clients, or services..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
        </div>

        {/* Row 2: Multi-select filters */}
        <div className="flex flex-wrap items-center gap-3">
          <MultiSelect
            label="All Statuses"
            icon={<Filter className="w-3.5 h-3.5" />}
            options={['Open', 'Addressing', 'Closed']}
            selected={filterStatuses}
            onChange={setFilterStatuses}
          />
          <MultiSelect
            label="All Categories"
            icon={<Shield className="w-3.5 h-3.5" />}
            options={categories}
            selected={filterCategories}
            onChange={setFilterCategories}
          />
          <MultiSelect
            label="All Services"
            icon={<Wrench className="w-3.5 h-3.5" />}
            options={servicesForFilter}
            selected={filterServices}
            onChange={setFilterServices}
          />
          {isLead && (
            <MultiSelect
              label="All Managers"
              icon={<Users className="w-3.5 h-3.5" />}
              options={managers}
              selected={filterIMs}
              onChange={setFilterIMs}
            />
          )}

          {/* Month single-select */}
          <div className="relative group">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              className={cn(
                'pl-9 pr-8 py-2.5 bg-slate-50 border rounded-2xl text-xs font-bold text-slate-600 outline-none transition-all cursor-pointer appearance-none',
                filterMonth !== 'All' ? 'border-teal-300 bg-teal-50 text-teal-700' : 'border-slate-100'
              )}
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
            >
              <option value="All">All Months</option>
              {months.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Period:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <span className="text-slate-300">to</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] font-black text-slate-600 outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="ml-auto flex items-center gap-2 px-4 py-2.5 text-rose-600 hover:bg-rose-50 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <X className="w-4 h-4" /> Clear All
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-50">
            {filterStatuses.map(s => (
              <span key={s} className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {s}
                <button onClick={() => setFilterStatuses(prev => prev.filter(v => v !== s))}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            {filterCategories.map(c => (
              <span key={c} className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {c}
                <button onClick={() => setFilterCategories(prev => prev.filter(v => v !== c))}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            {filterServices.map(s => (
              <span key={s} className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {s}
                <button onClick={() => setFilterServices(prev => prev.filter(v => v !== s))}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
            {filterIMs.map(im => (
              <span key={im} className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest">
                {im}
                <button onClick={() => setFilterIMs(prev => prev.filter(v => v !== im))}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {hasFilters && (
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Showing {filteredIssues.length} of {allIssues.length} issues
        </p>
      )}

      {/* Table */}
      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left table-fixed min-w-[900px]">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="w-[35%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Issue Description</th>
                <th className="w-[12%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="w-[20%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Institution & Manager</th>
                <th className="w-[10%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Impact</th>
                <th className="w-[13%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="w-[10%] px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Logged</th>
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
                paginatedIssues.map(issue => {
                  const daysOpen = differenceInDays(new Date(), parseISO(issue.createdAt));
                  const isStale = issue.status !== 'Closed' && daysOpen >= 7;

                  return (
                    <tr key={issue.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        {issue.isGeneral ? (
                          <button 
                            onClick={() => {
                              const gi = generalIssues.find(g => g.id === issue.id);
                              if (gi) setViewingGeneralIssue(gi);
                            }} 
                            className="text-left group/btn"
                          >
                            <p className="text-sm font-black text-slate-800 line-clamp-2 group-hover/btn:text-indigo-600 transition-colors">{issue.description}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {isStale && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase tracking-widest rounded animate-pulse">
                                  <Flame className="w-2.5 h-2.5 text-rose-500" /> Stale (7+ days)
                                </span>
                              )}
                              {issue.notes && <p className="text-[10px] text-slate-400 line-clamp-1 italic">{issue.notes}</p>}
                            </div>
                          </button>
                        ) : (
                          <button onClick={() => issue.extension && onManage(issue.extension)} className="text-left">
                            <p className="text-sm font-black text-slate-800 line-clamp-2 group-hover:text-teal-700 transition-colors">{issue.description}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              {isStale && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 text-[8px] font-black uppercase tracking-widest rounded animate-pulse">
                                  <Flame className="w-2.5 h-2.5 text-rose-500" /> Stale (7+ days)
                                </span>
                              )}
                              {issue.notes && <p className="text-[10px] text-slate-400 line-clamp-1 italic">{issue.notes}</p>}
                            </div>
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4 min-w-0">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block truncate" title={issue.category || 'General'}>{issue.category || 'General'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          {issue.isGeneral ? (
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-black uppercase tracking-widest w-fit mb-1 border border-indigo-100">
                              General
                            </span>
                          ) : (
                            <p className="text-xs font-black text-slate-800 truncate" title={issue.clientName}>{issue.clientName}</p>
                          )}
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate" title={issue.serviceName}>{issue.serviceName}</p>
                          <p className="text-[10px] font-black text-teal-600 uppercase tracking-widest truncate mt-0.5" title={issue.manager}>{issue.manager}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={cn('px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider', impactColors[issue.impact as keyof typeof impactColors] || 'bg-slate-100 text-slate-500')}>
                            {issue.impact}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border', statusColors[issue.status as keyof typeof statusColors] || 'border-slate-100')}>
                            {issue.status === 'Open' && <AlertTriangle className="w-3 h-3" />}
                            {issue.status === 'Addressing' && <Clock className="w-3 h-3" />}
                            {issue.status === 'Closed' && <CheckCircle className="w-3 h-3" />}
                            {issue.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {format(parseISO(issue.createdAt), 'dd MMM yyyy')}
                          </p>
                          <span className={cn(
                            "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border",
                            isStale ? "bg-red-50 text-red-600 border-red-100" : "bg-slate-50 text-slate-500 border-slate-100"
                          )}>
                            {daysOpen}d open
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {filteredIssues.length > pageSize && (
        <div className="flex items-center justify-between bg-white px-8 py-4 rounded-2xl border border-slate-200 shadow-sm mt-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="text-slate-900">{Math.min(currentPage * pageSize, filteredIssues.length)}</span> of{' '}
            <span className="text-slate-900">{filteredIssues.length}</span> results
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-teal-600 disabled:opacity-30 transition-colors"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-black transition-all',
                    currentPage === i + 1 ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20 scale-110' : 'text-slate-400 hover:bg-slate-100'
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-teal-600 disabled:opacity-30 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Log General Issue Modal */}
      {isLoggingGeneralIssue && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl shadow-slate-900/40 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/50">
            {/* Modal Header */}
            <div className="px-8 pt-8 pb-4 flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Log General Issue</h3>
                </div>
                <p className="text-xs font-medium text-slate-400 ml-13">Issues affecting multiple implementations or a service.</p>
              </div>
              <button 
                onClick={() => setIsLoggingGeneralIssue(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 py-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Description */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Description</label>
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400 transition-all resize-none"
                  placeholder="Describe the issue affecting the service..."
                  rows={3}
                  value={newGeneralIssue.description}
                  onChange={e => setNewGeneralIssue({ ...newGeneralIssue, description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Impact */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Impact Level</label>
                  <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-100">
                    {(['Low', 'Medium', 'High'] as const).map((level) => (
                      <button
                        key={level}
                        onClick={() => setNewGeneralIssue({ ...newGeneralIssue, impact: level })}
                        className={cn(
                          'flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all',
                          newGeneralIssue.impact === level 
                            ? level === 'High' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' 
                            : level === 'Medium' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                            : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-slate-400 hover:text-slate-600'
                        )}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400 transition-all appearance-none"
                    value={newGeneralIssue.category}
                    onChange={e => setNewGeneralIssue({ ...newGeneralIssue, category: e.target.value })}
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Affected Services */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Affected Services</label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 min-h-[60px]">
                  {availableServices.length === 0 ? (
                    <p className="text-xs text-slate-400 font-medium italic">No services configured in settings.</p>
                  ) : (
                    availableServices.map(service => (
                      <button
                        key={service}
                        onClick={() => {
                          const current = newGeneralIssue.affectedServices;
                          const next = current.includes(service) 
                            ? current.filter(s => s !== service)
                            : [...current, service];
                          setNewGeneralIssue({ ...newGeneralIssue, affectedServices: next });
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all',
                          newGeneralIssue.affectedServices.includes(service)
                            ? 'bg-teal-600 border-teal-600 text-white shadow-md'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        )}
                      >
                        {service}
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Resolution Notes / Workaround */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resolution / Workaround (Optional)</label>
                <textarea
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400 transition-all resize-none"
                  placeholder="Notes on resolution or current workaround..."
                  rows={2}
                  value={newGeneralIssue.notes}
                  onChange={e => setNewGeneralIssue({ ...newGeneralIssue, notes: e.target.value })}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-slate-50/50 flex gap-3 border-t border-slate-100">
              <button
                onClick={() => setIsLoggingGeneralIssue(false)}
                className="flex-1 px-6 py-3 text-sm font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleLogGeneralIssue}
                disabled={savingGeneral || !newGeneralIssue.description.trim() || newGeneralIssue.affectedServices.length === 0}
                className="flex-[2] px-6 py-3 bg-teal-600 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-teal-700 disabled:opacity-50 transition-all shadow-xl shadow-teal-600/10 flex items-center justify-center gap-2"
              >
                {savingGeneral ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Logging...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm & Log Issue
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Issue Details Modal */}
      {viewingGeneralIssue && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl shadow-slate-900/40 overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200/50">
            <div className="px-8 pt-8 pb-4 flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center">
                    <Layers className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">General Issue Details</h3>
                    {(() => {
                      const isOwner = viewingGeneralIssue.loggedBy?.trim().toLowerCase() === userName?.trim().toLowerCase();
                      return isOwner && !isLead ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 border border-teal-200 text-teal-700 rounded-lg text-[9px] font-black uppercase tracking-widest mt-0.5">
                          <Edit3 className="w-2.5 h-2.5" /> Your Issue
                        </span>
                      ) : null;
                    })()}
                  </div>
                </div>
                <p className="text-xs font-medium text-slate-400 ml-13">View and update service-level issues.</p>
              </div>
              <button 
                onClick={() => setViewingGeneralIssue(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-8 py-6 space-y-6 overflow-y-auto max-h-[70vh]">
              {/* Description */}
              {(() => {
                const canEdit = isLead || viewingGeneralIssue.loggedBy?.trim().toLowerCase() === userName?.trim().toLowerCase();
                return (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Issue Description</label>
                    <textarea
                      className={cn(
                        "w-full px-4 py-3 border rounded-2xl text-sm font-bold text-slate-800 leading-relaxed outline-none transition-all resize-none",
                        canEdit
                          ? "bg-slate-50 border-slate-100 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400"
                          : "bg-slate-50/50 border-slate-100 text-slate-600 cursor-default"
                      )}
                      rows={3}
                      readOnly={!canEdit}
                      value={viewingGeneralIssue.description}
                      onChange={canEdit ? e => setViewingGeneralIssue({ ...viewingGeneralIssue, description: e.target.value }) : undefined}
                      onBlur={canEdit ? () => handleUpdateGeneralIssue(viewingGeneralIssue.id, { description: viewingGeneralIssue.description }) : undefined}
                    />
                    {canEdit && <p className="text-[10px] text-slate-400 font-medium italic px-1">Description auto-saves on blur.</p>}
                  </div>
                );
              })()}

              {/* Status Update (Full width to avoid overlap) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Status</label>
                <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-100 gap-1">
                  {(['Open', 'Addressing', 'Closed'] as const).map((s) => (
                    <button
                      key={s}
                      disabled={updatingGeneral}
                      onClick={() => handleUpdateGeneralIssue(viewingGeneralIssue.id, { status: s, resolvedAt: s === 'Closed' ? new Date().toISOString() : undefined })}
                      className={cn(
                        'flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all',
                        viewingGeneralIssue.status === s 
                          ? s === 'Open' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' 
                          : s === 'Addressing' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20'
                          : 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Metadata Pills */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Metadata</label>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Category: {viewingGeneralIssue.category}</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Impact: {viewingGeneralIssue.impact}</span>
                  </div>
                </div>
              </div>

              {/* Affected Services */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Affected Services</label>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  {viewingGeneralIssue.affectedServices.map(service => (
                    <span
                      key={service}
                      className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[10px] font-black uppercase tracking-widest"
                    >
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {(() => {
                const canEdit = isLead || viewingGeneralIssue.loggedBy?.trim().toLowerCase() === userName?.trim().toLowerCase();
                return (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Resolution / Workaround</label>
                    <textarea
                      className={cn(
                        "w-full px-4 py-3 border rounded-2xl text-sm font-medium outline-none transition-all resize-none",
                        canEdit
                          ? "bg-slate-50 border-slate-100 focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400"
                          : "bg-slate-50/50 border-slate-100 text-slate-500 cursor-default"
                      )}
                      placeholder={canEdit ? "Notes on resolution or current workaround..." : "No resolution notes added yet."}
                      rows={4}
                      readOnly={!canEdit}
                      value={viewingGeneralIssue.notes || ''}
                      onChange={canEdit ? e => setViewingGeneralIssue({ ...viewingGeneralIssue, notes: e.target.value }) : undefined}
                      onBlur={canEdit ? () => handleUpdateGeneralIssue(viewingGeneralIssue.id, { notes: viewingGeneralIssue.notes }) : undefined}
                    />
                    {canEdit && <p className="text-[10px] text-slate-400 font-medium italic px-1">Notes are auto-saved on blur.</p>}
                  </div>
                );
              })()}

              {/* Comments Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comments</label>
                  {(viewingGeneralIssue.comments?.length || 0) > 0 && (
                    <span className="ml-auto px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-black">
                      {viewingGeneralIssue.comments!.length}
                    </span>
                  )}
                </div>

                {/* Comment list */}
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {(!viewingGeneralIssue.comments || viewingGeneralIssue.comments.length === 0) ? (
                    <div className="flex flex-col items-center py-6 text-slate-300">
                      <MessageSquare className="w-8 h-8 mb-2" />
                      <p className="text-xs font-bold">No comments yet. Be the first to add one.</p>
                    </div>
                  ) : (
                    viewingGeneralIssue.comments.map((c: GeneralIssueComment) => {
                      const isMe = c.author?.trim().toLowerCase() === userName?.trim().toLowerCase();
                      const initials = c.author?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
                      return (
                        <div key={c.id} className={cn('flex gap-3', isMe && 'flex-row-reverse')}>
                          {/* Avatar */}
                          <div className={cn(
                            'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-sm',
                            isMe ? 'bg-teal-600' : 'bg-indigo-500'
                          )}>
                            {initials}
                          </div>
                          {/* Bubble */}
                          <div className={cn(
                            'flex-1 max-w-[80%] space-y-1',
                            isMe && 'items-end flex flex-col'
                          )}>
                            <div className={cn(
                              'flex items-baseline gap-2',
                              isMe && 'flex-row-reverse'
                            )}>
                              <span className="text-[10px] font-black text-slate-700">{c.author}</span>
                              <span className="text-[9px] text-slate-400" title={format(new Date(c.timestamp), 'dd MMM yyyy HH:mm')}>
                                {format(new Date(c.timestamp), 'dd MMM, HH:mm')}
                              </span>
                            </div>
                            <div className={cn(
                              'px-3 py-2 rounded-2xl text-sm font-medium text-slate-700 shadow-sm',
                              isMe
                                ? 'bg-teal-50 border border-teal-100 rounded-tr-sm'
                                : 'bg-slate-50 border border-slate-100 rounded-tl-sm'
                            )}>
                              {c.text}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {/* New comment input */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center text-[10px] font-black text-white shadow-sm">
                    {(userName || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 flex gap-2 items-end">
                    <textarea
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-400 transition-all resize-none"
                      placeholder="Add a comment or update..."
                      rows={2}
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={postingComment || !newCommentText.trim()}
                      className="flex-shrink-0 p-2.5 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-40 transition-all shadow-lg shadow-teal-600/20 flex items-center justify-center"
                      title="Post comment (Ctrl+Enter)"
                    >
                      {postingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* History */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    Logged by {viewingGeneralIssue.loggedBy}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {format(parseISO(viewingGeneralIssue.createdAt), 'dd MMM yyyy HH:mm')}
                  </span>
                </div>
                {(isLead || viewingGeneralIssue.loggedBy?.trim().toLowerCase() === userName?.trim().toLowerCase()) && (
                  <button 
                    onClick={() => handleDeleteGeneralIssue(viewingGeneralIssue.id)}
                    className="text-rose-400 hover:text-rose-600 transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Issue
                  </button>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-slate-50/50 flex gap-3 border-t border-slate-100">
              <button
                onClick={() => setViewingGeneralIssue(null)}
                className="w-full px-6 py-3 bg-slate-900 text-white text-sm font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Done Viewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
