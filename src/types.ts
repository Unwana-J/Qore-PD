export type Role = 'Superadmin' | 'Manager' | 'Team Lead' | 'PM' | 'Finance' | 'Executive' | 'IM' | 'IM Lead';

export type DeliveryTrack = 'Standard' | 'Customization' | 'Internal Initiative' | 'Ancillary Implementation' | 'Ancillary';

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

export type ProjectPriority = 'P1' | 'P2' | 'P3' | 'Initiative';

export interface Phase {
  id: PhaseName;
  name: PhaseName;
  completionDate?: string;
  status: PhaseStatus;
}

export type ActivityType = 'Comment' | 'Risk' | 'Phase' | 'StateChange' | 'System' | 'Rebaseline' | 'Edit' | 'Milestone';

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
  category?: string;
  createdAt: string;
}

export interface ImplementationIssue {
  id: string;
  description: string;
  impact: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Addressing' | 'Closed';
  category?: string;
  createdAt: string;
  resolvedAt?: string;
  notes?: string;
}

export interface GeneralIssue {
  id: string;
  description: string;
  impact: 'Low' | 'Medium' | 'High';
  status: 'Open' | 'Addressing' | 'Closed';
  category?: string;
  affectedServices: string[];
  affectedExtensionIds?: string[];
  notes?: string;
  loggedBy: string;
  createdAt: string;
  resolvedAt?: string;
  updatedAt: string;
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

export interface BillingRejection {
  id: string;
  rejectedBy: string;      // Finance user name
  rejectedAt: string;      // ISO timestamp
  reason: string;          // Required free text from Finance
  category?: string;       // Optional: 'Missing documentation' | 'Invoice not raised' | 'Client dispute' | 'Awaiting sign-off' | 'Other'
  resolvedAt?: string;     // Set when PM re-submits to Signed Off
}

export interface PMActivityEntry {
  pmName: string;
  projectCount: number;
  lastUpdatedDaysAgo: number; // worst (most stale) project for this PM
}

export interface DigestData {
  weekOf: string;                     // ISO date of Monday e.g. "2026-04-28"
  generatedAt: Date;
  totalActive: number;
  onTrackCount: number;
  delayedCount: number;
  suspendedCount: number;
  completedThisWeek: number;
  pmActivity: PMActivityEntry[];       // PMs with stale projects, sorted desc
  awaitingBillingCount: number;
  awaitingBillingValue: Record<string, number>; // { NGN: 4200000, ... }
  billedThisWeekCount: number;
  billedThisWeekValue: Record<string, number>;
  billingRejectionsThisWeek: number;
  pendingRebaselineCount: number;
  oldestRebaselineDays: number;
}

export interface IMDigestActivityEntry {
  imName: string;
  totalActive: number;
  completedThisWeek: number;
  overdueCount: number;
  lastUpdatedDaysAgo: number; // based on updatedAt of their extensions
}

export interface ImplementationDigestData {
  weekOf: string;                     // ISO date of Monday
  generatedAt: Date;
  totalActive: number;
  completedThisWeek: number;
  mappingRequestsPending: number;
  suspensionRequestsPending: number;
  dateExtensionRequestsPending: number;
  overdueCount: number;
  openIssuesCount: number;
  imActivity: IMDigestActivityEntry[];
  upcomingDeadlines: { 
    id: string;
    clientName: string; 
    serviceName: string; 
    targetDate: string; 
    im: string;
  }[];
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
  deliveryTrack?: DeliveryTrack;
  milestones?: ExecutionMilestone[];
  phaseComments?: Partial<Record<PhaseName, MilestoneComment>>;
  intakeType?: 'New' | 'Old';
  actualCompletionDate?: string;
  externalId?: string;
  tags?: string[];
  billingRejections?: BillingRejection[];
  implementationManager?: string;   // @deprecated – use implementationManagers
  implementationManagers?: string[]; // all approved IMs derived from service_extensions
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

export interface ServiceSubService {
  id: string;
  name: string;
  baselineDays: number;
  complexityWeight?: number; // default 1.0
  milestones?: string[];     // specific milestones for this sub-service
}

export interface ServiceBaseline {
  id: string;
  name: string;
  baselineDays: number;        // parent-level fallback duration
  complexityWeight?: number;   // parent-level fallback weight
  milestones?: string[];       // parent-level milestone steps (used when no sub-service)
  subServices?: ServiceSubService[]; // per-gateway / per-sub-service config
  /** @deprecated Use subServices instead */
  variants?: string[];
}

export interface DBNotification {
  id: string;
  user_id: string;
  message: string;
  project_id: string | null;
  implementation_id: string | null;
  type: 'Comment' | 'Mapping' | 'Status' | 'System';
  is_read: boolean;
  created_at: string;
}

// ── Service Extensions (IM-managed ancillary implementations) ─────────────────

export type ExtensionStatus = 'Not Started' | 'In Progress' | 'Completed' | 'Suspended';
export type MappingStatus = 'None' | 'Pending' | 'Approved' | 'Rejected' | 'Unmapped';

export interface IMilestone {
  name: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
}

export interface ExtensionRequest {
  newTargetDate: string;
  reason: string;
  requestedAt: string;
  requestedBy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  rejectionComment?: string;
}

export interface ExtensionHistoryEntry {
  oldTargetDate: string;
  newTargetDate: string;
  reason: string;
  approvedBy: string;
  rejectionReason?: string;
  timestamp: string;
}

export interface ServiceComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AssignmentHistoryEntry {
  from: string;
  to: string;
  reassignedBy: string;
  timestamp: string;
}

export interface SuspensionRequest {
  reason: string;
  requestedAt: string;
  requestedBy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  resolvedAt?: string;
  resolvedBy?: string;
  rejectionComment?: string;
}

export interface ReactivationRequest {
  reason: string;
  requestedAt: string;
  requestedBy: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  resolvedAt?: string;
  resolvedBy?: string;
  rejectionComment?: string;
}

export interface ServiceExtension {
  id: string;
  clientName: string;
  serviceId: string;
  serviceName: string;
  serviceVariant: string;       // display name (sub-service name or custom)
  subServiceId: string | null;  // references ServiceSubService.id
  implementationManager: string;
  startDate: string;
  targetClosureDate: string;
  baselineDays: number;         // locked at creation from sub-service or parent
  status: ExtensionStatus;
  milestones: IMilestone[];
  // Mapping
  linkedProjectId: string | null;
  mappingStatus: MappingStatus;
  mappingRequestedAt: string | null;
  mappingApprovedAt: string | null;
  mappingRejectionComment: string | null;
  mappingNotes: string | null;
  unmapComment: string | null;
  extensionRequest: ExtensionRequest | null;
  extensionHistory: ExtensionHistoryEntry[];
  assignmentHistory: AssignmentHistoryEntry[];
  suspensionRequest: SuspensionRequest | null;
  reactivationRequest: ReactivationRequest | null;
  comments: ServiceComment[];
  issues: ImplementationIssue[];
  // Metadata
  createdAt: string;
  updatedAt: string;
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

export interface BulkImportViewProps {
  users: User[];
  invites?: any[];
  projects: Project[];
  config: AppConfig;
  userRole: Role;
  userName?: string;
  mode?: 'projects' | 'implementations';
  onImportBulk: (add: Partial<Project>[], update: Partial<Project>[], skippedCount: number) => Promise<{ added: number, updated: number } | undefined>;
  onImportExtensions?: (add: Partial<ServiceExtension>[], skippedCount: number) => Promise<{ added: number } | undefined>;
  onShowToast: (message: string, type?: 'error' | 'success' | 'info') => void;
  onUpdateConfig: (updates: Partial<AppConfig>) => void;
  onClose: () => void;
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

export type SettingsTab = 'performance' | 'users' | 'project' | 'priority' | 'revenue' | 'audit' | 'account' | 'brand' | 'currencies' | 'packages' | 'integrations' | 'taxonomies';

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
  webhookSecret?: string;
  allowedRoleSwitchers?: Role[];
  maintenanceMode?: boolean;
  customTags?: { id: string; name: string; color: string }[];
  riskCategories?: string[];
  issueCategories?: string[];
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
