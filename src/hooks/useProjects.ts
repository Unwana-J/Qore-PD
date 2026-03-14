import { useState, useMemo, useEffect, useCallback } from 'react';
import { Project, Role, AppConfig, ProjectPriority } from '../types';
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

  const updateProject = async (updatedProject: Project) => {
    try {
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

  return {
    projects,
    filteredProjects,
    selectedProject,
    setSelectedProject,
    addProject,
    updateProject,
    getPMWorkload,
    loading
  };
}
