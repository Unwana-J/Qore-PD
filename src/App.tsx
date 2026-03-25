import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { cn, isRole, hasRole } from './lib/utils';
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
import { BulkImportView } from './components/BulkImportView';
import { INITIAL_CONFIG } from './mockData';
import { Role, AppConfig, SettingsTab, Project } from './types';
import { useProjects } from './hooks/useProjects';
import { Toast } from './components/common/Toast';
import { api } from './lib/api';
import { OnboardingWizard } from './components/OnboardingWizard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthView } from './components/AuthView';

type View = 'dashboard' | 'projects' | 'risks' | 'settings' | 'rebaseline-requests';

import { safety } from './lib/safety';

function AppContent() {
  const { user, profile, loading: authLoading, profileLoading, isReconnecting, loadingStage, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('account');
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [projectToReassign, setProjectToReassign] = useState<Project | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const userRole = profile?.role;

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
    importBulkProjects,
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
    loading: projectsLoading,
    refreshProjects
  } = useProjects(userRole || 'PM', config, profile?.name || 'User');


  useEffect(() => {
    if (!user) return;
    
    // Load config and user/invite data
    const init = async () => {
      if (!user) return;
      
      const localOnboardingSkip = localStorage.getItem('onboarding_skipped');
      
      console.log("[Diagnostics] Initializing app data...");
      try {
        // Completely non-blocking background initialization
        api.config.get().then(c => {
          setConfig(c);
          if (hasRole(userRole, ['Superadmin', 'Manager']) && !c.isSetupComplete && !localOnboardingSkip) {
            setShowOnboarding(true);
          }
        }).catch(err => console.error("Config fetch failed", err));

        api.users.getAll().then(setUsers).catch(err => console.error("User fetch failed", err));
        api.invites.getAll().then(setInvites).catch(err => console.error("Invite fetch failed", err));
      } catch (err: any) {
        console.error('[Diagnostics] Initialization error:', err);
      }
    };
    init();
  }, [user?.id, userRole]); // Trigger correctly on user identity or role shift


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

  // Progressive loading screen with staged contextual messages
  if (authLoading || (user && profileLoading && !profile)) {
    const stageMessages: Record<string, string> = {
      auth: 'Verifying your session...',
      profile: 'Loading your profile...',
      ready: 'Almost ready...'
    };
    const message = isReconnecting
      ? 'Reconnecting to your workspace...'
      : (stageMessages[loadingStage] || 'Synchronizing...');
    const stages = ['auth', 'profile', 'ready'] as const;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
        <div className="relative">
          <div className="w-16 h-16 bg-teal-600 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-200 animate-pulse">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-bold text-slate-700">{message}</p>
          {isReconnecting && (
            <p className="text-xs text-slate-400">This may take a moment on slow connections</p>
          )}
        </div>
        <div className="flex gap-1.5">
          {stages.map((stage, i) => (
            <div
              key={stage}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-500",
                loadingStage === stage ? "bg-teal-500 scale-110" :
                i < stages.indexOf(loadingStage) ? "bg-teal-300" : "bg-slate-200"
              )}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  // Hard error — only shown when all retries are exhausted and nothing is loading
  if (!profile && !isReconnecting && !profileLoading && !authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6 p-6">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" />
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="text-xl font-bold text-slate-900">Session Sync Failed</h2>
          <p className="text-sm text-slate-500">We found your session but couldn't retrieve your profile data.</p>
          <p className="text-xs text-slate-400">
            This can happen on slow connections or if your profile wasn't set up correctly.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-64">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-slate-900 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> Retry Connection
          </button>
          <button
            onClick={signOut}
            className="w-full py-3 text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em] hover:text-red-500 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-900 relative">
      {/* Graceful reconnection banner — slides in during idle-resume token refresh */}
      <AnimatePresence>
        {isReconnecting && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="fixed top-0 left-0 right-0 z-[1000] flex items-center justify-center gap-2 bg-teal-600 text-white text-[11px] font-black uppercase tracking-widest py-2 shadow-md"
          >
            <RefreshCw className="w-3 h-3 animate-spin" />
            Reconnecting session…
          </motion.div>
        )}
      </AnimatePresence>
      <Sidebar 
        currentView={currentView}
        setCurrentView={setCurrentView}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        userRole={userRole}
        setUserRole={() => {}} // Disabled for now as it's profile-based
        config={config}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        pendingRebaselineCount={allRebaselineRequests.filter(r => r.status === 'Pending').length}
        onSignOut={signOut}
        userName={profile?.name}
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
          setIsBulkImportOpen={setIsBulkImportOpen}
          userName={profile?.name}
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
                    packages={config.packages}
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
                          loading={projectsLoading}
                        />
                      ) : userRole === 'Executive' ? (
                        <ExecutiveDashboard 
                          projects={filteredProjects}
                          users={users}
                          packages={config.packages}
                          themeColor={config.brand.themeColor}
                          onSelectProject={setSelectedProject}
                          staleThresholdDays={config.staleThresholdDays}
                          spiThresholds={config.spiThresholds}
                          loading={projectsLoading}
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
                          loading={projectsLoading}
                          onUpdateConfig={async (updates) => {
                            const newConfig = { ...config, ...updates };
                            await api.config.update(newConfig);
                            setConfig(newConfig);
                          }}
                          onNavigateToSettings={(tab) => {
                            setCurrentView('settings');
                            setActiveSettingsTab(tab as SettingsTab);
                          }}
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
                        users={users}
                        packages={config.packages}
                        allPMNames={Array.from(new Set([
                          ...users.filter(u => u.role === 'PM').map(u => u.name),
                          ...projects.map(p => p.assignedPM)
                        ])).sort()}
                        onReassignProject={setProjectToReassign}
                        spiThresholds={config.spiThresholds}
                        loading={projectsLoading}
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
                          users={users}
                          setUsers={setUsers}
                          invites={invites}
                          setInvites={setInvites}
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
        users={users}
        importedPMs={Array.from(new Set(projects.map(p => p.assignedPM).filter(Boolean)))}
        serviceBaselines={config.serviceBaselines}
        packages={config.packages}
        productLines={config.productLines}
      />

      {projectToReassign && (
        <ReassignModal 
          isOpen={!!projectToReassign}
          onClose={() => setProjectToReassign(null)}
          project={projectToReassign}
          users={users}
          getPMWorkload={getPMWorkload}
          workloadThresholds={config.workloadThresholds}
          onReassign={reassignProject}
          themeColor={config.brand.themeColor}
        />
      )}

      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 lg:p-10 hide-scrollbar overflow-y-auto">
          <div className="bg-white w-full h-[calc(100vh-100px)] rounded-3xl shadow-2xl relative overflow-hidden flex flex-col">
            <BulkImportView 
              users={users}
              invites={invites}
              projects={projects}
              config={config}
              userRole={userRole}
              onImportBulk={importBulkProjects}
              onShowToast={showToast}
              onClose={async () => {
                await refreshProjects();
                setIsBulkImportOpen(false);
              }}
              onUpdateConfig={(updates) => setConfig(prev => ({ ...prev, ...updates }))}
            />
          </div>
        </div>
      )}

      {showOnboarding && (
        <OnboardingWizard 
          config={config}
          userRole={userRole}
          onUpdateConfig={async (updates) => {
            const newConfig = { ...config, ...updates };
            await api.config.update(newConfig);
            setConfig(newConfig);
          }}
          onFinish={async () => {
            const newConfig = { ...config, isSetupComplete: true };
            await api.config.update(newConfig);
            setConfig(newConfig);
            setShowOnboarding(false);
            localStorage.setItem('onboarding_skipped', 'true');
          }}
          onSkip={async () => {
            const newConfig = { ...config, isSetupComplete: true };
            await api.config.update(newConfig);
            setConfig(newConfig);
            setShowOnboarding(false);
            localStorage.setItem('onboarding_skipped', 'true');
          }}
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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
