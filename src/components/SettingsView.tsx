import React, { useState } from 'react';
import { 
  Shield, 
  Users, 
  Settings as SettingsIcon, 
  DollarSign, 
  History, 
  UserPlus, 
  Trash2, 
  RefreshCw, 
  Download, 
  Search,
  Check,
  X,
  ChevronRight,
  Clock,
  Activity,
  Award,
  Box,
  Save,
  Palette,
  Filter,
  Link as LinkIcon
} from 'lucide-react';
import { 
  Role, 
  User, 
  AuditLog, 
  AppConfig, 
  WeightHistory, 
  PackageConfig,
  Project,
  ProjectPriority,
  SettingsTab
} from '../types';
import { PROJECT_STATES } from '../constants';
import { cn } from '../lib/utils';
import { MOCK_USERS, MOCK_AUDIT_LOGS, MOCK_WEIGHT_HISTORY } from '../mockData';
import { getThemeClasses } from '../lib/theme';
import { ConfirmationModal } from './common/ConfirmationModal';

interface SettingsViewProps {
  userRole: Role;
  projects: Project[];
  onUpdateProjects: (projects: Project[]) => void;
  config: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  invites: any[];
  setInvites: React.Dispatch<React.SetStateAction<any[]>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  userRole,
  projects,
  onUpdateProjects,
  config,
  onUpdateConfig,
  activeTab,
  setActiveTab,
  showToast,
  users,
  setUsers,
  invites,
  setInvites
}) => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS);
  const [weightHistory, setWeightHistory] = useState<WeightHistory[]>(MOCK_WEIGHT_HISTORY);
  const [packages, setPackages] = useState<PackageConfig[]>(config.packages);
  const [showUserRemoveConfirm, setShowUserRemoveConfirm] = useState<any | null>(null);

  const theme = getThemeClasses(config.brand.themeColor);
  
  // Tab access control
  const canAccess = (tab: SettingsTab) => {
    if (userRole === 'Superadmin') return true;
    
    // Package & Service is strictly for Superadmin and Manager
    if (tab === 'packages') return userRole === 'Manager';

    if (userRole === 'Manager' || userRole === 'Team Lead') {
      return tab !== 'revenue' && tab !== 'brand'; 
    }
    if (tab === 'brand' && userRole === 'Superadmin') return true;
    if (tab === 'account') return true;
    if (tab === 'audit' && (userRole === 'Executive' || userRole === 'Superadmin')) return true;
    if (tab === 'revenue' && (userRole === 'Finance' || userRole === 'Superadmin')) return true;
    return false;
  };

  const handleConfirmedRemove = async () => {
    if (showUserRemoveConfirm) {
      try {
        if (showUserRemoveConfirm.status === 'Pending') {
          await api.invites.delete(showUserRemoveConfirm.id);
          setInvites(invites.filter(i => i.id !== showUserRemoveConfirm.id));
        } else {
          // Future: Add user deletion logic
          setUsers(users.filter(u => u.id !== showUserRemoveConfirm.id));
        }
        showToast(`${showUserRemoveConfirm.email || showUserRemoveConfirm.name} has been removed.`, 'success');
      } catch (err) {
        showToast("Failed to remove user/invite", "error");
      }
      setShowUserRemoveConfirm(null);
    }
  };

  const SidebarItem = ({ id, icon: Icon, label }: { id: SettingsTab, icon: any, label: string }) => {
    const disabled = !canAccess(id);
    return (
      <button
        disabled={disabled}
        onClick={() => setActiveTab(id)}
        className={cn(
          "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left",
          activeTab === id 
            ? cn(theme.bg, "text-white shadow-lg", theme.shadow) 
            : disabled 
              ? "text-slate-300 cursor-not-allowed opacity-50" 
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <Icon className="w-5 h-5" />
        <span className="font-semibold text-sm">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-[calc(100vh-8rem)] bg-slate-50/50 p-6 gap-8">
      {/* Sidebar Navigation */}
      <div className="w-72 flex flex-col gap-8">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">System Settings</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Configure your environment</p>
        </div>
        
        <div className="flex flex-col gap-1.5 p-1.5 bg-white rounded-3xl border border-slate-200 shadow-sm">
          <SidebarItem id="account" icon={SettingsIcon} label="Account Settings" />
          <SidebarItem id="users" icon={Users} label="User Management" />
          <SidebarItem id="project" icon={RefreshCw} label="Project Lifecycle" />
          <SidebarItem id="priority" icon={Filter} label="Priorities & Weight" />
          <SidebarItem id="revenue" icon={DollarSign} label="Revenue Controls" />
          <SidebarItem id="brand" icon={Palette} label="White Labelling" />
          <SidebarItem id="packages" icon={Box} label="Package & Service" />
          <SidebarItem id="audit" icon={History} label="System Audit Log" />
        </div>

        {userRole === 'Superadmin' && (
          <div className="p-6 bg-slate-900 rounded-3xl shadow-xl shadow-slate-900/10">
            <Shield className="w-8 h-8 text-teal-400 mb-4" />
            <h3 className="text-white font-black text-sm mb-1 uppercase tracking-wider">Superadmin Mode</h3>
            <p className="text-slate-400 text-[10px] font-bold">Unrestriced configuration and user management enabled.</p>
          </div>
        )}
      </div>

      {/* Settings Content */}
      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
        {activeTab === 'users' && 
          <UserManagement 
            users={users} 
            setUsers={setUsers} 
            invites={invites}
            setInvites={setInvites}
            projects={projects}
            onUpdateProjects={onUpdateProjects}
            currentUserRole={userRole}
            config={config}
            showToast={showToast}
            setShowUserRemoveConfirm={setShowUserRemoveConfirm}
          />
        }
        {activeTab === 'priority' && <PrioritySettings config={config} setConfig={onUpdateConfig} packages={packages} setPackages={setPackages} weightHistory={weightHistory} setWeightHistory={setWeightHistory} userRole={userRole} theme={theme} />}
        {activeTab === 'project' && <ProjectConfig config={config} setConfig={onUpdateConfig} userRole={userRole} theme={theme} />}
        {activeTab === 'revenue' && <RevenueSettings config={config} setConfig={onUpdateConfig} userRole={userRole} theme={theme} />}
        {activeTab === 'brand' && <BrandSettings config={config} setConfig={onUpdateConfig} userRole={userRole} theme={theme} />}
        {activeTab === 'packages' && <PackageServiceConfig config={config} setConfig={onUpdateConfig} userRole={userRole} theme={theme} showToast={showToast} />}
        {activeTab === 'account' && <AccountSettings config={config} userRole={userRole} theme={theme} />}
        {activeTab === 'audit' && <AuditView logs={auditLogs} />}
      </div>

      <ConfirmationModal 
        isOpen={!!showUserRemoveConfirm}
        onClose={() => setShowUserRemoveConfirm(null)}
        onConfirm={handleConfirmedRemove}
        title={showUserRemoveConfirm?.status === 'Pending' ? "Cancel Invitation" : "Remove User"}
        message={showUserRemoveConfirm?.status === 'Pending' 
          ? `Are you sure you want to cancel the invitation for ${showUserRemoveConfirm.email}?` 
          : `Are you sure you want to remove ${showUserRemoveConfirm?.name}? This action cannot be undone.`}
        confirmLabel={showUserRemoveConfirm?.status === 'Pending' ? "Cancel Invite" : "Remove User"}
        variant="danger"
        themeColor={config.brand.themeColor}
      />
    </div>
  );
};

// --- Sub-components ---


const UserManagement = ({ users, setUsers, invites, setInvites, projects, onUpdateProjects, currentUserRole, config, showToast, setShowUserRemoveConfirm }: any) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'PM' as Role });
  const [filter, setFilter] = useState<'All' | 'Active' | 'Pending'>('All');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invite = await api.invites.send(newUser.email, newUser.role);
      setInvites([invite, ...invites]);
      setIsAdding(false);
      setNewUser({ name: '', email: '', role: 'PM' });
      showToast(`Invitation sent to ${newUser.email}`, 'success');
    } catch (err: any) {
      showToast(err.message || "Failed to send invite", "error");
    }
  };

  const filteredItems = [
    ...users.map(u => ({ ...u, statusType: 'Active' })),
    ...invites.map(i => ({ ...i, statusType: 'Pending', name: 'Invitee' }))
  ].filter(item => filter === 'All' || item.statusType === filter);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">User Management</h3>
          <p className="text-sm text-slate-500">Manage team members, roles, and pending invitations.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-xl transition-all",
            theme.bg, theme.hoverBg
          )}
        >
          <UserPlus className="w-4 h-4" />
          Invite Staff
        </button>
      </div>

      <div className="flex gap-2">
        {['All', 'Active', 'Pending'].map((f: any) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all",
                filter === f 
                  ? cn(theme.lightBg, theme.border, theme.text) 
                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              )}
            >
            {f}
          </button>
        ))}
      </div>

      {isAdding && (
        <form onSubmit={handleInvite} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              required
              type="email"
              placeholder="Email Address"
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
              value={newUser.email}
              onChange={e => setNewUser({...newUser, email: e.target.value})}
            />
            <select 
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
              value={newUser.role}
              onChange={e => setNewUser({...newUser, role: e.target.value as Role})}
            >
              <option value="PM">Project Manager</option>
              <option value="Manager">Manager</option>
              {currentUserRole === 'Superadmin' && <option value="Superadmin">Superadmin</option>}
              <option value="Finance">Finance</option>
              <option value="Executive">Executive</option>
            </select>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
            New users will be automatically assigned their role when they sign up with this email.
          </p>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-500 font-bold text-sm">Cancel</button>
            <button type="submit" className={cn("px-6 py-2 text-white font-bold rounded-xl text-sm", theme.bg)}>Send Invite</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.map((item: any) => (
          <div key={item.id} className={cn(
            "flex items-center justify-between p-4 bg-white border rounded-2xl transition-all group",
            item.statusType === 'Pending' ? "border-amber-100 bg-amber-50/20" : cn("border-slate-100", theme.hoverBorder)
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                item.statusType === 'Pending' ? "bg-amber-100 text-amber-600" : cn(theme.lightBg, theme.text)
              )}>
                {item.avatar || item.email?.substring(0, 2).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{item.name || item.email}</p>
                <p className="text-xs text-slate-500">{item.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">{item.role}</span>
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                  item.statusType === 'Active' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                )}>
                  {item.statusType}
                </span>
              </div>
              <div className="flex gap-1">
                {item.statusType === 'Pending' && (
                  <button 
                    onClick={() => {
                        const inviteLink = `${window.location.origin}`;
                        navigator.clipboard.writeText(inviteLink);
                        showToast(`Signup link copied! Send this to ${item.email}.`, 'success');
                    }}
                    title="Copy Signup Link"
                    className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  >
                    <LinkIcon className="w-4 h-4" />
                  </button>
                )}
                {(currentUserRole === 'Superadmin' || (currentUserRole === 'Manager' && item.role !== 'Superadmin')) && (
                  <button onClick={() => setShowUserRemoveConfirm(item)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="py-20 text-center">
            <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No {filter.toLowerCase()} users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ProjectConfig = ({ config, setConfig, theme }: any) => {
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Project Configuration</h3>
        <p className="text-sm text-slate-500">Define default templates and state detection.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Stale Project Threshold</h4>
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              className={cn("w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
              value={config.staleThresholdDays}
              onChange={e => setConfig({...config, staleThresholdDays: parseInt(e.target.value)})}
            />
            <span className="text-sm text-slate-600 font-medium">days without activity</span>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-slate-900">Show Bulk Import Guide</h4>
            <p className="text-xs text-slate-500 pt-1">Display the instructions pop-up before bulk importing projects.</p>
          </div>
          <button 
            onClick={() => setConfig({...config, hideImportGuide: !config.hideImportGuide})}
            className={cn("w-12 h-6 rounded-full relative transition-all", !config.hideImportGuide ? theme.bg : "bg-slate-300")}
          >
            <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", !config.hideImportGuide ? "left-7" : "left-1")} />
          </button>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">SPI Status Thresholds</h4>
          <p className="text-xs text-slate-500 font-medium pb-2">Set the thresholds for Schedule Performance Index statuses.</p>
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1.5 focus-within:z-10">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                 On-Track (≥)
               </label>
               <input 
                 type="number" step="0.01"
                 className={cn("w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
                 value={config.spiThresholds?.onTrack || 1.0}
                 onChange={e => {
                   const val = parseFloat(e.target.value) || 1.0;
                   setConfig({ ...config, spiThresholds: { ...config.spiThresholds, onTrack: val } });
                 }}
               />
             </div>
             <div className="space-y-1.5 focus-within:z-10">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                 At Risk (≥)
               </label>
               <input 
                 type="number" step="0.01"
                 className={cn("w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
                 value={config.spiThresholds?.atRisk || 0.8}
                 onChange={e => {
                   const val = parseFloat(e.target.value) || 0.8;
                   setConfig({ ...config, spiThresholds: { ...config.spiThresholds, atRisk: val } });
                 }}
               />
             </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Project Lifecycle Weights</h4>
          <p className="text-xs text-slate-500 font-medium pb-2">Set the relative weight of each phase towards total project completion (%)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {Object.entries(config.projectLifecycleWeights || {}).map(([phase, weight]) => (
               <div key={phase} className="space-y-1.5 focus-within:z-10">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                   {phase}
                 </label>
                 <div className="flex items-center">
                   <input 
                     type="number" 
                     className={cn("w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
                     value={weight as number}
                     onChange={e => {
                       const val = parseInt(e.target.value) || 0;
                       setConfig({
                         ...config, 
                         projectLifecycleWeights: { ...config.projectLifecycleWeights, [phase]: val }
                       })
                     }}
                   />
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const RevenueSettings = ({ config, setConfig, theme }: any) => (
  <div className="p-8 space-y-8 animate-in fade-in duration-300">
    <h3 className="text-lg font-bold text-slate-900">Revenue Controls</h3>
    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-slate-900">Post-Intake Edit Permission</p>
        <p className="text-xs text-slate-500">Allow revenue updates after project creation.</p>
      </div>
      <button 
        onClick={() => setConfig({...config, allowPostIntakeRevenueEdit: !config.allowPostIntakeRevenueEdit})}
        className={cn("w-12 h-6 rounded-full relative transition-all", config.allowPostIntakeRevenueEdit ? theme.bg : "bg-slate-300")}
      >
        <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", config.allowPostIntakeRevenueEdit ? "left-7" : "left-1")} />
      </button>
    </div>
  </div>
);

const PrioritySettings = ({ config, setConfig, packages, setPackages, weightHistory, setWeightHistory, userRole, theme }: any) => {
  const updateWeight = (pkgName: string, newWeight: number) => {
    const pkg = packages.find((p: any) => p.name === pkgName);
    if (!pkg) return;

    const history: WeightHistory = {
      id: Math.random().toString(36).substr(2, 9),
      packageName: pkgName,
      oldWeight: pkg.weight,
      newWeight,
      updatedBy: userRole,
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    };

    setPackages(packages.map((p: any) => p.name === pkgName ? { ...p, weight: newWeight } : p));
    setWeightHistory([history, ...weightHistory]);
  };

  const updateWorkload = (priority: string, value: number) => {
    setConfig({
      ...config,
      workloadThresholds: {
        ...config.workloadThresholds,
        [priority]: value
      }
    });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300 max-h-[700px] overflow-y-auto custom-scrollbar">
      <div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Priorities & Weights</h3>
        <p className="text-sm font-bold text-slate-500">Configure global prioritization logic and workload thresholds.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* At-Risk Threshold */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">At-Risk Detection</h4>
            <p className="text-[10px] font-bold text-slate-500 mb-4">Threshold for projects in "Delayed" state before flagging.</p>
          </div>
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              className={cn(
                "w-20 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-lg font-black outline-none focus:ring-4 transition-all",
                theme.ring, theme.focusBorder
              )}
              value={config.atRiskThresholdDays}
              onChange={e => setConfig({...config, atRiskThresholdDays: parseInt(e.target.value)})}
            />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Days until flagged</span>
          </div>
        </div>

        {/* Workload Thresholds */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Max Workload (Per PM)</h4>
          <div className="space-y-3">
            {['P1', 'P2', 'P3'].map((p) => (
              <div key={p} className="flex items-center justify-between gap-4">
                <span className="text-xs font-black text-slate-600">
                  {p === 'P1' ? 'Tier 1 - Enterprise' : p === 'P2' ? 'Tier 2 - Pro' : 'Tier 3 - Basic'} Projects
                </span>
                <input 
                  type="number" 
                  className={cn(
                    "w-16 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-center outline-none focus:ring-4 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={config.workloadThresholds[p as ProjectPriority]}
                  onChange={e => updateWorkload(p as ProjectPriority, parseInt(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Award className="w-4 h-4" />
          PM Scorecard Weights
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.keys(config.pmScorecardWeights || { deliveryRate: 0.4, avgSpi: 0.4, rebaselineRate: 0.2 }).map((key) => (
            <div key={key} className={cn(
              "flex flex-col p-4 bg-white border border-slate-100 rounded-2xl transition-all hover:shadow-md",
              theme.hoverBorder
            )}>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                {key.replace(/([A-Z])/g, ' $1').trim()} Weight
              </span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.05"
                  min="0"
                  max="1"
                  className={cn(
                    "w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-4 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={config.pmScorecardWeights?.[key as keyof AppConfig['pmScorecardWeights']] || 0}
                  onChange={e => setConfig({
                    ...config,
                    pmScorecardWeights: {
                      ...config.pmScorecardWeights,
                      [key]: parseFloat(e.target.value) || 0
                    }
                  })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Package Weights
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {packages.map((pkg: any) => (
            <div key={pkg.name} className={cn(
              "flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl transition-all hover:shadow-md",
              theme.hoverBorder
            )}>
              <span className="text-xs font-bold text-slate-700 truncate mr-2">{pkg.name}</span>
              <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  step="0.1"
                  className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-center outline-none"
                  value={pkg.weight}
                  onChange={e => updateWeight(pkg.name, parseFloat(e.target.value))}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          Weight Audit Log
        </h4>
        <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[10px]">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200">
                  <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Package</th>
                  <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-center">Change</th>
                  <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Author</th>
                  <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {weightHistory.map((h: any) => (
                  <tr key={h.id} className="hover:bg-white transition-colors">
                    <td className="px-4 py-3 font-bold text-slate-700">{h.packageName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-slate-400">{h.oldWeight.toFixed(1)}</span>
                      <ChevronRight className="w-3 h-3 inline mx-2 text-slate-300" />
                      <span className={cn("font-black", theme.text)}>{h.newWeight.toFixed(1)}</span>
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-600">{h.updatedBy}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono font-bold">{h.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const BrandSettings = ({ config, setConfig, theme }: any) => (
  <div className="p-8 space-y-8 animate-in fade-in duration-300">
    <h3 className="text-lg font-bold text-slate-900">White Labelling</h3>
    <div className="space-y-4">
      <p className="text-sm font-bold text-slate-900">Theme Color</p>
      <div className="flex gap-2">
        {['indigo', 'teal', 'emerald', 'sky', 'rose'].map(c => (
          <button 
            key={c}
            onClick={() => setConfig({...config, brand: {...config.brand, themeColor: c}})}
            className={cn("w-10 h-10 rounded-full border-4", config.brand.themeColor === c ? "border-slate-900" : "border-transparent", `bg-${c}-600`)}
          />
        ))}
      </div>
    </div>
  </div>
);

const AccountSettings = ({ config, userRole, theme }: any) => (
  <div className="p-8 space-y-8 animate-in fade-in duration-300">
    <h3 className="text-lg font-bold text-slate-900">Account Preferences</h3>
    <div className="space-y-4">
       <div className="flex items-center gap-4">
         <div className={cn("w-20 h-20 rounded-full flex items-center justify-center text-3xl font-black text-white", theme.bg)}>
           AD
         </div>
         <div>
           <p className="text-xl font-black text-slate-900">Admin User</p>
           <p className="text-sm font-bold text-slate-500">{userRole}</p>
         </div>
       </div>
    </div>
  </div>
);

const AuditView = ({ logs }: any) => (
  <div className="p-8 space-y-6 animate-in fade-in duration-300">
    <h3 className="text-lg font-bold text-slate-900">System Audit Log</h3>
    <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-100 border-b border-slate-200">
          <tr>
            <th className="px-4 py-3 font-bold text-slate-500">Action</th>
            <th className="px-4 py-3 font-bold text-slate-500">User</th>
            <th className="px-4 py-3 font-bold text-slate-500">Timestamp</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {logs.slice(0, 50).map((log: any) => (
            <tr key={log.id}>
              <td className="px-4 py-3 font-medium text-slate-700">{log.action}: {log.details}</td>
              <td className="px-4 py-3 font-bold text-slate-900">{log.user}</td>
              <td className="px-4 py-3 text-slate-400 font-mono">{log.timestamp}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PackageServiceConfig = ({ config, setConfig, theme, showToast }: any) => {
  const [subTab, setSubTab] = useState<'packages' | 'services'>('packages');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState<any>(null);

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({ ...item });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
    setEditForm(null);
    setNewForm(null);
  };

  const validateService = (form: any, currentId?: string) => {
    if (!form.name.trim()) {
      showToast("Service name is required.", "error");
      return false;
    }
    const isDuplicate = config.serviceBaselines.some((s: any) => 
      s.name.toLowerCase() === form.name.toLowerCase() && s.id !== currentId
    );
    if (isDuplicate) {
      showToast("Service name must be unique.", "error");
      return false;
    }
    if (form.baselineDays <= 0 || !Number.isInteger(Number(form.baselineDays))) {
      showToast("Duration must be a positive whole number.", "error");
      return false;
    }
    return true;
  };

  const validatePackage = (form: any, currentId?: string) => {
    if (!form.name.trim()) {
      showToast("Package name is required.", "error");
      return false;
    }
    const isDuplicate = config.packages.some((p: any) => 
      p.name.toLowerCase() === form.name.toLowerCase() && p.id !== currentId
    );
    if (isDuplicate) {
      showToast("Package name must be unique.", "error");
      return false;
    }
    if (form.services.length === 0) {
      showToast("Select at least one service for this package.", "error");
      return false;
    }
    return true;
  };

  const handleSaveService = (id: string) => {
    if (!validateService(editForm, id)) return;
    const updated = config.serviceBaselines.map((s: any) => s.id === id ? { ...editForm } : s);
    setConfig({ ...config, serviceBaselines: updated });
    handleCancel();
    showToast("Service updated successfully.");
  };

  const handleAddService = () => {
    if (!validateService(newForm)) return;
    const newService = { id: Math.random().toString(36).substr(2, 9), ...newForm };
    setConfig({ ...config, serviceBaselines: [...config.serviceBaselines, newService] });
    handleCancel();
    showToast("Service added successfully.");
  };

  const handleSavePackage = (id: string) => {
    if (!validatePackage(editForm, id)) return;
    const updated = config.packages.map((p: any) => p.id === id ? { ...editForm } : p);
    setConfig({ ...config, packages: updated });
    handleCancel();
    showToast("Package updated successfully.");
  };

  const handleAddPackage = () => {
    if (!validatePackage(newForm)) return;
    const newPackage = { id: Math.random().toString(36).substr(2, 9), weight: 1.0, ...newForm };
    setConfig({ ...config, packages: [...config.packages, newPackage] });
    handleCancel();
    showToast("Package added successfully.");
  };

  const handleDeleteService = (id: string) => {
    const updated = config.serviceBaselines.filter((s: any) => s.id !== id);
    setConfig({ ...config, serviceBaselines: updated });
    showToast("Service deleted.");
  };

  const handleDeletePackage = (id: string) => {
    const updated = config.packages.filter((p: any) => p.id !== id);
    setConfig({ ...config, packages: updated });
    showToast("Package deleted.");
  };

  const toggleServiceInPackage = (form: any, serviceName: string) => {
    const services = [...form.services];
    const idx = services.indexOf(serviceName);
    if (idx > -1) {
      services.splice(idx, 1);
    } else {
      services.push(serviceName);
    }
    if (editingId) setEditForm({ ...form, services });
    else setNewForm({ ...form, services });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Package & Service</h3>
          <p className="text-sm font-bold text-slate-500">Configure project bundles and service delivery metrics.</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => { setSubTab('packages'); handleCancel(); }}
            className={cn("px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all", subTab === 'packages' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
          >
            Package View
          </button>
          <button 
            onClick={() => { setSubTab('services'); handleCancel(); }}
            className={cn("px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all", subTab === 'services' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}
          >
            Service View
          </button>
        </div>
      </div>

      {subTab === 'packages' ? (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
             <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Packages</h4>
             <button 
               onClick={() => { setIsAdding(true); setNewForm({ name: '', services: [] }); }}
               className={cn("flex items-center gap-2 px-4 py-2 text-white text-xs font-bold rounded-xl shadow-md", theme.bg, theme.hoverBg)}
             >
               <RefreshCw className="w-3 h-3" />
               Add Package
             </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {isAdding && (
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
                <input 
                  autoFocus
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl font-bold outline-none ring-teal-500/20 focus:ring-4"
                  placeholder="New Package Name..."
                  value={newForm?.name || ''}
                  onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                />
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Services</p>
                  <div className="flex flex-wrap gap-2">
                    {config.serviceBaselines.map((s: any) => (
                      <button 
                        key={s.id}
                        onClick={() => toggleServiceInPackage(newForm, s.name)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                          newForm?.services.includes(s.name) ? cn(theme.bg, "text-white border-transparent") : "bg-white text-slate-500 border-slate-200"
                        )}
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={handleCancel} className="px-5 py-2 text-slate-500 font-bold text-sm">Cancel</button>
                  <button onClick={handleAddPackage} className={cn("px-5 py-2 text-white font-bold rounded-xl text-sm", theme.bg)}>Create Package</button>
                </div>
              </div>
            )}

            {config.packages.map((pkg: any) => (
              <div key={pkg.id} className="bg-white border border-slate-100 p-6 rounded-3xl hover:shadow-md transition-all group">
                {editingId === pkg.id ? (
                  <div className="space-y-4">
                    <input 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold outline-none"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <div className="flex flex-wrap gap-2">
                      {config.serviceBaselines.map((s: any) => (
                        <button 
                          key={s.id}
                          onClick={() => toggleServiceInPackage(editForm, s.name)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            editForm.services.includes(s.name) ? cn(theme.bg, "text-white border-transparent") : "bg-white text-slate-500 border-slate-200"
                          )}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={handleCancel} className="px-4 py-1.5 text-slate-500 font-bold text-sm">Cancel</button>
                      <button onClick={() => handleSavePackage(pkg.id)} className={cn("px-4 py-1.5 text-white font-bold rounded-xl text-sm", theme.bg)}>Save Changes</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                       <h5 className="text-lg font-black text-slate-900">{pkg.name}</h5>
                       <div className="flex flex-wrap gap-1.5">
                         {pkg.services.map((s: string) => (
                           <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">{s}</span>
                         ))}
                       </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(pkg)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg">
                        <SettingsIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeletePackage(pkg.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Service Name</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-center">Baseline (Days)</th>
                <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="bg-slate-50/30">
                <td colSpan={3} className="px-6 py-3">
                   <button 
                     onClick={() => { setIsAdding(true); setNewForm({ name: '', baselineDays: 1 }); }}
                     className={cn("w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-teal-500/30 hover:text-teal-600 transition-all", isAdding && "hidden")}
                   >
                     + Add New Service
                   </button>
                </td>
              </tr>
              {isAdding && (
                <tr className="bg-slate-50/50 animate-in slide-in-from-top-2">
                  <td className="px-6 py-4">
                    <input 
                      autoFocus
                      className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold outline-none ring-teal-500/20 focus:ring-4"
                      placeholder="Service Name..."
                      value={newForm?.name || ''}
                      onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                    />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <input 
                      type="number"
                      className="w-24 px-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold text-center outline-none ring-teal-500/20 focus:ring-4"
                      value={newForm?.baselineDays || 0}
                      onChange={e => setNewForm({ ...newForm, baselineDays: parseInt(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={handleAddService} className={cn("p-2 rounded-xl text-white shadow-lg shadow-teal-500/20", theme.bg)}><Check className="w-4 h-4" /></button>
                      <button onClick={handleCancel} className="p-2 rounded-xl bg-slate-100 text-slate-400"><X className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )}
              {config.serviceBaselines.map((service: any) => (
                <tr key={service.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    {editingId === service.id ? (
                      <input 
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <span className="text-sm font-bold text-slate-700">{service.name}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {editingId === service.id ? (
                      <input 
                        type="number"
                        className="w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-center outline-none"
                        value={editForm.baselineDays}
                        onChange={e => setEditForm({ ...editForm, baselineDays: parseInt(e.target.value) || 0 })}
                      />
                    ) : (
                      <span className="text-sm font-black text-slate-500">{service.baselineDays} Working Days</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === service.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleSaveService(service.id)} className={cn("px-4 py-1.5 text-white text-xs font-bold rounded-lg", theme.bg)}>Save</button>
                        <button onClick={handleCancel} className="px-4 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(service)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg">
                          <SettingsIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteService(service.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
