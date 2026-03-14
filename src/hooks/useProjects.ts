import { useState, useMemo, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { Project, Role, AppConfig, ProjectPriority, ProjectActivity, ActivityType } from '../types';
import { api } from '../lib/api';

export function useProjects(userRole: Role, config: AppConfig) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProjects() {
      try {
        const data = await api.projects.getAll();
        setProjects(data);
      } catch (error) {
        console.error('Failed to fetch projects', error);
      } finally {
        setLoading(false);
      }
    }
    fetchProjects();
  }, []);

  const getPMWorkload = useCallback((pmName: string) => {
    const pmProjects = projects.filter(p => 
      p.assignedPM === pmName && 
      ['Active', 'Delayed', 'Suspended', 'Ready for Billing'].includes(p.state)
    );

    return {
      P1: pmProjects.filter(p => p.priority === 'P1').length,
      P2: pmProjects.filter(p => p.priority === 'P2').length,
      P3: pmProjects.filter(p => p.priority === 'P3').length,
    };
  }, [projects]);

  const filteredProjects = useMemo(() => {
    if (userRole === 'PM') {
      return projects.filter(p => p.assignedPM === 'Sarah Jenkins');
    }
    return projects;
  }, [projects, userRole]);

  const addProject = async (newProjectData: Partial<Project>, force: boolean = false) => {
    const priority = newProjectData.priority || 'P2';
    const pmName = newProjectData.assignedPM || '';
    
    if (!force && pmName) {
      const workload = getPMWorkload(pmName);
      const currentCount = workload[priority];
      const maxCount = config.workloadThresholds[priority];

      if (currentCount >= maxCount && !['Superadmin', 'Manager', 'Team Lead'].includes(userRole)) {
        throw new Error(`This PM has reached their ${priority} limit (${currentCount}/${maxCount}).`);
      }
      
      if (currentCount >= maxCount && ['Superadmin', 'Manager', 'Team Lead'].includes(userRole)) {
        // This will be caught by the modal to show a confirmation
        return { warning: `PM is at limit (${currentCount}/${maxCount}). Override?` };
      }
    }

    try {
      const newProject = await api.projects.create(newProjectData);
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
      const userName = userRole === 'PM' ? 'Sarah Jenkins' : 'Admin User'; // Mock user context

      // Detect State Change
      if (oldProject.state !== project.state) {
        newActivities.unshift({
          id: Math.random().toString(36).substr(2, 9),
          type: 'StateChange',
          user: userName,
          description: `Changed project state from "${oldProject.state}" to "${project.state}"`,
          timestamp: now
        });

        // Set readyForBillingAt if moving to that state
        if (project.state === 'Ready for Billing' && !project.readyForBillingAt) {
          project.readyForBillingAt = new Date().toISOString().split('T')[0];
        }
      }

      // Detect Milestone Change
      project.milestones.forEach(m => {
        const oldM = oldProject.milestones.find(om => om.id === m.id);
        if (oldM && oldM.status !== m.status) {
          newActivities.unshift({
            id: Math.random().toString(36).substr(2, 9),
            type: 'Milestone',
            user: userName,
            description: `Updated milestone "${m.name}" to "${m.status}"`,
            timestamp: now
          });
        }
      });

      // Detect New Risk
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

      // Detect Risk status change
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

      // Detect New Comment
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
    const userName = userRole === 'PM' ? 'Sarah Jenkins' : 'Admin User';

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

    return updateProject(updatedProject);
  };

  return {
    projects,
    filteredProjects,
    selectedProject,
    setSelectedProject,
    addProject,
    updateProject,
    billProject,
    getPMWorkload,
    loading
  };
}
