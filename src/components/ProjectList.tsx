import React, { useState } from 'react';
import { Project, ProjectState } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { Search, Filter, MoreHorizontal, Calendar, User, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { PROJECT_STATES } from '../constants';
import { getThemeClasses } from '../lib/theme';
import { differenceInDays, parseISO } from 'date-fns';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { Role } from '../types';
import { DollarSign } from 'lucide-react';

interface ProjectListProps {
  projects: Project[];
  onSelectProject: (project: Project) => void;
  themeColor?: string;
  staleThresholdDays: number;
  userRole: Role;
  users: any[];
  onReassignProject: (project: Project) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ projects, onSelectProject, userRole, users, onReassignProject, themeColor = 'teal', staleThresholdDays }) => {
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState<ProjectState | 'All'>('All');

  const theme = getThemeClasses(themeColor);
  const canReassign = ['Superadmin', 'Manager', 'Team Lead'].includes(userRole);

  const getPMStatus = (pmName: string) => {
    const pm = users.find(u => u.name === pmName);
    return pm?.status || 'Active';
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.clientName.toLowerCase().includes(search.toLowerCase()) || 
                          p.assignedPM.toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter === 'All' || p.state === stateFilter;
    return matchesSearch && matchesState;
  }).sort((a, b) => {
    // Managers see inactive PM projects at the top
    if (canReassign) {
      const aInactive = getPMStatus(a.assignedPM) === 'Inactive' ? 1 : 0;
      const bInactive = getPMStatus(b.assignedPM) === 'Inactive' ? 1 : 0;
      if (aInactive !== bInactive) return bInactive - aInactive;
    }
    return 0;
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
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex gap-3">
            <select 
              className={cn(
                "px-5 py-3 bg-white border-2 border-slate-100 rounded-2xl text-sm font-bold focus:outline-none focus:ring-4 transition-all cursor-pointer hover:border-slate-200",
                theme.ring, "focus:border-slate-200"
              )}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as any)}
            >
              <option value="All">All States</option>
              {PROJECT_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>

            <button className="p-3 bg-white border-2 border-slate-100 rounded-2xl text-slate-500 hover:text-slate-900 hover:border-slate-200 transition-all">
              <Filter className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredProjects.map(project => (
          <motion.div 
            key={project.id}
            onClick={() => onSelectProject(project)}
            whileHover={{ y: -2, boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)" }}
            transition={{ duration: 0.2 }}
            className={cn(
              "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm cursor-pointer group",
              theme.hoverBorder
            )}
          >
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
              <div className="space-y-2 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className={cn("text-xl font-extrabold text-slate-900 transition-colors truncate", theme.groupHoverText)}>{project.clientName}</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={project.priority} />
                    <StateBadge state={project.state} themeColor={themeColor} />
                    {differenceInDays(new Date(), parseISO(project.updatedAt)) >= staleThresholdDays && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-extrabold border border-red-100 shadow-sm">
                        <AlertCircle className="w-3.5 h-3.5" />
                        STALE
                      </span>
                    )}
                    {getPMStatus(project.assignedPM) === 'Inactive' && (
                      <span className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-extrabold border border-amber-200 shadow-sm animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        ORPHANED — REASSIGN
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
              {project.productLines.map(pl => (
                <span key={pl} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider rounded-md">
                  {pl}
                </span>
              ))}
            </div>
          </motion.div>
        ))}

        {filteredProjects.length === 0 && (
          <div className="py-32 text-center bg-white rounded-3xl border-2 border-dashed border-slate-100 shadow-sm animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
              <Search className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">No projects found</h3>
            <p className="text-slate-500 font-bold uppercase tracking-wider text-[10px] max-w-[240px] mx-auto">Try adjusting your filters or search terms to find what you're looking for.</p>
            <button 
              onClick={() => { setSearch(''); setStateFilter('All'); }}
              className="mt-8 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const StateBadge = ({ state, themeColor = 'teal' }: { state: ProjectState, themeColor?: string }) => {
  const theme = getThemeClasses(themeColor);
  
  const styles: Record<ProjectState, string> = {
    'Active': 'bg-blue-50 text-blue-600 border-blue-100',
    'Delayed': 'bg-red-50 text-red-600 border-red-100 ring-2 ring-red-100',
    'Suspended': 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-100',
    'Ready for Billing': `${theme.lightBg} ${theme.lightText} ${theme.lightBorder}`,
    'Billed': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Closed': 'bg-slate-100 text-slate-500 border-slate-200 grayscale',
  };

  return (
    <span className={cn("px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border shadow-sm transition-all", styles[state])}>
      {state}
    </span>
  );
};

export const PriorityBadge = ({ priority }: { priority: string }) => {
  const styles: Record<string, string> = {
    'P1': 'bg-red-50 text-red-600 border-red-100',
    'P2': 'bg-amber-50 text-amber-600 border-amber-100',
    'P3': 'bg-sky-50 text-sky-600 border-sky-100',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", styles[priority] || styles['P2'])}>
      {priority}
    </span>
  );
};
