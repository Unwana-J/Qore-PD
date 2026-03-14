import { useState, useMemo, useEffect } from 'react';
import { Project, Role } from '../types';
import { api } from '../lib/api';

export function useProjects(userRole: Role) {
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

  const filteredProjects = useMemo(() => {
    if (userRole === 'PM') {
      return projects.filter(p => p.assignedPM === 'Sarah Jenkins');
    }
    return projects;
  }, [projects, userRole]);

  const addProject = async (newProjectData: Partial<Project>) => {
    try {
      const newProject = await api.projects.create(newProjectData);
      setProjects(prev => [newProject, ...prev]);
      return newProject;
    } catch (error) {
      console.error('Failed to add project', error);
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
    loading
  };
}
