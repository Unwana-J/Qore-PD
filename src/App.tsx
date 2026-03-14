import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/Dashboard';
import { ProjectList } from './components/ProjectList';
import { ProjectModal } from './components/ProjectModal';
import { MilestoneView } from './components/MilestoneView';
import { RisksTable } from './components/RisksTable';
import { SettingsView } from './components/SettingsView';
import { INITIAL_CONFIG } from './mockData';
import { Role, AppConfig, SettingsTab, Project } from './types';
import { useProjects } from './hooks/useProjects';

type View = 'dashboard' | 'projects' | 'risks' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [userRole, setUserRole] = useState<Role>('Manager');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('account');
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);

  const {
    filteredProjects,
    projects,
    selectedProject,
    setSelectedProject,
    addProject,
    updateProject,
    getPMWorkload,
    loading
  } = useProjects(userRole, config);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900">
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        userRole={userRole}
        setUserRole={setUserRole}
        config={config}
        isSidebarOpen={isSidebarOpen}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          selectedProject={selectedProject}
          currentView={currentView}
          activeSettingsTab={activeSettingsTab}
          themeColor={config.brand.themeColor}
          userRole={userRole}
          onNavigateBack={() => setSelectedProject(null)}
          setIsModalOpen={setIsModalOpen}
        />

        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedProject ? `project-${selectedProject.id}` : currentView}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              >
                {selectedProject ? (
                  <MilestoneView 
                    project={selectedProject} 
                    onBack={() => setSelectedProject(null)} 
                    onUpdateProject={updateProject}
                    userRole={userRole}
                    currencies={config.currencies}
                    themeColor={config.brand.themeColor}
                  />
                ) : (
                  <>
                    {currentView === 'dashboard' && (
                      <Dashboard 
                        projects={filteredProjects} 
                        workloadThresholds={config.workloadThresholds}
                        currencies={config.currencies}
                        themeColor={config.brand.themeColor} 
                      />
                    )}
                    {currentView === 'projects' && (
                      <ProjectList 
                        projects={filteredProjects} 
                        onSelectProject={setSelectedProject} 
                        themeColor={config.brand.themeColor}
                        staleThresholdDays={config.staleThresholdDays}
                      />
                    )}
                    {currentView === 'risks' && (
                      <RisksTable projects={filteredProjects} />
                    )}
                    {currentView === 'settings' && (
                        <SettingsView 
                          userRole={userRole} 
                          projects={projects} 
                          onUpdateProjects={() => {}} 
                          config={config}
                          onUpdateConfig={setConfig}
                          activeTab={activeSettingsTab}
                          setActiveTab={setActiveSettingsTab}
                        />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <ProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={addProject} 
        userRole={userRole}
        getPMWorkload={getPMWorkload}
        workloadThresholds={config.workloadThresholds}
        currencies={config.currencies}
        themeColor={config.brand.themeColor}
      />
    </div>
  );
}
