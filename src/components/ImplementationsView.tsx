import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Layers, Clock, Search, Users, Filter, X, CheckCircle2, AlertTriangle, TrendingUp, MapPin, Upload, Package, Trash2 } from 'lucide-react';
import { cn, isRole } from '../lib/utils';
import { ServiceExtension, Role, AppConfig } from '../types';
import { api } from '../lib/api';
import { NewImplementationModal } from './NewImplementationModal';
import { ManageImplementationModal } from './ManageImplementationModal';
import { IMInsightsView } from './IMInsightsView';
import { ImplementationIssuesLog } from './ImplementationIssuesLog';
import { ConfirmationModal } from './common/ConfirmationModal';
import { Project, User } from '../types';

interface ImplementationsViewProps {
  userRole: Role;
  userName: string;
  config: AppConfig;
  projects: Project[];
  users: User[];
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
  initialFilter?: string;
  initialIM?: string;
  defaultTab?: 'mine' | 'all' | 'insights' | 'queue' | 'issues';
  mode?: 'dashboard' | 'list';
  onImportExtensions?: () => void;
}

// ── IM Personal Dashboard Analytics ──────────────────────────────────────────
const IMPersonalDashboard: React.FC<{ extensions: ServiceExtension[]; userName: string; onManage: (ext: ServiceExtension) => void }> = ({ extensions, userName, onManage }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    const total = extensions.length;
    const completed = extensions.filter(e => e.status === 'Completed').length;
    const inProgress = extensions.filter(e => e.status === 'In Progress').length;
    const notStarted = extensions.filter(e => e.status === 'Not Started').length;
    const frozen = extensions.filter(e => e.status === 'Suspended').length;
    const overdue = extensions.filter(e => e.status !== 'Completed' && e.status !== 'Suspended' && new Date(e.targetClosureDate) < today).length;
    const mapped = extensions.filter(e => e.mappingStatus === 'Approved').length;
    const openIssues = extensions.reduce((acc, e) => acc + (e.issues || []).filter(i => i.status !== 'Closed').length, 0);
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, notStarted, frozen, overdue, mapped, openIssues, completionRate };
  }, [extensions]);

  const upcoming = useMemo(() =>
    extensions
      .filter(e => e.status !== 'Completed')
      .sort((a, b) => new Date(a.targetClosureDate).getTime() - new Date(b.targetClosureDate).getTime())
      .slice(0, 5),
    [extensions]);

  const getDaysLabel = (dateStr: string) => {
    const diff = Math.ceil((new Date(dateStr).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-red-600 bg-red-50 border-red-200' };
    if (diff === 0) return { label: 'Due today', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    if (diff <= 7) return { label: `${diff}d left`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: `${diff}d left`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const overduelist = extensions.filter(e => e.status !== 'Completed' && e.status !== 'Suspended' && new Date(e.targetClosureDate) < today);

  return (
    <div className="space-y-6">
      {/* Overdue Alert */}
      {overduelist.length > 0 && (
        <div className="flex items-start gap-4 p-5 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-red-800">
              {overduelist.length} overdue implementation{overduelist.length > 1 ? 's' : ''} need attention
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {overduelist.map(e => (
                <button
                  key={e.id}
                  onClick={() => onManage(e)}
                  className="px-2.5 py-1 bg-white border border-red-200 rounded-lg text-xs font-bold text-red-700 hover:bg-red-100 transition-colors"
                >
                  {e.clientName} · {e.serviceName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Assigned</p>
          <p className="text-4xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Completion Rate</p>
          <p className="text-4xl font-black text-emerald-600">{stats.completionRate}%</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">{stats.completed} of {stats.total} done</p>
        </div>
        <div className={cn("rounded-2xl border p-5 shadow-sm", stats.overdue > 0 ? "bg-red-50 border-red-200" : "bg-white border-slate-200")}>
          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", stats.overdue > 0 ? "text-red-500" : "text-slate-400")}>Overdue</p>
          <p className={cn("text-4xl font-black", stats.overdue > 0 ? "text-red-600" : "text-slate-300")}>{stats.overdue}</p>
        </div>
        <div className={cn("rounded-2xl border p-5 shadow-sm", stats.openIssues > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-slate-200")}>
          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", stats.openIssues > 0 ? "text-amber-500" : "text-slate-400")}>Open Issues</p>
          <p className={cn("text-4xl font-black", stats.openIssues > 0 ? "text-amber-600" : "text-slate-300")}>{stats.openIssues}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Mapped to Projects</p>
          <p className="text-4xl font-black text-indigo-600">{stats.mapped}</p>
        </div>
      </div>

      {/* Status Strip + Upcoming Deadlines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-teal-600" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Status Breakdown</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'In Progress', count: stats.inProgress, color: 'bg-blue-500', textColor: 'text-blue-600' },
              { label: 'Not Started', count: stats.notStarted, color: 'bg-slate-300', textColor: 'text-slate-500' },
              { label: 'Completed', count: stats.completed, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
              { label: 'Suspended', count: stats.frozen, color: 'bg-amber-400', textColor: 'text-amber-600' },
            ].map(({ label, count, color, textColor }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-600">{label}</span>
                  <span className={cn("text-xs font-black", textColor)}>{count}</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-700", color)}
                    style={{ width: stats.total > 0 ? `${(count / stats.total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-500" />
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Upcoming Deadlines</h3>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-24 text-slate-400">
              <CheckCircle2 className="w-8 h-8 mb-2 text-emerald-400" />
              <p className="text-xs font-bold">All caught up!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map(ext => {
                const { label, color } = getDaysLabel(ext.targetClosureDate);
                return (
                  <button
                    key={ext.id}
                    onClick={() => onManage(ext)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition-colors group text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate group-hover:text-teal-700 transition-colors">{ext.clientName}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{ext.serviceName}</p>
                    </div>
                    <span className={cn("ml-3 px-2.5 py-1 text-[10px] font-black rounded-lg border flex-shrink-0", color)}>
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main View ─────────────────────────────────────────────────────────────────
export const ImplementationsView: React.FC<ImplementationsViewProps> = ({
  userRole, userName, config, projects, users, onShowToast, initialFilter, initialIM, defaultTab, mode, onImportExtensions
}) => {
  const [extensions, setExtensions] = useState<ServiceExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [managingExtension, setManagingExtension] = useState<ServiceExtension | null>(null);
  const [extensionToDelete, setExtensionToDelete] = useState<ServiceExtension | null>(null);

  const isLead = isRole(userRole, 'IM Lead') || isRole(userRole, 'Superadmin');
  const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'insights' | 'queue' | 'issues'>(defaultTab || (isLead ? 'insights' : 'mine'));

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [managerFilter, setManagerFilter] = useState<string>('All');
  const [serviceFilter, setServiceFilter] = useState<string>('All');
  const [monthFilter, setMonthFilter] = useState<string>('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (initialFilter && initialFilter !== 'All') {
      setStatusFilter(initialFilter);
      if (isLead && activeTab === 'mine') setActiveTab('all');
    }
    if (initialIM && initialIM !== 'All') {
      setManagerFilter(initialIM);
      if (isLead && activeTab === 'mine') setActiveTab('all');
    }
    setCurrentPage(1);
  }, [initialFilter, initialIM, isLead]);

  const loadExtensions = async () => {
    try {
      setLoading(true);
      let data;
      // IM Leads / Superadmins always get all extensions
      if (isLead) {
        data = await api.serviceExtensions.getAll();
      } else if (activeTab === 'issues') {
        // Plain IMs see the shared issue log (all extensions) so they can view cross-team issues
        data = await api.serviceExtensions.getAll();
      } else {
        data = await api.serviceExtensions.getByIM(userName);
      }
      setExtensions(data);
    } catch (err: any) {
      onShowToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExtensions();

    const channel = api.supabase
      .channel('service_extensions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_extensions' }, () => {
        loadExtensions();
      })
      .subscribe();

    return () => { api.supabase.removeChannel(channel); };
  }, [activeTab, userName, userRole]);

  const filteredExtensions = useMemo(() => {
    return extensions.filter(ext => {
      const matchesSearch = ext.clientName.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesStatus = statusFilter === 'All' || ext.status === statusFilter;
      
      // Special digest filters
      if (statusFilter === 'Mapping Pending') matchesStatus = ext.mappingStatus === 'Pending';
      if (statusFilter === 'Suspension Pending') matchesStatus = ext.suspensionRequest?.status === 'Pending';
      if (statusFilter === 'Extension Pending') matchesStatus = ext.extensionRequest?.status === 'Pending';
      if (statusFilter === 'Delayed') matchesStatus = ext.status !== 'Completed' && ext.status !== 'Suspended' && new Date(ext.targetClosureDate) < new Date();

      const matchesManager = managerFilter === 'All' || ext.implementationManager === managerFilter;
      const matchesService = serviceFilter === 'All' || ext.serviceName === serviceFilter;
      
      let matchesMonth = true;
      if (monthFilter !== 'All') {
        const d = new Date(ext.startDate);
        matchesMonth = d.getMonth() === parseInt(monthFilter);
      }

      return matchesSearch && matchesStatus && matchesManager && matchesService && matchesMonth;
    });
  }, [extensions, searchTerm, statusFilter, managerFilter, serviceFilter, monthFilter]);

  const validServices = useMemo(() => {
    return Array.from(new Set((extensions || []).map(e => e.serviceName))).sort();
  }, [extensions]);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const managers = useMemo(() => {
    // Pull from users table (role-based) — catches correctly configured IMs
    const imUserNames = users
      .filter(u => u.role === 'IM' || u.role === 'IM Lead' || u.role === 'Superadmin')
      .map(u => u.name);
    // Also pull from extensions data directly — catches IMs whose DB role is misconfigured
    // This ensures Feyi (and anyone like her) always appears in the filter
    const extensionManagerNames = extensions.map(e => e.implementationManager).filter(Boolean);
    return Array.from(new Set([...imUserNames, ...extensionManagerNames])).sort();
  }, [users, extensions]);

  const handleDelete = async () => {
    if (!extensionToDelete) return;
    
    try {
      await api.serviceExtensions.delete(extensionToDelete.id);
      onShowToast('Implementation deleted successfully.');
      loadExtensions();
    } catch (error) {
      console.error('Error deleting extension:', error);
      onShowToast('Failed to delete implementation.');
    } finally {
      setExtensionToDelete(null);
    }
  };

  const renderTable = () => {
    const statusColors: Record<string, string> = {
      'Not Started': 'bg-slate-100 text-slate-500',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Completed': 'bg-emerald-100 text-emerald-700',
      'Suspended': 'bg-slate-200 text-slate-600',
      'Frozen': 'bg-slate-200 text-slate-600',
    };

    const mappingStatusColors: Record<string, string> = {
      None: 'bg-slate-100 text-slate-400',
      Pending: 'bg-amber-100 text-amber-700',
      Approved: 'bg-emerald-100 text-emerald-700',
      Rejected: 'bg-red-100 text-red-600',
      Unmapped: 'bg-slate-200 text-slate-500',
    };

    const paginatedItems = filteredExtensions.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    const totalPages = Math.ceil(filteredExtensions.length / pageSize);

    return (
      <>
        {/* Filter Bar */}
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-teal-500 transition-colors" />
            <input
              type="text"
              placeholder="Search by client name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            {isLead && (
              <div className="relative group">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <select
                  value={managerFilter}
                  onChange={(e) => setManagerFilter(e.target.value)}
                  className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none shadow-sm cursor-pointer"
                >
                  <option value="All">All Managers</option>
                  {managers.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            <div className="relative group">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none shadow-sm cursor-pointer"
              >
                <option value="All">All Services</option>
                {validServices.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="relative group">
              <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none shadow-sm cursor-pointer"
              >
                <option value="All">All Months</option>
                {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div className="relative group">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 appearance-none shadow-sm cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
            {(searchTerm || managerFilter !== 'All' || statusFilter !== 'All' || serviceFilter !== 'All' || monthFilter !== 'All') && (
              <button
                onClick={() => { setSearchTerm(''); setManagerFilter('All'); setStatusFilter('All'); setServiceFilter('All'); setMonthFilter('All'); }}
                className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                title="Clear Filters"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Implementation List */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client & Service</th>
                    {isLead && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Manager</th>}
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progress</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Mapping</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredExtensions.length === 0 ? (
                    <tr>
                      <td colSpan={isLead ? 7 : 6} className="px-6 py-12 text-center text-slate-400 italic font-bold">
                        No matching implementations found.
                      </td>
                    </tr>
                  ) : (
                    paginatedItems.map((ext) => {
                      const completedCount = ext.milestones.filter(m => m.completed).length;
                      const totalCount = ext.milestones.length;
                      const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
                      
                      return (
                        <tr key={ext.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-black text-slate-900 leading-tight group-hover:text-teal-700 transition-colors">{ext.clientName}</p>
                              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">{ext.serviceName} ({ext.serviceVariant || 'Standard'})</p>
                            </div>
                          </td>
                          {isLead && (
                            <td className="px-6 py-4">
                              <p className="text-sm font-bold text-slate-700">{ext.implementationManager}</p>
                            </td>
                          )}
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2.5 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider",
                              statusColors[ext.status] || 'bg-slate-100 text-slate-500'
                            )}>
                              {ext.status === 'Suspended' ? 'Frozen' : ext.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="w-32">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase">
                                  {Math.round(progress)}%
                                </span>
                                <span className="text-[9px] font-bold text-slate-400">
                                  {completedCount} of {totalCount}
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-teal-500 rounded-full transition-all duration-500" 
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <p className="text-sm font-black text-slate-700">{ext.targetClosureDate}</p>
                              {ext.extensionRequest?.status === 'Pending' && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-black uppercase tracking-widest rounded w-fit flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" /> Pending Extension
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={cn(
                              "px-2 py-0.5 text-[9px] font-black rounded uppercase tracking-widest",
                              mappingStatusColors[ext.mappingStatus] || 'bg-slate-100 text-slate-400'
                            )}>
                              {ext.mappingStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setManagingExtension(ext)}
                                className="px-4 py-2 bg-teal-600 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-teal-700 transition-all active:scale-95 shadow-md shadow-teal-600/10"
                              >
                                Manage
                              </button>
                              {isLead && (
                                <button
                                  onClick={() => setExtensionToDelete(ext)}
                                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all active:scale-95"
                                  title="Delete Implementation"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {filteredExtensions.length > pageSize && (
          <div className="flex items-center justify-between bg-white px-8 py-4 rounded-2xl border border-slate-200 shadow-sm mb-8">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              Showing <span className="text-slate-900">{(currentPage - 1) * pageSize + 1}</span> to <span className="text-slate-900">{Math.min(currentPage * pageSize, filteredExtensions.length)}</span> of <span className="text-slate-900">{filteredExtensions.length}</span> results
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
      </>
    );
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Layers className="w-8 h-8 text-teal-600" />
            Ancillary Implementations
          </h2>
          <p className="text-slate-500 font-medium mt-1">
            {isLead ? 'Manage and monitor your team\'s ancillary service portfolio.' : 'Your ancillary service implementations at a glance.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLead && onImportExtensions && (
            <button
              onClick={onImportExtensions}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl transition-all"
            >
              <Upload className="w-4 h-4" />
              Import Bulk
            </button>
          )}
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 hover:shadow-teal-700/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            New Implementation
          </button>
        </div>
      </div>
      
      {mode === 'dashboard' && (
        <div className="bg-teal-50 border border-teal-100 rounded-2xl p-4 flex items-center gap-3 mb-6">
          <TrendingUp className="w-5 h-5 text-teal-600" />
          <p className="text-sm font-medium text-teal-800">Your implementation performance and portfolio insights.</p>
        </div>
      )}

      {/* Leads: Tabbed interface */}
      {isLead ? (
        <>
          {mode !== 'dashboard' && (
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
              <button onClick={() => setActiveTab('insights')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'insights' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Team Insights</button>
              <button onClick={() => setActiveTab('all')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Team Dashboard</button>
              <button onClick={() => setActiveTab('queue')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2", activeTab === 'queue' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                Suspension Queue
                {extensions.filter(e => e.suspensionRequest?.status === 'Pending').length > 0 && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </button>
              <button onClick={() => setActiveTab('mine')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'mine' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>My Implementations</button>
              <button onClick={() => setActiveTab('issues')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'issues' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Issue Log</button>
            </div>
          )}

          {activeTab === 'insights' || mode === 'dashboard' ? (
            <IMInsightsView 
              extensions={extensions} 
              users={users} 
              config={config} 
              onFilter={(status, manager) => {
                setActiveTab('all');
                setStatusFilter(status);
                if (manager) setManagerFilter(manager);
                else setManagerFilter('All');
              }}
            />
          ) : activeTab === 'queue' ? (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-500" />
                <p className="text-sm font-medium text-orange-800">Review and resolve pending suspension requests from implementation managers.</p>
              </div>
              {extensions.filter(e => e.suspensionRequest?.status === 'Pending').length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold">No pending suspension requests.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extensions.filter(e => e.suspensionRequest?.status === 'Pending').map(ext => (
                    <div key={ext.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-orange-200 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-black text-slate-900">{ext.clientName}</h4>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ext.serviceName}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">by {ext.implementationManager}</span>
                      </div>
                      <div className="bg-orange-50/50 p-3 rounded-xl border border-orange-100 mb-4 italic text-sm text-orange-800">
                        "{ext.suspensionRequest?.reason}"
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setManagingExtension(ext)}
                          className="flex-1 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800"
                        >Review Details</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'issues' ? (
            <ImplementationIssuesLog 
              extensions={extensions}
              onManage={setManagingExtension}
              isLead={isLead}
              config={config}
            />
          ) : renderTable()}
        </>
      ) : (
        /* IMs: unified dashboard + table */
        <>
          {mode !== 'dashboard' && (
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6">
              <button onClick={() => setActiveTab('mine')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'mine' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>My Implementations</button>
              <button onClick={() => setActiveTab('issues')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'issues' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Issue Log</button>
            </div>
          )}

          {activeTab === 'issues' ? (
            <ImplementationIssuesLog 
              extensions={extensions}
              onManage={setManagingExtension}
              isLead={isLead}
              config={config}
            />
          ) : (
            <>
              {!loading && extensions.length > 0 && (
                <IMPersonalDashboard
                  extensions={extensions}
                  userName={userName}
                  onManage={setManagingExtension}
                />
              )}
              {mode !== 'dashboard' && (
                <div className="mt-8">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">All My Implementations</h3>
                  {renderTable()}
                </div>
              )}
            </>
          )}
        </>
      )}

      {isNewModalOpen && (
        <NewImplementationModal
          isOpen={isNewModalOpen}
          onClose={() => setIsNewModalOpen(false)}
          onSuccess={() => {
            setIsNewModalOpen(false);
            loadExtensions();
            onShowToast('New implementation created successfully.');
          }}
          config={config}
          userName={userName}
          userRole={userRole}
          users={users}
        />
      )}

      {managingExtension && (
        <ManageImplementationModal
          extension={managingExtension}
          isOpen={!!managingExtension}
          onClose={() => setManagingExtension(null)}
          onUpdated={(updated) => {
            setExtensions(prev => prev.map(e => e.id === updated.id ? updated : e));
            setManagingExtension(updated);
          }}
          userRole={userRole}
          userName={userName}
          config={config}
          onShowToast={onShowToast}
        />
      )}

      {extensionToDelete && (
        <ConfirmationModal
          isOpen={!!extensionToDelete}
          onClose={() => setExtensionToDelete(null)}
          onConfirm={handleDelete}
          title="Delete Implementation"
          message={`Are you sure you want to permanently delete the implementation for ${extensionToDelete.client_name}? This action cannot be undone.`}
          confirmText="Delete"
          type="danger"
        />
      )}
    </div>
  );
};
