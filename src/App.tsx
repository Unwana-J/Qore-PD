import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, UserCircle, ChevronRight, X, Settings, Upload } from 'lucide-react';
import { cn, isRole, hasRole, resolveServiceIds } from './lib/utils';
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
import { DigestModal } from './components/DigestModal';
import { ImplementationDigestModal } from './components/ImplementationDigestModal';
import { DeactivatedScreen } from './components/DeactivatedScreen';
import { ImplementationsView } from './components/ImplementationsView';
import { INITIAL_CONFIG } from './mockData';
import { Role, AppConfig, SettingsTab, Project, ProjectState } from './types';
import { useProjects } from './hooks/useProjects';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider, useNotifications } from './contexts/NotificationContext';
import { AuthView } from './components/AuthView';
import { api } from './lib/api';
import { OnboardingWizard } from './components/OnboardingWizard';
import { calculateSPI } from './lib/utils';

type View = 'dashboard' | 'projects' | 'risks' | 'settings' | 'rebaseline-requests' | 'implementations';

import { safety } from './lib/safety';

function AppContent() {
  const { user, profile, loading: authLoading, profileLoading, isReconnecting, loadingStage, signOut } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>('account');
  const [projectListFilter, setProjectListFilter] = useState<ProjectState | 'All'>('All');
  const [projectListPMFilter, setProjectListPMFilter] = useState<string | null>(null);
  const [implementationsFilter, setImplementationsFilter] = useState<string | 'All'>('All');
  const [implementationsIMFilter, setImplementationsIMFilter] = useState<string | 'All'>('All');
  const [openedFromDigest, setOpenedFromDigest] = useState(false);
  const [openedImplementationsFromDigest, setOpenedImplementationsFromDigest] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [isDigestOpen, setIsDigestOpen] = useState(false);
  const [isImplementationDigestOpen, setIsImplementationDigestOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [config, setConfig] = useState<AppConfig>(INITIAL_CONFIG);
  const [users, setUsers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [projectToReassign, setProjectToReassign] = useState<Project | null>(null);
  const [showSPIAnomaly, setShowSPIAnomaly] = useState(true);
  const { success, error: notifyError, info } = useNotifications();
  const [simulatedRole, setSimulatedRole] = useState<Role | null>(null);
  const actualRole = profile?.role;
  const userRole = simulatedRole || actualRole;
  // IDs of projects the current IM is mapped to (via approved service_extensions)
  const [imMappedProjectIds, setImMappedProjectIds] = useState<Set<string>>(new Set());
  const [importMode, setImportMode] = useState<'projects' | 'implementations'>('projects');

  const {
    filteredProjects,
    projects,
    selectedProject,
    setSelectedProject,
    addProject: originalAddProject,
    importBulkProjects,
    importBulkExtensions,
    updateProject,
    billProject,
    rejectBilling,
    reassignProject: originalReassignProject,
    submitRebaselineRequest,
    approveRebaselineRequest,
    declineRebaselineRequest,
    allRebaselineRequests,
    getPMWorkload,
    validateStateTransition,
    notifications,
    dismissNotification,
    markAllRead,
    clearAllNotifications,
    weeklyDigest,
    historicalDigests,
    dismissDigest,
    implementationDigest,
    implementationHistoricalDigests,
    dismissImplementationDigest,
    loading: projectsLoading,
    refreshProjects
  } = useProjects(userRole || 'PM', config, profile?.name || 'User');


  useEffect(() => {
    if (!user) return;
    
    // Load config and user/invite data
    const init = async () => {
      try {
        const [cloudConfig, fetchedUsers, fetchedInvites] = await Promise.all([
          api.config.get(),
          api.users.getAll().catch(e => { console.error(e); return []; }),
          api.invites.getAll().catch(e => { console.error(e); return []; })
        ]);

        setUsers(fetchedUsers);
        setInvites(fetchedInvites);

        // Universal Migration Layer: Sanitize packages to always use service IDs
        const sanitizedPackages = (cloudConfig.packages || []).map(pkg => ({
          ...pkg,
          services: resolveServiceIds(pkg.services || [], cloudConfig.serviceBaselines)
        }));
        
        const nextConfig = {
          ...cloudConfig,
          packages: sanitizedPackages
        };
        
        setConfig(nextConfig);

        // Deep Migration: Persist IDs back to DB if they were resolved from names
        if (JSON.stringify(cloudConfig.packages) !== JSON.stringify(sanitizedPackages)) {
          console.log("[Migration] Permanent ID-based synchronization triggered...");
          api.config.update(nextConfig).catch(err => console.error("[Migration] Save failed:", err));
        }
      } catch (err) {
        console.error("Failed to load cloud config:", err);
      }
    };
    init();

    // Load IM's mapped projects separately
    if (hasRole(userRole, ['IM', 'IM Lead']) && profile?.name) {
      api.serviceExtensions.getByIM(profile.name).then(exts => {
        const approvedIds = new Set(
          exts
            .filter(e => e.mappingStatus === 'Approved' && e.linkedProjectId)
            .map(e => e.linkedProjectId!)
        );
        setImMappedProjectIds(approvedIds);
      }).catch(console.error);
    }
  }, [user?.id, userRole]); // Depend on user and userRole to re-fetch if they change

  const handleUpdateConfig = async (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    try {
      await api.config.update(newConfig);
      setConfig(newConfig);
    } catch (err: any) {
      console.error("[API] Config persistence failed:", err);
      notifyError(err.message || "Failed to save configuration to cloud.");
    }
  };


  const addProject = async (p: Partial<Project>, force?: boolean) => {
    try {
      const result: any = await originalAddProject(p, force);
      if (!result?.warning) {
        success('Project created successfully!');
      }
      return result;
    } catch (err: any) {
      notifyError(err.message);
      throw err;
    }
  };

  const reassignProject = async (id: string, pm: string) => {
    try {
      await originalReassignProject(id, pm);
      success('Project reassigned successfully!');
    } catch (err: any) {
      notifyError(err.message);
    }
  };

  // User Deactivation / Stale 90-Day Logic
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const lastActivity = profile?.updated_at ? new Date(profile.updated_at) : (profile?.created_at ? new Date(profile.created_at) : new Date());
  const isStaleUser = profile && lastActivity < ninetyDaysAgo;
  const isDeactivated = profile?.status === 'Inactive' || isStaleUser;

  if (isDeactivated && !authLoading) {
    return (
      <DeactivatedScreen 
        brand={config.brand} 
        userName={profile?.name} 
        onLogout={signOut} 
      />
    );
  }

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
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse">
            <img src="/icon.png" alt="Loading..." className="w-12 h-12 object-contain" />
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

  // Maintenance Mode Intercept
  if (config.maintenanceMode && actualRole !== 'Superadmin') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-200 p-6 selection:bg-teal-500/30">
        <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden backdrop-blur-xl border border-slate-700/50">
          <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-transparent" />
          <Settings className="w-10 h-10 text-teal-400 animate-spin-slow relative z-10" />
        </div>
        
        <h1 className="text-3xl font-black text-white tracking-tight mb-3">System Under Maintenance</h1>
        <p className="max-w-md text-center text-slate-400 font-medium mb-10 text-sm leading-relaxed">
          The Solution Delivery platform is currently undergoing scheduled maintenance to improve performance and reliability.
          Please check back shortly.
        </p>

        <div className="flex gap-4">
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white text-slate-900 font-bold rounded-xl shadow-xl hover:bg-slate-100 transition-all active:scale-95 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
          <button 
            onClick={signOut}
            className="px-6 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl hover:bg-slate-700 hover:text-white transition-all active:scale-95"
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
        setCurrentView={(view) => {
          setCurrentView(view);
          if (view === 'projects') {
            setProjectListFilter('All');
            setProjectListPMFilter(null);
          }
          if (view === 'implementations') {
            setImplementationsFilter('All');
            setImplementationsIMFilter('All');
          }
          setOpenedFromDigest(false);
          setOpenedImplementationsFromDigest(false);
        }}
        selectedProject={selectedProject}
        setSelectedProject={setSelectedProject}
        userRole={userRole as Role}
        setUserRole={setSimulatedRole}
        actualRole={actualRole as Role}
        config={config}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        pendingRebaselineCount={allRebaselineRequests.filter(r => r.status === 'Pending').length}
        pendingBillingCount={projects.filter(p => p.state === 'Signed Off').length}
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
          notifications={notifications}
          dismissNotification={dismissNotification}
          markAllRead={markAllRead}
          clearAllNotifications={clearAllNotifications}
          onSelectProject={setSelectedProject}
          projects={projects}
          digestData={weeklyDigest}
          onOpenDigest={() => setIsDigestOpen(true)}
          implementationDigestData={implementationDigest}
          onOpenImplementationDigest={() => setIsImplementationDigestOpen(true)}
          openedImplementationsFromDigest={openedImplementationsFromDigest}
        />

        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {profile?.role === 'PM' && profile?.name?.trim().toLowerCase() === 'user' && currentView === 'dashboard' && (
              <div className="mt-6 mx-6 p-6 bg-teal-600 rounded-[2rem] text-white shadow-xl shadow-teal-200/50 flex flex-col md:flex-row items-center gap-6 animate-in slide-in-from-top-4 duration-500">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                  <UserCircle className="w-10 h-10 text-white" />
                </div>
                <div className="flex-1 text-center md:text-left space-y-1">
                  <h3 className="text-lg font-black tracking-tight">Set Your Profile Name</h3>
                  <p className="text-sm font-bold text-teal-50 leading-relaxed max-w-xl">
                    Projects are linked to your dashboard using your name. Your name is currently set to "User" — please update it to your real name in Settings to see your assigned projects.
                  </p>
                </div>
                <button 
                  onClick={() => { setCurrentView('settings'); setActiveSettingsTab('account'); }}
                  className="px-8 py-3 bg-white text-teal-600 rounded-xl font-black text-sm shadow-lg hover:bg-teal-50 transition-all flex items-center gap-2 shrink-0"
                >
                  Go to Settings
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
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
                    serviceBaselines={config.serviceBaselines}
                    packages={config.packages}
                    themeColor={config.brand.themeColor}
                    onReassign={() => setProjectToReassign(selectedProject)}
                    defaultPhases={config.defaultPhases}
                    onSubmitRebaseline={submitRebaselineRequest}
                    onApproveRebaseline={approveRebaselineRequest}
                    onDeclineRebaseline={declineRebaselineRequest}
                    spiThresholds={config.spiThresholds}
                    validateStateTransition={validateStateTransition}
                    onShowToast={(msg, type) => type === 'error' ? notifyError(msg) : success(msg)}
                    userName={profile?.name}
                    riskCategories={config.riskCategories}
                  />
                ) : (
                  <>
                    {currentView === 'dashboard' && (hasRole(userRole, ['IM', 'IM Lead'])) && (
                      <ImplementationsView
                        userRole={userRole}
                        userName={profile?.name || ''}
                        config={config}
                        projects={projects}
                        users={users}
                        defaultTab="insights"
                        mode="dashboard"
                        onViewProject={(pid) => {
                          const proj = projects.find(p => p.id === pid);
                          if (proj) {
                            setViewingProject(proj);
                            setCurrentView('projects');
                          }
                        }}
                      />
                    )}
                    {currentView === 'dashboard' && !hasRole(userRole, ['IM', 'IM Lead']) && (
                      userRole === 'Finance' ? (
                        <FinanceDashboard
                          projects={filteredProjects}
                          onBillProject={billProject}
                          onRejectBilling={rejectBilling}
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
                          onFilterClick={(state) => {
                            setProjectListFilter(state);
                            setCurrentView('projects');
                          }}
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
                          onUpdateConfig={handleUpdateConfig}
                          onNavigateToSettings={(tab) => {
                            setCurrentView('settings');
                            setActiveSettingsTab(tab as SettingsTab);
                          }}
                        />
                      )
                    )}
                    {currentView === 'projects' && (
                      <ProjectList
                        projects={
                          // IMs see only projects they are mapped to (read-only)
                          hasRole(userRole, ['IM']) && !hasRole(userRole, ['IM Lead'])
                            ? projects.filter(p => imMappedProjectIds.has(p.id))
                            : filteredProjects
                        }
                        initialStateFilter={projectListFilter}
                        initialPMFilter={projectListPMFilter || undefined}
                        onBackToDigest={openedFromDigest ? () => setIsDigestOpen(true) : undefined}
                        onSelectProject={setSelectedProject}
                        themeColor={config.brand.themeColor}
                        staleThresholdDays={config.staleThresholdDays}
                        userRole={userRole}
                        users={users}
                        packages={config.packages}
                        serviceBaselines={config.serviceBaselines || []}
                        allPMNames={Array.from(new Set([
                          ...users.filter(u => u.role === 'PM').map(u => u.name),
                          ...projects.map(p => p.assignedPM)
                        ])).sort()}
                        onReassignProject={setProjectToReassign}
                        spiThresholds={config.spiThresholds}
                        loading={projectsLoading}
                        customTags={config.customTags}
                      />
                    )}
                    {currentView === 'risks' && (
                      <RisksTable 
                        projects={filteredProjects} 
                        onSelectProject={setSelectedProject} 
                        riskCategories={config.riskCategories}
                        onViewImplementation={(ext) => {
                          setImplementationsFilter('All');
                          setImplementationsIMFilter('All');
                          setCurrentView('implementations');
                        }}
                        allPMNames={Array.from(new Set([
                          ...users.filter(u => u.role === 'PM').map(u => u.name),
                          ...projects.map(p => p.assignedPM)
                        ])).sort()}
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
                          onUpdateConfig={handleUpdateConfig}
                          activeTab={activeSettingsTab}
                          setActiveTab={setActiveSettingsTab}
                          showToast={(msg, type) => type === 'error' ? notifyError(msg) : success(msg)}
                          users={users}
                          setUsers={setUsers}
                          invites={invites}
                          setInvites={setInvites}
                        />
                    )}
                    {currentView === 'implementations' && (
                      <ImplementationsView 
                        userRole={userRole || 'PM'} 
                        userName={profile?.name || 'User'} 
                        config={config} 
                        projects={projects}
                        users={users}
                        onShowToast={(msg, type) => type === 'error' ? error(msg) : success(msg)}
                        onImportExtensions={() => {
                          setImportMode('implementations');
                          setIsBulkImportOpen(true);
                        }}
                        defaultTab={isRole(userRole, 'IM Lead') || isRole(userRole, 'Superadmin') ? 'all' : 'mine'}
                        mode="list"
                        onViewProject={(pid) => {
                          const proj = projects.find(p => p.id === pid);
                          if (proj) {
                            setViewingProject(proj);
                            setCurrentView('projects');
                          }
                        }}
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
        customTags={config.customTags}
        userName={profile?.name}
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
              userRole={userRole || 'PM'}
              mode={importMode}
              onImportBulk={importBulkProjects}
              onImportExtensions={importBulkExtensions}
              onShowToast={(msg, type) => {
                if (type === 'error') error(msg);
                else if (type === 'success') success(msg);
                else info(msg);
              }}
              onUpdateConfig={handleUpdateConfig}
              onClose={() => setIsBulkImportOpen(false)}
            />
          </div>
        </div>
      )}

      {showOnboarding && (
        <OnboardingWizard 
          config={config}
          userRole={userRole}
          onUpdateConfig={handleUpdateConfig}
          onFinish={() => {
            handleUpdateConfig({ isSetupComplete: true });
            setShowOnboarding(false);
            localStorage.setItem('onboarding_skipped', 'true');
          }}
          onSkip={() => {
            handleUpdateConfig({ isSetupComplete: true });
            setShowOnboarding(false);
            localStorage.setItem('onboarding_skipped', 'true');
          }}
        />
      )}

      {/* SPI Anomaly Banner — Only for Managers & Superadmins */}
      {showSPIAnomaly && hasRole(userRole, ['Superadmin', 'Manager']) && projects.some(p => calculateSPI(p).isAnomaly) && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-lg px-4 pointer-events-none">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between gap-4 pointer-events-auto border border-red-500/50 backdrop-blur-md bg-opacity-95 group"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-widest leading-none">SPI Anomaly Detected</p>
                <p className="text-[11px] font-bold opacity-90 mt-1 leading-tight">
                  Multiple projects are showing extreme schedule performance (+1.50). 
                  Please review progress tracking accuracy.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  setProjectListFilter('Delayed');
                  setCurrentView('projects');
                  setSelectedProject(null);
                }}
                className="px-4 py-2 bg-white text-red-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
              >
                Review Now
              </button>
              <button
                  onClick={() => {
                    setImportMode('projects');
                    setIsBulkImportOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Projects
                </button>
              <button 
                onClick={() => setShowSPIAnomaly(false)}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white/60 hover:text-white"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Weekly Digest Modal */}
      <AnimatePresence>
        {isDigestOpen && weeklyDigest && (
          <DigestModal
            digest={weeklyDigest}
            historicalDigests={historicalDigests}
            themeColor={config.brand.themeColor}
            userRole={userRole}
            onClose={() => setIsDigestOpen(false)}
            onNavigate={(view, filter, pmFilter) => {
              setIsDigestOpen(false);
              setOpenedFromDigest(true);
              setCurrentView(view as any);
              if (view === 'projects') {
                if (filter) setProjectListFilter(filter as any);
                if (pmFilter) setProjectListPMFilter(pmFilter);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Implementation Weekly Digest Modal */}
      <AnimatePresence>
        {isImplementationDigestOpen && implementationDigest && (
          <ImplementationDigestModal
            digest={implementationDigest}
            historicalDigests={implementationHistoricalDigests}
            onClose={() => setIsImplementationDigestOpen(false)}
            onNavigate={(view, filter, imFilter) => {
              setIsImplementationDigestOpen(false);
              setCurrentView(view as any);
              setOpenedImplementationsFromDigest(true);
              if (filter) setImplementationsFilter(filter);
              if (imFilter) setImplementationsIMFilter(imFilter);
            }}
            themeColor={config.brand.themeColor}
          />
        )}
      </AnimatePresence>

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}
