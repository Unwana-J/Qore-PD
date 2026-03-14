import React from 'react';
import { 
  Menu, 
  X, 
  ChevronRight, 
  Search, 
  Bell, 
  Plus 
} from 'lucide-react';
import { Role, AppConfig } from '../../types';
import { cn } from '../../lib/utils';
import { getThemeClasses } from '../../lib/theme';

interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (isOpen: boolean) => void;
  selectedProject: any;
  currentView: string;
  themeColor: string;
  userRole: Role;
  setIsModalOpen: (isOpen: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  selectedProject,
  currentView,
  themeColor,
  userRole,
  setIsModalOpen
}) => {
  const theme = getThemeClasses(themeColor);

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="lg:hidden p-2 hover:bg-slate-100 rounded-lg"
        >
          {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="hidden md:flex items-center gap-2 text-sm font-medium text-slate-400">
          <span>System</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-slate-900 capitalize">{selectedProject ? 'Project Details' : currentView}</span>
        </div>
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
