import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, differenceInBusinessDays, parseISO } from 'date-fns';
import { Project, Role, AppConfig, ProjectPriority, ProjectActivity, ActivityType, RebaselineRequest, Phase, ServiceState, ProjectState, BillingRejection } from '../types';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { calculateWorkingDays, getActiveDaysCount, calculateSPI, getAutoProjectState, isRole, hasRole } from '../lib/utils';

export function useProjects(userRole: Role, config: AppConfig, userName: string = 'User') {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // Ref-based dedup: tracks keys of notifications already added this session
  const notifKeysRef = useRef<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Array<{
    id: string; message: string; projectId: string;
    createdAt: Date; isRead: boolean; key: string;
  }>>([]);

  const addNotification = useCallback((message: string, projectId: string, key?: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const notifKey = key || id;
    setNotifications(prev => [...prev, { id, message, projectId, createdAt: new Date(), isRead: false, key: notifKey }]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications(prev => {
      const target = prev.find(n => n.id === id);
      if (target?.key) notifKeysRef.current.delete(target.key);
      return prev.filter(n => n.id !== id);
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    notifKeysRef.current.clear();
    setNotifications([]);
  }, []);

  const validateStateTransition = (project: Project, newState: string): string | null => {
    const current = project.state;

    if (newState === 'Billed' && !isRole(userRole, 'Finance')) {
      return 'Only Finance can mark a project as Billed.';
    }
    if (newState === 'Closed' && current !== 'Billed') {
      return 'Project must be Billed before it can be Closed.';
    }
    if (newState === 'Signed Off') {
      const isInitiativeTrack = project.isInternalInitiative || project.deliveryTrack === 'Internal Initiative';
      const isCustomTrack = project.deliveryTrack === 'Customization';

      if (isInitiativeTrack || isCustomTrack) {
        // For milestone-based projects, all milestones must be completed
        const milestones = project.milestones || [];
        if (milestones.length === 0) {
          return 'At least one milestone must be completed before signing off.';
        }
        const allMilestonesDone = milestones.every(m => m.status === 'Closed');
        if (!allMilestonesDone) {
          return 'All milestones must be marked complete before signing off.';
        }
      } else {
        // Standard track: all services must be closed
        const allClosed = project.services.length > 0 &&
          project.services.every(s => project.serviceStates?.[s] === 'Closed');
        if (!allClosed) {
          return 'All services must be closed before signing off.';
        }
      }
    }
    if (newState === 'Delayed') {
      return 'Delayed status is set automatically by the system.';
    }
    if (current === 'Closed') {
      return 'This project is closed and cannot be changed.';
    }
    return null;
  };

  const { data: rawProjects = [], isLoading: loading, refetch: refreshProjects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      console.log("[Diagnostics] Fetching lightweight projects projection...");
      const data = await api.projects.getAll();
      
      const terminalStates: ProjectState[] = ['Signed Off', 'Billed', 'Closed', 'Suspended'];
      return data.map(p => {
        if (!terminalStates.includes(p.state)) {
           const autoState = getAutoProjectState(p, config.spiThresholds);
           if (p.state !== autoState) {
              return { ...p, state: autoState };
           }
        }
        return p;
      });
    },
    staleTime: 5 * 60 * 1000, // 5 minutes fresh
  });

  // ── Realtime: instant notification when webhook inserts a new project ──────
  useEffect(() => {
    const channel = supabase
      .channel('projects-webhook-inserts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'projects' },
        (payload) => {
          // Invalidate React Query cache so the new project is fetched immediately
          queryClient.invalidateQueries({ queryKey: ['projects'] });

          // Fire an in-app notification for leadership roles
          const clientName = (payload.new as any).client_name || 'Unknown project';
          const projectId  = (payload.new as any).id || '';
          const notifId    = Math.random().toString(36).substr(2, 9);
          const webhookKey = `webhook-${projectId}`;
          if (!notifKeysRef.current.has(webhookKey)) {
            notifKeysRef.current.add(webhookKey);
            setNotifications(prev => [
              ...prev,
              { id: notifId, message: `New project received: "${clientName}"`, projectId, createdAt: new Date(), isRead: false, key: webhookKey },
            ]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Rebaseline Notifications for leadership
  useMemo(() => {
    if (!hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead'])) return;
    const pending = rawProjects.flatMap(p => (p.rebaselineRequests || [])
      .filter(r => r.status === 'Pending')
      .map(r => ({ projectId: p.id, projectName: p.clientName, requestId: r.id }))
    );
    pending.forEach(r => {
      const key = `rebaseline-${r.projectId}`;
      if (!notifKeysRef.current.has(key)) {
        notifKeysRef.current.add(key);
        addNotification(`New rebaseline request for "${r.projectName}"`, r.projectId, key);
      }
    });
  }, [rawProjects, userRole]);

  // Stale Data Notifications for assigned PM
  useMemo(() => {
    if (userRole !== 'PM') return;
    const staleProjects = rawProjects.filter(p => {
      const isOwner = p.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase();
      if (!isOwner || p.state === 'Closed' || p.state === 'Billed' || p.state === 'Suspended') return false;
      const lastUpdate = p.updatedAt ? new Date(p.updatedAt) : new Date(p.createdAt);
      const diffDays = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > (config.staleThresholdDays || 7);
    });
    staleProjects.forEach(p => {
      const key = `stale-${p.id}`;
      if (!notifKeysRef.current.has(key)) {
        notifKeysRef.current.add(key);
        addNotification(`Project "${p.clientName}" hasn't been updated in over ${config.staleThresholdDays || 7} days.`, p.id, key);
      }
    });
  }, [rawProjects, userRole, userName, config.staleThresholdDays]);

  // ── Approaching Completion Date — PM alert (≤5 working days to deadline) ───
  useMemo(() => {
    if (userRole !== 'PM') return;
    const WARN_DAYS = 5;
    const today = new Date();

    rawProjects.forEach(p => {
      const isOwner = p.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase();
      if (!isOwner) return;
      if (['Closed', 'Billed', 'Signed Off', 'Suspended'].includes(p.state)) return;
      if (!p.currentCompletionDate) return;

      const daysLeft = differenceInBusinessDays(parseISO(p.currentCompletionDate), today);
      if (daysLeft > WARN_DAYS || daysLeft < 0) return; // past due handled separately

      const key = `due-soon-${p.id}-${p.currentCompletionDate}`;
      if (!notifKeysRef.current.has(key)) {
        notifKeysRef.current.add(key);
        const label = daysLeft === 0 ? 'due today' : daysLeft === 1 ? '1 working day left' : `${daysLeft} working days left`;
        addNotification(
          `"${p.clientName}" is ${label} — ensure closure phase is on track.`,
          p.id,
          key
        );
      }
    });
  }, [rawProjects, userRole, userName]);

  // ── Auto-flip to Delayed — notify the PM when system downgrades state ────────
  // We compare rawProjects (with auto-state applied on load) against a stable
  // reference of what the DB had before: any project that is now 'Delayed' and
  // was previously something other than 'Delayed' fires a notification.
  useMemo(() => {
    if (userRole !== 'PM') return;

    rawProjects.forEach(p => {
      const isOwner = p.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase();
      if (!isOwner || p.state !== 'Delayed') return;

      const key = `auto-delayed-${p.id}`;
      if (!notifKeysRef.current.has(key)) {
        notifKeysRef.current.add(key);
        addNotification(
          `"${p.clientName}" was automatically marked Delayed based on schedule performance. Review and update progress.`,
          p.id,
          key
        );
      }
    });
  }, [rawProjects, userRole, userName]);

  // ── No PM Assigned — Manager / Superadmin alert ───────────────────────────
  useMemo(() => {
    if (!hasRole(userRole, ['Superadmin', 'Manager'])) return;

    rawProjects.forEach(p => {
      const noPM = !p.assignedPM || p.assignedPM.trim() === '';
      if (!noPM) return;
      if (['Closed', 'Billed'].includes(p.state)) return;

      const key = `no-pm-${p.id}`;
      if (!notifKeysRef.current.has(key)) {
        notifKeysRef.current.add(key);
        addNotification(
          `"${p.clientName}" has no assigned PM — assign one before delivery starts.`,
          p.id,
          key
        );
      }
    });
  }, [rawProjects, userRole]);

  // Alias for compatibility
  const projects = rawProjects;

  const getPMWorkload = useCallback((pmName: string) => {
    const pmProjects = projects.filter(p => 
      p.assignedPM === pmName && 
      ['On-Track', 'Delayed', 'Suspended', 'Signed Off'].includes(p.state)
    );

    return {
      P1: pmProjects.filter(p => p.priority === 'P1').length,
      P2: pmProjects.filter(p => p.priority === 'P2').length,
      P3: pmProjects.filter(p => p.priority === 'P3').length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (isRole(userRole, 'PM')) {
      const normalizedUserName = userName?.trim().toLowerCase();
      return projects.filter(p => p.assignedPM?.trim().toLowerCase() === normalizedUserName);
    }
    return projects;
  }, [projects, userRole, userName]);

  const addProject = async (newProjectData: Partial<Project>, force: boolean = false) => {
    const priority = newProjectData.priority || 'P2';
    // If a PM is creating, they must be the assigned PM
    const pmName = userRole === 'PM' ? userName : (newProjectData.assignedPM || '');
    
    if (!force && pmName) {
      const workload = getPMWorkload(pmName);
      const currentCount = workload[priority];
      const maxCount = config.workloadThresholds[priority];

      if (currentCount >= maxCount && !hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead'])) {
        throw new Error(`This PM has reached their ${priority} limit (${currentCount}/${maxCount}).`);
      }
      
      if (currentCount >= maxCount && hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead'])) {
        return { warning: `PM is at limit (${currentCount}/${maxCount}). Override?` };
      }
    }

    try {
      const isInternalInitiative = newProjectData.deliveryTrack === 'Internal Initiative' || newProjectData.isInternalInitiative;
      const isCustomization = newProjectData.deliveryTrack === 'Customization';
      
      const baselineDays = (isInternalInitiative || isCustomization) ? (newProjectData.expectedDuration || 0) : (newProjectData.services || []).reduce((acc, serviceName) => {
        const baseline = config.serviceBaselines.find(sb => sb.name === serviceName);
        return acc + (baseline ? baseline.baselineDays : 0);
      }, 0);

      const expectedCompletionDate = newProjectData.expectedCompletionDate || (isInternalInitiative 
        ? new Date().toISOString().split('T')[0]
        : calculateWorkingDays(newProjectData.startDate || new Date(), baselineDays));

      const phases: Phase[] = newProjectData.phases?.length ? newProjectData.phases : [
        { id: 'Initiation', name: 'Initiation', status: 'Pending' },
        { id: 'Planning', name: 'Planning', status: 'Locked' },
        { id: 'Execution', name: 'Execution', status: 'Locked' },
        { id: 'Closure', name: 'Closure', status: 'Locked' },
      ];

      const serviceStates: Record<string, ServiceState> = {};
      if (!isInternalInitiative) {
        (newProjectData.services || []).forEach(s => {
          serviceStates[s] = 'Not Started';
        });
      }

      const productLines = (isInternalInitiative || isCustomization) ? [] : Array.from(new Set(
        config.productLines
          .filter(pl => pl.services.some(s => (newProjectData.services || []).includes(s)))
          .map(pl => pl.name)
      ));

      const newProject = await api.projects.create({
        ...newProjectData,
        assignedPM: pmName,
        productLines,
        expectedDuration: (isInternalInitiative || isCustomization) ? (newProjectData.expectedDuration || 0) : baselineDays,
        expectedCompletionDate,
        currentCompletionDate: expectedCompletionDate,
        phases,
        phaseWeights: { ...config.projectLifecycleWeights },
        serviceStates,
        state: newProjectData.state || 'On-Track',
        deliveryTrack: newProjectData.deliveryTrack || 'Standard',
        isInternalInitiative,
        rebaselineRequests: [],
        suspensionCycles: []
      });
      queryClient.setQueryData<Project[]>(['projects'], (old = []) => [newProject, ...old]);
      return newProject;
    } catch (error) {
      console.error('Failed to add project', error);
      throw error;
    }
  };

  const updateProject = async (project: Project) => {
    try {
      const oldProject = projects.find(p => p.id === project.id);
      if (!oldProject) return;

      const newActivities: ProjectActivity[] = [...(project.activities || [])];
      const now = new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

      if (oldProject.state !== project.state) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'StateChange',
          user: userName,
          description: `Changed project state from "${oldProject.state}" to "${project.state}"`,
          timestamp: now
        });

        if (project.state === 'Signed Off' && !project.signedOffAt) {
          project.signedOffAt = new Date().toISOString().split('T')[0];
        }

        const dateStr = new Date().toISOString().split('T')[0];
        const cycles = [...(project.suspensionCycles || [])];

        if (project.state === 'Suspended') {
          cycles.push({
            suspensionDate: dateStr,
            reactivationDate: null,
            frozenActiveDays: getActiveDaysCount(oldProject).days
          });
          project.suspensionCycles = cycles;
        } else if (oldProject.state === 'Suspended') {
          if (cycles.length > 0) {
            cycles[cycles.length - 1].reactivationDate = dateStr;
            project.suspensionCycles = cycles;
          }
        }

        if (project.state === 'Closed') {
          project.totalActiveDays = getActiveDaysCount(project).days;
        }
      }

      project.phases.forEach(m => {
        const oldM = oldProject.phases.find(om => om.id === m.id);
        if (oldM && oldM.status !== m.status) {
          newActivities.unshift({
            id: Math.random().toString(36).substr(2, 9),
            type: 'Phase',
            user: userName,
            description: `Updated phase "${m.name}" to "${m.status}"`,
            timestamp: now
          });
        }
      });

      if (project.risks.length > oldProject.risks.length) {
        const newestRisk = project.risks[0];
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Risk',
          user: userName,
          description: `Logged new risk: "${newestRisk.description}" (${newestRisk.impact} impact)`,
          timestamp: now
        });
      }

      project.risks.forEach(r => {
        const oldR = oldProject.risks.find(or => or.id === r.id);
        if (oldR && oldR.status !== r.status) {
          newActivities.unshift({
            id: Math.random().toString(36).substr(2, 9),
            type: 'Risk',
            user: userName,
            description: `Updated risk "${r.description}" status to "${r.status}"`,
            timestamp: now
          });
        }
      });

      if (project.comments.length > oldProject.comments.length) {
        const newestComment = project.comments[0];
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Comment',
          user: userName,
          description: `Added a comment: "${newestComment.text.substring(0, 50)}${newestComment.text.length > 50 ? '...' : ''}"`,
          timestamp: now
        });
      }

      // ── Detail-edit diff detection ────────────────────────────────
      if (oldProject.startDate !== project.startDate) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Edit',
          user: userName,
          description: `Start date changed from ${oldProject.startDate} to ${project.startDate}`,
          timestamp: now
        });
      }

      if (oldProject.expectedCompletionDate !== project.expectedCompletionDate) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Edit',
          user: userName,
          description: `Expected completion date changed from ${oldProject.expectedCompletionDate} to ${project.expectedCompletionDate}`,
          timestamp: now
        });
      }

      if (oldProject.value !== project.value) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Edit',
          user: userName,
          description: `Project value updated from ${oldProject.value.toLocaleString()} to ${project.value.toLocaleString()} ${project.currency}`,
          timestamp: now
        });
      }

      if (oldProject.priority !== project.priority) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Edit',
          user: userName,
          description: `Priority changed from ${oldProject.priority} to ${project.priority}`,
          timestamp: now
        });
      }

      if (oldProject.packageName !== project.packageName) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Edit',
          user: userName,
          description: `Package changed from "${oldProject.packageName}" to "${project.packageName}"`,
          timestamp: now
        });
      }

      // PID sign-off
      if (oldProject.pidSignedOffDate !== project.pidSignedOffDate) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'Phase',
          user: userName,
          description: project.pidSignedOffDate
            ? `PID signed off on ${project.pidSignedOffDate}`
            : `PID sign-off reversed`,
          timestamp: now
        });
      }

      const updatedProject = { 
        ...project, 
        updatedAt: new Date().toISOString().split('T')[0],
        activities: newActivities 
      };

      // Auto-sync On-Track/Delayed state — only for non-terminal states
      const terminalStates: ProjectState[] = ['Signed Off', 'Billed', 'Closed', 'Suspended'];
      if (!terminalStates.includes(updatedProject.state)) {
        const autoState = getAutoProjectState(updatedProject, config.spiThresholds);
        if (autoState !== updatedProject.state) {
          updatedProject.state = autoState;
          // Log auto state change if different from what was requested
          newActivities.unshift({
            id: Math.random().toString(36).substr(2, 9),
            type: 'StateChange',
            user: 'System',
            description: `Auto-updated status to "${autoState}" based on SPI/schedule`,
            timestamp: now
          });
          updatedProject.activities = newActivities;
        }
      }

      const oldSpi = calculateSPI(oldProject, config.spiThresholds);
      const newSpi = calculateSPI(updatedProject, config.spiThresholds);

      if (newSpi.isAnomaly && !oldSpi.isAnomaly) {
        await api.audit.addLog({
          action: 'SPI Anomaly Detected',
          user: userName,
          details: `Project "${project.clientName}" recorded unusually high SPI (${newSpi.value})`,
          timestamp: now,
          category: 'Project'
        });
      }
      
      const result = await api.projects.update(updatedProject);
      queryClient.setQueryData<Project[]>(['projects'], (old = []) => old.map(p => p.id === result.id ? result : p));
      if (selectedProject?.id === result.id) {
        setSelectedProject(result);
      }
      return result;
    } catch (error) {
      console.error('Failed to update project', error);
    }
  };

  const billProject = async (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const now = new Date();
    const formattedNow = format(now, 'yyyy-MM-dd HH:mm');

    const updatedProject: Project = {
      ...project,
      state: 'Billed',
      billedAt: format(now, 'yyyy-MM-dd'),
      activities: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'StateChange',
          user: userName,
          description: `Project marked as Billed by Finance`,
          timestamp: formattedNow
        },
        ...(project.activities || [])
      ]
    };

    const result = await updateProject(updatedProject);
    // Notify the assigned PM
    addNotification(
      `Project "${project.clientName}" has been marked as Billed by Finance`,
      projectId,
      `billed-${projectId}`
    );
    return result;
  };

  const rejectBilling = async (projectId: string, reason: string, category?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const now = new Date();
    const formattedNow = format(now, 'yyyy-MM-dd HH:mm');

    const rejection: BillingRejection = {
      id: Math.random().toString(36).substr(2, 9),
      rejectedBy: userName,
      rejectedAt: now.toISOString(),
      reason,
      category,
    };

    const updatedProject: Project = {
      ...project,
      // Keep state as Signed Off — PM re-submits to re-enter the queue
      billingRejections: [rejection, ...(project.billingRejections || [])],
      activities: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'StateChange' as const,
          user: userName,
          description: `Finance declined billing${category ? ` (${category})` : ''}: "${reason}"`,
          timestamp: formattedNow,
        },
        ...(project.activities || []),
      ],
    };

    const result = await updateProject(updatedProject);

    // Notify assigned PM
    addNotification(
      `Finance declined billing for "${project.clientName}": "${reason}". Please review and resubmit.`,
      projectId,
      `billing-rejected-${rejection.id}`
    );

    // Notify leadership (Manager / Superadmin will see it via their role-based notification)
    addNotification(
      `Finance declined billing for "${project.clientName}" · PM: ${project.assignedPM}`,
      projectId,
      `billing-rejected-mgr-${rejection.id}`
    );

    return result;
  };

  const reassignProject = async (projectId: string, newPmName: string, reason?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const previousPm = project.assignedPM;
    const now = new Date();
    const formattedNow = format(now, 'yyyy-MM-dd HH:mm');

    const updatedProject: Project = {
      ...project,
      assignedPM: newPmName,
      activities: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'System',
          user: userName,
          description: `Project reassigned from ${previousPm} to ${newPmName}${reason ? ` · Reason: ${reason}` : ''}`,
          timestamp: formattedNow
        },
        ...(project.activities || [])
      ]
    };

    return updateProject(updatedProject);
  };

  const submitRebaselineRequest = async (projectId: string, extensionDays: number, comment: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newDate = calculateWorkingDays(project.currentCompletionDate, extensionDays);

    const request: RebaselineRequest = {
      id: Math.random().toString(36).substr(2, 9),
      projectId,
      projectName: project.clientName,
      submittedBy: userName,
      extensionDays,
      pmComment: comment,
      currentCompletionDate: project.currentCompletionDate,
      newCompletionDate: newDate,
      status: 'Pending',
      submittedAt: new Date().toISOString()
    };

    const updatedProject: Project = {
      ...project,
      rebaselineRequests: [request, ...(project.rebaselineRequests || [])],
      activities: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'Rebaseline' as const,
          user: userName,
          description: `Rebaseline requested: +${extensionDays} working day${extensionDays !== 1 ? 's' : ''}. New target: ${newDate}. Reason: "${comment}"`,
          timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        },
        ...(project.activities || [])
      ]
    };

    return updateProject(updatedProject);
  };

  const approveRebaselineRequest = async (projectId: string, requestId: string, reviewerComment?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const request = project.rebaselineRequests.find(r => r.id === requestId);
    if (!request) return;

    const updatedRequests = project.rebaselineRequests.map(r => 
      r.id === requestId ? { ...r, status: 'Approved' as const, reviewedBy: userName, reviewedAt: new Date().toISOString(), reviewerComment } : r
    );

    const updatedProject: Project = {
      ...project,
      currentCompletionDate: request.newCompletionDate,
      rebaselineRequests: updatedRequests,
      activities: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'Rebaseline',
          user: userName,
          description: `Approved rebaseline request: +${request.extensionDays} days. New completion date: ${request.newCompletionDate}`,
          timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        },
        ...(project.activities || [])
      ]
    };

    return updateProject(updatedProject);
  };

  const declineRebaselineRequest = async (projectId: string, requestId: string, reviewerComment: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedRequests = project.rebaselineRequests.map(r => 
      r.id === requestId ? { ...r, status: 'Declined' as const, reviewedBy: userName, reviewedAt: new Date().toISOString(), reviewerComment } : r
    );

    const updatedProject: Project = {
      ...project,
      rebaselineRequests: updatedRequests,
      activities: [
        {
          id: Math.random().toString(36).substr(2, 9),
          type: 'Rebaseline',
          user: userName,
          description: `Declined rebaseline request. Reason: ${reviewerComment}`,
          timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        },
        ...(project.activities || [])
      ]
    };

    return updateProject(updatedProject);
  };

  const importBulkProjects = async (projectsToAdd: Partial<Project>[], projectsToUpdate: Partial<Project>[], skippedCount: number) => {
    try {
      if (projectsToAdd.length === 0 && projectsToUpdate.length === 0) return;
      
      await api.projects.createBulk(projectsToAdd, projectsToUpdate);
      
      const importedNames = [...projectsToAdd, ...projectsToUpdate].map(p => p.clientName).join(', ');

      const now = new Date();
      await api.audit.addLog({
        action: 'Bulk Import',
        user: userName,
        details: `Created: ${projectsToAdd.length} | Overwritten: ${projectsToUpdate.length} | Skipped: ${skippedCount}. Institutions: ${importedNames}`,
        timestamp: format(now, 'yyyy-MM-dd HH:mm'),
        category: 'Project'
      });

      // Refetch projects to sync
      const data = await api.projects.getAll();
      queryClient.setQueryData(['projects'], data);

      return { added: projectsToAdd.length, updated: projectsToUpdate.length };
    } catch (error) {
      console.error('Failed to import bulk projects', error);
      throw error;
    }
  };

  const allRebaselineRequests = useMemo(() => {
    return projects.flatMap(p => p.rebaselineRequests || []);
  }, [projects]);

  return {
    projects,
    filteredProjects,
    selectedProject,
    setSelectedProject,
    allRebaselineRequests,
    addProject,
    importBulkProjects,
    updateProject,
    billProject,
    rejectBilling,
    reassignProject,
    submitRebaselineRequest,
    approveRebaselineRequest,
    declineRebaselineRequest,
    getPMWorkload,
    validateStateTransition,
    notifications,
    dismissNotification,
    markAllRead,
    clearAllNotifications,
    loading,
    refreshProjects
  };
}
