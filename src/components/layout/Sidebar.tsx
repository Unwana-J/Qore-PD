import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  LogOut, 
  ChevronRight,
  AlertTriangle 
} from 'lucide-react';
import { Role, AppConfig } from '../../types';
import { cn } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

type View = 'dashboard' | 'projects' | 'risks' | 'settings';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  selectedProject: any;
  setSelectedProject: (project: any) => void;
  userRole: Role;
  setUserRole: (role: Role) => void;
  config: AppConfig;
  isSidebarOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  selectedProject,
  setSelectedProject,
  userRole,
  setUserRole,
  config,
  isSidebarOpen
}) => {
  const theme = getThemeClasses(config.brand.themeColor);

  const NavItem = ({ icon: Icon, label, view }: { icon: any, label: string, view: View }) => (
    <button 
      onClick={() => {
        setCurrentView(view);
        setSelectedProject(null);
      }}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
        currentView === view && !selectedProject
          ? `${theme.bg} text-white shadow-lg ${theme.shadow}` 
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <Icon className={cn("w-5 h-5", currentView === view && !selectedProject ? "text-white" : "text-slate-400 group-hover:text-slate-600")} />
      <span className="font-semibold">{label}</span>
      {currentView === view && !selectedProject && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
    </button>
  );

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transition-transform lg:static lg:translate-x-0",
      !isSidebarOpen && "-translate-x-full"
    )}>
      <div className="h-full flex flex-col p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          {config.brand.logoUrl ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg">
              <img src={config.brand.logoUrl} alt="Logo" className="w-full h-full object-contain bg-white" />
            </div>
          ) : (
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", theme.bg, theme.shadow)}>
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{config.brand.companyName}</h1>
            <p className={cn("text-[10px] font-bold uppercase tracking-widest", theme.text)}>Tracker</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem icon={LayoutDashboard} label="Dashboard" view="dashboard" />
          <NavItem icon={Briefcase} label="Projects" view="projects" />
          <NavItem icon={AlertTriangle} label="Risks & Issues" view="risks" />
          <NavItem icon={Settings} label="Settings" view="settings" />
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100">
          <div className="mb-6 px-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 block">Switch Role (POC)</label>
            <select 
              value={userRole}
              onChange={(e) => setUserRole(e.target.value as Role)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none"
            >
              <option value="Superadmin">Superadmin</option>
              <option value="Manager">Manager</option>
              <option value="Team Lead">Team Lead</option>
              <option value="PM">PM (Sarah Jenkins)</option>
              <option value="Finance">Finance</option>
              <option value="Executive">Executive</option>
            </select>
          </div>

          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-600">
              {userRole[0]}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{userRole === 'PM' ? 'Sarah Jenkins' : 'Admin User'}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{userRole}</p>
            </div>
          </div>
          <button className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group">
            <LogOut className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
            <span className="font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
