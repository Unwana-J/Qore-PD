import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { Dashboard } from './components/Dashboard';
import { FinanceDashboard } from './components/FinanceDashboard';
import { ProjectList } from './components/ProjectList';
import { ProjectModal } from './components/ProjectModal';
import { ReassignModal } from './components/ReassignModal';
import { PhaseView } from './components/PhaseView';
import { RisksTable } from './components/RisksTable';
import { SettingsView } from './components/SettingsView';
import { RebaselineRequestsView } from './components/RebaselineRequestsView';
import { ExecutiveDashboard } from './components/ExecutiveDashboard';
import { INITIAL_CONFIG, MOCK_USERS } from './mockData';
import { Role, AppConfig, SettingsTab, Project } from './types';
import { useProjects } from './hooks/useProjects';
import { Toast } from './components/common/Toast';

type View = 'dashboard' | 'projects' | 'risks' | 'settings' | 'rebaseline-requests';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [userRole, setUserRole] = useState<Role>('Manager');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('account');
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [projectToReassign, setProjectToReassign] = useState<Project | null>(null);

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const {
    filteredProjects,
    projects,
    selectedProject,
    setSelectedProject,
    addProject: originalAddProject,
    updateProject,
    billProject,
    reassignProject: originalReassignProject,
    submitRebaselineRequest,
    approveRebaselineRequest,
    declineRebaselineRequest,
    allRebaselineRequests,
    getPMWorkload,
    validateStateTransition,
    notifications,
    dismissNotification,
    loading
  } = useProjects(userRole, config);

  const addProject = async (p: Partial<Project>, force?: boolean) => {
    try {
      const result: any = await originalAddProject(p, force);
      if (!result?.warning) {
        showToast('Project created successfully!');
      }
      return result;
    } catch (err: any) {
      showToast(err.message, 'error');
      throw err;
    }
  };

  const reassignProject = async (id: string, pm: string) => {
    try {
      await originalReassignProject(id, pm);
      showToast('Project reassigned successfully!');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-slate-200 rounded-2xl animate-[pulse_2s_infinite]"></div>
          <div className="absolute inset-0 w-16 h-16 border-t-4 border-teal-600 rounded-2xl animate-spin"></div>
        </div>
        <div className="text-center">
          <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Qore Tracker</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1 pulse opacity-70">Synchronizing Data...</p>
        </div>
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
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        pendingRebaselineCount={allRebaselineRequests.filter(r => r.status === 'Pending').length}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header 
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
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
                  <PhaseView 
                    project={selectedProject} 
                    onBack={() => setSelectedProject(null)} 
                    onUpdateProject={updateProject}
                    userRole={userRole}
                    currencies={config.currencies}
                    themeColor={config.brand.themeColor}
                    onReassign={() => setProjectToReassign(selectedProject)}
                    defaultPhases={config.defaultPhases}
                    onSubmitRebaseline={submitRebaselineRequest}
                    onApproveRebaseline={approveRebaselineRequest}
                    onDeclineRebaseline={declineRebaselineRequest}
                    spiThresholds={config.spiThresholds}
                    validateStateTransition={validateStateTransition}
                    onShowToast={showToast}
                  />
                ) : (
                  <>
                    {currentView === 'dashboard' && (
                      userRole === 'Finance' ? (
                        <FinanceDashboard 
                          projects={filteredProjects}
                          onBillProject={billProject}
                          currencies={config.currencies}
                          themeColor={config.brand.themeColor}
                        />
                      ) : userRole === 'Executive' ? (
                        <ExecutiveDashboard 
                          projects={filteredProjects}
                          users={MOCK_USERS}
                          themeColor={config.brand.themeColor}
                          onSelectProject={setSelectedProject}
                          staleThresholdDays={config.staleThresholdDays}
                        />
                      ) : (
                        <Dashboard 
                          projects={filteredProjects} 
                          workloadThresholds={config.workloadThresholds}
                          currencies={config.currencies}
                          themeColor={config.brand.themeColor} 
                          userRole={userRole}
                          onReassignProject={setProjectToReassign}
                          config={config}
                        />
                      )
                    )}
                    {currentView === 'projects' && (
                      <ProjectList 
                        projects={filteredProjects} 
                        onSelectProject={setSelectedProject} 
                        themeColor={config.brand.themeColor}
                        staleThresholdDays={config.staleThresholdDays}
                        userRole={userRole}
                        users={MOCK_USERS}
                        onReassignProject={setProjectToReassign}
                        spiThresholds={config.spiThresholds}
                      />
                    )}
                    {currentView === 'risks' && (
                      <RisksTable 
                        projects={filteredProjects} 
                        onSelectProject={setSelectedProject} 
                      />
                    )}
                    {currentView === 'rebaseline-requests' && (
                      <RebaselineRequestsView 
                        requests={allRebaselineRequests}
                        onApprove={approveRebaselineRequest}
                        onDecline={declineRebaselineRequest}
                        userRole={userRole}
                        themeColor={config.brand.themeColor}
                      />
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
                          showToast={showToast}
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
        users={MOCK_USERS}
        serviceBaselines={config.serviceBaselines}
      />

      {projectToReassign && (
        <ReassignModal 
          isOpen={!!projectToReassign}
          onClose={() => setProjectToReassign(null)}
          project={projectToReassign}
          users={MOCK_USERS}
          getPMWorkload={getPMWorkload}
          workloadThresholds={config.workloadThresholds}
          onReassign={reassignProject}
          themeColor={config.brand.themeColor}
        />
      )}

      <div className="fixed bottom-6 right-6 z-[100] pointer-events-none flex flex-col gap-2 items-end">
        <AnimatePresence>
          {notifications.map(n => (
            <div key={n.id} className="pointer-events-auto bg-blue-600 text-white rounded-2xl shadow-xl px-5 py-3 flex items-center gap-3 max-w-sm animate-in slide-in-from-right-4 duration-300">
              <span className="text-sm font-semibold flex-1">{n.message}</span>
              <button onClick={() => dismissNotification(n.id)} className="p-1 hover:bg-blue-700 rounded-lg transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
          ))}
          {toast && (
            <div className="pointer-events-auto">
              <Toast 
                message={toast.message} 
                type={toast.type} 
                onClose={() => setToast(null)} 
              />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
