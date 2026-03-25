import { useState, useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Project, Role, AppConfig, ProjectPriority, ProjectActivity, ActivityType, RebaselineRequest, Phase, ServiceState, ProjectState } from '../types';
import { api } from '../lib/api';
import { calculateWorkingDays, getActiveDaysCount, calculateSPI, getAutoProjectState, isRole, hasRole } from '../lib/utils';

export function useProjects(userRole: Role, config: AppConfig, userName: string = 'User') {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; projectId: string }>>([]);

  const addNotification = (message: string, projectId: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { id, message, projectId }]);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  /**
   * Validates a manual state transition, returning an error string if invalid.
   */
  const validateStateTransition = (project: Project, newState: string): string | null => {
    const current = project.state;

    // Billed can only be set by Finance
    if (newState === 'Billed' && !isRole(userRole, 'Finance')) {
      return 'Only Finance can mark a project as Billed.';
    }
    // Closed requires Billed
    if (newState === 'Closed' && current !== 'Billed') {
      return 'Project must be Billed before it can be Closed.';
    }
    // Sign Off requires all Execution services closed
    if (newState === 'Signed Off') {
      const allClosed = project.services.length > 0 &&
        project.services.every(s => project.serviceStates?.[s] === 'Closed');
      if (!allClosed) {
        return 'All services must be closed before signing off.';
      }
    }
    // Cannot manually set auto-managed states
    if (newState === 'Delayed') {
      return 'Delayed status is set automatically by the system.';
    }
    // Closed is irreversible
    if (current === 'Closed') {
      return 'This project is closed and cannot be changed.';
    }
    return null;
  };

  const fetchProjects = useCallback(async () => {
    console.log("[Diagnostics] Starting projects sync...");
    try {
      const data = await api.projects.getAll();
      console.log(`[Diagnostics] Fetched ${data.length} projects.`);
      
      const terminalStates: ProjectState[] = ['Signed Off', 'Billed', 'Closed', 'Suspended'];
      const correctedData = data.map(p => {
        if (!terminalStates.includes(p.state)) {
           const autoState = getAutoProjectState(p, config.spiThresholds);
           if (p.state !== autoState) {
              return { ...p, state: autoState };
           }
        }
        return p;
      });

      setProjects(correctedData);
      console.log("[Diagnostics] Projects state updated.");
    } catch (error) {
      console.error('[Diagnostics] Failed to fetch projects:', error);
    } finally {
      setLoading(false);
      console.log("[Diagnostics] Projects loading set to false.");
    }
  }, [config.spiThresholds.atRisk, config.spiThresholds.onTrack]);

  useEffect(() => {
    let isMounted = true;

    const syncTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn("[Diagnostics] Projects sync timed out. Releasing UI lock.");
        setLoading(false);
      }
    }, 15000);

    fetchProjects().finally(() => clearTimeout(syncTimeout));
    
    return () => {
      isMounted = false;
      clearTimeout(syncTimeout);
    };
  }, [fetchProjects]);

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
      // PMs can only see projects assigned to them
      return projects.filter(p => p.assignedPM === userName);
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
      const isInternalInitiative = newProjectData.isInternalInitiative;
      
      const baselineDays = isInternalInitiative ? 0 : (newProjectData.services || []).reduce((acc, serviceName) => {
        const baseline = config.serviceBaselines.find(sb => sb.name === serviceName);
        return acc + (baseline ? baseline.baselineDays : 0);
      }, 0);

      const expectedCompletionDate = isInternalInitiative 
        ? (newProjectData.expectedCompletionDate || new Date().toISOString().split('T')[0])
        : calculateWorkingDays(newProjectData.startDate || new Date(), baselineDays);

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

      const productLines = isInternalInitiative ? [] : Array.from(new Set(
        config.productLines
          .filter(pl => pl.services.some(s => (newProjectData.services || []).includes(s)))
          .map(pl => pl.name)
      ));

      const newProject = await api.projects.create({
        ...newProjectData,
        assignedPM: pmName,
        productLines,
        expectedDuration: isInternalInitiative ? 0 : baselineDays,
        expectedCompletionDate,
        currentCompletionDate: expectedCompletionDate,
        phases,
        phaseWeights: { ...config.projectLifecycleWeights },
        serviceStates,
        rebaselineRequests: [],
        suspensionCycles: []
      });
      setProjects(prev => [newProject, ...prev]);
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
      setProjects(prev => prev.map(p => p.id === result.id ? result : p));
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
      projectId
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

    const updatedProject = {
      ...project,
      rebaselineRequests: [request, ...(project.rebaselineRequests || [])]
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
      setProjects(data);

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
    reassignProject,
    submitRebaselineRequest,
    approveRebaselineRequest,
    declineRebaselineRequest,
    getPMWorkload,
    validateStateTransition,
    notifications,
    dismissNotification,
    loading,
    refreshProjects: fetchProjects
  };
}
