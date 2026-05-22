import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Layers, Clock, Search, Users, Filter, X, CheckCircle2, AlertTriangle, TrendingUp, MapPin, Upload, Package, Trash2, RefreshCw, Check } from 'lucide-react';
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
  defaultTab?: 'mine' | 'all' | 'insights' | 'suspension-queue' | 'mapping-queue' | 'issues';
  mode?: 'dashboard' | 'list';
  onImportExtensions?: () => void;
  onNavigate?: (view: string, filter?: string, tab?: string) => void;
  onTabChange?: (tab: any) => void;
}

// ── IM Personal Dashboard Analytics ──────────────────────────────────────────
const IMPersonalDashboard: React.FC<{ extensions: ServiceExtension[]; userName: string; config: AppConfig; onManage: (ext: ServiceExtension) => void; onNavigate?: (view: string, filter?: string, tab?: string) => void }> = ({ extensions, userName, config, onManage, onNavigate }) => {
  const [periodFilter, setPeriodFilter] = useState<string>('All Time');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredExtensions = useMemo(() => {
    if (periodFilter === 'All Time') return extensions;
    return extensions.filter(e => {
      const d = e.targetClosureDate ? new Date(e.targetClosureDate) : new Date(e.startDate);
      if (isNaN(d.getTime())) return true;
      if (periodFilter === 'Q1') return d.getMonth() >= 0 && d.getMonth() <= 2;
      if (periodFilter === 'Q2') return d.getMonth() >= 3 && d.getMonth() <= 5;
      if (periodFilter === 'Q3') return d.getMonth() >= 6 && d.getMonth() <= 8;
      if (periodFilter === 'Q4') return d.getMonth() >= 9 && d.getMonth() <= 11;
      
      const yearMatch = periodFilter.match(/^Year: (\d+)$/);
      if (yearMatch) return d.getFullYear() === parseInt(yearMatch[1]);

      const monthMatch = periodFilter.match(/^Month: (\d+)$/);
      if (monthMatch) return d.getMonth() === parseInt(monthMatch[1]);
      
      return true;
    });
  }, [extensions, periodFilter]);

  const stats = useMemo(() => {
    const total = filteredExtensions.filter(e => e.status !== 'Cancelled').length;
    const completed = filteredExtensions.filter(e => e.status === 'Completed').length;
    const inProgress = filteredExtensions.filter(e => e.status === 'In Progress').length;
    const notStarted = filteredExtensions.filter(e => e.status === 'Not Started').length;
    const frozen = filteredExtensions.filter(e => e.status === 'Suspended').length;
    const cancelled = filteredExtensions.filter(e => e.status === 'Cancelled').length;
    const overdue = filteredExtensions.filter(e => 
      e.status !== 'Completed' && 
      e.status !== 'Suspended' && 
      e.status !== 'Cancelled' &&
      !e.serviceName.toLowerCase().includes('api') &&
      new Date(e.targetClosureDate) < today
    ).length;
    const mapped = filteredExtensions.filter(e => e.mappingStatus === 'Approved').length;
    const openIssues = filteredExtensions.reduce((acc, e) => acc + (e.issues || []).filter(i => i.status !== 'Closed').length, 0);
    // Calculate Weighted Performance Index
    let ws = 0;
    let tw = 0;
    
    const weightMap: Record<string, number> = {};
    config.packages?.forEach(p => { weightMap[p.name] = p.storyPoints; });
    
    const getIMStoryPoint = (raw: number) => {
      if (raw >= 13) return 3;
      if (raw >= 5) return 2;
      return 1;
    };

    filteredExtensions.forEach(ext => {
      if (ext.status === 'Suspended' || ext.status === 'Cancelled') return;

      const pkg = config.packages?.find(p => p.name === ext.serviceName || p.name === ext.serviceVariant);
      const rawWeight = pkg?.storyPoints || weightMap[ext.serviceVariant] || weightMap[ext.serviceName] || 
                        Object.entries(weightMap).find(([k]) => ext.serviceName.includes(k))?.[1] || 1;
      const baseWeight = getIMStoryPoint(rawWeight);
      const isApi = ext.serviceName.toLowerCase().includes('api') || (ext.serviceVariant || '').toLowerCase().includes('api');

      let progress = 0;
      if (ext.status === 'Completed') {
        progress = 1;
      } else if (ext.milestones?.length > 0) {
        progress = ext.milestones.filter(m => m.completed).length / ext.milestones.length;
      } else {
        // Fallback if no milestones exist
        progress = ext.status === 'In Progress' ? 0.5 : 0;
      }
      
      let penalty = 0;
      if (ext.status !== 'Completed' && !isApi && new Date(ext.targetClosureDate) < today) {
        const daysOverdue = Math.floor((today.getTime() - new Date(ext.targetClosureDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue <= 7) penalty = 0.05;
        else if (daysOverdue <= 14) penalty = 0.10;
        else penalty = 0.20;
      }
      
      ws += (progress - penalty) * baseWeight;
      tw += baseWeight; // Denominator ALWAYS takes full weight
    });

    let performanceIndex = tw > 0 ? Math.max(0, Math.round((ws / tw) * 100)) : 0;
    const suspensionRate = total > 0 ? Math.round((frozen / total) * 100) : 0;

    // Portfolio Health Penalty: -5% if suspension rate > 30%
    if (suspensionRate > 30) {
      performanceIndex = Math.max(0, performanceIndex - 5);
    }

    return { total, completed, inProgress, notStarted, frozen, cancelled, overdue, mapped, openIssues, performanceIndex, suspensionRate };
  }, [filteredExtensions, config]);

  const upcoming = useMemo(() =>
    filteredExtensions
      .filter(e => {
        if (e.status === 'Completed' || e.status === 'Suspended' || e.status === 'Cancelled') return false;
        if (!e.targetClosureDate) return false;
        const d = new Date(e.targetClosureDate);
        return !isNaN(d.getTime());
      })
      .sort((a, b) => new Date(a.targetClosureDate).getTime() - new Date(b.targetClosureDate).getTime())
      .slice(0, 5),
    [filteredExtensions]);

  const getDaysLabel = (dateStr: string) => {
    if (!dateStr) return { label: 'No date', color: 'text-slate-400 bg-slate-50 border-slate-200' };
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { label: 'Invalid date', color: 'text-slate-400 bg-slate-50 border-slate-200' };
    
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { label: `${Math.abs(diff)}d overdue`, color: 'text-red-600 bg-red-50 border-red-200' };
    if (diff === 0) return { label: 'Due today', color: 'text-orange-600 bg-orange-50 border-orange-200' };
    if (diff <= 7) return { label: `${diff}d left`, color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { label: `${diff}d left`, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
  };

  const overduelist = filteredExtensions.filter(e => 
    e.status !== 'Completed' && 
    e.status !== 'Suspended' && 
    e.status !== 'Cancelled' &&
    !e.serviceName.toLowerCase().includes('api') &&
    new Date(e.targetClosureDate) < today
  );

  return (
    <div className="space-y-6">
      {/* Period Filter Bar */}
      <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-200 shadow-sm w-fit">
        {['All Time', 'Q1', 'Q2', 'Q3', 'Q4', `Year: ${today.getFullYear()}`].map(period => (
          <button
            key={period}
            onClick={() => setPeriodFilter(period)}
            className={cn(
              "px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider",
              periodFilter === period
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            {period === `Year: ${today.getFullYear()}` ? 'This Year' : period}
          </button>
        ))}
      </div>

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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Assigned</p>
          <p className="text-4xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Performance Index</p>
          <p className="text-4xl font-black text-emerald-600">{stats.performanceIndex}%</p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">{stats.completed} projects completed</p>
        </div>
        <div className={cn("rounded-2xl border p-5 shadow-sm flex flex-col justify-between", 
          stats.suspensionRate >= 30 ? "bg-red-50 border-red-200" : 
          stats.suspensionRate >= 20 ? "bg-orange-50 border-orange-200" : "bg-white border-slate-200"
        )}>
          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", 
            stats.suspensionRate >= 30 ? "text-red-500" : 
            stats.suspensionRate >= 20 ? "text-orange-500" : "text-slate-400"
          )}>Portfolio Health</p>
          <div>
            <div className="flex items-baseline gap-1">
              <p className={cn("text-4xl font-black", 
                stats.suspensionRate >= 30 ? "text-red-600" : 
                stats.suspensionRate >= 20 ? "text-orange-600" : "text-slate-900"
              )}>{stats.suspensionRate}%</p>
              <p className={cn("text-[10px] font-bold",
                stats.suspensionRate >= 30 ? "text-red-500" : 
                stats.suspensionRate >= 20 ? "text-orange-500" : "text-slate-400"
              )}>suspended</p>
            </div>
            {stats.suspensionRate >= 30 && <p className="text-[10px] font-bold text-red-500 mt-1">-5% Penalty Active</p>}
            {stats.suspensionRate >= 20 && stats.suspensionRate < 30 && <p className="text-[10px] font-bold text-orange-500 mt-1">Warning: Nearing 30%</p>}
          </div>
        </div>
        <div 
          className={cn("rounded-2xl border p-5 shadow-sm transition-colors", stats.overdue > 0 ? "bg-red-50 border-red-200 hover:bg-red-100 cursor-pointer" : "bg-white border-slate-200 cursor-pointer hover:bg-slate-50")}
          onClick={() => onNavigate?.('implementations', 'Delayed')}
        >
          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", stats.overdue > 0 ? "text-red-500" : "text-slate-400")}>Overdue</p>
          <p className={cn("text-4xl font-black", stats.overdue > 0 ? "text-red-600" : "text-slate-300")}>{stats.overdue}</p>
        </div>
        <div 
          className={cn("rounded-2xl border p-5 shadow-sm transition-colors", stats.openIssues > 0 ? "bg-amber-50 border-amber-200 hover:bg-amber-100 cursor-pointer" : "bg-white border-slate-200 cursor-pointer hover:bg-slate-50")}
          onClick={() => onNavigate?.('implementations', undefined, 'issues')}
        >
          <p className={cn("text-[10px] font-black uppercase tracking-widest mb-2", stats.openIssues > 0 ? "text-amber-500" : "text-slate-400")}>Open Issues</p>
          <p className={cn("text-4xl font-black", stats.openIssues > 0 ? "text-amber-600" : "text-slate-300")}>{stats.openIssues}</p>
        </div>
        <div 
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm cursor-pointer hover:bg-indigo-50 transition-colors group"
          onClick={() => onNavigate?.('projects')}
        >
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-500 transition-colors">Mapped to Projects</p>
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
  userRole, userName, config, projects, users, onShowToast, initialFilter, initialIM, defaultTab, mode, onImportExtensions, onNavigate, onTabChange
}) => {
  const [extensions, setExtensions] = useState<ServiceExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [managingExtension, setManagingExtension] = useState<ServiceExtension | null>(null);
  const [extensionToDelete, setExtensionToDelete] = useState<ServiceExtension | null>(null);

  const isLead = isRole(userRole, 'IM Lead') || isRole(userRole, 'Superadmin');
  const initialTab = defaultTab as any || (isLead ? 'insights' : 'mine');
  const [activeTab, setActiveTab] = useState<'mine' | 'all' | 'insights' | 'requests-queue' | 'mapping-queue' | 'issues' | 'pm-dashboard'>(initialTab);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [managerFilter, setManagerFilter] = useState<string>('All');
  const [serviceFilters, setServiceFilters] = useState<string[]>([]);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [monthFilter, setMonthFilter] = useState<string>('All');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (initialFilter && initialFilter !== 'All') {
      setStatusFilter(initialFilter);
      if (initialFilter === 'Mapping Pending') {
        setActiveTab('mapping-queue');
      } else if (isLead && activeTab === 'mine') {
        setActiveTab('all');
      }
    }
    if (initialIM && initialIM !== 'All') {
      setManagerFilter(initialIM);
      if (isLead && activeTab === 'mine') setActiveTab('all');
    }
    setCurrentPage(1);
  }, [initialFilter, initialIM, isLead]);

  // NOTE: defaultTab is intentionally only used for initial state to avoid circular updates.
  // Do not add an effect that syncs defaultTab → activeTab or activeTab → onTabChange,
  // as that creates an infinite re-render loop (activeTab → onTabChange → parent state → defaultTab → effect → activeTab...).

  const loadExtensions = async () => {
    try {
      setLoading(true);
      let data: ServiceExtension[];
      
      // IM Leads / Superadmins / PMs in queue get all extensions initially to filter
      if (isLead || activeTab === 'mapping-queue' || activeTab === 'requests-queue' || isRole(userRole, 'PM')) {
        data = await api.serviceExtensions.getAll();
      } else if (activeTab === 'issues') {
        data = await api.serviceExtensions.getAll();
      } else {
        data = await api.serviceExtensions.getByIM(userName);
      }

      // PM Visibility Restriction: Only see implementations for projects assigned to them
      if (isRole(userRole, 'PM') && !isLead) {
        const myProjectIds = projects
          .filter(p => p.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase())
          .map(p => p.id);
        
        data = data.filter(ext => 
          ext.linkedProjectId && myProjectIds.includes(ext.linkedProjectId)
        );
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
      
      let matchesStatus = statusFilter === 'All' ? ext.status !== 'Cancelled' : ext.status === statusFilter;
      
      // Special digest filters
      if (statusFilter === 'Mapping Pending') matchesStatus = ext.mappingStatus === 'Pending';
      if (statusFilter === 'Suspension Pending') matchesStatus = ext.suspensionRequest?.status === 'Pending';
      if (statusFilter === 'Extension Pending') matchesStatus = ext.extensionRequest?.status === 'Pending';
      if (statusFilter === 'Delayed') matchesStatus = ext.status !== 'Completed' && ext.status !== 'Suspended' && ext.status !== 'Cancelled' && !ext.serviceName.toLowerCase().includes('api') && new Date(ext.targetClosureDate) < new Date();

      const matchesManager = managerFilter === 'All' || ext.implementationManager === managerFilter;
      const matchesService = serviceFilters.length === 0 || serviceFilters.includes(ext.serviceName);
      
      let matchesMonth = true;
      if (monthFilter !== 'All') {
        const d = new Date(ext.startDate);
        matchesMonth = d.getMonth() === parseInt(monthFilter);
      }

      let matchesTab = true;
      if (activeTab === 'pm-dashboard') {
        matchesTab = ext.mappingStatus === 'Approved';
      }

      return matchesSearch && matchesStatus && matchesManager && matchesService && matchesMonth && matchesTab;
    });
  }, [extensions, searchTerm, statusFilter, managerFilter, serviceFilters, monthFilter, activeTab]);

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

  const renderMappingQueue = () => (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3">
        <MapPin className="w-5 h-5 text-amber-500" />
        <p className="text-sm font-medium text-amber-800">Review and approve requests from IMs to link implementations to your projects.</p>
      </div>
      {extensions.filter(e => e.mappingStatus === 'Pending').length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-500 font-bold">No pending mapping requests.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {extensions.filter(e => e.mappingStatus === 'Pending').map(ext => {
            const linkedProject = projects.find(p => p.id === ext.linkedProjectId);
            const isForUser = linkedProject?.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase();
            
            if (!isLead && !isForUser) return null;

            return (
              <div key={ext.id} className={cn("bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-amber-200 transition-colors", isForUser && "border-l-4 border-l-amber-500")}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-black text-slate-900">{ext.clientName}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ext.serviceName}</p>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IM: {ext.implementationManager}</span>
                </div>
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 mb-4 space-y-2">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Target Project</p>
                  <p className="text-sm font-bold text-slate-700">{linkedProject?.clientName || 'Unknown Project'}</p>
                  {ext.mappingNotes && <p className="text-xs text-amber-700 italic">"{ext.mappingNotes}"</p>}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setManagingExtension(ext)}
                    className="flex-1 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800"
                  >Review & Approve</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderPMMiniDashboard = () => {
    const mappedExts = extensions.filter(e => e.mappingStatus === 'Approved');
    const completed = mappedExts.filter(e => e.status === 'Completed').length;
    const suspended = mappedExts.filter(e => e.status === 'Suspended' || e.status === 'Frozen').length;
    const inProgress = mappedExts.filter(e => e.status === 'In Progress').length;

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Total Mapped</p>
          <p className="text-3xl font-black text-slate-900">{mappedExts.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
          <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-1">Completed</p>
          <p className="text-3xl font-black text-emerald-700">{completed}</p>
        </div>
        <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
          <p className="text-xs font-black text-blue-500 uppercase tracking-widest mb-1">In Progress</p>
          <p className="text-3xl font-black text-blue-700">{inProgress}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Suspended</p>
          <p className="text-3xl font-black text-slate-700">{suspended}</p>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    const statusColors: Record<string, string> = {
      'Not Started': 'bg-slate-100 text-slate-500',
      'In Progress': 'bg-blue-100 text-blue-700',
      'Completed': 'bg-emerald-100 text-emerald-700',
      'Suspended': 'bg-slate-200 text-slate-600',
      'Frozen': 'bg-slate-200 text-slate-600',
      'Cancelled': 'bg-rose-100 text-rose-700',
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
            {(isLead || isRole(userRole, 'PM')) && (
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
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
              <button
                onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
                className="pl-11 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 shadow-sm text-left relative min-w-[160px]"
              >
                <span className="block truncate">
                  {serviceFilters.length === 0 ? 'All Services' : `${serviceFilters.length} Selected`}
                </span>
              </button>
              
              {isServiceDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsServiceDropdownOpen(false)} />
                  <div className="absolute top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-2 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto pr-1 custom-scrollbar flex flex-col gap-1">
                      <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                        <div className="relative flex items-center justify-center w-5 h-5 rounded border border-slate-300 group-hover:border-teal-500">
                          <input
                            type="checkbox"
                            className="peer sr-only"
                            checked={serviceFilters.length === 0}
                            onChange={() => setServiceFilters([])}
                          />
                          <div className={cn("absolute inset-0 rounded bg-teal-500 opacity-0 peer-checked:opacity-100 transition-opacity flex items-center justify-center")}>
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        </div>
                        <span className={cn("text-sm font-medium", serviceFilters.length === 0 ? "text-slate-900" : "text-slate-600")}>All Services</span>
                      </label>
                      
                      {validServices.map(s => (
                        <label key={s} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors group">
                          <div className="relative flex items-center justify-center w-5 h-5 rounded border border-slate-300 group-hover:border-teal-500">
                            <input
                              type="checkbox"
                              className="peer sr-only"
                              checked={serviceFilters.includes(s)}
                              onChange={() => {
                                if (serviceFilters.includes(s)) {
                                  setServiceFilters(serviceFilters.filter(f => f !== s));
                                } else {
                                  setServiceFilters([...serviceFilters, s]);
                                }
                              }}
                            />
                            <div className={cn("absolute inset-0 rounded bg-teal-500 opacity-0 peer-checked:opacity-100 transition-opacity flex items-center justify-center")}>
                              <Check className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                          <span className={cn("text-sm font-medium", serviceFilters.includes(s) ? "text-slate-900" : "text-slate-600")}>{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
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
                <option value="Cancelled">Cancelled</option>
                <option value="Delayed">Overdue</option>
              </select>
            </div>
            {(searchTerm || managerFilter !== 'All' || statusFilter !== 'All' || serviceFilters.length > 0 || monthFilter !== 'All') && (
              <button
                onClick={() => { setSearchTerm(''); setManagerFilter('All'); setStatusFilter('All'); setServiceFilters([]); setMonthFilter('All'); }}
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
      {!(mode === 'dashboard' && isRole(userRole, 'PM')) && (
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
          {!isRole(userRole, 'PM') && (
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-6 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 hover:shadow-teal-700/30 transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Implementation
            </button>
          )}
        </div>
      </div>
      )}
      
      {mode === 'dashboard' && !isRole(userRole, 'PM') && (
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
              <button onClick={loadExtensions} className="p-2 text-slate-400 hover:text-teal-600 transition-colors" title="Refresh Feed"><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></button>
              <button onClick={() => setActiveTab('insights')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'insights' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Team Insights</button>
              <button onClick={() => setActiveTab('all')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'all' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Team Dashboard</button>
              <button onClick={() => setActiveTab('requests-queue')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2", activeTab === 'requests-queue' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                Requests Queue
                {extensions.filter(e => e.suspensionRequest?.status === 'Pending' || e.reactivationRequest?.status === 'Pending').length > 0 && (
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </button>
              <button onClick={() => setActiveTab('mapping-queue')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2", activeTab === 'mapping-queue' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                Mapping Queue
                {extensions.filter(e => e.mappingStatus === 'Pending').length > 0 && (
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
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
              onManage={(id) => {
                const ext = extensions.find(e => e.id === id);
                if (ext) setManagingExtension(ext);
              }}
            />
          ) : activeTab === 'requests-queue' ? (
            <div className="space-y-4">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-500" />
                <p className="text-sm font-medium text-orange-800">Review and resolve pending suspension and reactivation requests.</p>
              </div>
              {extensions.filter(e => e.suspensionRequest?.status === 'Pending' || e.reactivationRequest?.status === 'Pending').length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 border-dashed p-12 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-slate-500 font-bold">No pending requests.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {extensions.filter(e => e.suspensionRequest?.status === 'Pending' || e.reactivationRequest?.status === 'Pending').map(ext => {
                    const isSuspension = ext.suspensionRequest?.status === 'Pending';
                    const isReactivation = ext.reactivationRequest?.status === 'Pending';
                    return (
                      <div key={ext.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-orange-200 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-black text-slate-900">{ext.clientName}</h4>
                              <span className={cn("px-2 py-0.5 text-[10px] font-black uppercase tracking-widest rounded-full", isSuspension ? "bg-orange-100 text-orange-700" : "bg-emerald-100 text-emerald-700")}>
                                {isSuspension ? 'Suspension' : 'Reactivation'}
                              </span>
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{ext.serviceName}</p>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">by {ext.implementationManager}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4 italic text-sm text-slate-700">
                          "{isSuspension ? ext.suspensionRequest?.reason : ext.reactivationRequest?.reason}"
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setManagingExtension(ext)}
                            className="flex-1 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-800"
                          >Review Details</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'mapping-queue' ? (
            renderMappingQueue()
          ) : activeTab === 'issues' ? (
            <ImplementationIssuesLog 
              extensions={extensions}
              onManage={setManagingExtension}
              isLead={isLead}
              config={config}
              userName={userName}
              onShowToast={onShowToast}
            />
          ) : renderTable()}
        </>
      ) : (
        /* IMs: unified dashboard + table */
        <>
          {mode !== 'dashboard' && (
            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit mb-6">
              <button onClick={loadExtensions} className="p-2 text-slate-400 hover:text-teal-600 transition-colors" title="Refresh Feed"><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /></button>
              {isRole(userRole, 'IM') && <button onClick={() => setActiveTab('mine')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'mine' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>My Implementations</button>}
              {isRole(userRole, 'PM') && (
                <>
                  <button onClick={() => setActiveTab('pm-dashboard')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'pm-dashboard' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>My Portfolio</button>
                  <button onClick={() => setActiveTab('mapping-queue')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2", activeTab === 'mapping-queue' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    Mapping Queue
                    {extensions.some(e => e.mappingStatus === 'Pending' && projects.find(p => p.id === e.linkedProjectId)?.assignedPM === userName) && (
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                    )}
                  </button>
                </>
              )}
              <button onClick={() => setActiveTab('issues')} className={cn("px-4 py-2 text-sm font-bold rounded-lg transition-all", activeTab === 'issues' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>Issue Log</button>
            </div>
          )}

          {activeTab === 'issues' ? (
            <ImplementationIssuesLog 
              extensions={extensions}
              onManage={setManagingExtension}
              isLead={isLead}
              config={config}
              userName={userName}
              onShowToast={onShowToast}
            />
          ) : activeTab === 'mapping-queue' ? (
            renderMappingQueue()
          ) : activeTab === 'pm-dashboard' ? (
            <>
              {!loading && extensions.length > 0 && renderPMMiniDashboard()}
              <div className="mt-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Mapped Implementations</h3>
                {renderTable()}
              </div>
            </>
          ) : (
            <>
              {isRole(userRole, 'IM') && !loading && extensions.length > 0 && (
                <IMPersonalDashboard
                  extensions={extensions}
                  userName={userName}
                  config={config}
                  onManage={setManagingExtension}
                  onNavigate={onNavigate}
                />
              )}
              {mode !== 'dashboard' && (
                <div className="mt-8">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">
                    {isRole(userRole, 'IM') ? 'All My Implementations' : 'Mapped Implementations'}
                  </h3>
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
          projects={projects}
        />
      )}

      {extensionToDelete && (
        <ConfirmationModal
          isOpen={!!extensionToDelete}
          onClose={() => setExtensionToDelete(null)}
          onConfirm={handleDelete}
          title="Delete Implementation"
          message={`Are you sure you want to permanently delete the implementation for ${extensionToDelete.clientName}? This action cannot be undone.`}
          confirmLabel="Delete"
          variant="danger"
        />
      )}
    </div>
  );
};
