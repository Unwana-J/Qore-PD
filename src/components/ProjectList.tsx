import React, { useState, useMemo } from 'react';
import { Project, ProjectState } from '../types';
import { formatCurrency, cn, getActiveDaysCount, calculateSPI, getAutoProjectState, getEffectiveServiceIds, getServiceNames } from '../lib/utils';
import { motion } from 'motion/react';
import { PROJECT_STATES } from '../constants';
import { PROJECT_STATE_COLORS, PRIORITY_COLORS, getThemeClasses } from '../lib/theme';
import { differenceInDays, parseISO, subDays, format } from 'date-fns';
import { AlertCircle, AlertTriangle, BarChart2, DollarSign, Search, Filter, MoreHorizontal, Calendar, User, ChevronRight, TrendingUp, TrendingDown, Minus, ChevronDown, Check, X, RefreshCw } from 'lucide-react';
import { Role, PackageConfig, ServiceBaseline } from '../types';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  themeColor?: string;
  staleThresholdDays: number;
  userRole: Role;
  users: any[];
  packages: PackageConfig[];
  serviceBaselines: ServiceBaseline[];
  allPMNames: string[];
  onReassignProject: (project: Project) => void;
  spiThresholds: { onTrack: number, atRisk: number };
  initialSearch?: string;
  initialStateFilter?: ProjectState | 'All';
  initialPMFilter?: string;
  onBackToDigest?: () => void;
  loading?: boolean;
  customTags?: { id: string; name: string; color: string }[];
}

