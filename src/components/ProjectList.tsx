import React, { useState } from 'react';
import { Project, ProjectState } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { PROJECT_STATES } from '../constants';
import { PROJECT_STATE_COLORS, PRIORITY_COLORS, getThemeClasses } from '../lib/theme';
import { differenceInDays, parseISO, subDays, format } from 'date-fns';
import { getActiveDaysCount, calculateSPI } from '../lib/utils';
import { AlertCircle, AlertTriangle, DollarSign, Search, Filter, MoreHorizontal, Calendar, User, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Role } from '../types';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  themeColor?: string;
  staleThresholdDays: number;
  userRole: Role;
  users: any[];
  onReassignProject: (project: Project) => void;
  spiThresholds: { onTrack: number, atRisk: number };
  initialSearch?: string;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, userRole, users, onReassignProject, themeColor = 'teal', staleThresholdDays, spiThresholds, initialSearch = '' }) => {
  const [search, setSearch] = useState(initialSearch);
  const [stateFilter, setStateFilter] = useState<ProjectState | 'All'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  const theme = getThemeClasses(themeColor);
  const canReassign = ['Superadmin', 'Manager', 'Team Lead'].includes(userRole);

  const getPMStatus = (pmName: string) => {
    const pm = users.find(u => u.name === pmName);
    return pm?.status || 'Active';
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = (p.clientName || '').toLowerCase().includes(search.toLowerCase()) || 
                          (p.assignedPM || '').toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter === 'All' || p.state === stateFilter;
    return matchesSearch && matchesState;
  }).sort((a, b) => {
    // Managers see inactive PM projects at the top
    if (canReassign) {
      const aInactive = getPMStatus(a.assignedPM) === 'Inactive' ? 1 : 0;
      const bInactive = getPMStatus(b.assignedPM) === 'Inactive' ? 1 : 0;
      if (aInactive !== bInactive) return bInactive - aInactive;
    }
    // Fallback sort: Most recently created first
    const dateA = new Date(a.createdAt || 0).getTime();
    const dateB = new Date(b.createdAt || 0).getTime();
    return dateB - dateA;
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <div className="relative flex-1 group">
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
          
          <div className="flex gap-3">
            <select 
              className={cn(
                "px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 transition-all cursor-pointer hover:border-slate-200",
                theme.ring, "focus:border-slate-200"
              )}
              value={stateFilter}
              onChange={(e) => { setStateFilter(e.target.value as any); setCurrentPage(1); }}
            >
              <option value="All">All States</option>
              {PROJECT_STATES.map(state => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>
        </div>
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
                      <StateBadge state={project.state} />
                      
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
              {(project.productLines || []).map(pl => (
                <span key={pl} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                  {pl}
                </span>
              ))}
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
