import React from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  LogOut, 
  ChevronRight,
  AlertTriangle,
  Clock 
} from 'lucide-react';
import { Role, AppConfig } from '../../types';
import { cn } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

type View = 'dashboard' | 'projects' | 'risks' | 'settings' | 'rebaseline-requests';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  selectedProject: any;
  setSelectedProject: (project: any) => void;
  userRole: Role;
  setUserRole: (role: Role) => void;
  config: AppConfig;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (isCollapsed: boolean) => void;
  pendingRebaselineCount?: number;
  onSignOut: () => void;
  userName?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  selectedProject,
  setSelectedProject,
  userRole,
  setUserRole,
  config,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  pendingRebaselineCount = 0,
  onSignOut,
  userName = 'User'
}) => {
  const theme = getThemeClasses(config.brand.themeColor);

  const NavItem = ({ icon: Icon, label, view }: { icon: any, label: string, view: View }) => (
    <button 
      onClick={() => {
        setCurrentView(view);
        setSelectedProject(null);
        if (window.innerWidth < 1024) setIsSidebarOpen(false);
      }}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
        currentView === view && !selectedProject
          ? `${theme.bg} text-white shadow-lg ${theme.shadow}` 
          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600",
        isSidebarCollapsed && "justify-center px-0 hover:scale-110 active:scale-95"
      )}
      title={isSidebarCollapsed ? label : undefined}
    >
      {currentView === view && !selectedProject && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-full my-3 animate-pulse" />
      )}
      <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110", currentView === view && !selectedProject ? "text-white" : "text-slate-400 group-hover:text-indigo-600")} />
      {!isSidebarCollapsed && <span className="font-bold text-[13px] tracking-tight whitespace-nowrap">{label}</span>}
      {!isSidebarCollapsed && currentView === view && !selectedProject && <ChevronRight className="w-4 h-4 ml-auto opacity-50 group-hover:translate-x-0.5 transition-transform" />}
      
      {/* Tooltip for collapsed state */}
      {isSidebarCollapsed && (
        <div className="absolute left-full ml-4 px-2 py-1 bg-slate-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap font-bold uppercase tracking-wider">
          {label}
        </div>
      )}
    </button>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static lg:translate-x-0",
        isSidebarCollapsed ? "w-20" : "w-64",
        !isSidebarOpen && "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-4">
          <div className={cn(
            "flex items-center gap-3 mb-10 px-2",
            isSidebarCollapsed ? "justify-center" : "justify-between"
          )}>
            <div className="flex items-center gap-3">
              {config.brand.logoUrl ? (
                <div className="w-10 h-10 rounded-xl overflow-hidden shadow-md flex-shrink-0">
                  <img src={config.brand.logoUrl} alt="Logo" className="w-full h-full object-contain bg-white" />
                </div>
              ) : (
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-md flex-shrink-0", theme.bg, theme.shadow)}>
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                  <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-none">{config.brand.companyName}</h1>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", theme.text)}>Tracker</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 px-1">
            <NavItem icon={LayoutDashboard} label="Dashboard" view="dashboard" />
            <NavItem icon={Briefcase} label="Projects" view="projects" />
            {userRole !== 'Executive' && userRole !== 'Finance' && (
              <>
                <NavItem icon={AlertTriangle} label="Risks & Issues" view="risks" />
                {['Superadmin', 'Manager', 'Team Lead'].includes(userRole) && (
                  <div className="relative">
                    <NavItem icon={Clock} label="Rebaseline Queue" view="rebaseline-requests" />
                    {pendingRebaselineCount > 0 && !isSidebarCollapsed && (
                      <span className="absolute right-8 top-1/2 -translate-y-1/2 bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                        {pendingRebaselineCount}
                      </span>
                    )}
                    {pendingRebaselineCount > 0 && isSidebarCollapsed && (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-amber-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                )}
                <NavItem icon={Settings} label="Settings" view="settings" />
              </>
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-4">
            <div className={cn(
              "flex items-center gap-3 px-2",
              isSidebarCollapsed && "justify-center"
            )}>
              <div className="w-10 h-10 flex-shrink-0 rounded-full bg-slate-100 border-2 border-white shadow-sm flex items-center justify-center font-bold text-slate-700 hover:scale-105 transition-transform cursor-pointer">
                {userRole[0]}
              </div>
              {!isSidebarCollapsed && (
                <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300">
                  <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{userRole}</p>
                </div>
              )}
            </div>
            
            <button 
              onClick={onSignOut}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all group",
                isSidebarCollapsed && "justify-center"
              )}
            >
              <LogOut className="w-5 h-5 text-slate-500 group-hover:text-red-500 flex-shrink-0" />
              {!isSidebarCollapsed && <span className="font-semibold text-sm">Logout</span>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
