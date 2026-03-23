import { Project, User, AuditLog, AppConfig, WeightHistory } from '../types';
import { MOCK_PROJECTS, MOCK_USERS, MOCK_AUDIT_LOGS, INITIAL_CONFIG, MOCK_WEIGHT_HISTORY } from '../mockData';

// Simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const api = {
  projects: {
    getAll: async (): Promise<Project[]> => {
      await delay(300);
      return [...MOCK_PROJECTS];
    },
    update: async (project: Project): Promise<Project> => {
      await delay(200);
      // In a real app, this would hit a DB
      return { ...project };
    },
    create: async (projectData: Partial<Project>): Promise<Project> => {
      await delay(200);
      const newProject: Project = {
        ...projectData as any,
        id: Math.random().toString(36).substr(2, 9),
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0],
        comments: [],
        risks: [],
        activities: [
          { 
            id: Math.random().toString(36).substr(2, 9), 
            type: 'System', 
            user: 'System', 
            description: 'Project created from intake form', 
            timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
          }
        ],
      };
      MOCK_PROJECTS.unshift(newProject);
      return newProject;
    },
    createBulk: async (projectsToAdd: Partial<Project>[], projectsToUpdate: Partial<Project>[]): Promise<void> => {
      await delay(500);
      
      // Simulate atomic behavior by performing validation before modifying our array
      // In this mock setup, we just append or mutate the MOCK_PROJECTS array.
      
      // Update existing ones
      projectsToUpdate.forEach(updatedData => {
        const idx = MOCK_PROJECTS.findIndex(p => p.clientName.toLowerCase() === updatedData.clientName?.toLowerCase());
        if (idx !== -1) {
          MOCK_PROJECTS[idx] = {
            ...MOCK_PROJECTS[idx],
            ...updatedData,
            updatedAt: new Date().toISOString().split('T')[0]
          } as Project;
        }
      });

      // Insert new ones
      const now = new Date();
      const newProjects: Project[] = projectsToAdd.map((projectData) => ({
        ...projectData as any,
        id: Math.random().toString(36).substr(2, 9),
        phases: [
          { id: 'Initiation', name: 'Initiation', status: 'In Progress' },
          { id: 'Planning', name: 'Planning', status: 'Pending' },
          { id: 'Execution', name: 'Execution', status: 'Pending' },
          { id: 'Closure', name: 'Closure', status: 'Pending' }
        ],
        phaseWeights: {
          initiation: 10,
          planning: 20,
          execution: 50,
          closure: 20
        },
        rebaselineRequests: [],
        suspensionCycles: [],
        createdAt: now.toISOString().split('T')[0],
        updatedAt: now.toISOString().split('T')[0],
        comments: [],
        risks: [],
        activities: [
          { 
            id: Math.random().toString(36).substr(2, 9), 
            type: 'System', 
            user: 'System', 
            description: 'Project created from bulk import', 
            timestamp: now.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) 
          }
        ],
      }));
      
      MOCK_PROJECTS.push(...newProjects);
    }
  },
  users: {
    getAll: async (): Promise<User[]> => {
      await delay(300);
      return [...MOCK_USERS];
    }
  },
  config: {
    get: async (): Promise<AppConfig> => {
      await delay(100);
      return { ...INITIAL_CONFIG };
    },
    update: async (config: AppConfig): Promise<AppConfig> => {
      await delay(100);
      return { ...config };
    }
  },
  audit: {
    addLog: async (log: Omit<AuditLog, 'id'>) => {
      await delay(100);
      MOCK_AUDIT_LOGS.unshift({ ...log, id: Math.random().toString(36).substr(2,9) });
    },
    getLogs: async (): Promise<AuditLog[]> => {
      await delay(200);
      return [...MOCK_AUDIT_LOGS];
    }
  }
};
