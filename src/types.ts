export type Role = 'Superadmin' | 'Manager' | 'Team Lead' | 'PM' | 'Finance' | 'Executive';

export type ProjectState = 
  | 'Active' 
  | 'Delayed' 
  | 'Suspended' 
  | 'Ready for Billing' 
  | 'Billed' 
  | 'Closed';

export type MilestoneStatus = 'Pending' | 'In Progress' | 'Completed';

export interface Milestone {
  id: string;
  name: string;
  targetDate: string;
  completionDate?: string;
  status: MilestoneStatus;
}

export type ProductLine = 'Bankone' | 'Channels' | 'Recova' | 'Cluster';

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

export interface Risk {
  id: string;
  description: string;
  impact: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Addressing' | 'Closed';
  createdAt: string;
}

export interface Project {
  id: string;
  clientName: string;
  packageName: string;
  services: string[];
  productLines: ProductLine[];
  assignedPM: string;
  startDate: string;
  value: number;
  state: ProjectState;
  milestones: Milestone[];
  comments: Comment[];
  risks: Risk[];
  createdAt: string;
}

export interface PackageConfig {
  name: string;
  productLines: ProductLine[];
  weight: number;
}

export interface ProductLineConfig {
  name: ProductLine;
  services: string[];
}

export type UserStatus = 'Active' | 'Inactive' | 'Invited' | 'Expired';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  avatar?: string;
  invitedAt?: string;
  lastLogin?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  user: string;
  details: string;
  timestamp: string;
  category: 'Project' | 'Revenue' | 'User' | 'Config';
}

export interface BrandConfig {
  themeColor: string;
  logoUrl?: string;
  companyName: string;
}

export interface AppConfig {
  atRiskThresholdDays: number;
  currency: string;
  defaultMilestones: string[];
  allowPostIntakeRevenueEdit: boolean;
  brand: BrandConfig;
}

export interface WeightHistory {
  id: string;
  packageName: string;
  oldWeight: number;
  newWeight: number;
  updatedBy: string;
  timestamp: string;
}
