import React from 'react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Bell, 
  Plus,
  Upload,
  BarChart2
} from 'lucide-react';
import { format } from 'date-fns';
import { Project, Role } from '../../types';
import { cn } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (isCollapsed: boolean) => void;
  selectedProject: Project | null;
  currentView: string;
  activeSettingsTab?: string;
  themeColor: string;
  userRole: Role;
  onNavigateBack?: () => void;
  setIsModalOpen: (isOpen: boolean) => void;
  setIsBulkImportOpen: (isOpen: boolean) => void;
  userName?: string;
  notifications?: Array<{ id: string; message: string; projectId: string; createdAt?: Date; isRead?: boolean }>;
  dismissNotification?: (id: string) => void;
  markAllRead?: () => void;
  clearAllNotifications?: () => void;
  onSelectProject?: (project: any) => void;
  projects?: Project[];
  digestData?: import('../../types').DigestData | null;
  onOpenDigest?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  selectedProject,
  currentView,
  activeSettingsTab,
  themeColor,
  userRole,
  onNavigateBack,
  setIsModalOpen,
  setIsBulkImportOpen,
  userName = 'User',
  notifications = [],
  dismissNotification,
  markAllRead,
  clearAllNotifications,
  onSelectProject,
  projects = [],
  digestData,
  onOpenDigest
}) => {
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const theme = getThemeClasses(themeColor);
  const now = new Date();

  const getRelativeTime = (date?: Date) => {
    if (!date) return 'Just now';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const getGreeting = () => {
    const hour = now.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getSettingsTabName = (tab?: string) => {
    switch (tab) {
      case 'performance': return 'Package Weights';
      case 'users': return 'User Management';
      case 'project': return 'Project Config';
      case 'priority': return 'Priority & Workload';
      case 'revenue': return 'Revenue Settings';
      case 'audit': return 'Audit Logs';
      case 'account': return 'Account Settings';
      case 'brand': return 'Branding';
      default: return '';
    }
  };

  const renderHeaderContent = () => {
    // 1. Nested Views (Breadcrumbs)
    if (selectedProject) {
      return (
        <div className="flex items-center gap-2 text-xs font-medium">
          <button 
            onClick={onNavigateBack}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            Projects
          </button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-400">{selectedProject.clientName}</span>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900">Milestones</span>
        </div>
      );
    }

    if (currentView === 'settings' && activeSettingsTab && activeSettingsTab !== 'account') {
      const tabName = getSettingsTabName(activeSettingsTab);
      return (
        <div className="flex items-center gap-2 text-xs font-medium">
          <button 
            onClick={() => onNavigateBack?.()}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            Settings
          </button>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          <span className="text-slate-900">{tabName}</span>
        </div>
      );
    }

    // 2. Dashboard Page Header
    if (currentView === 'dashboard') {
      return (
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-slate-900 leading-tight">
            {getGreeting()}, {userName.split(' ')[0]} 👋
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {userRole === 'PM' ? "Here's your project overview." : format(now, 'EEEE, d MMMM yyyy')}
          </p>
        </div>
      );
    }

    // 3. Simple Page Titles
    const titles: Record<string, string> = {
      projects: 'Projects',
      settings: 'Settings',
      risks: 'Risks & Issues'
    };

    return (
      <h1 className="text-lg font-bold text-slate-900">{titles[currentView] || currentView}</h1>
    );
  };

  return (
    <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 transition-all duration-300">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden lg:flex p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
          title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <Menu className={cn("w-5 h-5 transition-transform duration-300", isSidebarCollapsed && "rotate-180")} />
        </button>
        
        <div className="ml-2">
          {renderHeaderContent()}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => {
              const opening = !isNotifOpen;
              setIsNotifOpen(opening);
              if (opening && markAllRead) markAllRead();
            }}
            className={cn("p-2 text-slate-400 rounded-lg transition-all relative", theme.hoverText, theme.hoverLightBg, isNotifOpen && "bg-slate-50 text-slate-900")}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
              <div className="absolute right-0 mt-3 w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ring-1 ring-slate-900/5">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-black text-slate-900 uppercase tracking-widest">Notifications</p>
                    {unreadCount > 0 && <p className="text-[10px] text-slate-400 font-medium mt-0.5">{unreadCount} unread</p>}
                  </div>
                  {notifications.length > 0 && (
                    <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[9px] font-bold">{notifications.length}</span>
                  )}
                </div>
                <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-50">
                  {/* Digest card — pinned at top when available */}
                  {digestData && (
                    <button
                      onClick={() => { onOpenDigest?.(); setIsNotifOpen(false); }}
                      className="w-full px-5 py-4 text-left hover:bg-indigo-50 transition-colors flex items-center gap-3 border-b border-indigo-100 bg-indigo-50/50"
                    >
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                        <BarChart2 className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-indigo-900">Weekly Portfolio Digest</p>
                        <p className="text-[10px] text-indigo-500 font-medium mt-0.5">Week of {digestData.weekOf} · Click to open</p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    </button>
                  )}
                  {notifications.length === 0 ? (
                    <div className="px-5 py-12 text-center">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Bell className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-xs font-bold text-slate-400">All caught up!</p>
                      <p className="text-[10px] text-slate-400 mt-1">No new alerts at the moment.</p>
                    </div>
                  ) : (
                    notifications.map(n => {
                      const isRebaseline = n.message.includes('rebaseline');
                      const isStale = n.message.includes("hasn't been updated");
                      const isBilled = n.message.includes('Billed') || n.message.includes('Billed by Finance');
                      const isDueSoon = n.message.includes('working day') || n.message.includes('due today');
                      const isDelayed = n.message.includes('automatically marked Delayed');
                      const isNoPM = n.message.includes('no assigned PM');

                      const dotColor = isRebaseline ? 'bg-amber-500'
                        : isDueSoon ? 'bg-orange-500'
                        : isDelayed || isStale ? 'bg-rose-500'
                        : isBilled ? 'bg-emerald-500'
                        : isNoPM ? 'bg-purple-500'
                        : 'bg-blue-500';
                      return (
                        <div 
                          key={n.id} 
                          className={cn(
                            "px-5 py-4 hover:bg-slate-50 transition-colors group cursor-pointer flex gap-3",
                            n.isRead ? 'opacity-70' : ''
                          )}
                          onClick={() => {
                            const fullProject = projects.find(p => p.id === n.projectId);
                            if (onSelectProject && fullProject) onSelectProject(fullProject);
                            setIsNotifOpen(false);
                          }}
                        >
                          <div className={cn("mt-2 w-2 h-2 rounded-full shrink-0", dotColor)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-900 leading-snug">{n.message}</p>
                            <p className="text-[10px] font-medium text-slate-400 mt-1">{getRelativeTime(n.createdAt)}</p>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); dismissNotification?.(n.id); }}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded-lg transition-all shrink-0"
                            title="Dismiss"
                          >
                            <X className="w-3 h-3 text-slate-400" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
                {notifications.length > 0 && (
                  <button 
                    onClick={() => { clearAllNotifications?.(); setIsNotifOpen(false); }}
                    className="w-full px-5 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 border-t border-slate-100 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {['Superadmin', 'Manager', 'Team Lead'].includes(userRole) && currentView === 'dashboard' && (
          <button 
            onClick={() => setIsBulkImportOpen(true)}
            className="hidden sm:flex items-center gap-2 px-4 py-2 text-slate-600 bg-white border border-slate-200 text-sm font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </button>
        )}
        {userRole !== 'Executive' && userRole !== 'Finance' && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-xl shadow-lg transition-all",
              theme.bg,
              theme.hoverBg,
              theme.shadow
            )}
          >
            <Plus className="w-4 h-4" />
            <span>Create Project</span>
          </button>
        )}
      </div>
    </header>
  );
};
