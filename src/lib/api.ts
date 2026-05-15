import { Project, User, AuditLog, AppConfig, DigestData, ServiceExtension, IMilestone, MappingStatus, ServiceSubService, ExtensionRequest, ExtensionHistoryEntry, AssignmentHistoryEntry, SuspensionRequest, ImplementationIssue, DBNotification, ImplementationDigestData, GeneralIssue, ReactivationRequest } from '../types';
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
  deliveryTrack: p.delivery_track || (p.is_internal_initiative ? 'Internal Initiative' : 'Standard'),
  milestones: p.milestones || [],
  phaseComments: p.phase_comments || {},
  externalId: p.external_id,
  implementationManager: p.implementation_manager,
  implementationManagers: p.implementation_managers || (p.implementation_manager ? [p.implementation_manager] : []),
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
  if (p.deliveryTrack !== undefined) mapped.delivery_track = p.deliveryTrack;
  if (p.milestones !== undefined) mapped.milestones = p.milestones;
  if (p.phaseComments !== undefined) mapped.phase_comments = p.phaseComments;
  if (p.externalId !== undefined) mapped.external_id = p.externalId;
  if (p.implementationManager !== undefined) mapped.implementation_manager = p.implementationManager;
  if (p.implementationManagers !== undefined) mapped.implementation_managers = p.implementationManagers;
  return mapped;
};

