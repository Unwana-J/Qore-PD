import React from 'react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Search, 
  Bell, 
  Plus,
  Upload
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
  userName = 'User'
}) => {
  const theme = getThemeClasses(themeColor);
  const now = new Date();

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
        <div className="hidden md:flex items-center gap-2 pl-3 pr-1 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 group focus-within:ring-2 focus-within:ring-slate-200 focus-within:bg-white transition-all">
          <Search className="w-4 h-4 text-slate-400 group-focus-within:text-slate-600" />
          <input 
            type="text" 
            placeholder="Search everything..." 
            className="bg-transparent text-[13px] font-medium outline-none w-40 focus:w-60 transition-all" 
          />
          <div className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-400">
            ⌘K
          </div>
        </div>
        <button className={cn("p-2 text-slate-400 rounded-lg transition-all relative", theme.hoverText, theme.hoverLightBg)}>
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
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
