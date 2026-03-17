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
  Box,
  Save,
  Palette,
  Filter
} from 'lucide-react';
import { 
  Role, 
  User, 
  AuditLog, 
  AppConfig, 
  WeightHistory, 
  PackageConfig,
  Project,
  SettingsTab
} from '../types';
import { PACKAGES, PROJECT_STATES } from '../constants';
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
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  userRole,
  projects,
  onUpdateProjects,
  config,
  onUpdateConfig,
  activeTab,
  setActiveTab,
  showToast
}) => {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS);
  const [weightHistory, setWeightHistory] = useState<WeightHistory[]>(MOCK_WEIGHT_HISTORY);
  const [packages, setPackages] = useState<PackageConfig[]>(PACKAGES);
  const [showUserRemoveConfirm, setShowUserRemoveConfirm] = useState<User | null>(null);

  const theme = getThemeClasses(config.brand.themeColor);
  
  // Tab access control
  const canAccess = (tab: SettingsTab) => {
    if (userRole === 'Superadmin') return true;
    if (userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead') {
      return tab !== 'revenue' && tab !== 'brand'; 
    }
    if (tab === 'brand' && userRole === 'Superadmin') return true;
    if (tab === 'account') return true;
    if (tab === 'audit' && (userRole === 'Executive' || userRole === 'Superadmin')) return true;
    if (tab === 'revenue' && (userRole === 'Finance' || userRole === 'Superadmin')) return true;
    return false;
  };

  const handleConfirmedRemove = () => {
    if (showUserRemoveConfirm) {
      setUsers(users.filter((u: any) => u.id !== showUserRemoveConfirm.id));
      showToast(`${showUserRemoveConfirm.name} has been removed.`, 'success');
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
        title="Delete User"
        message={showUserRemoveConfirm ? `Are you sure you want to permanently delete ${showUserRemoveConfirm.name}? This action is irreversible.` : ''}
        confirmLabel="Delete User"
        variant="danger"
        themeColor={config.brand.themeColor}
      />
    </div>
  );
};

// --- Sub-components ---


