import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  LogOut, 
  Plus, 
  Bell, 
  Search,
  ChevronRight,
  Menu,
  X,
  AlertTriangle,
  Users
} from 'lucide-react';
import { Dashboard } from './components/Dashboard';
import { ProjectList } from './components/ProjectList';
import { ProjectModal } from './components/ProjectModal';
import { MilestoneView } from './components/MilestoneView';
import { RisksTable } from './components/RisksTable';
import { SettingsView } from './components/SettingsView';
import { MOCK_PROJECTS, INITIAL_CONFIG } from './mockData';
import { Project, Role, AppConfig } from './types';
import { cn } from './lib/utils';
import { getThemeClasses } from './lib/theme';

type View = 'dashboard' | 'projects' | 'risks' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [projects, setProjects] = useState<Project[]>(MOCK_PROJECTS);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<Role>('Manager');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);

  const theme = getThemeClasses(config.brand.themeColor);
  
  // Filter projects based on role
  const filteredProjects = useMemo(() => {
    if (userRole === 'PM') {
      // In a real app, we'd filter by the logged-in user's name/ID
      // For this POC, we'll assume Sarah Jenkins is the logged-in PM
      return projects.filter(p => p.assignedPM === 'Sarah Jenkins');
    }
    return projects;
  }, [projects, userRole]);

  const handleCreateProject = (newProjectData: Partial<Project>) => {
    const newProject: Project = {
      ...newProjectData as any,
      id: Math.random().toString(36).substr(2, 9),
      createdAt: new Date().toISOString().split('T')[0],
      comments: [],
      risks: [],
    };
    setProjects([newProject, ...projects]);
  };

  const handleUpdateProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
    if (selectedProject?.id === updatedProject.id) {
      setSelectedProject(updatedProject);
    }
  };

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
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      {/* Sidebar */}
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
            {/* Role Switcher for POC */}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
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

        {/* View Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {selectedProject ? (
              <MilestoneView 
                project={selectedProject} 
                onBack={() => setSelectedProject(null)} 
                onUpdateProject={handleUpdateProject}
                userRole={userRole}
                themeColor={config.brand.themeColor}
              />
            ) : (
              <>
                {currentView === 'dashboard' && <Dashboard projects={filteredProjects} themeColor={config.brand.themeColor} />}
                {currentView === 'projects' && (
                  <ProjectList 
                    projects={filteredProjects} 
                    onSelectProject={setSelectedProject} 
                    themeColor={config.brand.themeColor}
                  />
                )}
                {currentView === 'risks' && (
                  <RisksTable projects={filteredProjects} />
                )}
                {currentView === 'settings' && (
                  <SettingsView 
                    userRole={userRole} 
                    projects={projects} 
                    onUpdateProjects={setProjects}
                    config={config}
                    onUpdateConfig={setConfig}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <ProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateProject} 
        userRole={userRole}
        themeColor={config.brand.themeColor}
      />
    </div>
  );
}
