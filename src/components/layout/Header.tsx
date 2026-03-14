import React from 'react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Search, 
  Bell, 
  Plus 
} from 'lucide-react';
import { format } from 'date-fns';
import { Project, Role } from '../../types';
import { cn } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedProject: Project | null;
  currentView: string;
  activeSettingsTab?: string;
  themeColor: string;
  userRole: Role;
  onNavigateBack?: () => void;
  setIsModalOpen: (isOpen: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  selectedProject,
  currentView,
  activeSettingsTab,
  themeColor,
  userRole,
  onNavigateBack,
  setIsModalOpen
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
            onClick={() => {/* This would ideally switch view, but it's handled in App */}}
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
      if (userRole === 'PM') {
        return (
          <div className="flex flex-col">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">
              {getGreeting()}, Sarah 👋
            </h1>
            <p className="text-xs text-slate-500 font-medium">Here's your project overview.</p>
          </div>
        );
      }
      return (
        <div className="flex flex-col">
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Dashboard</h1>
          <p className="text-xs text-slate-500 font-medium">{format(now, 'EEEE, d MMMM yyyy')}</p>
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
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-6">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        
        {renderHeaderContent()}
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400">
          <Search className="w-4 h-4" />
          <input type="text" placeholder="Global search..." className="bg-transparent text-xs outline-none w-32 focus:w-48 transition-all" />
        </div>
        <button className={cn("p-2 text-slate-400 rounded-lg transition-all relative", theme.hoverText, theme.hoverLightBg)}>
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
        </button>
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