const UserManagement = ({ users, setUsers, projects, onUpdateProjects, currentUserRole, config, showToast, setShowUserRemoveConfirm }: any) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'PM' as Role });
  const [filter, setFilter] = useState<'All' | 'Active' | 'Inactive' | 'Invited'>('All');

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      ...newUser,
      status: 'Invited',
      invitedAt: new Date().toISOString(),
      avatar: newUser.name.split(' ').map(n => n[0]).join('').toUpperCase()
    };
    setUsers([...users, user]);
    setIsAdding(false);
    showToast(`Invite sent to ${user.email}`, 'success');
  };

  const toggleUserStatus = (id: string) => {
    const user = users.find((u: any) => u.id === id);
    if (!user) return;

    if (user.role === 'Superadmin' && user.status === 'Active') {
      const activeSuperadmins = users.filter((u: any) => u.role === 'Superadmin' && u.status === 'Active');
      if (activeSuperadmins.length <= 1) {
        showToast("Cannot deactivate the last active Superadmin.", 'error');
        return;
      }
    }

    if (currentUserRole === 'Manager' && (user.role === 'Superadmin' || user.role === 'Manager')) {
      showToast("Managers cannot modify other Managers or Superadmins.", 'error');
      return;
    }

    setUsers(users.map((u: any) => u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u));
    showToast(`${user.name} status updated.`, 'info');
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">User Management</h3>
          <p className="text-sm text-slate-500">Manage team members, roles, and access status.</p>
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
        {['All', 'Active', 'Inactive', 'Invited'].map((f: any) => (
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
        <form onSubmit={handleAddUser} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4 animate-in slide-in-from-top-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input 
              required
              placeholder="Full Name"
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none"
              value={newUser.name}
              onChange={e => setNewUser({...newUser, name: e.target.value})}
            />
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
              <option value="PM">PM</option>
              <option value="Manager">Manager</option>
              {currentUserRole === 'Superadmin' && <option value="Superadmin">Superadmin</option>}
              <option value="Finance">Finance</option>
              <option value="Executive">Executive</option>
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-500 font-bold text-sm">Cancel</button>
            <button type="submit" className={cn("px-6 py-2 text-white font-bold rounded-xl text-sm", theme.bg)}>Send Invite</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {users.filter((u: any) => filter === 'All' || u.status === filter).map((user: any) => (
          <div key={user.id} className={cn(
            "flex items-center justify-between p-4 bg-white border rounded-2xl transition-all group",
            user.status === 'Inactive' ? "opacity-60 grayscale border-slate-100" : cn("border-slate-100", theme.hoverBorder)
          )}>
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm",
                user.status === 'Invited' ? "bg-amber-50 text-amber-600 border border-amber-100" : cn(theme.lightBg, theme.text)
              )}>
                {user.avatar}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{user.role}</span>
              <div className="flex gap-1">
                <button onClick={() => toggleUserStatus(user.id)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => setShowUserRemoveConfirm(user)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ProjectConfig = ({ config, setConfig, theme }: any) => {
  const [newPhase, setNewPhase] = useState('');
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

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Phase Template</h4>
          <div className="space-y-4">
             {config.defaultPhases.map((m: string) => (
               <div key={m} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl">
                 <span className="text-sm font-semibold text-slate-700">{m}</span>
                 <button className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
               </div>
             ))}
             <div className="flex gap-2">
               <input 
                placeholder="New phase..." 
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                value={newPhase}
                onChange={e => setNewPhase(e.target.value)}
               />
               <button className={cn("px-4 py-2 text-white font-bold rounded-xl text-sm", theme.bg)}>Add</button>
             </div>
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
                <span className="text-xs font-black text-slate-600">{p} Projects</span>
                <input 
                  type="number" 
                  className={cn(
                    "w-16 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-center outline-none focus:ring-4 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={config.workloadThresholds[p]}
                  onChange={e => updateWorkload(p, parseInt(e.target.value))}
                />
              </div>
            ))}
          </div>
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

const PackageServiceConfig = ({ config, setConfig, userRole, theme, showToast }: any) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', baselineDays: 0 });
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', baselineDays: 1 });

  const handleEdit = (service: any) => {
    setEditingId(service.id);
    setEditForm({ name: service.name, baselineDays: service.baselineDays });
  };

  const handleCancel = () => {
    setEditingId(null);
    setIsAdding(false);
  };

  const validate = (form: { name: string, baselineDays: number }, currentId?: string) => {
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

  const handleSaveEdit = (id: string) => {
    if (!validate(editForm, id)) return;
    
    const updated = config.serviceBaselines.map((s: any) => 
      s.id === id ? { ...s, ...editForm } : s
    );
    setConfig({ ...config, serviceBaselines: updated });
    setEditingId(null);
    showToast("Service updated successfully.");
  };

  const handleAdd = () => {
    if (!validate(newForm)) return;

    const newService = {
      id: Math.random().toString(36).substr(2, 9),
      ...newForm
    };
    setConfig({ ...config, serviceBaselines: [...config.serviceBaselines, newService] });
    setIsAdding(false);
    setNewForm({ name: '', baselineDays: 1 });
    showToast("Service added successfully.");
  };

  const handleDelete = (id: string) => {
    const updated = config.serviceBaselines.filter((s: any) => s.id !== id);
    setConfig({ ...config, serviceBaselines: updated });
    showToast("Service deleted.");
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Package & Service Configuration</h3>
          <p className="text-sm font-bold text-slate-500">Manage baseline durations for service delivery metrics.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-white text-sm font-bold rounded-xl transition-all shadow-lg",
            theme.bg, theme.hoverBg, theme.shadow
          )}
        >
          <UserPlus className="w-4 h-4" />
          Add Service
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Service Name</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Baseline Duration (Days)</th>
              <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isAdding && (
              <tr className="bg-slate-50/50 animate-in slide-in-from-top-2">
                <td className="px-6 py-4">
                  <input 
                    autoFocus
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="e.g. Data Migration"
                    value={newForm.name}
                    onChange={e => setNewForm({ ...newForm, name: e.target.value })}
                  />
                </td>
                <td className="px-6 py-4">
                  <input 
                    type="number"
                    className="w-32 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
                    value={newForm.baselineDays}
                    onChange={e => setNewForm({ ...newForm, baselineDays: parseInt(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className={cn("p-2 rounded-xl text-white", theme.bg)}><Check className="w-4 h-4" /></button>
                    <button onClick={handleCancel} className="p-2 rounded-xl bg-slate-200 text-slate-600"><X className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            )}
            {config.serviceBaselines.map((service: any) => (
              <tr key={service.id} className="group hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  {editingId === service.id ? (
                    <input 
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
                      value={editForm.name}
                      onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-700">{service.name}</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  {editingId === service.id ? (
                    <input 
                      type="number"
                      className="w-32 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
                      value={editForm.baselineDays}
                      onChange={e => setEditForm({ ...editForm, baselineDays: parseInt(e.target.value) || 0 })}
                    />
                  ) : (
                    <span className="text-sm font-black text-slate-500">{service.baselineDays} working days</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {editingId === service.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleSaveEdit(service.id)} className={cn("flex items-center gap-1.5 px-3 py-1.5 text-white text-xs font-bold rounded-lg", theme.bg)}>
                         Save
                      </button>
                      <button onClick={handleCancel} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(service)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-all">
                        <SettingsIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(service.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
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
    </div>
  );
};