export const ProjectList: React.FC<ProjectListProps> = ({ 
  projects, onSelectProject, userRole, users, packages = [], serviceBaselines = [], allPMNames = [], onReassignProject, 
  themeColor = 'teal', staleThresholdDays, spiThresholds, initialSearch = '', initialStateFilter = 'All', 
  initialPMFilter, onBackToDigest, loading = false, customTags = []
}) => {
  const [search, setSearch] = useState(initialSearch);
  const [stateFilter, setStateFilter] = useState<ProjectState | 'All'>(initialStateFilter);
  const [periodFilter, setPeriodFilter] = useState<string>('All Time');
  const [customDateRange, setCustomDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [selectedPMs, setSelectedPMs] = useState<string[]>(initialPMFilter ? [initialPMFilter] : []);
  const [portfolioFilter, setPortfolioFilter] = useState<'All' | 'Enterprise' | 'Initiative'>('All');
  
  const [isPackageDropdownOpen, setIsPackageDropdownOpen] = useState(false);
  const [isPMDropdownOpen, setIsPMDropdownOpen] = useState(false);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  const theme = getThemeClasses(themeColor);
  const canReassign = ['Superadmin', 'Manager', 'Team Lead'].includes(userRole);
  const showAdvancedFilters = ['Superadmin', 'Manager', 'Finance', 'Executive'].includes(userRole);

  const getPMStatus = (pmName: string) => {
    const pm = users.find(u => u.name === pmName);
    return pm?.status || 'Active';
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // 1. Search
      const matchesSearch = (p.clientName || '').toLowerCase().includes(search.toLowerCase()) || 
                            (p.assignedPM || '').toLowerCase().includes(search.toLowerCase());
      if (!matchesSearch) return false;

      // 2. State
      if (stateFilter !== 'All' && p.state !== stateFilter) return false;

      // 3. Portfolio
      if (portfolioFilter === 'Enterprise') {
        if (p.isInternalInitiative || p.priority !== 'P1') return false;
      } else if (portfolioFilter === 'Initiative') {
        if (!p.isInternalInitiative) return false;
      }

      // 4. Packages
      if (selectedPackages.length > 0 && !selectedPackages.includes(p.packageName)) return false;

      // 5. PMs
      if (selectedPMs.length > 0 && !selectedPMs.includes(p.assignedPM)) return false;

      // 6. Period
      if (periodFilter !== 'All Time') {
        const pDate = new Date(p.startDate);
        if (periodFilter === 'Custom') {
          if (customDateRange.from && pDate < new Date(customDateRange.from)) return false;
          if (customDateRange.to && pDate > new Date(customDateRange.to)) return false;
        } else {
          if (pDate.getFullYear().toString() !== periodFilter) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (canReassign) {
        const aInactive = getPMStatus(a.assignedPM) === 'Inactive' ? 1 : 0;
        const bInactive = getPMStatus(b.assignedPM) === 'Inactive' ? 1 : 0;
        if (aInactive !== bInactive) return bInactive - aInactive;
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [projects, search, stateFilter, portfolioFilter, selectedPackages, selectedPMs, periodFilter, customDateRange, canReassign]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          {onBackToDigest && (
            <button
              onClick={onBackToDigest}
              className={cn(
                "flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all active:scale-95 shrink-0"
              )}
            >
              <BarChart2 className="w-4 h-4" />
              Back to Digest
            </button>
          )}
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Search clients or PMs..."
              className={cn(
                "w-full pl-11 pr-4 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 transition-all hover:border-slate-200",
                theme.ring, "focus:border-slate-200 focus:bg-white"
              )}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            />
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 px-1 text-slate-400">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Synchronizing projects...</span>
          </div>
        )}

        {/* Advanced Filter Bar (For Privileged Roles) */}
        {showAdvancedFilters && (
          <div className="bg-white p-2 rounded-[28px] border border-slate-200 shadow-sm flex flex-wrap items-center gap-2">
            {/* Period Filter */}
            <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
              {['All Time', '2023', '2024', '2025', '2026', 'Custom'].map(period => (
                <button
                  key={period}
                  onClick={() => {
                    setPeriodFilter(period);
                    if (period !== 'Custom') setIsCustomDateOpen(false);
                    else setIsCustomDateOpen(true);
                  }}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider",
                    periodFilter === period
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                  )}
                >
                  {period}
                </button>
              ))}
            </div>

            {isCustomDateOpen && periodFilter === 'Custom' && (
              <div className="absolute top-44 left-6 z-50 bg-white p-4 rounded-3xl border border-slate-200 shadow-2xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
                <div className="flex gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">From</label>
                    <input 
                      type="date" 
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none ring-teal-500/20 focus:ring-2"
                      value={customDateRange.from}
                      onChange={e => setCustomDateRange(prev => ({ ...prev, from: e.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase">To</label>
                    <input 
                      type="date" 
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none ring-teal-500/20 focus:ring-2"
                      value={customDateRange.to}
                      onChange={e => setCustomDateRange(prev => ({ ...prev, to: e.target.value }))}
                    />
                  </div>
                </div>
                <button 
                  onClick={() => setIsCustomDateOpen(false)}
                  className={cn("w-full py-2 rounded-xl text-white text-[10px] font-black uppercase tracking-widest transition-all", theme.bg, theme.hoverBg)}
                >
                  Apply Custom Range
                </button>
              </div>
            )}

            <div className="h-6 w-px bg-slate-200 mx-1" />

            {/* Packages Multi-Select */}
            <div className="relative">
              <button
                onClick={() => { setIsPackageDropdownOpen(!isPackageDropdownOpen); setIsPMDropdownOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all text-[11px] font-black uppercase tracking-wider",
                  selectedPackages.length > 0 ? "bg-teal-50 border-teal-200 text-teal-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <Filter className="w-3.5 h-3.5" />
                {selectedPackages.length === 0 ? "Packages" : `${selectedPackages.length} Pkgs`}
                <ChevronDown className={cn("w-3 h-3 transition-transform", isPackageDropdownOpen && "rotate-180")} />
              </button>
              {isPackageDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPackageDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-3xl border border-slate-200 shadow-2xl z-50 p-2 py-3">
                    <div className="max-h-60 overflow-y-auto px-1 space-y-1 custom-scrollbar">
                      {packages.map(pkg => (
                        <button
                          key={pkg.id}
                          onClick={() => setSelectedPackages(prev => prev.includes(pkg.name) ? prev.filter(p => p !== pkg.name) : [...prev, pkg.name])}
                          className={cn("w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group", selectedPackages.includes(pkg.name) ? "bg-teal-50 text-teal-700" : "hover:bg-slate-50 text-slate-600")}
                        >
                          <span className="text-xs font-bold truncate">{pkg.name}</span>
                          <div className={cn("w-4 h-4 rounded-md border flex items-center justify-center transition-all", selectedPackages.includes(pkg.name) ? "bg-teal-600 border-teal-600" : "bg-white border-slate-300 group-hover:border-teal-400")}>
                            {selectedPackages.includes(pkg.name) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* PMs Multi-Select */}
            <div className="relative">
              <button
                onClick={() => { setIsPMDropdownOpen(!isPMDropdownOpen); setIsPackageDropdownOpen(false); }}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-2xl border transition-all text-[11px] font-black uppercase tracking-wider",
                  selectedPMs.length > 0 ? "bg-indigo-50 border-indigo-200 text-indigo-700" : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                <User className="w-3.5 h-3.5" />
                {selectedPMs.length === 0 ? "All PMs" : `${selectedPMs.length} PMs`}
                <ChevronDown className={cn("w-3 h-3 transition-transform", isPMDropdownOpen && "rotate-180")} />
              </button>
              {isPMDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsPMDropdownOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-3xl border border-slate-200 shadow-2xl z-50 p-2 py-3">
                    <div className="max-h-60 overflow-y-auto px-1 space-y-1 custom-scrollbar">
                      {allPMNames.map(name => (
                        <button
                          key={name}
                          onClick={() => setSelectedPMs(prev => prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name])}
                          className={cn("w-full flex items-center justify-between px-4 py-2.5 rounded-xl transition-all group", selectedPMs.includes(name) ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-600")}
                        >
                          <span className="text-xs font-bold truncate">{name}</span>
                          <div className={cn("w-4 h-4 rounded-md border flex items-center justify-center transition-all", selectedPMs.includes(name) ? "bg-indigo-600 border-indigo-600" : "bg-white border-slate-300 group-hover:border-indigo-400")}>
                            {selectedPMs.includes(name) && <Check className="w-3 h-3 text-white" />}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            {/* State Filter (Consolidated) */}
            <select 
              className="px-4 py-2 bg-slate-100 border-none rounded-2xl text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 ring-slate-200 transition-all cursor-pointer"
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value as any); setCurrentPage(1); }}
            >
              <option value="All">All States</option>
              {PROJECT_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>

            {/* Portfolio Type Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 ml-auto">
              {[
                { id: 'All', label: 'All' },
                { id: 'Enterprise', label: 'Enterprise' },
                { id: 'Initiative', label: 'Initiatives' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setPortfolioFilter(f.id as any)}
                  className={cn(
                    "px-4 py-1.5 rounded-xl text-[10px] font-black transition-all uppercase tracking-wider",
                    portfolioFilter === f.id ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filter Chips */}
        {showAdvancedFilters && (periodFilter !== 'All Time' || selectedPackages.length > 0 || selectedPMs.length > 0 || portfolioFilter !== 'All' || stateFilter !== 'All') && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 text-slate-400">
              <Filter className="w-3 h-3" />
              <span className="text-[10px] font-black uppercase tracking-widest italic">Active:</span>
            </div>
            {periodFilter !== 'All Time' && <FilterChip label={periodFilter === 'Custom' ? `${customDateRange.from} to ${customDateRange.to}` : periodFilter} onRemove={() => setPeriodFilter('All Time')} />}
            {portfolioFilter !== 'All' && <FilterChip label={portfolioFilter === 'Enterprise' ? 'Enterprise' : 'Initiatives'} onRemove={() => setPortfolioFilter('All')} />}
            {stateFilter !== 'All' && <FilterChip label={`Status: ${stateFilter}`} onRemove={() => setStateFilter('All')} />}
            {selectedPackages.map(p => <FilterChip key={p} label={p} onRemove={() => setSelectedPackages(prev => prev.filter(x => x !== p))} />)}
            {selectedPMs.map(p => <FilterChip key={p} label={p} onRemove={() => setSelectedPMs(prev => prev.filter(x => x !== p))} />)}
            <button 
              onClick={() => {
                setPeriodFilter('All Time'); setSelectedPackages([]); setSelectedPMs([]); setPortfolioFilter('All'); setStateFilter('All');
              }}
              className="px-3 py-1 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest transition-colors flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear all
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {(() => {
          const totalResults = filteredProjects.length;
          const totalPages = Math.ceil(totalResults / PAGE_SIZE);
          // Guard: if current page is beyond available pages, snap to page 1
          const safePage = currentPage > totalPages && totalPages > 0 ? 1 : currentPage;
          const startIdx = (safePage - 1) * PAGE_SIZE;
          const pageProjects = filteredProjects.slice(startIdx, startIdx + PAGE_SIZE);
          const showFrom = totalResults === 0 ? 0 : startIdx + 1;
          const showTo = Math.min(startIdx + PAGE_SIZE, totalResults);

          /** Build page button list with ellipsis. E.g. 1 … 4 5 6 … 12 */
          const getPageNumbers = (): (number | '...')[] => {
            if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
            const pages: (number | '...')[] = [1];
            if (safePage > 3) pages.push('...');
            for (let p = Math.max(2, safePage - 1); p <= Math.min(totalPages - 1, safePage + 1); p++) {
              pages.push(p);
            }
            if (safePage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
            return pages;
          };

          return (
            <>
              {/* Results summary */}
              {totalResults > 0 && (
                <p className="text-xs font-semibold text-slate-400 pb-1">
                  Showing <span className="font-bold text-slate-600">{showFrom}–{showTo}</span> of{' '}
                  <span className="font-bold text-slate-600">{totalResults}</span> project{totalResults !== 1 ? 's' : ''}
                </p>
              )}
              {/* Project cards */}
              {pageProjects.map(project => (
          <motion.div 
            key={project.id}
            onClick={() => onSelectProject(project)}
            whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" }}
            transition={{ duration: 0.2 }}
            className={cn(
              "bg-white p-6 rounded-2xl border border-slate-200 shadow-sm cursor-pointer group",
              theme.hoverBorder
            )}
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className={cn("text-xl font-extrabold text-slate-900 transition-colors truncate", theme.groupHoverText)}>{project.clientName}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={project.priority} />
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{getActiveDaysCount(project).text}</span>
                      <span className="text-slate-300">|</span>
                      <StateBadge state={getAutoProjectState(project, spiThresholds)} />
                      
                      {(() => {
                        const spiNow = calculateSPI(project, spiThresholds);
                        const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
                        const spiYest = calculateSPI(project, spiThresholds, yesterdayStr);
                        
                        let trendIcon = <Minus className="w-3 h-3 text-slate-400" />;
                        if (spiNow.rawSpi !== null && spiYest.rawSpi !== null) {
                           if (spiNow.rawSpi > spiYest.rawSpi) trendIcon = <TrendingUp className="w-3 h-3 text-emerald-500" />;
                           else if (spiNow.rawSpi < spiYest.rawSpi) trendIcon = <TrendingDown className="w-3 h-3 text-red-500" />;
                        }

                        return (
                          <>
                            <span className="text-slate-300">|</span>
                            <div className={cn("flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black tracking-widest", spiNow.color)} title={spiNow.tooltip}>
                               <span>SPI: {spiNow.value}</span>
                               {trendIcon}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {differenceInDays(new Date(), parseISO(project.updatedAt)) >= staleThresholdDays && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/10 text-red-600 rounded-md text-[9px] font-black uppercase tracking-tighter border border-red-200/50 backdrop-blur-sm shadow-sm ring-4 ring-red-500/5">
                        <AlertCircle className="w-3 h-3 animate-pulse" />
                        Needs Update
                      </span>
                    )}
                    {getPMStatus(project.assignedPM) === 'Inactive' && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-700 rounded-md text-[9px] font-black uppercase tracking-tighter border border-amber-200/50 backdrop-blur-sm shadow-sm ring-4 ring-amber-500/5">
                        <AlertTriangle className="w-3 h-3 animate-bounce" />
                        In-Active PM
                      </span>
                    )}
                    {project.isInternalInitiative && (
                      <span className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-100/50 text-purple-700 rounded-md text-[9px] font-black uppercase tracking-tighter border border-purple-200/50 backdrop-blur-sm shadow-sm ring-4 ring-purple-500/5">
                        Initiative
                      </span>
                    )}
                    {(project.tags || []).map(tagId => {
                      const tagDef = customTags.find(t => t.id === tagId);
                      if (!tagDef) return null;
                      return (
                        <span key={tagId} className={cn(
                          "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tighter border backdrop-blur-sm shadow-sm ring-4",
                          `bg-${tagDef.color}-100/50 text-${tagDef.color}-700 border-${tagDef.color}-200/50 ring-${tagDef.color}-500/5`
                        )}>
                          {tagDef.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[13px] text-slate-500 font-bold uppercase tracking-wider">{project.packageName}</p>
              </div>

              <div className="flex flex-wrap items-center gap-y-4 gap-x-8">
                <div className="flex items-center gap-3 min-w-[140px]">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-extrabold text-slate-500">
                    {project.assignedPM.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manager</p>
                    <p className="text-sm font-bold text-slate-700">{project.assignedPM}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-[120px]">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Started</p>
                    <p className="text-sm font-bold text-slate-700">{project.startDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-[120px]">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Value</p>
                    <p className="text-sm font-extrabold text-slate-900">{formatCurrency(project.value, project.currency)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  {canReassign && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onReassignProject(project); }}
                      className={cn("px-5 py-2.5 text-xs font-extrabold border-2 rounded-xl transition-all shadow-sm active:scale-95", theme.border, theme.text, theme.hoverBg, "hover:text-white")}
                    >
                      Reassign
                    </button>
                  )}
                  <button className="p-2.5 hover:bg-slate-100 rounded-xl transition-all group-hover:translate-x-1">
                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-slate-600" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {getServiceNames(getEffectiveServiceIds(project, packages, serviceBaselines), serviceBaselines).map(srvName => (
                <span key={srvName} className="px-2 py-1 bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded border border-slate-200 shadow-sm">
                  {srvName}
                </span>
              ))}
              {(project.productLines || []).map(pl => {
                const serviceNames = getServiceNames(getEffectiveServiceIds(project, packages, serviceBaselines), serviceBaselines);
                if (serviceNames.includes(pl)) return null;
                return (
                  <span key={pl} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                    {pl}
                  </span>
                );
              })}
            </div>
          </motion.div>
              ))}

              {/* Empty state */}
              {filteredProjects.length === 0 && (
                <div className="py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 shadow-sm animate-in fade-in zoom-in duration-500">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                    <Search className="w-10 h-10" />
                  </div>
                  <h3 className="text-xl font-extrabold text-slate-900 mb-2">No projects found</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] max-w-[280px] mx-auto">No projects found. Try adjusting your search or filters.</p>
                  <button 
                    onClick={() => { setSearch(''); setStateFilter('All'); setCurrentPage(1); }}
                    className="mt-8 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
                  >
                    Clear all filters
                  </button>
                </div>
              )}

              {/* Pagination controls — only shown when > PAGE_SIZE results */}
              {totalResults > PAGE_SIZE && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={safePage === 1}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all",
                      safePage === 1
                        ? "border-slate-100 text-slate-300 bg-white cursor-not-allowed"
                        : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 active:scale-95"
                    )}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
                    Previous
                  </button>

                  <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) =>
                      p === '...' ? (
                        <span key={`ellipsis-${idx}`} className="w-9 h-9 flex items-center justify-center text-xs font-bold text-slate-400">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={cn(
                            "w-9 h-9 flex items-center justify-center text-xs font-bold rounded-xl border transition-all",
                            p === safePage
                              ? cn(theme.bg, 'text-white border-transparent shadow-md')
                              : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 active:scale-95"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={safePage === totalPages}
                    className={cn(
                      "flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl border transition-all",
                      safePage === totalPages
                        ? "border-slate-100 text-slate-300 bg-white cursor-not-allowed"
                        : "border-slate-200 text-slate-600 bg-white hover:bg-slate-50 active:scale-95"
                    )}
                  >
                    Next
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
};

export const StateBadge = ({ state }: { state: ProjectState }) => {
  const styles = PROJECT_STATE_COLORS[state] || PROJECT_STATE_COLORS['On-Track'];

  return (
    <span className={cn(
      "px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border shadow-sm transition-all inline-flex items-center gap-1",
      styles.bg, styles.text, styles.border, styles.ring
    )}>
      {state === 'Closed' && (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
      {state}
    </span>
  );
};

export const PriorityBadge = ({ priority }: { priority: string }) => {
  const styles = PRIORITY_COLORS[priority] || PRIORITY_COLORS['P2'];
  const label = priority === 'P1' ? 'Tier 1 - Enterprise' : priority === 'P2' ? 'Tier 2 - Pro' : 'Tier 3 - Basic';

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", styles.bg, styles.text, styles.border)}>
      {label}
    </span>
  );
};

const FilterChip = ({ label, onRemove }: { label: string, onRemove: () => void, key?: React.Key }) => (
  <div className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-full shadow-sm animate-in zoom-in-95 duration-200">
    <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">{label}</span>
    <button 
      onClick={onRemove}
      className="p-0.5 hover:bg-slate-100 rounded-full transition-colors"
    >
      <X className="w-2.5 h-2.5 text-slate-400" />
    </button>
  </div>
);
