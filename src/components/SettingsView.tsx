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
  Palette,
  Globe,
  Filter,
  Image as ImageIcon,
  Activity
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

interface SettingsViewProps {
  userRole: Role;
  projects: Project[];
  onUpdateProjects: (projects: Project[]) => void;
  config: AppConfig;
  onUpdateConfig: (config: AppConfig) => void;
  activeTab: SettingsTab;
  setActiveTab: (tab: SettingsTab) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ 
  userRole,
  projects,
  onUpdateProjects,
  config,
  onUpdateConfig,
  activeTab,
  setActiveTab
}) => {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS);
  const [weightHistory, setWeightHistory] = useState<WeightHistory[]>(MOCK_WEIGHT_HISTORY);
  const [packages, setPackages] = useState<PackageConfig[]>(PACKAGES);
  
  // Tab access control
  const canAccess = (tab: SettingsTab) => {
    if (userRole === 'Superadmin') return true;
    if (userRole === 'Manager' || userRole === 'Team Lead') {
      return tab !== 'revenue' && tab !== 'brand'; 
    }
    if (tab === 'brand' && userRole === 'Superadmin') return true;
    if (tab === 'account') return true;
    if (tab === 'audit' && (userRole === 'Executive' || userRole === 'Superadmin')) return true;
    if (tab === 'revenue' && (userRole === 'Finance' || userRole === 'Superadmin')) return true;
    return false;
  };

  const theme = getThemeClasses(config.brand.themeColor);

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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Settings Sidebar */}
        <div className="w-full md:w-64 space-y-2">
          <div className="px-4 mb-4">
            <h2 className="text-xl font-bold text-slate-900">Settings</h2>
            <p className="text-xs text-slate-500 mt-1">Manage your system preferences</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Configuration</p>
            <SidebarItem id="performance" icon={Shield} label="Package & Performance" />
            <SidebarItem id="users" icon={Users} label="User Management" />
            <SidebarItem id="project" icon={SettingsIcon} label="Project Config" />
            <SidebarItem id="priority" icon={Activity} label="Priority & Workload" />
            <SidebarItem id="revenue" icon={DollarSign} label="Revenue Settings" />
          </div>

          <div className="space-y-1 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Organization</p>
            <SidebarItem id="brand" icon={Palette} label="Brand Configuration" />
          </div>

          <div className="space-y-1 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Monitoring</p>
            <SidebarItem id="audit" icon={History} label="Audit Log Viewer" />
          </div>

          <div className="space-y-1 pt-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">Personal</p>
            <SidebarItem id="account" icon={Users} label="Account Preferences" />
          </div>
        </div>

        {/* Settings Content */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px]">
          {activeTab === 'performance' && <PerformanceSettings config={config} setConfig={onUpdateConfig} packages={packages} setPackages={setPackages} weightHistory={weightHistory} setWeightHistory={setWeightHistory} userRole={userRole} />}
          {activeTab === 'users' && <UserManagement users={users} setUsers={setUsers} projects={projects} onUpdateProjects={onUpdateProjects} currentUserRole={userRole} config={config} />}
          {activeTab === 'project' && <ProjectConfig config={config} setConfig={onUpdateConfig} userRole={userRole} />}
          {activeTab === 'priority' && <PrioritySettings config={config} setConfig={onUpdateConfig} userRole={userRole} />}
          {activeTab === 'revenue' && <RevenueSettings config={config} setConfig={onUpdateConfig} userRole={userRole} />}
          {activeTab === 'audit' && <AuditLogViewer logs={auditLogs} />}
          {activeTab === 'account' && <AccountPreferences config={config} />}
          {activeTab === 'brand' && <BrandSettings config={config} setConfig={onUpdateConfig} />}
        </div>
      </div>
    </div>
  );
};

// --- Sub-components ---

