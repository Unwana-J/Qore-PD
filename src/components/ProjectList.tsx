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
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search clients or PMs..."
              className={cn(
                "w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
                theme.ring, theme.focusBorder
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <select 
            className={cn(
              "px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all",
              theme.ring, theme.focusBorder
            )}
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as any)}
          >
            <option value="All">All States</option>
            {PROJECT_STATES.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h3 className={cn("text-lg font-bold text-slate-900 transition-colors", theme.groupHoverText)}>{project.clientName}</h3>
                  <div className="flex items-center gap-2">
                    <PriorityBadge priority={project.priority} />
                    <StateBadge state={project.state} themeColor={themeColor} />
                    {differenceInDays(new Date(), parseISO(project.updatedAt)) >= staleThresholdDays && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[10px] font-bold border border-red-200">
                        <AlertCircle className="w-3 h-3" />
                        STALE
                      </span>
                    )}
                    {getPMStatus(project.assignedPM) === 'Inactive' && (
                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-bold border border-amber-200 animate-pulse">
                        <AlertTriangle className="w-3 h-3" />
                        PM INACTIVE — REASSIGNMENT REQUIRED
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-500 font-medium">{project.packageName}</p>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2 text-slate-600">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">{project.assignedPM}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">{project.startDate}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <span className="text-sm">{formatCurrency(project.value, project.currency)}</span>
                </div>
                {canReassign && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); onReassignProject(project); }}
                    className={cn("px-4 py-2 text-xs font-bold border-2 rounded-xl transition-all", theme.border, theme.text, theme.hoverBg, "hover:text-white")}
                  >
                    Reassign
                  </button>
                )}
                <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                </button>
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
          <div className="py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No projects found matching your criteria</p>
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
    'Delayed': 'bg-amber-50 text-amber-600 border-amber-100',
    'Suspended': 'bg-slate-100 text-slate-600 border-slate-200',
    'Ready for Billing': `${theme.lightBg} ${theme.lightText} ${theme.lightBorder}`,
    'Billed': 'bg-emerald-50 text-emerald-600 border-emerald-100',
    'Closed': 'bg-slate-200 text-slate-700 border-slate-300',
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight border", styles[state])}>
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
