export type Role = 'Superadmin' | 'Manager' | 'Team Lead' | 'PM' | 'Finance' | 'Executive';

export type ProjectState = 
  | 'On-Track' 
  | 'Delayed' 
  | 'Suspended' 
  | 'Signed Off' 
  | 'Billed' 
  | 'Closed';

export type PhaseStatus = 'Locked' | 'Pending' | 'In Progress' | 'Completed';

export type PhaseName = 'Initiation' | 'Planning' | 'Execution' | 'Closure';
export type ServiceState = 'Not Started' | 'In Progress' | 'Closed';

export interface ProjectLifecycleWeights {
  initiation: number;
  planning: number;
  execution: number;
  closure: number;
}

export type ProjectPriority = 'P1' | 'P2' | 'P3';

export interface Phase {
  id: PhaseName;
  name: PhaseName;
  completionDate?: string;
  status: PhaseStatus;
}

export type ActivityType = 'Comment' | 'Risk' | 'Phase' | 'StateChange' | 'System' | 'Rebaseline';

export interface ProjectActivity {
  id: string;
  type: ActivityType;
  user: string;
  description: string;
  timestamp: string;
}

export type ProductLine = 'Bankone' | 'Channels' | 'Recova' | 'Cluster' | 'Paypoint';

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

export interface Currency {
  code: string;
  symbol: string;
  name: string;
  isActive: boolean;
}

export interface SuspensionCycle {
  suspensionDate: string;
  reactivationDate: string | null;
  frozenActiveDays: number;
}

export interface ExecutionMilestone {
  id: string;
  name: string;
  status: ServiceState;
}

export interface MilestoneComment {
  author: string;
  text: string;
  timestamp: string;
}

export interface Project {
  id: string;
  clientName: string;
  packageName: string;
  services: string[]; // service IDs
  productLines: ProductLine[];
  assignedPM: string;
  startDate: string;
  expectedDuration: number;
  expectedCompletionDate: string;
  currentCompletionDate: string;
  value: number;
  currency: string;
  state: ProjectState;
  phases: Phase[];
  phaseWeights: ProjectLifecycleWeights;
  serviceStates: Record<string, ServiceState>; // keys are service IDs
  pidSignedOffDate?: string;
  comments: Comment[];
  risks: Risk[];
  priority: ProjectPriority;
  createdAt: string;
  updatedAt: string;
  signedOffAt?: string;
  billedAt?: string;
  activities: ProjectActivity[];
  rebaselineRequests: RebaselineRequest[];
  totalActiveDays?: number;
  suspensionCycles: SuspensionCycle[];
  isInternalInitiative?: boolean;
  milestones?: ExecutionMilestone[];
  phaseComments?: Partial<Record<PhaseName, MilestoneComment>>;
  intakeType?: 'New' | 'Old';
  actualCompletionDate?: string;
}

export interface PackageConfig {
  id: string;
  name: string;
  services: string[]; // service IDs
  weight: number;
}

export interface ProductLineConfig {
  name: ProductLine;
  services: string[]; // service IDs
}

export interface ServiceBaseline {
  id: string;
  name: string;
  baselineDays: number;
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

export interface PMScorecardWeights {
  deliveryRate: number;
  avgSpi: number;
  rebaselineRate: number;
}

export interface BrandConfig {
  themeColor: string;
  logoUrl?: string;
  companyName: string;
}

export type SettingsTab = 'performance' | 'users' | 'project' | 'priority' | 'revenue' | 'audit' | 'account' | 'brand' | 'currencies' | 'packages';

export interface AppConfig {
  spiThresholds: { onTrack: number; atRisk: number };
  atRiskThresholdDays: number;
  staleThresholdDays: number;
  currencies: Currency[];
  projectLifecycleWeights: ProjectLifecycleWeights;
  serviceBaselines: ServiceBaseline[];
  packages: PackageConfig[];
  productLines: ProductLineConfig[];
  allowPostIntakeRevenueEdit: boolean;
  workloadThresholds: Record<ProjectPriority, number>;
  brand: BrandConfig;
  pmScorecardWeights: PMScorecardWeights;
  maxImportRows: number;
  hideImportGuide: boolean;
  
  // Onboarding & Setup
  orgName?: string;
  logoUrl?: string;
  defaultCurrency?: string;
  isSetupComplete?: boolean;
  dismissedChecklistItems?: string[];
}

export interface WeightHistory {
  id: string;
  packageName: string;
  oldWeight: number;
  newWeight: number;
  updatedBy: string;
  timestamp: string;
}

export interface RebaselineRequest {
  id: string;
  projectId: string;
  projectName: string;
  submittedBy: string;
  reviewedBy?: string;
  extensionDays: number;
  pmComment: string;
  reviewerComment?: string;
  currentCompletionDate: string;
  newCompletionDate: string;
  status: 'Pending' | 'Approved' | 'Declined';
  submittedAt: string;
  reviewedAt?: string;
}

export interface RevenueTrend {
  month: string;
  intakeNGN: number;
  achievedNGN: number;
  intakeUSD: number;
  achievedUSD: number;
}

export type ImportRowStatus = 'clean' | 'error' | 'duplicate';
export type DuplicateAction = 'overwrite' | 'skip' | 'unresolved';

export interface ImportRow {
  index: number;
  clientName: string;
  packageName: string;
  assignedPM: string;
  startDate: string;
  value: string | number;
  currency: string;
  implementationPerson?: string;
  subscriptionLevel?: string;
  status: ImportRowStatus;
  errors: string[];
  duplicateAction?: DuplicateAction;
  originalData: any;
  serviceStates?: Record<string, string>;
  services?: string[];
  closureStatus?: string;
  notes?: string;
  intakeType?: 'New' | 'Old';
  currentPhase?: string;
  productLine?: string;
  expectedCompletionDate?: string;
  actualCompletionDate?: string;
}
