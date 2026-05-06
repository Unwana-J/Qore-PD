import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Link as LinkIcon,
  AlertTriangle,
  ListChecks,
  Tags,
  Plus,
  ShieldAlert,
  Key,
  Mail
} from 'lucide-react';
import { MilestoneEditorModal } from './MilestoneEditorModal';
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
import { cn, isRole, hasRole } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_USERS, MOCK_AUDIT_LOGS, MOCK_WEIGHT_HISTORY } from '../mockData';
import { ConfirmationModal } from './common/ConfirmationModal';
import { api } from '../lib/api';

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
  const { user, profile, refreshProfile } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [weightHistory, setWeightHistory] = useState<WeightHistory[]>(MOCK_WEIGHT_HISTORY);
  const [showUserRemoveConfirm, setShowUserRemoveConfirm] = useState<any | null>(null);

  // Local state for configuration edits
  const [draftConfig, setDraftConfig] = useState<AppConfig>(config);
  const [isSaving, setIsSaving] = useState(false);

  // Sync draft with global config if not modified
  const isDirty = useMemo(() => {
    return JSON.stringify(draftConfig) !== JSON.stringify(config);
  }, [draftConfig, config]);

  // If config changes from outside (e.g. reload), sync it if we are not dirty
  useEffect(() => {
    if (!isDirty) {
      setDraftConfig(config);
    }
  }, [config, isDirty]);

  // Fetch audit logs when active tab is 'audit'
  useEffect(() => {
    if (activeTab === 'audit') {
      api.audit.getLogs()
        .then(setAuditLogs)
        .catch(err => {
          console.error("Failed to fetch audit logs", err);
          showToast("Failed to fetch audit logs", "error");
        });
    }
  }, [activeTab, showToast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdateConfig(draftConfig);
      showToast('Settings saved successfully.', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setDraftConfig(config);
    showToast('Changes discarded.', 'info');
  };

  const theme = getThemeClasses(draftConfig.brand.themeColor);
  
  // Tab access control
  const canAccess = (tab: SettingsTab) => {
    if (isRole(userRole, 'Superadmin')) return true;
    
    // Non-superadmin access rules
    if (tab === 'account') return true;
    if (tab === 'project' && hasRole(userRole, ['Manager', 'Team Lead'])) return true;
    if (tab === 'packages' && isRole(userRole, 'Manager')) return true;
    if (tab === 'integrations' && isRole(userRole, 'Superadmin')) return true;
    if (tab === 'brand' && isRole(userRole, 'Superadmin')) return true;
    if (tab === 'audit' && hasRole(userRole, ['Executive', 'Superadmin'])) return true;
    if (tab === 'revenue' && hasRole(userRole, ['Finance', 'Superadmin'])) return true;
    if (tab === 'users' && isRole(userRole, 'Manager')) return true;
    if (tab === 'taxonomies' && isRole(userRole, 'Superadmin')) return true;

    return false;
  };

  const handleConfirmedRemove = async () => {
    if (showUserRemoveConfirm) {
      try {
        if (showUserRemoveConfirm.statusType === 'Pending') {
          await api.invites.delete(showUserRemoveConfirm.id);
          setInvites(invites.filter(i => i.id !== showUserRemoveConfirm.id));
        } else {
          await api.users.delete(showUserRemoveConfirm.id, showUserRemoveConfirm.email);
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
          <SidebarItem id="taxonomies" icon={Tags} label="Taxonomies & Labels" />
          <SidebarItem id="integrations" icon={LinkIcon} label="Integrations" />
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

      <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[600px] flex flex-col">
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {activeTab === 'users' && 
            <UserManagement 
              users={users} 
              setUsers={setUsers} 
              invites={invites}
              setInvites={setInvites}
              projects={projects}
              onUpdateProjects={onUpdateProjects}
              currentUserRole={userRole}
              config={draftConfig}
              setConfig={setDraftConfig}
              showToast={showToast}
              setShowUserRemoveConfirm={setShowUserRemoveConfirm}
              refreshProfile={refreshProfile}
              setActiveTab={setActiveTab}
              setAuditSearch={setAuditSearch}
            />
          }
          {activeTab === 'priority' && <PrioritySettings config={draftConfig} setConfig={setDraftConfig} weightHistory={weightHistory} setWeightHistory={setWeightHistory} userRole={userRole} theme={theme} />}
          {activeTab === 'project' && <ProjectConfig config={draftConfig} setConfig={setDraftConfig} userRole={userRole} theme={theme} showToast={showToast} projects={projects} />}
          {activeTab === 'revenue' && <RevenueSettings config={draftConfig} setConfig={setDraftConfig} userRole={userRole} theme={theme} />}
          {activeTab === 'brand' && <BrandSettings config={draftConfig} setConfig={setDraftConfig} userRole={userRole} theme={theme} />}
          {activeTab === 'packages' && <PackageServiceConfig config={draftConfig} setConfig={setDraftConfig} theme={theme} showToast={showToast} />}
          {activeTab === 'taxonomies' && <TaxonomiesSettings config={draftConfig} setConfig={setDraftConfig} theme={theme} showToast={showToast} />}
          {activeTab === 'integrations' && <IntegrationsSettings config={draftConfig} setConfig={setDraftConfig} theme={theme} />}
          {activeTab === 'account' && <AccountSettings user={user} profile={profile} refreshProfile={refreshProfile} theme={theme} showToast={showToast} />}
          {activeTab === 'audit' && <AuditView logs={auditLogs} />}
        </div>

        {/* Floating Save Bar */}
        <AnimatePresence>
          {isDirty && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="px-8 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between z-[60]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-white text-sm font-bold">Unsaved Changes</p>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">You have modified system settings</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  disabled={isSaving}
                  onClick={handleDiscard}
                  className="px-6 py-2 text-slate-400 hover:text-white font-bold text-sm transition-colors disabled:opacity-50"
                >
                  Discard
                </button>
                <button 
                  disabled={isSaving}
                  onClick={handleSave}
                  className={cn(
                    "px-8 py-2 text-white font-black rounded-xl text-sm shadow-xl flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50",
                    theme.bg, theme.shadow
                  )}
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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


const UserManagement = ({ users, setUsers, invites, setInvites, projects, onUpdateProjects, currentUserRole, config, setConfig, showToast, setShowUserRemoveConfirm, refreshProfile, setActiveTab, setAuditSearch }: any) => {
  const theme = getThemeClasses(config.brand.themeColor);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'PM' as Role });
  const [filter, setFilter] = useState<'All' | 'Active' | 'Pending'>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'permissions'>('users');

  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingInvite(true);
    
    try {
      const email = newUser.email.trim().toLowerCase();
      if (users.some((u: any) => (u.email || '').toLowerCase() === email)) {
        showToast('A user with this email already exists.', 'error');
        return;
      }
      if (invites.some((i: any) => (i.email || '').toLowerCase() === email)) {
        showToast('This email has already been invited.', 'error');
        return;
      }

      const invite = await api.invites.send(email, newUser.role, newUser.name);
      setInvites([invite, ...invites]);
      setIsAdding(false);
      setNewUser({ name: '', email: '', role: 'PM' });
      showToast(`Invitation sent to ${email}`, 'success');
    } catch (err: any) {
      showToast(err.message || "Permission Denied: Check Superadmin status", "error");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: Role) => {
    try {
      await api.users.update(userId, { role: newRole });
      setUsers(users.map((u: any) => u.id === userId ? { ...u, role: newRole } : u));
      
      // Force refresh of current profile in case the updated user is the current user
      await refreshProfile();
      
      showToast(`User role updated to ${newRole}`, 'success');
    } catch (err: any) {
      showToast("Failed to update user role", "error");
    }
  };

  const handleStatusToggle = async (user: User) => {
    const newStatus = user.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.users.update(user.id, { status: newStatus });
      setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));
      showToast(`User ${newStatus === 'Active' ? 'reactivated' : 'deactivated'} successfully.`, 'success');
      
      // If deactivating the current user, refresh profile to trigger intercept screen
      await refreshProfile();
    } catch (err) {
      showToast("Failed to update user status", "error");
    }
  };

  const filteredItems = [
    ...users.map(u => ({ ...u, statusType: u.status })),
    ...invites.map(i => ({ ...i, statusType: 'Pending', name: i.name || 'Invitee' }))
  ].filter(item => filter === 'All' || item.statusType === filter);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold text-slate-900">User Management</h3>
          <p className="text-sm text-slate-500">Manage team members, roles, and pending invitations.</p>
        </div>
        <div className="flex gap-4 items-center">
          {isRole(currentUserRole, 'Superadmin') && (
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setActiveSubTab('users')}
                className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeSubTab === 'users' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              >
                Users
              </button>
              <button 
                onClick={() => setActiveSubTab('permissions')}
                className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", activeSubTab === 'permissions' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}
              >
                System Permissions
              </button>
            </div>
          )}
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
      </div>

      {activeSubTab === 'users' ? (
        <>
          <div className="flex gap-2">
        {['All', 'Active', 'Pending'].map((f: any) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentPage(1); }}
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
              <option value="PM">Project Manager</option>
              <option value="IM">Implementation Manager</option>
              <option value="IM Lead">Implementation Manager Lead</option>
              <option value="Manager">Manager</option>
              {isRole(currentUserRole, 'Superadmin') && <option value="Superadmin">Superadmin</option>}
              <option value="Finance">Finance</option>
              <option value="Executive">Executive</option>
            </select>
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
            New users will be automatically assigned their role and name when they sign up.
          </p>
          <div className="flex gap-3 justify-end">
            <button type="button" disabled={isSendingInvite} onClick={() => setIsAdding(false)} className="px-6 py-2 text-slate-500 font-bold text-sm">Cancel</button>
            <button type="submit" disabled={isSendingInvite} className={cn("px-6 py-2 text-white font-bold rounded-xl text-sm flex items-center gap-2", theme.bg)}>
              {isSendingInvite ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending...
                </>
              ) : "Send Invite"}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filteredItems.slice((currentPage - 1) * 10, currentPage * 10).map((item: any) => (
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
                <p className="text-sm font-bold text-slate-900 leading-tight">
                  {item.name || item.email}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[10px] font-medium text-slate-400 font-mono italic">{item.email}</p>
                  {item.statusType === 'Inactive' && (
                    <span className="text-[9px] font-black uppercase text-rose-500 tracking-tighter bg-rose-50 px-1 rounded">Stale/Inactive</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                {item.statusType === 'Active' && (isRole(currentUserRole, 'Superadmin') || (isRole(currentUserRole, 'Manager') && !isRole(item.role, 'Superadmin'))) ? (
                  <select 
                    className="text-[10px] font-black uppercase text-slate-400 tracking-widest bg-transparent outline-none cursor-pointer hover:text-slate-600"
                    value={item.role}
                    onChange={(e) => handleRoleUpdate(item.id, e.target.value as Role)}
                  >
                    <option value="PM">PM</option>
                    <option value="IM">IM</option>
                    <option value="IM Lead">IM Lead</option>
                    <option value="Manager">Manager</option>
                    <option value="Team Lead">Team Lead</option>
                    <option value="Finance">Finance</option>
                    <option value="Executive">Executive</option>
                    <option value="Superadmin">Superadmin</option>
                  </select>
                ) : (
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">{item.role}</span>
                )}
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
                {item.statusType !== 'Pending' && (isRole(currentUserRole, 'Superadmin') || (isRole(currentUserRole, 'Manager') && isRole(item.role, 'PM'))) && (
                  <button 
                    onClick={() => handleStatusToggle(item)} 
                    title={item.status === 'Active' ? "Deactivate User" : "Reactivate User"}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      item.status === 'Active' 
                        ? "text-slate-400 hover:text-amber-500 hover:bg-amber-50" 
                        : "text-amber-500 hover:text-emerald-600 hover:bg-emerald-50"
                    )}
                  >
                    <ShieldAlert className="w-4 h-4" />
                  </button>
                )}
                {item.statusType === 'Pending' && (
                  <button 
                    onClick={async () => {
                      try {
                        await api.invites.resend(item.email);
                        showToast(`Invitation resent to ${item.email}`, 'success');
                      } catch (err: any) {
                        showToast(err.message || "Failed to resend invite", "error");
                      }
                    }}
                    title="Resend Invitation"
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                  </button>
                )}
                {item.statusType === 'Active' && (isRole(currentUserRole, 'Superadmin') || (isRole(currentUserRole, 'Manager') && !isRole(item.role, 'Superadmin'))) && (
                  <button 
                    onClick={async () => {
                      try {
                        await api.users.resetPassword(item.email);
                        showToast(`Password reset email sent to ${item.email}`, 'success');
                      } catch (err: any) {
                        showToast(err.message || "Failed to send reset email", "error");
                      }
                    }}
                    title="Reset Password"
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                  >
                    <Key className="w-4 h-4" />
                  </button>
                )}
                {item.statusType === 'Active' && (
                  <button 
                    onClick={() => {
                      setActiveTab('audit');
                      setAuditSearch(item.name || item.email);
                    }}
                    title="View User Activity"
                    className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                  >
                    <Activity className="w-4 h-4" />
                  </button>
                )}
                {(isRole(currentUserRole, 'Superadmin') || (isRole(currentUserRole, 'Manager') && !isRole(item.role, 'Superadmin'))) && (
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

      {filteredItems.length > 10 && activeSubTab === 'users' && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-bold">
            Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, filteredItems.length)} of {filteredItems.length} entries
          </p>
          <div className="flex gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button 
              disabled={currentPage * 10 >= filteredItems.length}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
      </>
      ) : isRole(currentUserRole, 'Superadmin') && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">System Permissions</h3>
            <p className="text-sm text-slate-500">Enable advanced features for specific user roles.</p>
          </div>

          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900">Platform Role Simulation</p>
              <p className="text-xs text-slate-500 mt-1">Allow specific roles to use the "View As" switcher to simulate how the system looks to different levels of clearance. <span className="text-indigo-600 font-medium">Superadmins always have access.</span></p>
            </div>
            
            <div className="flex flex-wrap gap-4 mt-2">
              {['Executive', 'Manager', 'Finance', 'Team Lead'].map((roleStr) => {
                const role = roleStr as Role;
                const isEnabled = (config.allowedRoleSwitchers || ['Superadmin', 'Executive']).includes(role);
                return (
                   <label key={role} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-pointer hover:border-indigo-200 transition-all select-none">
                     <div className={cn(
                       "w-5 h-5 rounded flex items-center justify-center transition-colors",
                       isEnabled ? cn(theme.bg, "border-transparent") : "border-2 border-slate-300 bg-white"
                     )}>
                       {isEnabled && <Check className="w-3 h-3 text-white" />}
                     </div>
                     <span className="text-sm font-bold text-slate-700">{role}</span>
                     <input 
                       type="checkbox" 
                       className="hidden"
                       checked={isEnabled}
                       onChange={() => {
                         const current = config.allowedRoleSwitchers || ['Superadmin', 'Executive'];
                         const updated = isEnabled 
                           ? current.filter(r => r !== role)
                           : [...current, role];
                           
                         setConfig({ ...config, allowedRoleSwitchers: updated });
                       }}
                     />
                   </label>
                )
              })}
            </div>
          </div>

          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-red-900">Emergency Maintenance Mode</p>
              <p className="text-xs text-red-700 mt-1">Globally intercept and lock out all non-Superadmin traffic to a "System Maintenance" holding screen.</p>
            </div>
            <button 
              onClick={() => setConfig({...config, maintenanceMode: !config.maintenanceMode})}
              className={cn("w-12 h-6 rounded-full relative transition-all", config.maintenanceMode ? "bg-red-600" : "bg-red-200/50")}
            >
              <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all", config.maintenanceMode ? "left-7 shadow-md" : "left-1")} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const MOCK_CLIENT_NAMES = [
  'Global Trust Bank', 'Apex Microfinance', 'Zenith Connect', 'Stellar Fin',
  'Eco Bank', 'Recova Plus', 'Prime Bank', 'Rapid Pay',
  'Legacy Corp', 'Old School Fin', 'Future Bank', 'Amber Ventures'
];

const NumberInput = ({ value, onChange, className, step = "1", min, max }: any) => {
  const [buffer, setBuffer] = useState(value?.toString() || "");
  
  useEffect(() => {
    setBuffer(value?.toString() || "");
  }, [value]);

  return (
    <input 
      type="number"
      step={step}
      min={min}
      max={max}
      className={className}
      value={buffer}
      onChange={e => setBuffer(e.target.value)}
      onBlur={() => {
        if (buffer === "") return;
        const num = parseFloat(buffer);
        if (!isNaN(num)) onChange(num);
        else setBuffer(value?.toString() || "");
      }}
    />
  );
};

const ProjectConfig = ({ config, setConfig, userRole, theme, showToast, projects }: any) => {
  const [isPurging, setIsPurging] = useState(false);

  // Find any mock projects that still exist in the DB
  const mockProjectsInDb = (projects as Project[]).filter(p =>
    MOCK_CLIENT_NAMES.some(name => name.toLowerCase() === p.clientName.toLowerCase())
  );

  const handlePurgeMockData = async () => {
    if (mockProjectsInDb.length === 0) {
      showToast('No mock test projects found in the database.', 'info');
      return;
    }
    if (!window.confirm(`Delete ${mockProjectsInDb.length} mock test projects? This cannot be undone.`)) return;
    setIsPurging(true);
    try {
      const ids = mockProjectsInDb.map(p => p.id);
      await api.projects.deleteByIds(ids);
      showToast(`Deleted ${ids.length} mock test projects. Please refresh the page.`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to purge mock data.', 'error');
    } finally {
      setIsPurging(false);
    }
  };

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
            <NumberInput 
              className={cn("w-24 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
              value={config.staleThresholdDays}
              onChange={(val: number) => setConfig({...config, staleThresholdDays: val})}
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
               <NumberInput 
                 step="0.01"
                 className={cn("w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
                 value={config.spiThresholds?.onTrack || 1.0}
                 onChange={(val: number) => setConfig({ ...config, spiThresholds: { ...config.spiThresholds, onTrack: val } })}
               />
             </div>
             <div className="space-y-1.5 focus-within:z-10">
               <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                 At Risk (≥)
               </label>
               <NumberInput 
                 step="0.01"
                 className={cn("w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
                 value={config.spiThresholds?.atRisk || 0.8}
                 onChange={(val: number) => setConfig({ ...config, spiThresholds: { ...config.spiThresholds, atRisk: val } })}
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
                    <NumberInput 
                      className={cn("w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none", theme.focusBorder)}
                      value={weight as number}
                      onChange={(val: number) => setConfig({
                        ...config, 
                        projectLifecycleWeights: { ...config.projectLifecycleWeights, [phase]: val }
                      })}
                    />
                 </div>
               </div>
              ))}
        </div>
      </div>

      {userRole === 'Superadmin' && (
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl space-y-3">
          <h4 className="text-sm font-bold text-red-700 flex items-center gap-2">
            <Trash2 className="w-4 h-4" />
            Danger Zone — Purge Mock Test Data
          </h4>
          <p className="text-xs text-red-500 font-medium">
            Permanently delete the {MOCK_CLIENT_NAMES.length} original demo projects from the database.
            {mockProjectsInDb.length > 0
              ? ` Found ${mockProjectsInDb.length} mock project(s) still in the database.`
              : ' No mock projects found — already clean.'}
          </p>
          <button
            onClick={handlePurgeMockData}
            disabled={isPurging || mockProjectsInDb.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isPurging ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Purging...</>
            ) : (
              <><Trash2 className="w-4 h-4" /> Purge {mockProjectsInDb.length} Mock Projects</>
            )}
          </button>
        </div>
      )}
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

const PrioritySettings = ({ config, setConfig, weightHistory, setWeightHistory, userRole, theme }: any) => {
  const updateWeight = (id: string, newWeight: number) => {
    const pkg = config.packages.find((p: any) => p.id === id);
    if (!pkg) return;

    const updatedPackages = config.packages.map((p: any) => 
      p.id === id ? { ...p, weight: newWeight } : p
    );
    
    setConfig({ ...config, packages: updatedPackages });
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
            <NumberInput 
              className={cn(
                "w-20 px-4 py-3 bg-white border border-slate-200 rounded-2xl text-lg font-black outline-none focus:ring-4 transition-all",
                theme.ring, theme.focusBorder
              )}
              value={config.atRiskThresholdDays}
              onChange={(val: number) => setConfig({...config, atRiskThresholdDays: val})}
            />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-tighter">Days until flagged</span>
          </div>
        </div>

        {/* Workload Thresholds */}
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Max Workload (Per PM)</h4>
          <div className="space-y-3">
            {['P1', 'P2', 'P3', 'Initiative'].map((p) => (
              <div key={p} className="flex items-center justify-between gap-4">
                <span className="text-xs font-black text-slate-600">
                  {p === 'P1' ? 'Tier 1 - Enterprise' : p === 'P2' ? 'Tier 2 - Pro' : p === 'P3' ? 'Tier 3 - Basic' : 'Internal Initiative'} Projects
                </span>
                <NumberInput 
                  className={cn(
                    "w-16 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black text-center outline-none focus:ring-4 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={config.workloadThresholds[p as ProjectPriority]}
                  onChange={(val: number) => updateWorkload(p as ProjectPriority, val)}
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
                <NumberInput 
                  step="0.05"
                  min="0"
                  max="1"
                  className={cn(
                    "w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-black outline-none focus:ring-4 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={config.pmScorecardWeights?.[key as keyof AppConfig['pmScorecardWeights']] || 0}
                  onChange={(val: number) => setConfig({
                    ...config,
                    pmScorecardWeights: {
                      ...config.pmScorecardWeights,
                      [key]: val
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
          {config.packages.map((pkg: any) => (
            <div key={pkg.id} className={cn(
              "flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl transition-all hover:shadow-md",
              theme.hoverBorder
            )}>
              <span className="text-xs font-bold text-slate-700 truncate mr-2">{pkg.name}</span>
              <div className="flex items-center gap-2">
                <NumberInput 
                  step="0.1"
                  className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-center outline-none"
                  value={pkg.weight ?? 1.0}
                  onChange={(val: number) => updateWeight(pkg.id, val)}
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

const AccountSettings = ({ user, profile, refreshProfile, theme, showToast }: any) => {
  const [name, setName] = useState(profile?.name || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsUpdating(true);
    try {
      await api.users.update(user.id, { name: name.trim() });
      await refreshProfile();
      showToast('Profile updated successfully', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update profile', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-10 space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Account Preferences</h3>
          <p className="text-sm font-bold text-slate-400">Manage your personal identity and login details.</p>
        </div>
        <div className={cn("px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-sm", theme.bg)}>
          {profile?.role}
        </div>
      </div>

      <div className="bg-slate-50/50 rounded-[2.5rem] border border-slate-100 p-8 space-y-8">
        <div className="flex items-center gap-8">
          <div className={cn("w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-black text-white shadow-xl rotate-3 shrink-0", theme.bg)}>
            {profile?.name?.substring(0, 2).toUpperCase() || 'U'}
          </div>
          <div className="space-y-1">
            <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Login Email</p>
            <p className="text-lg font-bold text-slate-900">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-6 max-w-md">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Display Name</label>
            <div className="flex gap-4">
              <input 
                required
                className="flex-1 px-5 py-4 bg-white border border-slate-200 rounded-2xl font-bold outline-none focus:ring-4 ring-teal-500/10 focus:border-teal-500 transition-all"
                value={name}
                onChange={e => setName(e.target.value)}
              />
              <button 
                type="submit"
                disabled={isUpdating || name === profile?.name}
                className={cn(
                  "px-8 rounded-2xl font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:grayscale",
                  theme.bg, theme.hoverBg
                )}
              >
                {isUpdating ? 'Saving...' : 'Save'}
              </button>
            </div>
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed max-w-xs mt-2 pl-1">
              IMPORTANT: This name is used to link projects to your dashboard. Make sure it matches exactly how projects are assigned to you.
            </p>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100 space-y-2">
            <div className="flex items-center gap-2 text-amber-600">
               <Shield className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Security</span>
            </div>
            <p className="text-sm font-bold text-amber-900 leading-tight">Password Management</p>
            <p className="text-xs text-amber-700 font-medium">Password resets are handled via your IT administrator or the Magic Link login flow.</p>
         </div>
         <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200 space-y-2 grayscale">
            <div className="flex items-center gap-2 text-slate-400">
               <Activity className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Activity History</span>
            </div>
            <p className="text-sm font-bold text-slate-400 leading-tight">Personal Audit Trail</p>
            <p className="text-xs text-slate-400 font-medium">Coming soon: View your recent actions and project contributions.</p>
         </div>
      </div>
    </div>
  );
};

const AuditView = ({ logs, initialSearch = '' }: any) => {
  const [search, setSearch] = useState(initialSearch);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const term = search.toLowerCase().trim();
    return logs.filter((l: any) => 
      (l.action || '').toLowerCase().includes(term) || 
      (l.user || '').toLowerCase().includes(term) || 
      (l.details || '').toLowerCase().includes(term)
    );
  }, [logs, search]);

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">System Audit Log</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            placeholder="Search logs..."
            className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-slate-200 transition-all w-64"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left text-[11px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Action & Details</th>
              <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest">User</th>
              <th className="px-4 py-3 font-black text-slate-400 uppercase tracking-widest text-right">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.slice(0, 100).map((log: any) => (
              <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-bold text-slate-900">{log.action}</span>
                  <p className="text-slate-500 mt-0.5">{log.details}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-600">
                      {log.user?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    <span className="font-bold text-slate-700">{log.user}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-400 font-mono text-right">{log.timestamp}</td>
              </tr>
            ))}
            {filteredLogs.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  No matching logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PackageServiceConfig = ({ config, setConfig, theme, showToast }: any) => {
  const [subTab, setSubTab] = useState<'packages' | 'services'>('packages');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newForm, setNewForm] = useState<any>(null);
  const [milestoneModal, setMilestoneModal] = useState<{ isOpen: boolean; serviceId: string | null; subServiceId?: string | null; serviceName: string; initialMilestones: string[] }>({
    isOpen: false,
    serviceId: null,
    subServiceId: null,
    serviceName: '',
    initialMilestones: []
  });

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

  const parseMilestoneStrings = (form: any) => {
    const parsed = { ...form };
    if (typeof parsed.milestones === 'string') {
      parsed.milestones = parsed.milestones.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    if (Array.isArray(parsed.subServices)) {
      parsed.subServices = parsed.subServices.map((ss: any) => ({
        ...ss,
        milestones: typeof ss.milestones === 'string'
          ? ss.milestones.split(',').map((s: string) => s.trim()).filter(Boolean)
          : (ss.milestones || []),
      }));
    }
    return parsed;
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
    const newService = { 
      id: Math.random().toString(36).substr(2, 9), 
      ...newForm, 
      milestones: [],
      subServices: newForm.subServices || [] 
    };
    setConfig({ ...config, serviceBaselines: [...config.serviceBaselines, newService] });
    handleCancel();
    showToast("Service added successfully.");
  };

  const handleSaveMilestones = async (milestones: string[]) => {
    if (!milestoneModal.serviceId) return;
    
    let updated;
    if (milestoneModal.subServiceId) {
      updated = config.serviceBaselines.map((s: any) => {
        if (s.id === milestoneModal.serviceId) {
          const updatedSubServices = (s.subServices || []).map((ss: any) => 
            ss.id === milestoneModal.subServiceId ? { ...ss, milestones } : ss
          );
          return { ...s, subServices: updatedSubServices };
        }
        return s;
      });
    } else {
      updated = config.serviceBaselines.map((s: any) => 
        s.id === milestoneModal.serviceId ? { ...s, milestones } : s
      );
    }

    setConfig({ ...config, serviceBaselines: updated });
    setMilestoneModal({ ...milestoneModal, isOpen: false, serviceId: null, subServiceId: null, serviceName: '', initialMilestones: [] });
    showToast("Milestones updated.");

    // Sync with active implementations
    const syncTargetName = milestoneModal.subServiceId ? milestoneModal.serviceName : `all "${milestoneModal.serviceName}"`;
    if (window.confirm(`Would you like to sync these updated milestones to active implementations of ${syncTargetName}?\n\nThis will add new milestones and update the order, but will NOT lose existing completion progress.`)) {
      try {
        const count = await api.serviceExtensions.syncMilestones(
          milestoneModal.subServiceId ? milestoneModal.serviceName.split(' (')[0] : milestoneModal.serviceName, 
          milestones,
          milestoneModal.subServiceId
        );
        if (count > 0) showToast(`Successfully synced milestones with ${count} active implementations.`, 'success');
        else showToast("No active implementations required synchronization.");
      } catch (err) {
        console.error("Sync error:", err);
        showToast("Failed to sync milestones with existing implementations.", "error");
      }
    }
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

  const toggleServiceInPackage = (form: any, serviceId: string) => {
    const services = [...form.services];
    const idx = services.indexOf(serviceId);
    if (idx > -1) {
      services.splice(idx, 1);
    } else {
      services.push(serviceId);
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
                        onClick={() => toggleServiceInPackage(newForm, s.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                          newForm?.services.includes(s.id) ? cn(theme.bg, "text-white border-transparent") : "bg-white text-slate-500 border-slate-200"
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
                          onClick={() => toggleServiceInPackage(editForm, s.id)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                            editForm.services.includes(s.id) ? cn(theme.bg, "text-white border-transparent") : "bg-white text-slate-500 border-slate-200"
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
                         {pkg.services.map((sid: string) => {
                           const service = config.serviceBaselines.find((s: any) => s.id === sid);
                           return (
                             <span key={sid} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                               {service ? service.name : sid}
                             </span>
                           );
                         })}
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
        <div className="space-y-3">
          <button
            onClick={() => { setIsAdding(true); setNewForm({ name: '', baselineDays: 1, milestones: '', subServices: [] }); }}
            className={cn("w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:border-teal-500/30 hover:text-teal-600 transition-all", isAdding && "hidden")}
          >
            + Add New Service
          </button>

          {isAdding && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Service Name</label>
                  <input autoFocus className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" placeholder="e.g. Transfers" value={newForm?.name || ''} onChange={e => setNewForm({ ...newForm, name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Default Baseline (Days)</label>
                  <NumberInput className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" value={newForm?.baselineDays || 1} onChange={(val: number) => setNewForm({ ...newForm, baselineDays: val })} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Complexity Weight (e.g. 1.5)</label>
                  <NumberInput step="0.1" className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" value={newForm?.complexityWeight || 1.0} onChange={(val: number) => setNewForm({ ...newForm, complexityWeight: val })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Default Milestones (comma-separated, used when no sub-service selected)</label>
                <input className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all" placeholder="Onboarding, Integration, Testing, Go-Live" value={newForm?.milestones || ''} onChange={e => setNewForm({ ...newForm, milestones: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={handleAddService} className={cn("px-5 py-2 rounded-xl text-white text-xs font-bold shadow-lg", theme.bg)}>Add Service</button>
                <button onClick={handleCancel} className="px-5 py-2 rounded-xl bg-slate-200 text-slate-600 text-xs font-bold">Cancel</button>
              </div>
            </div>
          )}

          {config.serviceBaselines.map((service: any) => {
            const isEditing = editingId === service.id;
            const subServices: any[] = isEditing ? (editForm.subServices || []) : (service.subServices || []);
            return (
              <div key={service.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Service Header Row */}
                <div className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                    {isEditing ? (
                      <input className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : (
                      <span className="text-sm font-black text-slate-900">{service.name}</span>
                    )}
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-bold">Default:</span>
                        <NumberInput className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none" value={editForm.baselineDays} onChange={(val: number) => setEditForm({ ...editForm, baselineDays: val })} />
                        <span className="text-[10px] text-slate-400 font-bold">days</span>
                        <span className="text-[10px] text-slate-400 font-bold ml-2">Weight:</span>
                        <NumberInput step="0.1" className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-center outline-none" value={editForm.complexityWeight || 1.0} onChange={(val: number) => setEditForm({ ...editForm, complexityWeight: val })} />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">{service.baselineDays}d default</span>
                        <span className="text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">x{service.complexityWeight || 1.0} weight</span>
                      </div>
                    )}
                    <button 
                      onClick={() => setMilestoneModal({ isOpen: true, serviceId: service.id, serviceName: service.name, initialMilestones: service.milestones || [] })}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-500 text-[10px] font-black rounded-md flex items-center gap-1 transition-colors"
                    >
                      <ListChecks className="w-3 h-3" />
                      {service.milestones?.length || 0} milestones
                    </button>
                    <span className="px-2 py-0.5 bg-teal-50 text-teal-700 text-[10px] font-black rounded-md">{service.subServices?.length || 0} sub-services</span>
                  </div>
                  {isEditing ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => handleSaveService(service.id)} className={cn("px-3 py-1.5 text-white text-xs font-bold rounded-lg", theme.bg)}>Save Changes</button>
                      <button onClick={handleCancel} className="px-3 py-1.5 bg-slate-200 text-slate-600 text-xs font-bold rounded-lg">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEdit(service)} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"><SettingsIcon className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteService(service.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </div>

                {/* Sub-Services Table */}
                <div className="border-t border-slate-100">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-slate-50/70">
                        <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sub-Service / Gateway</th>
                        <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Duration (Days)</th>
                        <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Complexity Weight</th>
                        <th className="px-5 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Custom Milestones</th>
                        {isEditing && <th className="px-5 py-2.5 text-right"></th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {subServices.map((ss: any, i: number) => (
                        <tr key={ss.id || i}>
                          <td className="px-5 py-2.5">
                            {isEditing ? (
                              <input className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-teal-500/20" value={ss.name} onChange={e => { const u = [...subServices]; u[i] = { ...ss, name: e.target.value }; setEditForm({ ...editForm, subServices: u }); }} />
                            ) : (
                              <span className="text-sm font-bold text-slate-700">{ss.name}</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            {isEditing ? (
                              <NumberInput className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center outline-none" value={ss.baselineDays} onChange={(val: number) => { const u = [...subServices]; u[i] = { ...ss, baselineDays: val }; setEditForm({ ...editForm, subServices: u }); }} />
                            ) : (
                              <span className="text-xs font-bold text-slate-500">{ss.baselineDays}d</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            {isEditing ? (
                              <NumberInput step="0.1" className="w-20 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-center outline-none" value={ss.complexityWeight || 1.0} onChange={(val: number) => { const u = [...subServices]; u[i] = { ...ss, complexityWeight: val }; setEditForm({ ...editForm, subServices: u }); }} />
                            ) : (
                              <span className="text-xs font-bold text-slate-500">x{ss.complexityWeight || 1.0}</span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-center">
                            <button 
                              onClick={() => setMilestoneModal({ 
                                isOpen: true, 
                                serviceId: service.id, 
                                subServiceId: ss.id,
                                serviceName: `${service.name} (${ss.name})`, 
                                initialMilestones: ss.milestones || [] 
                              })}
                              className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-black transition-colors flex items-center gap-1 mx-auto",
                                ss.milestones?.length ? "bg-teal-50 text-teal-700 hover:bg-teal-100" : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                              )}
                            >
                              <ListChecks className="w-3 h-3" />
                              {ss.milestones?.length || 0} Set
                            </button>
                          </td>
                          {isEditing && (
                            <td className="px-5 py-2.5 text-right">
                              <button onClick={() => { const u = subServices.filter((_: any, idx: number) => idx !== i); setEditForm({ ...editForm, subServices: u }); }} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {isEditing && (
                        <tr>
                          <td colSpan={3} className="px-5 py-3">
                            <button onClick={() => { const newSS = { id: Math.random().toString(36).substr(2, 9), name: '', baselineDays: service.baselineDays || 1 }; setEditForm({ ...editForm, subServices: [...(editForm.subServices || []), newSS] }); }} className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 flex items-center gap-1.5 transition-colors">
                              <Plus className="w-3.5 h-3.5" /> Add Sub-Service
                            </button>
                          </td>
                        </tr>
                      )}
                      {!isEditing && subServices.length === 0 && (
                        <tr>
                          <td colSpan={2} className="px-5 py-3 text-[10px] font-bold text-slate-400 italic">No sub-services configured — click the edit icon to add gateways or variants.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}

          <MilestoneEditorModal 
            isOpen={milestoneModal.isOpen}
            onClose={() => setMilestoneModal({ ...milestoneModal, isOpen: false })}
            onSave={handleSaveMilestones}
            initialMilestones={milestoneModal.initialMilestones}
            serviceName={milestoneModal.serviceName}
          />
        </div>
      )}
    </div>
  );
};

const IntegrationsSettings = ({ config, setConfig, theme }: any) => {
  const generateSecret = () => {
    const newSecret = 'whsec_' + Math.random().toString(36).substr(2, 10) + Math.random().toString(36).substr(2, 10);
    setConfig({ ...config, webhookSecret: newSecret });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Integrations</h3>
        <p className="text-sm font-bold text-slate-500">Manage external data connections like Zoho or Data Warehouses.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
        <div className="flex items-center gap-4 mb-6">
          <div className={cn("p-4 rounded-2xl", theme.lightBg)}>
            <LinkIcon className={cn("w-8 h-8", theme.text)} />
          </div>
          <div>
             <h4 className="text-lg font-bold text-slate-900">Zoho / Data Warehouse Webhook</h4>
             <p className="text-sm text-slate-500 mt-1">Receive real-time project updates from your engineering team's endpoint.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Webhook URL Endpoint</label>
            <div className="flex">
              <input 
                readOnly
                value={`${import.meta.env.VITE_SUPABASE_URL || 'https://[YOUR_PROJECT_REF].supabase.co'}/functions/v1/zoho-webhook`}
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 outline-none"
              />
            </div>
            <p className="text-xs text-slate-500 pl-1 mt-2">Provide this endpoint URL to your engineering team to POST their JSON payloads.</p>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Webhook Secret (X-Webhook-Secret Header)</label>
            <div className="flex gap-2">
              <input 
                 readOnly
                 value={config.webhookSecret || 'Not generated yet'}
                 className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-600 outline-none"
              />
              <button 
                 onClick={generateSecret}
                 className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all whitespace-nowrap"
              >
                 {config.webhookSecret ? 'Regenerate' : 'Generate Secret'}
              </button>
            </div>
            <p className="text-[10px] text-amber-600 font-bold pl-1 uppercase tracking-widest mt-1">This secret MUST be included by the engineering team in the <code className="bg-amber-100 px-1 rounded mx-1">X-Webhook-Secret</code> header.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TaxonomiesSettings = ({ config, setConfig, theme, showToast }: any) => {
  const [newTag, setNewTag] = useState({ name: '', color: 'indigo' });
  const [newRiskCategory, setNewRiskCategory] = useState('');
  const [newIssueCategory, setNewIssueCategory] = useState('');

  const colors = ['indigo', 'amber', 'rose', 'emerald', 'sky', 'violet', 'fuchsia'];

  const handleAddTag = () => {
    if (!newTag.name.trim()) return;
    const tag = {
      id: 't_' + Math.random().toString(36).substr(2, 9),
      name: newTag.name.trim(),
      color: newTag.color
    };
    setConfig({ ...config, customTags: [...(config.customTags || []), tag] });
    setNewTag({ name: '', color: 'indigo' });
    showToast('Tag added.', 'success');
  };

  const handleRemoveTag = (id: string) => {
    setConfig({ ...config, customTags: (config.customTags || []).filter((t: any) => t.id !== id) });
  };

  const handleAddRiskCategory = () => {
    if (!newRiskCategory.trim()) return;
    if ((config.riskCategories || []).includes(newRiskCategory.trim())) {
      showToast('Category already exists.', 'error');
      return;
    }
    setConfig({ ...config, riskCategories: [...(config.riskCategories || []), newRiskCategory.trim()] });
    setNewRiskCategory('');
    showToast('Risk category added.', 'success');
  };

  const handleRemoveRiskCategory = (category: string) => {
    setConfig({ ...config, riskCategories: (config.riskCategories || []).filter((c: string) => c !== category) });
  };

  const handleAddIssueCategory = () => {
    if (!newIssueCategory.trim()) return;
    if ((config.issueCategories || []).includes(newIssueCategory.trim())) {
      showToast('Category already exists.', 'error');
      return;
    }
    setConfig({ ...config, issueCategories: [...(config.issueCategories || []), newIssueCategory.trim()] });
    setNewIssueCategory('');
    showToast('Issue category added.', 'success');
  };

  const handleRemoveIssueCategory = (category: string) => {
    setConfig({ ...config, issueCategories: (config.issueCategories || []).filter((c: string) => c !== category) });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      <div>
        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Taxonomies & Labels</h3>
        <p className="text-sm font-bold text-slate-500">Manage dynamic categories and project tags used across the application.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Project Tags */}
        <div className="space-y-4">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 h-full flex flex-col">
            <h4 className="text-sm font-black text-slate-900 mb-1">Custom Project Tags</h4>
            <p className="text-xs font-bold text-slate-500 mb-6">Create badge labels that can be assigned to projects.</p>
            
            <div className="space-y-4 mb-6">
              <input 
                placeholder="New Tag Name..."
                className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                value={newTag.name}
                onChange={e => setNewTag({ ...newTag, name: e.target.value })}
              />
              <div className="flex gap-2 items-center justify-between">
                <div className="flex gap-2">
                  {colors.map(color => (
                    <button
                      key={color}
                      onClick={() => setNewTag({ ...newTag, color })}
                      className={cn(
                        "w-6 h-6 rounded-full border-2 transition-all",
                        newTag.color === color ? "border-slate-800 scale-110" : "border-transparent opacity-50 hover:opacity-100",
                        `bg-${color}-500`
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={handleAddTag}
                  className={cn("p-2 rounded-xl text-white transition-all active:scale-95", theme.bg)}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 flex-1 content-start">
              {(config.customTags || []).map((tag: any) => (
                <div 
                  key={tag.id}
                  className={cn(
                    "group flex items-center gap-2 pl-3 pr-1 py-1 rounded-full border text-xs font-bold",
                    `bg-${tag.color}-50 text-${tag.color}-700 border-${tag.color}-200`
                  )}
                >
                  {tag.name}
                  <button 
                    onClick={() => handleRemoveTag(tag.id)}
                    className={cn(
                      "p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity",
                      `hover:bg-${tag.color}-100`
                    )}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {(config.customTags || []).length === 0 && (
                <p className="text-xs text-slate-400 font-medium italic">No custom tags created yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Risk Categories */}
        <div className="space-y-4">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 h-full flex flex-col">
            <h4 className="text-sm font-black text-slate-900 mb-1">Risk Categories</h4>
            <p className="text-xs font-bold text-slate-500 mb-6">Manage the dropdown list options for documenting project risks.</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                placeholder="New Category..."
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                value={newRiskCategory}
                onChange={e => setNewRiskCategory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddRiskCategory()}
              />
              <button
                onClick={handleAddRiskCategory}
                className={cn("px-4 py-2 rounded-xl text-white font-bold transition-all active:scale-95", theme.bg)}
              >
                Add
              </button>
            </div>

            <div className="space-y-2 flex-1 content-start overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {(config.riskCategories || []).map((category: string) => (
                <div 
                  key={category}
                  className="group flex flex-col justify-center px-4 py-2 bg-white border border-slate-200 rounded-xl relative overflow-hidden transition-all"
                >
                  <p className="text-sm font-bold text-slate-900 z-10">{category}</p>
                  <button 
                    onClick={() => handleRemoveRiskCategory(category)}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(config.riskCategories || []).length === 0 && (
                <p className="text-xs text-slate-400 font-medium italic">No risk categories created yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Issue Categories */}
        <div className="space-y-4">
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 h-full flex flex-col">
            <h4 className="text-sm font-black text-slate-900 mb-1">Issue Categories</h4>
            <p className="text-xs font-bold text-slate-500 mb-6">Manage categories for the Implementation Issue Log blockers.</p>
            
            <div className="flex gap-2 mb-6">
              <input 
                placeholder="New Category..."
                className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none"
                value={newIssueCategory}
                onChange={e => setNewIssueCategory(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddIssueCategory()}
              />
              <button
                onClick={handleAddIssueCategory}
                className={cn("px-4 py-2 rounded-xl text-white font-bold transition-all active:scale-95", theme.bg)}
              >
                Add
              </button>
            </div>

            <div className="space-y-2 flex-1 content-start overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
              {(config.issueCategories || []).map((category: string) => (
                <div 
                  key={category}
                  className="group flex flex-col justify-center px-4 py-2 bg-white border border-slate-200 rounded-xl relative overflow-hidden transition-all"
                >
                  <p className="text-sm font-bold text-slate-900 z-10">{category}</p>
                  <button 
                    onClick={() => handleRemoveIssueCategory(category)}
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all z-20"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(config.issueCategories || []).length === 0 && (
                <p className="text-xs text-slate-400 font-medium italic">No issue categories created yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

