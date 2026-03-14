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
        comments: [],
        risks: [],
      };
      return newProject;
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
    getLogs: async (): Promise<AuditLog[]> => {
      await delay(200);
      return [...MOCK_AUDIT_LOGS];
    }
  }
};
