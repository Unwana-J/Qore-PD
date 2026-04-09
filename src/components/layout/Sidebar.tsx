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
import { cn, isRole, hasRole } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

type View = 'dashboard' | 'projects' | 'risks' | 'settings' | 'rebaseline-requests';

interface SidebarProps {
  currentView: View;
  setCurrentView: (view: View) => void;
  selectedProject: any;
  setSelectedProject: (project: any) => void;
  userRole: Role;
  setUserRole: (role: Role | null) => void;
  actualRole?: Role;
  config: AppConfig;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (isCollapsed: boolean) => void;
  pendingRebaselineCount?: number;
  pendingBillingCount?: number;
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
  actualRole,
  config,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  pendingRebaselineCount = 0,
  pendingBillingCount = 0,
  onSignOut,
  userName = 'User'
}) => {
  const [isRoleSelectOpen, setIsRoleSelectOpen] = React.useState(false);
  const theme = getThemeClasses(config.brand.themeColor);
  
  const allRoles: Role[] = ['PM', 'Team Lead', 'Manager', 'Executive', 'Finance', 'Superadmin'];

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
              <div className={cn("flex-shrink-0", isSidebarCollapsed ? "h-8 w-8" : "h-8 w-auto")}>
                {isSidebarCollapsed ? (
                  <img src="/icon.png" alt="Icon" className="h-full w-full object-contain" />
                ) : (
                  <img src={config.brand.logoUrl || '/logo.png'} alt="Logo" className="h-full w-auto object-contain" />
                )}
              </div>
              {!isSidebarCollapsed && (
                <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                  <h1 className="text-lg font-black tracking-tight text-slate-900 leading-none">SD</h1>
                  <p className={cn("text-[10px] font-bold uppercase tracking-widest mt-1", theme.text)}>Project Information System</p>
                </div>
              )}
            </div>
          </div>

          <nav className="flex-1 space-y-1.5 px-1">
          <div className="relative">
            <NavItem icon={LayoutDashboard} label="Dashboard" view="dashboard" />
            {isRole(userRole, 'Finance') && pendingBillingCount > 0 && (
              <>
                {!isSidebarCollapsed ? (
                  <span className="absolute right-8 top-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                    {pendingBillingCount}
                  </span>
                ) : (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
                )}
              </>
            )}
          </div>
            <NavItem icon={Briefcase} label="Projects" view="projects" />
            {!isRole(userRole, 'Executive') && !isRole(userRole, 'Finance') && (
              <>
                <NavItem icon={AlertTriangle} label="Risks & Issues" view="risks" />
                {hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']) && (
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
                <div className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300 relative">
                  <p className="text-sm font-bold text-slate-900 truncate">{userName}</p>
                  {actualRole === 'Superadmin' || actualRole === 'Executive' ? (
                    <div className="relative">
                      <button 
                        onClick={() => setIsRoleSelectOpen(!isRoleSelectOpen)}
                        className="text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-indigo-600 transition-colors flex items-center gap-1 group"
                        title="Switch view role"
                      >
                        {userRole}
                        <ChevronRight className={cn("w-3 h-3 opacity-50 group-hover:opacity-100 transition-transform", isRoleSelectOpen && "rotate-90")} />
                      </button>
                      
                      {isRoleSelectOpen && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setIsRoleSelectOpen(false)} />
                          <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 z-50">
                            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                              View As
                            </div>
                            {allRoles.map(r => (
                              <button
                                key={r}
                                onClick={() => {
                                  setUserRole(r === actualRole ? null : r);
                                  setIsRoleSelectOpen(false);
                                }}
                                className={cn(
                                  "w-full text-left px-3 py-2 text-xs font-bold transition-colors",
                                  userRole === r ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                )}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{userRole}</p>
                  )}
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