const PerformanceSettings = ({ config, setConfig, packages, setPackages, weightHistory, setWeightHistory, userRole }: any) => {
  const theme = getThemeClasses(config.brand.themeColor);
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

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Package & Performance</h3>
        <p className="text-sm text-slate-500">Configure package weights and risk thresholds.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 mb-4">At-Risk Threshold</h4>
          <div className="flex items-center gap-4">
              <input 
                type="number" 
                className={cn(
                  "w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2",
                  theme.ring, theme.focusBorder
                )}
                value={config.atRiskThresholdDays}
                onChange={e => setConfig({...config, atRiskThresholdDays: parseInt(e.target.value)})}
              />
            <span className="text-sm text-slate-600 font-medium">days in "Delayed" state before flagging as "At Risk"</span>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Package Weights</h4>
          <div className="grid grid-cols-1 gap-3">
            {packages.map((pkg: any) => (
              <div key={pkg.name} className={cn(
                "flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl transition-all",
                theme.hoverBorder
              )}>
                <span className="text-sm font-semibold text-slate-700">{pkg.name}</span>
                <div className="flex items-center gap-3">
                  <input 
                    type="number" 
                    step="0.1"
                    className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none"
                    value={pkg.weight}
                    onChange={e => updateWeight(pkg.name, parseFloat(e.target.value))}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            Weight Change Log
          </h4>
          <div className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-100/50 border-b border-slate-200">
                  <th className="px-4 py-3 font-bold text-slate-500">Package</th>
                  <th className="px-4 py-3 font-bold text-slate-500 text-center">Change</th>
                  <th className="px-4 py-3 font-bold text-slate-500">Updated By</th>
                  <th className="px-4 py-3 font-bold text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {weightHistory.map((h: any) => (
                  <tr key={h.id}>
                    <td className="px-4 py-3 font-semibold text-slate-700">{h.packageName}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-slate-400">{h.oldWeight}</span>
                      <ChevronRight className="w-3 h-3 inline mx-1 text-slate-300" />
                      <span className={cn("font-bold", theme.text)}>{h.newWeight}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{h.updatedBy}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{h.timestamp}</td>
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

const UserManagement = ({ users, setUsers, projects, onUpdateProjects, currentUserRole, config }: any) => {
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
    setNewUser({ name: '', email: '', role: 'PM' });
  };

  const toggleUserStatus = (id: string) => {
    const user = users.find((u: any) => u.id === id);
    if (!user) return;

    // Last Superadmin check
    if (user.role === 'Superadmin' && user.status === 'Active') {
      const activeSuperadmins = users.filter((u: any) => u.role === 'Superadmin' && u.status === 'Active');
      if (activeSuperadmins.length <= 1) {
        alert("Cannot deactivate the last active Superadmin.");
        return;
      }
    }

    // Manager restriction
    if (currentUserRole === 'Manager' && (user.role === 'Superadmin' || user.role === 'Manager')) {
      alert("Managers cannot modify other Managers or Superadmins.");
      return;
    }

    setUsers(users.map((u: any) => u.id === id ? { ...u, status: u.status === 'Active' ? 'Inactive' : 'Active' } : u));
  };

  const removeUser = (id: string) => {
    const user = users.find((u: any) => u.id === id);
    if (!user) return;

    if (currentUserRole !== 'Superadmin') {
      alert("Only a Superadmin can permanently remove users.");
      return;
    }

    if (window.confirm(`Are you sure you want to permanently delete ${user.name}? This action is irreversible.`)) {
      setUsers(users.filter((u: any) => u.id !== id));
    }
  };

  const changeRole = (id: string, newRole: Role) => {
    const user = users.find((u: any) => u.id === id);
    if (!user) return;

    if (newRole === 'Superadmin' && currentUserRole !== 'Superadmin') {
      alert("Only a Superadmin can elevate users to Superadmin.");
      return;
    }

    if (currentUserRole === 'Manager' && (user.role === 'Superadmin' || user.role === 'Manager')) {
      alert("Managers cannot modify other Managers or Superadmins.");
      return;
    }

    setUsers(users.map((u: any) => u.id === id ? { ...u, role: newRole } : u));
  };

  const reassignProjects = (oldPM: string, newPM: string) => {
    const updatedProjects = projects.map((p: any) => 
      p.assignedPM === oldPM ? { ...p, assignedPM: newPM } : p
    );
    onUpdateProjects(updatedProjects);
    alert(`Reassigned projects from ${oldPM} to ${newPM}`);
  };

  const filteredUsers = users.filter((u: any) => filter === 'All' || u.status === filter);

  const allowedRoles = currentUserRole === 'Superadmin' 
    ? ['Superadmin', 'Manager', 'Team Lead', 'PM', 'Finance', 'Executive']
    : ['PM', 'Finance', 'Executive'];

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
          Invite Member
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
              {allowedRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-500 font-bold text-sm">Cancel</button>
            <button type="submit" className={cn("px-6 py-2 text-white font-bold rounded-xl text-sm", theme.bg)}>Send Invite</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredUsers.map((user: any) => (
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
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-900">{user.name}</p>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-tighter",
                    user.status === 'Active' ? "bg-emerald-100 text-emerald-700" :
                    user.status === 'Invited' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                  )}>
                    {user.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select 
                value={user.role}
                onChange={(e) => changeRole(user.id, e.target.value as Role)}
                className="bg-slate-50 text-slate-600 text-[10px] font-bold rounded px-2 py-1 outline-none border border-transparent hover:border-slate-200"
              >
                {allowedRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {user.role === 'PM' && user.status === 'Active' && (
                  <button 
                    title="Reassign Projects"
                    onClick={() => {
                      const target = prompt("Enter new PM's name:");
                      if (target) reassignProjects(user.name, target);
                    }}
                    className={cn("p-2 text-slate-400 rounded-lg", theme.hoverText, theme.hoverLightBg)}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
                <button 
                  title={user.status === 'Active' ? "Deactivate" : "Activate"}
                  onClick={() => toggleUserStatus(user.id)}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    user.status === 'Active' ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50" : "text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50"
                  )}
                >
                  {user.status === 'Active' ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                </button>
                <button 
                  title="Permanently Remove"
                  onClick={() => removeUser(user.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
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

const ProjectConfig = ({ config, setConfig }: any) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const [newMilestone, setNewMilestone] = useState('');

  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    setConfig({ ...config, defaultMilestones: [...config.defaultMilestones, newMilestone] });
    setNewMilestone('');
  };

  const removeMilestone = (m: string) => {
    setConfig({ ...config, defaultMilestones: config.defaultMilestones.filter((item: any) => item !== m) });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Project Configuration</h3>
        <p className="text-sm text-slate-500">Define default templates and state permissions.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900">Stale Project Detection</h4>
          <div className="flex items-center gap-4">
            <input 
              type="number" 
              className={cn(
                "w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2",
                theme.ring, theme.focusBorder
              )}
              value={config.staleThresholdDays}
              onChange={e => setConfig({...config, staleThresholdDays: parseInt(e.target.value)})}
            />
            <span className="text-sm text-slate-600 font-medium">days without activity before flagging as "Stale"</span>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 mb-4">Default Milestone Template</h4>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              {config.defaultMilestones.map((m: string, i: number) => (
                <div key={m} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
                  <span className="text-xs font-bold text-slate-400">{i + 1}</span>
                  <span className="text-sm font-semibold text-slate-700">{m}</span>
                  <button onClick={() => removeMilestone(m)} className="p-1 hover:text-red-500 rounded">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input 
                placeholder="Add new milestone..."
                className={cn(
                  "flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2",
                  theme.ring, theme.focusBorder
                )}
                value={newMilestone}
                onChange={e => setNewMilestone(e.target.value)}
              />
              <button 
                onClick={addMilestone}
                className={cn("px-4 py-2 text-white font-bold rounded-xl text-sm transition-all", theme.bg, theme.hoverBg)}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900">State Transition Permissions</h4>
          <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 font-bold text-slate-500">Transition To</th>
                  <th className="px-4 py-3 font-bold text-slate-500">Authorized Roles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PROJECT_STATES.map(state => (
                  <tr key={state}>
                    <td className="px-4 py-3 font-semibold text-slate-700">{state}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {state === 'Billed' ? (
                          <>
                            <span className={cn("px-1.5 py-0.5 rounded", theme.lightBg, theme.text)}>Finance</span>
                            <span className={cn("px-1.5 py-0.5 rounded", theme.lightBg, theme.text)}>Manager</span>
                          </>
                        ) : (
                          <>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">PM</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">Manager</span>
                          </>
                        )}
                      </div>
                    </td>
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

const RevenueSettings = ({ config, setConfig }: any) => {
  const theme = getThemeClasses(config.brand.themeColor);
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Revenue Settings</h3>
        <p className="text-sm text-slate-500">Configure currency and revenue editing permissions.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400" />
            Currency Configuration
          </h4>
          <div className="flex items-center gap-4">
            <select 
              className={cn(
                "px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2",
                theme.ring, theme.focusBorder
              )}
              value={config.currency}
              onChange={e => setConfig({...config, currency: e.target.value})}
            >
              <option value="USD">USD ($)</option>
              <option value="NGN">NGN (₦)</option>
              <option value="GBP">GBP (£)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            <p className="text-xs text-slate-500 italic">System-wide currency for project values and reporting.</p>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-400" />
            Post-Intake Editing
          </h4>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-700">Allow revenue edits after project creation</p>
              <p className="text-xs text-slate-500">When enabled, Manager and Finance roles can update project values.</p>
            </div>
            <button 
              onClick={() => setConfig({...config, allowPostIntakeRevenueEdit: !config.allowPostIntakeRevenueEdit})}
              className={cn(
                "w-12 h-6 rounded-full transition-all relative",
                config.allowPostIntakeRevenueEdit ? theme.bg : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                config.allowPostIntakeRevenueEdit ? "left-7" : "left-1"
              )} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AuditLogViewer = ({ logs }: any) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  const filteredLogs = logs.filter((log: any) => {
    const matchesSearch = log.details.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'All' || log.category === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-300 flex flex-col h-full">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Audit Log Viewer</h3>
          <p className="text-sm text-slate-500">Track all sensitive system actions.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-200 transition-all">
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-400">
          <Search className="w-4 h-4" />
          <input 
            placeholder="Search logs..."
            className="bg-transparent text-sm outline-none w-full text-slate-700"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
          value={filter}
          onChange={e => setFilter(e.target.value)}
        >
          <option value="All">All Categories</option>
          <option value="Project">Project</option>
          <option value="Revenue">Revenue</option>
          <option value="User">User</option>
          <option value="Config">Config</option>
        </select>
      </div>

      <div className="flex-1 bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
            <tr>
              <th className="px-4 py-3 font-bold text-slate-500">Action</th>
              <th className="px-4 py-3 font-bold text-slate-500">Details</th>
              <th className="px-4 py-3 font-bold text-slate-500">User</th>
              <th className="px-4 py-3 font-bold text-slate-500">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredLogs.map((log: any) => (
              <tr key={log.id} className="hover:bg-white transition-colors">
                <td className="px-4 py-3">
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                    log.category === 'Project' ? "bg-blue-100 text-blue-700" :
                    log.category === 'Revenue' ? "bg-emerald-100 text-emerald-700" :
                    log.category === 'User' ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 font-medium">{log.details}</td>
                <td className="px-4 py-3 text-slate-900 font-bold">{log.user}</td>
                <td className="px-4 py-3 text-slate-400 font-mono">{log.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const BrandSettings = ({ config, setConfig }: { config: AppConfig, setConfig: (c: AppConfig) => void }) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const colors = [
    { name: 'Indigo', value: 'indigo' },
    { name: 'Teal', value: 'teal' },
    { name: 'Emerald', value: 'emerald' },
    { name: 'Rose', value: 'rose' },
    { name: 'Amber', value: 'amber' },
    { name: 'Sky', value: 'sky' },
    { name: 'Violet', value: 'violet' },
    { name: 'Orange', value: 'orange' },
    { name: 'Pink', value: 'pink' },
    { name: 'Slate', value: 'slate' },
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig({
          ...config,
          brand: {
            ...config.brand,
            logoUrl: reader.result as string
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Brand Configuration</h3>
        <p className="text-sm text-slate-500">Customize the look and feel of your organization's workspace.</p>
      </div>

      <div className="space-y-6">
        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Workspace Logo</label>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
              {config.brand.logoUrl ? (
                <img src={config.brand.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="space-y-2">
              <label className="inline-block px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer hover:bg-slate-50 transition-colors">
                Upload New Logo
                <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
              </label>
              <p className="text-[10px] text-slate-400">Recommended: Square PNG or SVG, max 2MB.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Theme Color</label>
          <div className="flex flex-wrap gap-4">
            {colors.map((color) => (
              <button
                key={color.value}
                onClick={() => setConfig({
                  ...config,
                  brand: { ...config.brand, themeColor: color.value }
                })}
                title={color.name}
                className={cn(
                  "w-12 h-12 rounded-full border-4 transition-all flex items-center justify-center relative group",
                  config.brand.themeColor === color.value
                    ? `border-${color.value}-200 ring-2 ring-${color.value}-500`
                    : "border-transparent hover:scale-110"
                )}
              >
                <div className={cn("w-full h-full rounded-full shadow-inner", `bg-${color.value}-500`)} />
                {config.brand.themeColor === color.value && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Check className="w-6 h-6 text-white drop-shadow-md" />
                  </div>
                )}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  {color.name}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Company Name</label>
          <input 
            type="text"
            className={cn(
              "w-full max-w-md px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
              theme.ring, theme.focusBorder
            )}
            value={config.brand.companyName}
            onChange={(e) => setConfig({
              ...config,
              brand: { ...config.brand, companyName: e.target.value }
            })}
          />
        </div>
      </div>
    </div>
  );
};

const AccountPreferences = ({ config }: { config: AppConfig }) => {
  const theme = getThemeClasses(config.brand.themeColor);
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-lg font-bold text-slate-900">Account Preferences</h3>
        <p className="text-sm text-slate-500">Personalize your dashboard experience.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            Default Dashboard Filters
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Show only my projects by default</span>
              <button className={cn("w-10 h-5 rounded-full relative transition-colors", theme.bg)}>
                <div className="absolute top-0.5 left-5 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Include "Closed" projects in summary</span>
              <button className="w-10 h-5 bg-slate-300 rounded-full relative">
                <div className="absolute top-0.5 left-1 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            Regional Settings
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date Format</label>
              <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none">
                <option>DD/MM/YYYY</option>
                <option>MM/DD/YYYY</option>
                <option>YYYY-MM-DD</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Timezone</label>
              <select className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none">
                <option>UTC (GMT+0)</option>
                <option>WAT (GMT+1)</option>
                <option>EST (GMT-5)</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PrioritySettings = ({ config, setConfig }: { config: AppConfig, setConfig: (c: AppConfig) => void, userRole: Role }) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const [thresholds, setThresholds] = useState(config.workloadThresholds);
  const [hasChanges, setHasChanges] = useState(false);

  const handleUpdate = (priority: string, val: string) => {
    const num = parseInt(val) || 1;
    setThresholds({ ...thresholds, [priority as 'P1' | 'P2' | 'P3']: num });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (window.confirm("Updating thresholds will apply immediately to all new project assignments. Proceed?")) {
      setConfig({ ...config, workloadThresholds: thresholds });
      setHasChanges(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Priority & Workload</h3>
          <p className="text-sm text-slate-500">Configure global project limits per PM per priority tier.</p>
        </div>
        {hasChanges && (
          <button 
            type="button"
            onClick={handleSave}
            className={cn("px-6 py-2 text-white font-bold rounded-xl text-sm transition-all shadow-lg", theme.bg, theme.shadow)}
          >
            Save Changes
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(['P1', 'P2', 'P3'] as const).map((p) => (
          <div key={p} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
            <div className="flex justify-between items-center">
              <span className={cn(
                "px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border",
                p === 'P1' ? "bg-red-50 text-red-600 border-red-100" :
                p === 'P2' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-sky-50 text-sky-600 border-sky-100"
              )}>
                {p} Tier
              </span>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase block mb-1.5">Max Active Projects</label>
              <input 
                type="number" 
                min="1"
                className={cn(
                  "w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-lg font-bold outline-none focus:ring-2 transition-all",
                  theme.ring, theme.focusBorder
                )}
                value={thresholds[p]}
                onChange={(e) => handleUpdate(p, e.target.value)}
              />
            </div>
            <p className="text-[10px] text-slate-400 italic">
              {p === 'P1' ? 'Strategic engagements' : p === 'P2' ? 'Core delivery projects' : 'Routine engagements'}
            </p>
          </div>
        ))}
      </div>

      <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
        <div className="p-2 bg-blue-100 rounded-lg h-fit">
          <Shield className="w-5 h-5 text-blue-600" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-blue-900">Threshold Enforcement Rule</h4>
          <p className="text-sm text-blue-700/80 leading-relaxed">
            Thresholds are evaluated against "Active", "Delayed", "Suspended", and "Ready for Billing" states only. 
            Managers and Superadmins can override these limits with a confirmation prompt.
          </p>
        </div>
      </div>
    </div>
  );
};
