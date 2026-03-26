import { Project, User, AuditLog, AppConfig } from '../types';
import { MOCK_PROJECTS, MOCK_USERS, MOCK_AUDIT_LOGS, INITIAL_CONFIG } from '../mockData';
import { supabase } from './supabase';

// Helper to map DB snake_case to Frontend camelCase
const mapProjectFromDb = (p: any): Project => ({
  id: p.id,
  clientName: p.client_name,
  packageName: p.package_name,
  services: p.services || [],
  productLines: p.product_lines || [],
  assignedPM: p.assigned_pm,
  startDate: p.start_date,
  expectedDuration: p.expected_duration,
  expectedCompletionDate: p.expected_completion_date,
  currentCompletionDate: p.current_completion_date,
  value: isNaN(Number(p.value)) ? 0 : Number(p.value),
  currency: p.currency || 'NGN',
  state: p.state,
  phases: p.phases || [],
  phaseWeights: p.phase_weights || {},
  serviceStates: p.service_states || {},
  pidSignedOffDate: p.pid_signed_off_date,
  comments: p.comments || [],
  risks: p.risks || [],
  priority: p.priority,
  createdAt: p.created_at,
  updatedAt: p.updated_at,
  signedOffAt: p.signed_off_at,
  billedAt: p.billed_at,
  activities: p.activities || [],
  rebaselineRequests: p.rebaseline_requests || [],
  totalActiveDays: p.total_active_days,
  suspensionCycles: p.suspension_cycles || [],
  isInternalInitiative: p.is_internal_initiative,
  milestones: p.milestones || [],
  phaseComments: p.phase_comments || {}
});

// Helper to map Frontend camelCase to DB snake_case
const mapProjectToDb = (p: Partial<Project>) => {
  const mapped: any = {};
  if (p.clientName !== undefined) mapped.client_name = p.clientName;
  if (p.packageName !== undefined) mapped.package_name = p.packageName;
  if (p.services !== undefined) mapped.services = p.services;
  if (p.productLines !== undefined) mapped.product_lines = p.productLines;
  if (p.assignedPM !== undefined) mapped.assigned_pm = p.assignedPM;
  if (p.startDate !== undefined) mapped.start_date = p.startDate;
  if (p.expectedDuration !== undefined) mapped.expected_duration = p.expectedDuration;
  if (p.expectedCompletionDate !== undefined) mapped.expected_completion_date = p.expectedCompletionDate;
  if (p.currentCompletionDate !== undefined) mapped.current_completion_date = p.currentCompletionDate;
  if (p.value !== undefined) mapped.value = p.value;
  if (p.currency !== undefined) mapped.currency = p.currency;
  if (p.state !== undefined) mapped.state = p.state;
  if (p.phases !== undefined) mapped.phases = p.phases;
  if (p.phaseWeights !== undefined) mapped.phase_weights = p.phaseWeights;
  if (p.serviceStates !== undefined) mapped.service_states = p.serviceStates;
  if (p.pidSignedOffDate !== undefined) mapped.pid_signed_off_date = p.pidSignedOffDate;
  if (p.comments !== undefined) mapped.comments = p.comments;
  if (p.risks !== undefined) mapped.risks = p.risks;
  if (p.priority !== undefined) mapped.priority = p.priority;
  if (p.signedOffAt !== undefined) mapped.signed_off_at = p.signedOffAt;
  if (p.billedAt !== undefined) mapped.billed_at = p.billedAt;
  if (p.activities !== undefined) mapped.activities = p.activities;
  if (p.rebaselineRequests !== undefined) mapped.rebaseline_requests = p.rebaselineRequests;
  if (p.totalActiveDays !== undefined) mapped.total_active_days = p.totalActiveDays;
  if (p.suspensionCycles !== undefined) mapped.suspension_cycles = p.suspensionCycles;
  if (p.isInternalInitiative !== undefined) mapped.is_internal_initiative = p.isInternalInitiative;
  if (p.milestones !== undefined) mapped.milestones = p.milestones;
  if (p.phaseComments !== undefined) mapped.phase_comments = p.phaseComments;
  return mapped;
};