export const api = {
  supabase,
  projects: {
    getAll: async (): Promise<Project[]> => {
      const FIELDS = 'id, client_name, package_name, services, product_lines, assigned_pm, start_date, expected_duration, expected_completion_date, current_completion_date, value, currency, state, phases, phase_weights, service_states, pid_signed_off_date, priority, created_at, updated_at, signed_off_at, billed_at, total_active_days, suspension_cycles, is_internal_initiative, delivery_track, rebaseline_requests, comments, risks, activities, milestones, phase_comments, implementation_managers';
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;
      let keepGoing = true;
      while (keepGoing) {
        const { data, error } = await supabase
          .from('projects')
          .select(FIELDS)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = data || [];
        allRows = allRows.concat(page);
        keepGoing = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allRows.map(mapProjectFromDb);
    },
    getPaginated: async (
      page: number, 
      pageSize: number, 
      filters?: { 
        state?: string, 
        pm?: string,
        search?: string,
        portfolio?: 'All' | 'Enterprise' | 'Initiative',
        packages?: string[],
        pms?: string[]
      }
    ): Promise<{ data: Project[]; count: number }> => {
      let query = supabase
        .from('projects')
        .select('id, client_name, package_name, services, product_lines, assigned_pm, start_date, expected_duration, expected_completion_date, current_completion_date, value, currency, state, phases, phase_weights, service_states, pid_signed_off_date, priority, created_at, updated_at, signed_off_at, billed_at, total_active_days, suspension_cycles, is_internal_initiative, delivery_track, rebaseline_requests, implementation_managers', { count: 'exact' });

      if (filters?.state && filters.state !== 'All') {
        query = query.eq('state', filters.state);
      }
      if (filters?.portfolio === 'Enterprise') {
        query = query.eq('is_internal_initiative', false).eq('priority', 'P1');
      } else if (filters?.portfolio === 'Initiative') {
        query = query.eq('is_internal_initiative', true);
      }
      if (filters?.packages && filters.packages.length > 0) {
        query = query.in('package_name', filters.packages);
      }
      if (filters?.pms && filters.pms.length > 0) {
        query = query.in('assigned_pm', filters.pms);
      } else if (filters?.pm) {
        query = query.ilike('assigned_pm', filters.pm);
      }
      if (filters?.search) {
        query = query.ilike('client_name', `%${filters.search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;
      return {
        data: (data || []).map(mapProjectFromDb),
        count: count || 0
      };
    },
    deleteByIds: async (ids: string[]): Promise<void> => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .in('id', ids);
      if (error) throw error;
    },
    getById: async (id: string): Promise<Project> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return mapProjectFromDb(data);
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
  },

  notifications: {
    getAll: async (userId: string): Promise<DBNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    markAsRead: async (id: string): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      if (error) throw error;
    },
    markAllAsRead: async (userId: string): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) throw error;
    },
    clearAll: async (userId: string): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId);
      if (error) throw error;
    },
    create: async (userId: string, message: string, type: 'Comment' | 'Mapping' | 'Status' | 'System', projectId?: string | null, implementationId?: string | null): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          message,
          type,
          project_id: projectId,
          implementation_id: implementationId
        });
      if (error) throw error;
    },
    createMany: async (notificationsList: Partial<DBNotification>[]): Promise<void> => {
      const { error } = await supabase
        .from('notifications')
        .insert(notificationsList);
      if (error) throw error;
    }
  },

  users: {
    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      return (data || []).map(u => {
        const lastActivity = u.updated_at ? new Date(u.updated_at) : new Date(u.created_at);
        const isStale = lastActivity < ninetyDaysAgo;
        
        return {
          id: u.id,
          name: u.name,
          email: u.email, 
          role: u.role,
          status: isStale ? 'Inactive' : (u.status || 'Active'),
          avatar: u.name?.substring(0, 2).toUpperCase() || 'U',
          lastLogin: u.updated_at || u.created_at
        };
      });
    },
    update: async (userId: string, updates: Partial<User>): Promise<void> => {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: updates.role,
          name: updates.name,
          status: updates.status
        })
        .eq('id', userId);
      if (error) throw error;
    },
    resetPassword: async (email: string): Promise<void> => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      if (error) throw error;
    },
    delete: async (userId: string, email: string): Promise<void> => {
      // 1. Delete pending invites first (Cleanup)
      if (email) {
        await supabase.from('invites').delete().eq('email', email.toLowerCase().trim());
      }
      // 2. Delete the profile
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
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
    resend: async (email: string): Promise<void> => {
      console.log("[Invites] Resending invitation to:", email);
      // This will be linked to the same Edge Function that handles initial invites.
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
  },
  digests: {
    getHistorical: async (): Promise<DigestData[]> => {
      const { data, error } = await supabase
        .from('weekly_digests')
        .select('data')
        .order('week_of', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map(d => d.data as DigestData);
    },
    save: async (digest: DigestData): Promise<void> => {
      const { error } = await supabase
        .from('weekly_digests')
        .upsert({
          week_of: digest.weekOf,
          data: digest
        }, { onConflict: 'week_of' });
      
      if (error) {
        if (error.code !== '23505' && error.code !== '42P01') {
          console.error("[Digests] Failed to save project digest:", error);
        }
      }
    }
  },
  implementationDigests: {
    getHistorical: async (): Promise<ImplementationDigestData[]> => {
      const { data, error } = await supabase
        .from('implementation_digests')
        .select('data')
        .order('week_of', { ascending: false });
      
      if (error) {
        if (error.code === '42P01') return [];
        throw error;
      }
      return (data || []).map(d => d.data as ImplementationDigestData);
    },
    save: async (digest: ImplementationDigestData): Promise<void> => {
      const { error } = await supabase
        .from('implementation_digests')
        .upsert({
          week_of: digest.weekOf,
          data: digest
        }, { onConflict: 'week_of' });
      
      if (error) {
        if (error.code !== '23505' && error.code !== '42P01') {
          console.error("[Digests] Failed to save implementation digest:", error);
        }
      }
    }
  },

  serviceExtensions: {
    // ── Mapper ──────────────────────────────────────────────────────────────
    _fromDb: (r: any): ServiceExtension => ({
      id: r.id,
      clientName: r.client_name,
      serviceId: r.service_id,
      serviceName: r.service_name,
      serviceVariant: r.service_variant,
      subServiceId: r.sub_service_id ?? null,
      baselineDays: r.baseline_days ?? 0,
      implementationManager: r.implementation_manager,
      startDate: r.start_date,
      targetClosureDate: r.target_closure_date,
      status: r.status,
      milestones: r.milestones || [],
      linkedProjectId: r.linked_project_id,
      mappingStatus: r.mapping_status,
      mappingRequestedAt: r.mapping_requested_at,
      mappingApprovedAt: r.mapping_approved_at,
      mappingRejectionComment: r.mapping_rejection_comment,
      mappingNotes: r.mapping_notes,
      unmapComment: r.unmap_comment,
      extensionRequest: r.extension_request || null,
      extensionHistory: r.extension_history || [],
      assignmentHistory: r.assignment_history || [],
      suspensionRequest: r.suspension_request || null,
      reactivationRequest: r.reactivation_request || null,
      comments: r.comments || [],
      issues: r.issues || [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }),

    _toDb: (ext: Partial<ServiceExtension>) => ({
      client_name: ext.clientName,
      service_id: ext.serviceId,
      service_name: ext.serviceName,
      service_variant: ext.serviceVariant,
      sub_service_id: ext.subServiceId,
      baseline_days: ext.baselineDays,
      implementation_manager: ext.implementationManager,
      start_date: ext.startDate,
      target_closure_date: ext.targetClosureDate,
      status: ext.status,
      milestones: ext.milestones,
      linked_project_id: ext.linkedProjectId,
      mapping_status: ext.mappingStatus,
      mapping_requested_at: ext.mappingRequestedAt,
      mapping_approved_at: ext.mappingApprovedAt,
      mapping_rejection_comment: ext.mappingRejectionComment,
      mapping_notes: ext.mappingNotes,
      unmap_comment: ext.unmapComment,
      extension_request: ext.extensionRequest,
      extension_history: ext.extensionHistory,
      assignment_history: ext.assignmentHistory,
      suspension_request: ext.suspensionRequest,
      reactivation_request: ext.reactivationRequest,
      comments: ext.comments,
      issues: ext.issues,
    }),

    // ── CRUD ─────────────────────────────────────────────────────────────────
    getAll: async (): Promise<ServiceExtension[]> => {
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;
      let keepGoing = true;
      while (keepGoing) {
        const { data, error } = await supabase
          .from('service_extensions')
          .select('*')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = data || [];
        allRows = allRows.concat(page);
        keepGoing = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allRows.map(api.serviceExtensions._fromDb);
    },

    getByIM: async (imName: string): Promise<ServiceExtension[]> => {
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;
      let keepGoing = true;
      while (keepGoing) {
        const { data, error } = await supabase
          .from('service_extensions')
          .select('*')
          .eq('implementation_manager', imName)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        const page = data || [];
        allRows = allRows.concat(page);
        keepGoing = page.length === PAGE_SIZE;
        from += PAGE_SIZE;
      }
      return allRows.map(api.serviceExtensions._fromDb);
    },

    getByProject: async (projectId: string): Promise<ServiceExtension[]> => {
      const { data, error } = await supabase
        .from('service_extensions')
        .select('*')
        .eq('linked_project_id', projectId)
        .eq('mapping_status', 'Approved');
      if (error) throw error;
      return (data || []).map(api.serviceExtensions._fromDb);
    },

    syncMilestones: async (serviceName: string, newMilestoneNames: string[], subServiceId?: string | null, subServiceName?: string | null): Promise<number> => {
      let query = supabase
        .from('service_extensions')
        .select('*')
        .eq('service_name', serviceName)
        .neq('status', 'Completed');
      
      if (subServiceId || subServiceName) {
        if (subServiceId && subServiceName) {
          query = query.or(`sub_service_id.eq.${subServiceId},service_variant.eq.${subServiceName}`);
        } else if (subServiceId) {
          query = query.eq('sub_service_id', subServiceId);
        } else {
          query = query.eq('service_variant', subServiceName);
        }
      } else {
        // Main baseline: target those with 'Standard' variant or null ID
        query = query.or(`sub_service_id.is.null,service_variant.eq.Standard`);
      }

      const { data, error } = await query;
      if (!data || data.length === 0) return 0;

      let updatedCount = 0;
      for (const r of data) {
        const currentMilestones = r.milestones || [];
        const updatedMilestones = newMilestoneNames.map(name => {
          const existing = currentMilestones.find((m: any) => m.name === name);
          if (existing) return existing;
          return { name, completed: false, completedAt: null, completedBy: null };
        });

        const isDifferent = updatedMilestones.length !== currentMilestones.length || 
                           updatedMilestones.some((m, i) => m.name !== currentMilestones[i]?.name);

        if (isDifferent) {
          await supabase
            .from('service_extensions')
            .update({ milestones: updatedMilestones })
            .eq('id', r.id);
          updatedCount++;
        }
      }
      return updatedCount;
    },

    create: async (ext: Omit<ServiceExtension, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceExtension> => {
      const { data, error } = await supabase
        .from('service_extensions')
        .insert(api.serviceExtensions._toDb({ ...ext, issues: [] }))
        .select()
        .single();
      if (error) throw error;
      return api.serviceExtensions._fromDb(data);
    },

    createBulk: async (extensions: Partial<ServiceExtension>[]): Promise<void> => {
      if (extensions.length === 0) return;
      const dbRows = extensions.map(api.serviceExtensions._toDb);
      const { error } = await supabase.from('service_extensions').insert(dbRows);
      if (error) throw error;
    },

    updateMilestones: async (
      id: string,
      milestones: IMilestone[],
      newStatus: string,
      linkedProjectId?: string | null,
      serviceName?: string,
      serviceId?: string,
    ): Promise<ServiceExtension> => {
      const { data, error } = await supabase
        .from('service_extensions')
        .update({ milestones, status: newStatus })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Sync to linked project's service_states ONLY if this is the primary (first approved)
      // mapping for this parent service on this project.
      if (linkedProjectId && serviceName && serviceId) {
        // Check if there are other approved mappings for the same parent service on this project
        const { data: otherApproved } = await supabase
          .from('service_extensions')
          .select('id')
          .eq('linked_project_id', linkedProjectId)
          .eq('service_id', serviceId)
          .eq('mapping_status', 'Approved')
          .neq('id', id);

        const isPrimary = (otherApproved || []).length === 0;

        if (isPrimary) {
          const serviceStatus = 
            newStatus === 'Completed' ? 'Closed' :
            newStatus === 'Suspended' ? 'Suspended' :
            newStatus === 'In Progress' ? 'In Progress' : 'Not Started';

          const { data: proj } = await supabase
            .from('projects')
            .select('service_states')
            .eq('id', linkedProjectId)
            .single();
          
          if (proj) {
            const updatedStates = { ...(proj.service_states || {}), [serviceName]: serviceStatus };
            await supabase
              .from('projects')
              .update({ service_states: updatedStates })
              .eq('id', linkedProjectId);
          }
        }
      }
      return api.serviceExtensions._fromDb(data);
    },

    reassign: async (id: string, newIM: string, currentIM: string, reassignedBy: string): Promise<void> => {
      const { data: current } = await supabase
        .from('service_extensions')
        .select('assignment_history')
        .eq('id', id)
        .single();
      
      const history = [...(current?.assignment_history || []), {
        from: currentIM,
        to: newIM,
        reassignedBy,
        timestamp: new Date().toISOString()
      }];

      const { error } = await supabase
        .from('service_extensions')
        .update({ 
          implementation_manager: newIM,
          assignment_history: history
        })
        .eq('id', id);
      if (error) throw error;
    },

    requestExtension: async (id: string, request: Omit<ExtensionRequest, 'status' | 'requestedAt'>): Promise<void> => {
      const pendingRequest: ExtensionRequest = {
        ...request,
        status: 'Pending',
        requestedAt: new Date().toISOString()
      };
      const { error } = await supabase
        .from('service_extensions')
        .update({ extension_request: pendingRequest })
        .eq('id', id);
      if (error) throw error;
    },

    approveExtension: async (id: string, approvedBy: string): Promise<void> => {
      const { data: current, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('extension_request, extension_history, target_closure_date')
        .eq('id', id)
        .single();
      
      if (fetchErr || !current?.extension_request) throw new Error('No pending extension request found.');

      const req = current.extension_request;
      const historyEntry: ExtensionHistoryEntry = {
        oldTargetDate: current.target_closure_date,
        newTargetDate: req.newTargetDate,
        reason: req.reason,
        timestamp: new Date().toISOString(),
        approvedBy
      };

      const { error } = await supabase
        .from('service_extensions')
        .update({
          target_closure_date: req.newTargetDate,
          extension_request: null,
          extension_history: [...(current.extension_history || []), historyEntry]
        })
        .eq('id', id);
      if (error) throw error;
    },

    rejectExtension: async (id: string, comment: string): Promise<void> => {
      const { error } = await supabase
        .from('service_extensions')
        .update({ extension_request: null })
        .eq('id', id);
      if (error) throw error;
    },

    // ── Suspension Workflow ──────────────────────────────────────────────────
    requestSuspension: async (id: string, reason: string, requestedBy: string): Promise<void> => {
      const pendingRequest: SuspensionRequest = {
        reason,
        requestedAt: new Date().toISOString(),
        requestedBy,
        status: 'Pending',
      };
      const { error } = await supabase
        .from('service_extensions')
        .update({ suspension_request: pendingRequest })
        .eq('id', id);
      if (error) throw error;
    },

    approveSuspension: async (id: string, resolvedBy: string): Promise<void> => {
      const { data: ext } = await supabase.from('service_extensions').select('suspension_request, implementation_manager, client_name, service_name, linked_project_id').eq('id', id).single();
      const updated = { ...ext?.suspension_request, status: 'Approved', resolvedAt: new Date().toISOString(), resolvedBy };
      
      const { error } = await supabase
        .from('service_extensions')
        .update({ status: 'Suspended', suspension_request: updated })
        .eq('id', id);
      if (error) throw error;

      if (ext?.implementation_manager) {
        const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
        if (imUser) {
          await api.notifications.create(
            imUser.id,
            `Your suspension request for ${ext.client_name} (${ext.service_name}) has been approved by ${resolvedBy}.`,
            'Status',
            ext.linked_project_id,
            id
          );
        }
      }
    },

    rejectSuspension: async (id: string, rejectionReason: string, resolvedBy: string): Promise<void> => {
      const { data: ext } = await supabase.from('service_extensions').select('suspension_request, implementation_manager, client_name, service_name, linked_project_id').eq('id', id).single();
      const updated = { ...ext?.suspension_request, status: 'Rejected', rejectionComment: rejectionReason, resolvedAt: new Date().toISOString(), resolvedBy };

      const { error } = await supabase
        .from('service_extensions')
        .update({ suspension_request: updated })
        .eq('id', id);
      if (error) throw error;

      if (ext?.implementation_manager) {
        const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
        if (imUser) {
          await api.notifications.create(
            imUser.id,
            `Your suspension request for ${ext.client_name} (${ext.service_name}) was rejected by ${resolvedBy}.`,
            'Status',
            ext.linked_project_id,
            id
          );
        }
      }
    },

    // ── Reactivation Workflow ────────────────────────────────────────────────
    requestReactivation: async (id: string, reason: string, requestedBy: string): Promise<void> => {
      const pendingRequest: ReactivationRequest = {
        reason,
        requestedAt: new Date().toISOString(),
        requestedBy,
        status: 'Pending',
      };
      const { error } = await supabase
        .from('service_extensions')
        .update({ reactivation_request: pendingRequest })
        .eq('id', id);
      if (error) throw error;
    },

    approveReactivation: async (id: string, resolvedBy: string): Promise<void> => {
      const { data: ext } = await supabase.from('service_extensions').select('reactivation_request, implementation_manager, client_name, service_name, linked_project_id').eq('id', id).single();
      const updated = { ...ext?.reactivation_request, status: 'Approved', resolvedAt: new Date().toISOString(), resolvedBy };
      
      const { error } = await supabase
        .from('service_extensions')
        .update({ status: 'In Progress', reactivation_request: updated })
        .eq('id', id);
      if (error) throw error;

      if (ext?.implementation_manager) {
        const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
        if (imUser) {
          await api.notifications.create(
            imUser.id,
            `Your reactivation request for ${ext.client_name} (${ext.service_name}) has been approved by ${resolvedBy}.`,
            'Status',
            ext.linked_project_id,
            id
          );
        }
      }
    },

    rejectReactivation: async (id: string, rejectionReason: string, resolvedBy: string): Promise<void> => {
      const { data: ext } = await supabase.from('service_extensions').select('reactivation_request, implementation_manager, client_name, service_name, linked_project_id').eq('id', id).single();
      const updated = { ...ext?.reactivation_request, status: 'Rejected', rejectionComment: rejectionReason, resolvedAt: new Date().toISOString(), resolvedBy };

      const { error } = await supabase
        .from('service_extensions')
        .update({ reactivation_request: updated })
        .eq('id', id);
      if (error) throw error;

      if (ext?.implementation_manager) {
        const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
        if (imUser) {
          await api.notifications.create(
            imUser.id,
            `Your reactivation request for ${ext.client_name} (${ext.service_name}) was rejected by ${resolvedBy}.`,
            'Status',
            ext.linked_project_id,
            id
          );
        }
      }
    },

    addComment: async (id: string, author: string, content: string): Promise<ServiceExtension> => {
      // 1. Get current comments and participants
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('comments, implementation_manager, client_name, service_name, linked_project_id')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const newComments = [
        ...(ext.comments || []),
        { id: Math.random().toString(36).substr(2, 9), author, content, createdAt: new Date().toISOString() }
      ];

      const { data: updated, error } = await supabase
        .from('service_extensions')
        .update({ comments: newComments })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      // ── Notifications ──────────────────────────────────────────────────────
      try {
        const notificationsToCreate = [];
        
        // Notify IM if they are not the author
        if (ext.implementation_manager && author !== ext.implementation_manager) {
          const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
          if (imUser) {
            notificationsToCreate.push({
              user_id: imUser.id,
              message: `${author} commented on ${ext.client_name} (${ext.service_name})`,
              type: 'Comment',
              project_id: ext.linked_project_id,
              implementation_id: id
            });
          }
        }

        if (ext.linked_project_id) {
          const { data: proj } = await supabase.from('projects').select('assigned_pm').eq('id', ext.linked_project_id).single();
          if (proj?.assigned_pm && author !== proj.assigned_pm) {
            const { data: pmUser } = await supabase.from('profiles').select('id').eq('name', proj.assigned_pm).single();
            if (pmUser) {
              notificationsToCreate.push({
                user_id: pmUser.id,
                message: `${author} commented on ${ext.client_name} (${ext.service_name})`,
                type: 'Comment',
                project_id: ext.linked_project_id,
                implementation_id: id
              });
            }
          }
        }

        if (notificationsToCreate.length > 0) {
          await api.notifications.createMany(notificationsToCreate);
        }
      } catch (notifErr) {
        console.error("[API] Failed to dispatch comment notifications:", notifErr);
      }

      return api.serviceExtensions._fromDb(updated);
    },

    editComment: async (extensionId: string, commentId: string, newContent: string): Promise<ServiceExtension> => {
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('comments')
        .eq('id', extensionId)
        .single();
      if (fetchErr) throw fetchErr;

      const updatedComments = (ext.comments || []).map((c: any) => {
        if (c.id === commentId) {
          return { ...c, content: newContent, updatedAt: new Date().toISOString() };
        }
        return c;
      });

      const { data: updated, error } = await supabase
        .from('service_extensions')
        .update({ comments: updatedComments })
        .eq('id', extensionId)
        .select('*')
        .single();
      if (error) throw error;
      return api.serviceExtensions._fromDb(updated);
    },

    deleteComment: async (extensionId: string, commentId: string): Promise<ServiceExtension> => {
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('comments')
        .eq('id', extensionId)
        .single();
      if (fetchErr) throw fetchErr;

      const updatedComments = (ext.comments || []).filter((c: any) => c.id !== commentId);

      const { data: updated, error } = await supabase
        .from('service_extensions')
        .update({ comments: updatedComments })
        .eq('id', extensionId)
        .select('*')
        .single();
      if (error) throw error;
      return api.serviceExtensions._fromDb(updated);
    },

    updateTimeline: async (id: string, startDate: string, targetDate: string, updatedBy: string): Promise<ServiceExtension> => {
      const { data, error } = await supabase
        .from('service_extensions')
        .update({
          start_date: startDate,
          target_closure_date: targetDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return api.serviceExtensions._fromDb(data);
    },

    updateDetails: async (
      id: string,
      clientName: string,
      serviceId: string,
      serviceName: string,
      serviceVariant: string,
      subServiceId: string | null,
      baselineDays: number,
      milestones: IMilestone[]
    ): Promise<ServiceExtension> => {
      const { data, error } = await supabase
        .from('service_extensions')
        .update({
          client_name: clientName,
          service_id: serviceId,
          service_name: serviceName,
          service_variant: serviceVariant,
          sub_service_id: subServiceId,
          baseline_days: baselineDays,
          milestones: milestones,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return api.serviceExtensions._fromDb(data);
    },

    addIssue: async (id: string, description: string, impact: ImplementationIssue['impact'], category?: string): Promise<ServiceExtension> => {
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('issues')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const newIssue: ImplementationIssue = {
        id: Math.random().toString(36).substr(2, 9),
        description,
        impact,
        category: category || 'General',
        status: 'Open',
        createdAt: new Date().toISOString()
      };

      const newIssues = [newIssue, ...(ext.issues || [])];

      const { data: updated, error } = await supabase
        .from('service_extensions')
        .update({ issues: newIssues })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      return api.serviceExtensions._fromDb(updated);
    },

    updateIssue: async (id: string, issueId: string, updates: Partial<ImplementationIssue>): Promise<ServiceExtension> => {
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('issues')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const newIssues = (ext.issues || []).map((i: ImplementationIssue) => 
        i.id === issueId ? { ...i, ...updates } : i
      );

      const { data: updated, error } = await supabase
        .from('service_extensions')
        .update({ issues: newIssues })
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;

      return api.serviceExtensions._fromDb(updated);
    },

    // ── Mapping Workflow ─────────────────────────────────────────────────────
    requestMapping: async (id: string, projectId: string, notes: string): Promise<void> => {
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('client_name, service_name, implementation_manager')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const { error } = await supabase
        .from('service_extensions')
        .update({
          linked_project_id: projectId,
          mapping_status: 'Pending',
          mapping_requested_at: new Date().toISOString(),
          mapping_notes: notes,
        })
        .eq('id', id);
      if (error) throw error;

      // Notify PM
      const { data: proj } = await supabase.from('projects').select('assigned_pm').eq('id', projectId).single();
      if (proj?.assigned_pm) {
        const { data: pmUser } = await supabase.from('profiles').select('id').eq('name', proj.assigned_pm).single();
        if (pmUser) {
          await api.notifications.create(
            pmUser.id,
            `${ext.implementation_manager} requested a mapping for ${ext.client_name} (${ext.service_name})`,
            'Mapping',
            projectId,
            id
          );
        }
      }
    },

    approveMapping: async (id: string, approvedBy: string): Promise<void> => {
      // 1. Mark as approved and get linked info
      const { data: ext, error: extErr } = await supabase
        .from('service_extensions')
        .update({
          mapping_status: 'Approved',
          mapping_approved_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('linked_project_id, implementation_manager, status, service_variant, service_id, service_name, client_name')
        .single();
      if (extErr) throw extErr;

      if (ext?.linked_project_id) {
        // 2. Check if this is the FIRST approved mapping for this parent service on the project.
        //    Only the first one reflects on the execution milestone. Others are Additional Scope.
        const { data: existingApproved } = await supabase
          .from('service_extensions')
          .select('id')
          .eq('linked_project_id', ext.linked_project_id)
          .eq('service_id', ext.service_id)
          .eq('mapping_status', 'Approved')
          .neq('id', id);

        const isPrimary = (existingApproved || []).length === 0;

        if (isPrimary) {
          // 3. Map implementation status to project service milestone status
          const serviceStatus = 
            ext.status === 'Completed' ? 'Closed' :
            ext.status === 'Suspended' ? 'Suspended' :
            ext.status === 'In Progress' ? 'In Progress' : 'Not Started';

          const { data: proj } = await supabase
            .from('projects')
            .select('service_states, implementation_managers')
            .eq('id', ext.linked_project_id)
            .single();

          if (proj) {
            // Key by service_name (e.g. "USSD") so it matches the execution milestone label
            const updatedStates = { ...(proj.service_states || {}), [ext.service_name]: serviceStatus };
            
            // Re-aggregate implementation managers
            const { data: allApproved } = await supabase
              .from('service_extensions')
              .select('implementation_manager')
              .eq('linked_project_id', ext.linked_project_id)
              .eq('mapping_status', 'Approved');

            const ims = Array.from(new Set((allApproved || []).map((e: any) => e.implementation_manager).filter(Boolean)));
            
            await supabase
              .from('projects')
              .update({ 
                service_states: updatedStates,
                implementation_managers: ims 
              })
              .eq('id', ext.linked_project_id);
          }
        } else {
          // Additional scope — still update implementation_managers list
          const { data: allApproved } = await supabase
            .from('service_extensions')
            .select('implementation_manager')
            .eq('linked_project_id', ext.linked_project_id)
            .eq('mapping_status', 'Approved');

          const ims = Array.from(new Set((allApproved || []).map((e: any) => e.implementation_manager).filter(Boolean)));
          await supabase.from('projects').update({ implementation_managers: ims }).eq('id', ext.linked_project_id);
        }

        // Notify IM regardless
        const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
        if (imUser) {
          await api.notifications.create(
            imUser.id,
            `Your mapping for ${ext.client_name} (${ext.service_name}) has been APPROVED.`,
            'Mapping',
            ext.linked_project_id,
            id
          );
        }
      }
    },

    rejectMapping: async (id: string, comment: string): Promise<void> => {
      if (!comment?.trim()) throw new Error('Rejection comment is required.');
      const { data: ext, error: fetchErr } = await supabase
        .from('service_extensions')
        .select('client_name, service_name, implementation_manager')
        .eq('id', id)
        .single();
      
      const { error } = await supabase
        .from('service_extensions')
        .update({
          mapping_status: 'Rejected',
          mapping_rejection_comment: comment,
          linked_project_id: null,
        })
        .eq('id', id);
      if (error) throw error;

      if (ext) {
        const { data: imUser } = await supabase.from('profiles').select('id').eq('name', ext.implementation_manager).single();
        if (imUser) {
          await api.notifications.create(
            imUser.id,
            `Your mapping for ${ext.client_name} (${ext.service_name}) was REJECTED: ${comment}`,
            'Mapping',
            null,
            id
          );
        }
      }
    },

    unmapFromProject: async (id: string, comment: string, linkedProjectId: string, serviceVariant: string): Promise<void> => {
      if (!comment?.trim()) throw new Error('Unmap comment is required.');
      // Revert service_states on the project
      const { data: proj } = await supabase
        .from('projects')
        .select('service_states')
        .eq('id', linkedProjectId)
        .single();
      if (proj) {
        const updatedStates = { ...(proj.service_states || {}) };
        delete updatedStates[serviceVariant];
        await supabase
          .from('projects')
          .update({ service_states: updatedStates })
          .eq('id', linkedProjectId);
      }
      // Mark the extension as unmapped
      const { error } = await supabase
        .from('service_extensions')
        .update({
          mapping_status: 'Unmapped',
          linked_project_id: null,
          unmap_comment: comment,
        })
        .eq('id', id);
      if (error) throw error;

      // Re-aggregate remaining approved IMs for this project
      const { data: allApproved } = await supabase
        .from('service_extensions')
        .select('implementation_manager')
        .eq('linked_project_id', linkedProjectId)
        .eq('mapping_status', 'Approved');

      const ims = Array.from(new Set((allApproved || []).map((e: any) => e.implementation_manager).filter(Boolean)));
      await supabase
        .from('projects')
        .update({ implementation_managers: ims })
        .eq('id', linkedProjectId);
    },

    // Freeze/unfreeze all extensions linked to a project
    freezeByProject: async (projectId: string): Promise<void> => {
      await supabase
        .from('service_extensions')
        .update({ status: 'Suspended' })
        .eq('linked_project_id', projectId)
        .eq('mapping_status', 'Approved')
        .neq('status', 'Completed');
    },

    unfreezeByProject: async (projectId: string): Promise<void> => {
      await supabase
        .from('service_extensions')
        .update({ status: 'Not Started' })
        .eq('linked_project_id', projectId)
        .eq('mapping_status', 'Approved')
        .eq('status', 'Suspended');
    },

    // Check for duplicate active extension (warn before create)
    checkDuplicate: async (clientName: string, serviceId: string, serviceVariant: string, excludeId?: string): Promise<boolean> => {
      let query = api.supabase
        .from('service_extensions')
        .select('id')
        .eq('client_name', clientName)
        .eq('service_id', serviceId)
        .eq('service_variant', serviceVariant)
        .neq('status', 'Completed');
        
      if (excludeId) {
        query = query.neq('id', excludeId);
      }
      
      const { data } = await query.limit(1);
      return (data || []).length > 0;
    },

    delete: async (id: string): Promise<void> => {
      const { error } = await api.supabase
        .from('service_extensions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },
  generalIssues: {
    getAll: async (): Promise<GeneralIssue[]> => {
      const { data, error } = await api.supabase
        .from('general_issues')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        description: d.description,
        impact: d.impact,
        status: d.status,
        category: d.category,
        affectedServices: d.affected_services || [],
        affectedExtensionIds: d.affected_extension_ids || [],
        notes: d.notes,
        loggedBy: d.logged_by,
        createdAt: d.created_at,
        resolvedAt: d.resolved_at,
        updatedAt: d.updated_at
      }));
    },
    create: async (issue: Partial<GeneralIssue>): Promise<GeneralIssue> => {
      const { data, error } = await api.supabase
        .from('general_issues')
        .insert([{
          description: issue.description,
          impact: issue.impact,
          category: issue.category,
          status: issue.status || 'Open',
          affected_services: issue.affectedServices || [],
          affected_extension_ids: issue.affectedExtensionIds || [],
          notes: issue.notes,
          logged_by: issue.loggedBy,
          resolved_at: issue.resolvedAt
        }])
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        description: data.description,
        impact: data.impact,
        status: data.status,
        category: data.category,
        affectedServices: data.affected_services || [],
        affectedExtensionIds: data.affected_extension_ids || [],
        notes: data.notes,
        loggedBy: data.logged_by,
        createdAt: data.created_at,
        resolvedAt: data.resolved_at,
        updatedAt: data.updated_at
      };
    },
    update: async (id: string, updates: Partial<GeneralIssue>): Promise<GeneralIssue> => {
      const dbUpdates: any = {
        description: updates.description,
        impact: updates.impact,
        category: updates.category,
        status: updates.status,
        affected_services: updates.affectedServices,
        affected_extension_ids: updates.affectedExtensionIds,
        notes: updates.notes,
        resolved_at: updates.resolvedAt,
        updated_at: new Date().toISOString()
      };

      // Remove undefined fields
      Object.keys(dbUpdates).forEach(key => dbUpdates[key] === undefined && delete dbUpdates[key]);

      const { data, error } = await api.supabase
        .from('general_issues')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return {
        id: data.id,
        description: data.description,
        impact: data.impact,
        status: data.status,
        category: data.category,
        affectedServices: data.affected_services || [],
        affectedExtensionIds: data.affected_extension_ids || [],
        notes: data.notes,
        loggedBy: data.logged_by,
        createdAt: data.created_at,
        resolvedAt: data.resolved_at,
        updatedAt: data.updated_at
      };
    },
    delete: async (id: string): Promise<void> => {
      const { error } = await api.supabase
        .from('general_issues')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  }
};