export const api = {
  projects: {
    getAll: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(mapProjectFromDb);
    },
    update: async (project: Project): Promise<Project> => {
      const { data, error } = await supabase
        .from('projects')
        .update(mapProjectToDb(project))
        .eq('id', project.id)
        .select()
        .single();
      
      if (error) throw error;
      return mapProjectFromDb(data);
    },
    create: async (projectData: Partial<Project>): Promise<Project> => {
      const { data, error } = await supabase
        .from('projects')
        .insert(mapProjectToDb(projectData))
        .select()
        .single();
      
      if (error) throw error;
      return mapProjectFromDb(data);
    },
    createBulk: async (projectsToAdd: Partial<Project>[], projectsToUpdate: Partial<Project>[]): Promise<void> => {
      // Merge all projects to handle in a single bulk operation
      const allProjects = [...projectsToAdd, ...projectsToUpdate];
      if (allProjects.length === 0) return;

      // Map to DB structure
      const dbRows = allProjects.map(mapProjectToDb);

      // Strategy: Since unique constraints are tricky to rely on without direct DB access,
      // we'll fetch existing records for this batch in ONE go to identify conflicts.
      const clientNames = Array.from(new Set(allProjects.map(p => p.clientName || '').filter(Boolean)));
      const { data: existingRecords } = await supabase
        .from('projects')
        .select('id, client_name, package_name')
        .in('client_name', clientNames);

      const existingMap = new Map<string, string>(); // "client|package" -> id
      existingRecords?.forEach(r => {
        existingMap.set(`${r.client_name?.toLowerCase()}|${r.package_name?.toLowerCase()}`, r.id);
      });

      const toInsert: any[] = [];
      const toUpdate: any[] = [];

      dbRows.forEach((row, idx) => {
        const key = `${row.client_name?.toLowerCase()}|${row.package_name?.toLowerCase()}`;
        const existingId = existingMap.get(key);
        
        if (existingId) {
          toUpdate.push({ ...row, id: existingId });
        } else {
          toInsert.push(row);
        }
      });

      // Execute bulk operations
      if (toInsert.length > 0) {
        const { error } = await supabase.from('projects').insert(toInsert);
        if (error) console.error("[API] Bulk Insert error:", error);
      }

      if (toUpdate.length > 0) {
        // Supabase upsert with IDs will perform updates
        const { error } = await supabase.from('projects').upsert(toUpdate);
        if (error) console.error("[API] Bulk Upsert (Update) error:", error);
      }
    },
    deleteByIds: async (ids: string[]): Promise<void> => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('projects').delete().in('id', ids);
      if (error) throw error;
    },
    // Admin tool to seed the database initially
    seed: async () => {
      // Seeding is permanently disabled to ensure 100% clean production environment.
      // All institutional data must be imported via CSV/Excel or created manually.
      console.log("[API] Seeding skipped (Disabled for Production).");
      return;
    }
  },
  users: {
    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return (data || []).map(u => ({
        id: u.id,
        name: u.name,
        email: '', 
        role: u.role,
        status: 'Active',
        avatar: u.name?.substring(0, 2).toUpperCase() || 'U',
        lastLogin: u.updated_at
      }));
    },
    update: async (userId: string, updates: Partial<User>): Promise<void> => {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: updates.role,
          name: updates.name
        })
        .eq('id', userId);
      if (error) throw error;
    }
  },
  invites: {
    getAll: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      if (!profile || profile.role.toLowerCase() !== 'superadmin') {
        return [];
      }

      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') {
          throw new Error('Invites table is missing. Run supabase_setup.sql in Supabase SQL Editor.');
        }
        if (error.code === '42501') {
          throw new Error('You do not have permission to view invites. Ensure your profile role is Manager, Team Lead, or Superadmin.');
        }
        throw new Error(error.message || 'Failed to load invites.');
      }
      return data || [];
    },
    send: async (email: string, role: string, name?: string) => {
      const normalizedEmail = email.trim().toLowerCase();
      console.log("[Invites] Starting invite process for:", normalizedEmail);

      // Prevent inviting existing users.
      console.log("[Invites] Checking for existing profile...");
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', normalizedEmail)
        .maybeSingle();
      
      if (existingProfile) {
        console.warn("[Invites] Profile already exists for:", normalizedEmail);
        throw new Error('A user with this email already exists.');
      }

      // Record the invite in the database first.
      console.log("[Invites] Inserting record into 'invites' table...");
      const { data: invite, error: inviteError } = await supabase
        .from('invites')
        .insert({ 
          email: normalizedEmail, 
          role, 
          name, 
          status: 'Pending' 
        })
        .select()
        .single();

      if (inviteError) {
        console.error("[Invites] Insert failed:", inviteError);
        throw inviteError;
      }

      console.log("[Invites] Successfully recorded invite in DB:", invite.id);

      // Email functionality via Edge Function is currently disabled to prevent UI hangs.
      console.log("[Invites] Invite process complete.");

      return invite;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('invites').delete().eq('id', id);
      if (error) {
        if (error.code === '42501') {
          throw new Error('You do not have permission to cancel invites.');
        }
        throw new Error(error.message || 'Failed to delete invite.');
      }
    }
  },
  config: {
    get: async (): Promise<AppConfig> => {
      const { data, error } = await supabase.from('app_config').select('config').eq('id', 1).maybeSingle();
      if (error) throw error;
      return data?.config || INITIAL_CONFIG;
    },
    update: async (config: AppConfig): Promise<AppConfig> => {
      const { data, error } = await supabase
        .from('app_config')
        .upsert({ id: 1, config })
        .select('config')
        .single();
      if (error) throw error;
      return data.config;
    }
  },
  audit: {
    addLog: async (log: Omit<AuditLog, 'id'>) => {
      await supabase.from('audit_logs').insert({
        action: log.action,
        user: log.user,
        details: log.details,
        timestamp: log.timestamp,
        category: log.category
      });
    },
    getLogs: async (): Promise<AuditLog[]> => {
      const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false });
      if (error) throw error;
      return (data || []).map(l => ({
        id: l.id,
        action: l.action,
        user: l.user,
        details: l.details,
        timestamp: l.timestamp,
        category: l.category as any
      }));
    }
  }
};
