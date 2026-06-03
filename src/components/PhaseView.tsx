import React, { useState, useMemo, useEffect } from 'react';
import { Project, Phase, Comment, Risk, Role, RebaselineRequest, ServiceState, PackageConfig, ServiceBaseline, ServiceExtension, User as AppUser } from '../types';
import { StateBadge } from './ProjectList';
import { formatCurrency, formatCompactCurrency, cn, calculatePhaseScores, getActiveDaysCount, getValidTransitions, isRole, hasRole, getAutoProjectState, getPhaseListFromState, calculateSPI, calculateWorkingDays, resolveServiceIds, getServiceNames, getEffectiveServiceIds } from '../lib/utils';
import { api } from '../lib/api';
import { 
  Calendar, 
  User, 
  Briefcase, 
  ChevronLeft, 
  CheckCircle2, 
  Circle, 
  Clock, 
  MessageSquare, 
  Send,
  AlertTriangle,
  Plus,
  Shield,
  RefreshCw,
  X,
  Layers,
  Lock,
  Check,
  CheckCircle,
  TrendingDown,
  TrendingUp,
  Minus,
  Activity,
  Pencil,
  Save,
  Wrench,
  MapPin,
  XCircle,
  Trash2,
  Trash,
  Info
} from 'lucide-react';
import { PROJECT_STATES } from '../constants';
import { getThemeClasses } from '../lib/theme';
import { subDays, format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';

interface PhaseViewProps {
  project: Project;
  onBack: () => void;
  onUpdateProject: (project: Project) => void;
  onSubmitRebaseline: (projectId: string, days: number, comment: string) => Promise<any>;
  onApproveRebaseline: (projectId: string, requestId: string, reviewerComment?: string) => Promise<any>;
  onDeclineRebaseline: (projectId: string, requestId: string, reviewerComment: string) => Promise<any>;
  userRole: Role;
  serviceBaselines: ServiceBaseline[];
  packages?: PackageConfig[];
  themeColor?: string;
  onReassign?: () => void;
  defaultPhases?: string[];
  spiThresholds: { onTrack: number, atRisk: number };
  validateStateTransition?: (project: Project, newState: string) => string | null;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  userName?: string;
  riskCategories?: string[];
  onViewImplementation?: (ext: ServiceExtension) => void;
  onDeleteProject?: (projectId: string) => Promise<void>;
  users?: AppUser[];
}

export const PhaseView: React.FC<PhaseViewProps> = ({ 
  project: rawProject, onBack, onUpdateProject, onSubmitRebaseline, 
  onApproveRebaseline, onDeclineRebaseline, 
  userRole, currencies = [], serviceBaselines = [], packages = [], themeColor = 'teal', onReassign, defaultPhases = [],
  spiThresholds, validateStateTransition, onShowToast, userName, riskCategories = [], onViewImplementation,
  onDeleteProject,
  users = []
}) => {
  const effectiveIds = getEffectiveServiceIds(rawProject, packages, serviceBaselines);

  const queryClient = useQueryClient();

  // State variables for auto-create implementation modal
  const [showAddImplModal, setShowAddImplModal] = useState(false);
  const [newImplServiceId, setNewImplServiceId] = useState('');
  const [newImplSubServiceId, setNewImplSubServiceId] = useState<string | null>(null);
  const [newImplStartDate, setNewImplStartDate] = useState('');
  const [newImplManager, setNewImplManager] = useState('');
  const [newImplLoading, setNewImplLoading] = useState(false);
  const [newImplError, setNewImplError] = useState<string | null>(null);

  // Selectors for auto-create implementation
  const availableIMs = useMemo(() => {
    if (!users) return [];
    const list = users.filter(u => u.role === 'IM' || u.role === 'IM Lead' || u.role === 'Superadmin').map(u => u.name);
    if (rawProject.assignedPM) list.push(rawProject.assignedPM);
    if (userName) list.push(userName);
    return Array.from(new Set(list.filter(Boolean))).sort();
  }, [users, rawProject.assignedPM, userName]);

  const availableAncillaryServices = useMemo(() => {
    const isStandard = rawProject.deliveryTrack === 'Standard' || !rawProject.deliveryTrack;
    if (isStandard && rawProject.packageName) {
      const pkg = packages.find(p => p.name === rawProject.packageName);
      if (pkg) {
        return serviceBaselines.filter(sb =>
          (pkg.services || []).includes(sb.id) || (pkg.services || []).includes(sb.name)
        );
      }
      return [];
    }
    return serviceBaselines;
  }, [rawProject.deliveryTrack, rawProject.packageName, packages, serviceBaselines]);

  // Dynamic Scope Sync: Filter out services that are neither in the package nor in milestones
  // This cleans up ghost tags like "Bankone" from legacy imports.
  const syncedServiceIds = useMemo(() => {
    const pkg = packages.find(p => p.name === rawProject.packageName);
    const pkgServiceIds = pkg ? resolveServiceIds(pkg.services || [], serviceBaselines) : [];
    
    return effectiveIds.filter(id => {
      const isInPackage = pkgServiceIds.includes(id);
      const hasMilestone = (rawProject.milestones || []).some(m => m.id === id);
      // Keep if it's in the package OR if it has work (milestone) associated with it
      return isInPackage || hasMilestone;
    });
  }, [effectiveIds, packages, rawProject.packageName, rawProject.milestones, serviceBaselines]);

  // 2. Defensive fallbacks for imported legacy projects that might lack these arrays
  // Resilience Layer: Auto-initialize phases if they are missing
  const phases = (rawProject.phases && rawProject.phases.length > 0) 
    ? rawProject.phases 
    : getPhaseListFromState(
        rawProject.intakeType === 'Old' ? 'Execution' : 'Initiation',
        rawProject.state === 'Closed' || rawProject.state === 'Billed',
        rawProject.startDate,
        rawProject.actualCompletionDate
      );

  // Fresh service_states fetched on mount — ensures execution milestones reflect
  // latest IM progress even when parent component state is stale.
  const [freshServiceStates, setFreshServiceStates] = useState<Record<string, string> | null>(null);

  // Universal Milestones: Use package-default services if milestones are empty
  const getInitialMilestones = () => {
    // Prefer freshly-fetched service_states over stale prop data
    const effectiveStates = freshServiceStates ?? rawProject.serviceStates ?? {};
    const statusRank = { 'Not Started': 0, 'In Progress': 1, 'Closed': 2 };

    if (rawProject.milestones && rawProject.milestones.length > 0) {
      // Merge: if the IM's service_states has a higher status than the saved milestone,
      // use the fresh value so the PM always sees current IM progress.
      return rawProject.milestones.map(m => {
        const freshStatus = (effectiveStates[m.name] || effectiveStates[m.id]) as ServiceState | undefined;
        if (freshStatus && (statusRank[freshStatus] ?? 0) > (statusRank[m.status as ServiceState] ?? 0)) {
          return { ...m, status: freshStatus };
        }
        return m;
      });
    }
    
    // Check package or project services
    const pkg = packages.find(p => p.name === rawProject.packageName);
    const serviceIds = pkg ? pkg.services : syncedServiceIds;
    
    return serviceIds.map(sid => {
      const sb = serviceBaselines.find(b => b.id === sid);
      const name = sb ? sb.name : sid;
      return {
        id: sid,
        name: name,
        status: (effectiveStates[sid] || effectiveStates[name] || 'Not Started') as ServiceState
      };
    });
  };

  // 3. Dynamic Duration Calculation: STRICTLY derive from current configuration via IDs
  const dynamicDuration = syncedServiceIds.reduce((acc, sid) => {
    const sb = serviceBaselines.find(b => b.id === sid);
    return acc + (sb ? sb.baselineDays : 0);
  }, 0);

  const dynamicExpCompletion = rawProject.startDate 
    ? calculateWorkingDays(rawProject.startDate, dynamicDuration) 
    : (rawProject.expectedCompletionDate || rawProject.startDate);

  const project = {
    ...rawProject,
    services: syncedServiceIds,
    expectedDuration: dynamicDuration,
    expectedCompletionDate: dynamicExpCompletion,
    phases,
    milestones: getInitialMilestones(),
    risks: rawProject.risks || [],
    comments: rawProject.comments || [],
    activities: rawProject.activities || [],
    serviceStates: freshServiceStates ?? rawProject.serviceStates ?? {},
    suspensionCycles: rawProject.suspensionCycles || []
  };

  // Auto-Persist pruned scope if it changed (important for fixing ghost tags globally)
  React.useEffect(() => {
    if (JSON.stringify(rawProject.services) !== JSON.stringify(syncedServiceIds)) {
      console.log(`[Sync] Pruning ghost services for ${project.clientName}:`, 
        (rawProject.services || []).filter(id => !syncedServiceIds.includes(id)));
      onUpdateProject(project);
    }
  }, [syncedServiceIds, rawProject.services, project, onUpdateProject]);

  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [commentText, setCommentText] = useState('');
  const [isAddingRisk, setIsAddingRisk] = useState(false);
  const [newRisk, setNewRisk] = useState({ description: '', impact: 'Medium' as const, category: riskCategories[0] || 'General' });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync newRisk category if riskCategories load after mount
  React.useEffect(() => {
    if (newRisk.category === 'General' && riskCategories.length > 0) {
      setNewRisk(prev => ({ ...prev, category: riskCategories[0] }));
    }
  }, [riskCategories]);
  
  const [isRebaselineModalOpen, setIsRebaselineModalOpen] = useState(false);
  const [rebaselineDays, setRebaselineDays] = useState(1);
  const [rebaselineComment, setRebaselineComment] = useState('');
  const [isSubmittingRebaseline, setIsSubmittingRebaseline] = useState(false);

  const [isStoryPointsModalOpen, setIsStoryPointsModalOpen] = useState(false);
  const [requestedPoints, setRequestedPoints] = useState(0);
  const [pointsReason, setPointsReason] = useState('');
  const [isSubmittingPoints, setIsSubmittingPoints] = useState(false);

  const handleStoryPointsRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPoints(true);
    try {
      const defaultPoints = packages?.find(p => p.name === project.packageName)?.storyPoints || 0;
      const currentPoints = project.storyPoints || defaultPoints;

      const request = {
        requestedPoints,
        reason: pointsReason,
        requestedBy: userName || 'Project Manager',
        requestedAt: new Date().toISOString()
      };
      
      const updatedProject = {
        ...project,
        pendingStoryPointsRequest: request
      };
      
      await onUpdateProject(updatedProject);
      setIsStoryPointsModalOpen(false);
      setPointsReason('');
      onShowToast?.("Story point adjustment requested!", "success");
    } catch (err) {
      console.error(err);
      onShowToast?.("Failed to request story point adjustment", "error");
    } finally {
      setIsSubmittingPoints(false);
    }
  };

  // Additional Scope (Service Extensions)
  const [linkedExtensions, setLinkedExtensions] = useState<ServiceExtension[]>([]);
  const [extensionsLoaded, setExtensionsLoaded] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  useEffect(() => {
    if (!rawProject?.id) return;
    // Fetch extensions and fresh service_states in parallel
    Promise.all([
      api.serviceExtensions.getAll(),
      api.projects.getById(rawProject.id).catch(() => null),
    ]).then(([all, freshProject]) => {
      setLinkedExtensions(all.filter(e => e.linkedProjectId === rawProject.id));
      if (freshProject?.serviceStates) {
        setFreshServiceStates(freshProject.serviceStates);
      }
      setExtensionsLoaded(true);
    }).catch(() => setExtensionsLoaded(true));
  }, [rawProject?.id]);

  const handleAutoCreateImplementation = async () => {
    if (!newImplServiceId) {
      setNewImplError('Please select an ancillary service.');
      return;
    }
    const service = serviceBaselines.find(sb => sb.id === newImplServiceId);
    if (!service) {
      setNewImplError('Selected service not found.');
      return;
    }
    const hasSub = service.subServices && service.subServices.length > 0;
    if (hasSub && !newImplSubServiceId) {
      setNewImplError('Please select a sub-service / gateway.');
      return;
    }
    if (!newImplStartDate) {
      setNewImplError('Please select a start date.');
      return;
    }
    if (!newImplManager) {
      setNewImplError('Please select an implementation manager.');
      return;
    }

    setNewImplLoading(true);
    setNewImplError(null);

    try {
      const subService = service.subServices?.find(ss => ss.id === newImplSubServiceId);
      const effectiveBaseline = subService?.baselineDays ?? service.baselineDays ?? 0;
      const effectiveMilestones = (subService?.milestones?.length ? subService.milestones : service.milestones) ?? [];
      const effectiveDeliverables = subService?.deliverables ?? service.deliverables ?? [];
      const targetClosureDate = calculateWorkingDays(newImplStartDate, effectiveBaseline);

      const milestones = effectiveMilestones.map(m => ({
        name: m,
        completed: false,
        completedAt: null,
        completedBy: null,
      }));
      const deliverables = effectiveDeliverables.map(d => ({
        name: d,
        completed: false,
        completedAt: null,
        completedBy: null,
      }));

      const created = await api.serviceExtensions.create({
        clientName: rawProject.clientName,
        serviceId: service.id,
        serviceName: service.name,
        serviceVariant: subService?.name ?? 'Standard',
        subServiceId: subService?.id ?? null,
        baselineDays: effectiveBaseline,
        implementationManager: newImplManager,
        startDate: newImplStartDate,
        targetClosureDate: targetClosureDate,
        status: 'Not Started',
        milestones,
        deliverables,
        linkedProjectId: rawProject.id,
        mappingStatus: 'Approved',
        mappingRequestedAt: new Date().toISOString(),
        mappingApprovedAt: new Date().toISOString(),
        mappingRejectionComment: null,
        mappingNotes: 'Auto-created directly from project details page',
        unmapComment: null,
        extensionRequest: null,
        extensionHistory: [],
        assignmentHistory: [],
        suspensionRequest: null,
        reactivationRequest: null,
        cancellation: null,
        comments: [],
        issues: [],
      });

      // Update local state immediately
      setLinkedExtensions(prev => [...prev, created]);
      // Invalidate react-query cache to refresh dashboards/queues
      queryClient.invalidateQueries({ queryKey: ['serviceExtensions'] });

      // Close modal and notify
      setShowAddImplModal(false);
      onShowToast?.('Implementation auto-created and linked successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to auto-create implementation:', err);
      setNewImplError(err.message || 'Failed to auto-create implementation. Please try again.');
    } finally {
      setNewImplLoading(false);
    }
  };

  // Determine the "primary" extension per parent service — the first approved mapping
  // per serviceId on this project. Primary ones reflect on the execution milestone and
  // should NOT appear in the Additional Scope panel.
  const primaryExtensionIds = useMemo(() => {
    const primaryMap: Record<string, ServiceExtension> = {};
    linkedExtensions
      .filter(e => e.mappingStatus === 'Approved')
      .forEach(ext => {
        const existing = primaryMap[ext.serviceId];
        if (!existing) {
          primaryMap[ext.serviceId] = ext;
        } else {
          const existingTime = existing.mappingApprovedAt ? new Date(existing.mappingApprovedAt).getTime() : Infinity;
          const newTime = ext.mappingApprovedAt ? new Date(ext.mappingApprovedAt).getTime() : Infinity;
          if (newTime < existingTime) primaryMap[ext.serviceId] = ext;
        }
      });
    return new Set(Object.values(primaryMap).map(e => e.id));
  }, [linkedExtensions]);

  // Extensions to show in Additional Scope:
  // - Always include Pending (PM needs to act)
  // - Include Approved only if NOT the primary for their service
  // - Include Rejected / Unmapped for audit trail
  const additionalScopeExtensions = useMemo(() =>
    linkedExtensions.filter(ext =>
      ext.mappingStatus !== 'Approved' || !primaryExtensionIds.has(ext.id)
    ),
  [linkedExtensions, primaryExtensionIds]);

  const [phaseCommentInputs, setPhaseCommentInputs] = useState<Record<string, string>>({});
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMilestoneName, setNewMilestoneName] = useState('');

  // Inline edit state for Project Details card
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [editDraft, setEditDraft] = useState<{
    packageName: string;
    priority: string;
    value: number;
    currency: string;
    startDate: string;
    expectedCompletionDate: string;
  }>({
    packageName: project.packageName || '',
    priority: project.priority || 'P3',
    value: project.value || 0,
    currency: project.currency || 'NGN',
    startDate: project.startDate || '',
    expectedCompletionDate: project.expectedCompletionDate || '',
  });

  const handleOpenEdit = () => {
    setEditDraft({
      packageName: project.packageName || '',
      priority: project.priority || 'P3',
      value: project.value || 0,
      currency: project.currency || 'NGN',
      startDate: project.startDate || '',
      expectedCompletionDate: project.expectedCompletionDate || '',
    });
    setIsEditingDetails(true);
  };

  const handleSaveDetails = () => {
    const isInitiativeOrCustom = project.isInternalInitiative ||
      project.deliveryTrack === 'Internal Initiative' ||
      project.deliveryTrack === 'Customization';

    const packageChanged = !isInitiativeOrCustom && editDraft.packageName !== project.packageName;
    let updatedProject = {
      ...project,
      packageName: editDraft.packageName,
      priority: editDraft.priority as any,
      value: editDraft.value,
      currency: editDraft.currency,
      // Dates only editable for Initiative/Customization (Standard uses rebaseline workflow)
      ...(isInitiativeOrCustom && {
        startDate: editDraft.startDate,
        expectedCompletionDate: editDraft.expectedCompletionDate,
        currentCompletionDate: editDraft.expectedCompletionDate,
      })
    };

    if (packageChanged) {
      const newPkg = packages.find(p => p.name === editDraft.packageName);
      if (newPkg) {
        const nextServices = newPkg.services || [];
        const currentMilestones = project.milestones || [];
        
        // Sync milestones: Start fresh with new package services
        const nextMilestones = nextServices.map(sid => {
          const existing = currentMilestones.find(m => m.id === sid);
          if (existing) return existing;
          
          const sb = serviceBaselines.find(b => b.id === sid || b.name === sid);
          return {
            id: sid,
            name: sb ? sb.name : sid,
            status: 'Not Started' as const
          };
        });

        // Recalculate duration & completion
        const nextDuration = nextServices.reduce((acc, sid) => {
          const sb = serviceBaselines.find(b => b.id === sid || b.name === sid);
          return acc + (sb ? sb.baselineDays : 0);
        }, 0);
        
        const nextExpCompletion = project.startDate 
          ? calculateWorkingDays(project.startDate, nextDuration) 
          : project.expectedCompletionDate;

        updatedProject = {
          ...updatedProject,
          services: nextServices,
          milestones: nextMilestones,
          expectedDuration: nextDuration,
          expectedCompletionDate: nextExpCompletion,
          currentCompletionDate: nextExpCompletion,
          serviceStates: nextServices.reduce((acc, sid) => ({ 
            ...acc, 
            [sid]: project.serviceStates?.[sid] || 'Not Started' 
          }), {})
        };
      }
    }

    onUpdateProject(updatedProject);
    setIsEditingDetails(false);
    onShowToast?.('Project details updated', 'success');
  };

  const theme = getThemeClasses(themeColor);
  const scores = calculatePhaseScores(project);

  const isOwner = project.assignedPM?.trim().toLowerCase() === userName?.trim().toLowerCase();
  const canEdit = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']) || (isRole(userRole, 'PM') && isOwner);
  const canEditPhase = canEdit; // Relaxed for testing ease, initially restricted to Superadmin/PM

  const handleStatusChange = (newState: string) => {
    // Validate transition
    if (validateStateTransition) {
      const error = validateStateTransition(project, newState);
      if (error) {
        onShowToast?.(error, 'error');
        return;
      }
    }
    onUpdateProject({ ...project, state: newState as any });
  };

  const handleTogglePID = () => {
    if (!canEditPhase) return;
    const newDate = project.pidSignedOffDate ? undefined : new Date().toISOString().split('T')[0];
    onUpdateProject({ ...project, pidSignedOffDate: newDate });
  };

  const handleCompletePhase = (phaseId: string) => {
    if (!canEditPhase) return;
    const updatedPhases = project.phases.map(p => 
      p.id === phaseId ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
    );
    
    if (phaseId === 'Initiation') {
      const p = updatedPhases.find(x => x.id === 'Planning');
      if (p) p.status = 'In Progress';
    } else if (phaseId === 'Planning') {
      const p = updatedPhases.find(x => x.id === 'Execution');
      if (p) p.status = 'In Progress';
    } else if (phaseId === 'Execution') {
      const p = updatedPhases.find(x => x.id === 'Closure');
      if (p) p.status = 'In Progress';
    } else if (phaseId === 'Closure') {
       onUpdateProject({ ...project, phases: updatedPhases, state: 'Signed Off' });
       return;
    }

    onUpdateProject({ ...project, phases: updatedPhases });
  };

  const handleMilestoneChange = (milestoneId: string, state: ServiceState) => {
    if (!canEditPhase) return;
    const updatedMilestones = (project.milestones || []).map(m => 
      m.id === milestoneId ? { ...m, status: state } : m
    );
    const allClosed = updatedMilestones.every(m => m.status === 'Closed');
    
    let updatedPhases = [...project.phases];
    if (allClosed && updatedMilestones.length > 0) {
      updatedPhases = updatedPhases.map(p => 
        p.id === 'Execution' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure && (closure.status === 'Locked' || closure.status === 'Pending')) closure.status = 'In Progress';
    } else {
      const exec = updatedPhases.find(x => x.id === 'Execution');
      if (exec && exec.status === 'Completed') {
        exec.status = 'In Progress';
        exec.completionDate = undefined;
        const closure = updatedPhases.find(x => x.id === 'Closure');
        if (closure) closure.status = 'Locked';
      }
    }

    onUpdateProject({ ...project, milestones: updatedMilestones, phases: updatedPhases });
  };

  const handleAddMilestone = (name: string) => {
    if (!name.trim()) return;
    const next = [...(project.milestones || []), {
      id: Math.random().toString(36).substr(2, 9),
      name,
      status: 'Not Started' as const
    }];
    
    // Recalculate phase status if currently completed
    let updatedPhases = [...project.phases];
    const exec = updatedPhases.find(x => x.id === 'Execution');
    if (exec && exec.status === 'Completed') {
      exec.status = 'In Progress';
      exec.completionDate = undefined;
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure) closure.status = 'Locked';
    }

    onUpdateProject({ ...project, milestones: next, phases: updatedPhases });
    setNewMilestoneName('');
    setShowAddMilestone(false);
    onShowToast?.('Milestone added', 'success');
  };
  const handleDeleteMilestone = (id: string) => {
    // 1. Prune the services list
    const nextServices = (project.services || []).filter(sid => sid !== id);
    
    // 2. Remove from milestones
    const nextMilestones = (project.milestones || []).filter(m => m.id !== id);
    
    // 3. RECALCULATE Duration/Completion (CRITICAL for persistence)
    const nextDuration = nextServices.reduce((acc, sid) => {
      const sb = serviceBaselines.find(b => b.id === sid);
      return acc + (sb ? sb.baselineDays : 0);
    }, 0);
    
    const nextExpCompletion = rawProject.startDate 
      ? calculateWorkingDays(rawProject.startDate, nextDuration) 
      : (rawProject.expectedCompletionDate || rawProject.startDate);
    
    // 4. Check for phase completion
    const allClosed = nextMilestones.every(m => m.status === 'Closed');
    let updatedPhases = [...project.phases];
    if (allClosed && nextMilestones.length > 0) {
      updatedPhases = updatedPhases.map(p => 
        p.id === 'Execution' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure && (closure.status === 'Locked' || closure.status === 'Pending')) closure.status = 'In Progress';
    }
    
    // Persist NEWLY CALCULATED duration and services
    onUpdateProject({ 
      ...project, 
      milestones: nextMilestones, 
      services: nextServices, 
      expectedDuration: nextDuration,
      expectedCompletionDate: nextExpCompletion,
      phases: updatedPhases 
    });
  };

  const handleSavePhaseComment = (phaseId: string) => {
    const text = phaseCommentInputs[phaseId];
    if (!text?.trim()) return;

    if (phaseId === 'Closure' && project.isInternalInitiative && text.trim().length < 10) {
      onShowToast?.('Closure comment must be at least 10 characters', 'error');
      return;
    }

    const comment = {
      author: isRole(userRole, 'PM') ? project.assignedPM : 'Admin',
      text: text.trim(),
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    };

    const nextComments = { ...project.phaseComments, [phaseId]: comment };
    
    if (phaseId === 'Closure') {
      // Completion for all projects upon closure comment
      const updatedPhases = project.phases.map(p => 
        p.id === 'Closure' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      onUpdateProject({ ...project, phaseComments: nextComments, phases: updatedPhases as Phase[], state: 'Closed' });
      onShowToast?.('Project closed', 'success');
    } else {
      onUpdateProject({ ...project, phaseComments: nextComments });
    }
    
    setPhaseCommentInputs({ ...phaseCommentInputs, [phaseId]: '' });
  };

  const handleServiceChange = (service: string, state: ServiceState) => {
    if (!canEditPhase) return;
    const newStates = { ...project.serviceStates, [service]: state };
    const allServicesClosed = project.services.every(s => newStates[s] === 'Closed');
    
    let updatedPhases = [...project.phases];
    if (allServicesClosed && project.services.length > 0) {
      updatedPhases = updatedPhases.map(p => 
        p.id === 'Execution' ? { ...p, status: 'Completed', completionDate: new Date().toISOString().split('T')[0] } : p
      );
      const closure = updatedPhases.find(x => x.id === 'Closure');
      if (closure && closure.status === 'Locked') closure.status = 'Pending';
    } else {
      const exec = updatedPhases.find(x => x.id === 'Execution');
      if (exec && exec.status === 'Completed') {
        exec.status = 'In Progress';
        exec.completionDate = undefined;
        const closure = updatedPhases.find(x => x.id === 'Closure');
        if (closure) closure.status = 'Locked';
      }
    }

    onUpdateProject({ ...project, serviceStates: newStates, phases: updatedPhases });
  };

  const handleRiskStatusChange = (riskId: string, newStatus: Risk['status']) => {
    const updatedRisks = project.risks.map(r => 
      r.id === riskId ? { ...r, status: newStatus } : r
    );
    onUpdateProject({ ...project, risks: updatedRisks });
  };

  const handleRiskCategoryChange = (riskId: string, newCategory: string) => {
    const updatedRisks = (project.risks || []).map(r => 
      r.id === riskId ? { ...r, category: newCategory } : r
    );
    onUpdateProject({ ...project, risks: updatedRisks });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const comment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      author: userName || 'User',
      text: commentText,
      timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
    };

    onUpdateProject({
      ...project,
      comments: [comment, ...project.comments]
    });
    setCommentText('');
  };

  const handleAddRisk = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRisk.description.trim()) return;

    const risk: Risk = {
      id: Math.random().toString(36).substr(2, 9),
      description: newRisk.description,
      impact: newRisk.impact,
      status: 'Open',
      category: newRisk.category,
      createdAt: new Date().toISOString().split('T')[0]
    };

    onUpdateProject({
      ...project,
      risks: [risk, ...project.risks]
    });
    setNewRisk({ description: '', impact: 'Medium', category: riskCategories[0] || 'General' });
    setIsAddingRisk(false);
  };

  const handleRebaselineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rebaselineDays <= 0 || !rebaselineComment.trim()) return;

    setIsSubmittingRebaseline(true);
    try {
      await onSubmitRebaseline(project.id, rebaselineDays, rebaselineComment);
      setIsRebaselineModalOpen(false);
      setRebaselineDays(1);
      setRebaselineComment('');
    } catch (error) {
      console.error('Failed to submit rebaseline', error);
    } finally {
      setIsSubmittingRebaseline(false);
    }
  };

  const canChangeState = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead', 'Finance']) || (isRole(userRole, 'PM') && isOwner);
  const canEditDetails = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']) || (isRole(userRole, 'PM') && isOwner);
  const canReassign = hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead']);
  const canRequestRebaseline = isRole(userRole, 'PM') && isOwner;

  return (
    <div className="p-6 space-y-8 animate-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{project.clientName}</h2>
              {project.intakeType === 'New' && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-200">
                  New Project
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <StateBadge state={getAutoProjectState(project, spiThresholds)} />
              <span className="text-sm text-slate-500 font-medium">
                {project.isInternalInitiative || project.deliveryTrack === 'Internal Initiative'
                  ? 'Internal Initiative'
                  : project.deliveryTrack === 'Customization'
                    ? 'Custom Engagement'
                    : project.packageName}
              </span>
              {canReassign && (
                <button 
                  onClick={onReassign}
                  className={cn(
                    "ml-2 flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold transition-all",
                    theme.text, theme.hoverBg, "hover:text-white hover:border-transparent"
                  )}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reassign Project
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {hasRole(userRole, ['Superadmin', 'Manager']) && (
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-black hover:bg-rose-600 hover:text-white transition-all shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete Project
            </button>
          )}
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              activeTab === 'overview' ? cn(theme.bg, "text-white shadow-md") : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('activity')}
            className={cn(
              "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
              activeTab === 'activity' ? cn(theme.bg, "text-white shadow-md") : "text-slate-500 hover:bg-slate-50"
            )}
          >
            Activity Feed
          </button>
        </div>

        {/* Status Control — role-aware state machine */}
        {(() => {
          const state = project.state;
          const transitions = getValidTransitions(project, userRole);
          const isClosed = state === 'Closed';
          const isSignedOff = state === 'Signed Off' && userRole !== 'Finance';
          const canAct = !isClosed && !isSignedOff;

          if (isClosed) {
            return (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-2xl">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700">Project Closed</span>
              </div>
            );
          }

          if (isSignedOff) {
            return (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-200 bg-amber-50/50 text-amber-700 text-xs font-black uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                Awaiting Finance
              </div>
            );
          }

          if (transitions.length === 0) return null;

          return (
            <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-slate-400 uppercase ml-2">Update Status:</span>
              {transitions.map(t => (
                <button
                  key={t.value}
                  onClick={() => handleStatusChange(t.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold rounded-xl border transition-all",
                    t.value === 'Closed' ? "bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700" :
                    t.value === 'Billed' ? "bg-blue-600 text-white border-blue-700 hover:bg-blue-700" :
                    t.value === 'Signed Off' ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600" :
                    t.value === 'Suspended' ? "bg-slate-800 text-white border-slate-900 hover:bg-slate-900" :
                    t.value === 'On-Track' ? cn(theme.bg, 'text-white', theme.hoverBg) :
                    "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        })()}
      </div>
    </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {activeTab === 'overview' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Project Completion</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Overall progress based on phase completion</p>
                    </div>
                    <span 
                      className={cn("text-2xl font-black tracking-tighter", theme.text)}
                      title={`${scores.totalPercentage}% Completion`}
                    >
                      {scores.totalPercentage}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-6">
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Initiation</span>
                        <span className="sm:hidden">Init</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.initiationScore / (project.phaseWeights?.initiation || 10)) * 100}%` }}></div>
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.initiation || 10}%</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Planning</span>
                        <span className="sm:hidden">Plan</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.planningScore / (project.phaseWeights?.planning || 10)) * 100}%` }}></div>
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.planning || 10}%</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Execution</span>
                        <span className="sm:hidden">Exec</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.executionScore / (project.phaseWeights?.execution || 60)) * 100}%` }}></div>
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.execution || 60}%</span>
                    </div>
                    <div className="flex flex-col text-center">
                      <span className="text-[10px] uppercase font-black text-slate-600 truncate mb-2">
                        <span className="hidden sm:inline">Closure</span>
                        <span className="sm:hidden">Close</span>
                      </span>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                        <div className={cn("h-full transition-all duration-500", theme.bg)} style={{ width: `${(scores.closureScore / (project.phaseWeights?.closure || 20)) * 100}%` }}></div>
                      </div>
                      <span className="text-[9px] uppercase font-black text-slate-400 mt-2">{project.phaseWeights?.closure || 20}%</span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const activeStats = getActiveDaysCount(project);
                  const isVisible = userRole === 'PM' ? isOwner : userRole !== 'Stakeholder';
                  
                  if (!isVisible) return null;

                  return (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between" title="Counts working days only. Paused during any suspension periods.">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Clock className={cn("w-5 h-5", theme.text)} />
                            {activeStats.label}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium mt-1">Excludes weekends and holidays</p>
                        </div>
                      </div>
                      <div className="flex items-end gap-3 mt-auto pt-4">
                        {activeStats.isStarted ? (
                          <>
                            <span className={cn("text-4xl font-black tracking-tighter leading-none", activeStats.isSuspended ? "text-slate-400" : theme.text)}>
                              {activeStats.days}
                            </span>
                            <span className="text-sm font-bold text-slate-500 pb-1">working days</span>
                            {activeStats.isSuspended && (
                               <span className="mb-1 ml-auto text-[10px] font-black px-2 py-1 bg-slate-100 text-slate-500 uppercase tracking-widest rounded border border-slate-200">
                                 Suspended
                               </span>
                            )}
                          </>
                        ) : (
                           <span className={cn("text-lg font-black tracking-tighter", theme.text)}>
                             {activeStats.text}
                           </span>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const spiNow = calculateSPI(project, spiThresholds);
                  const isVisible = userRole === 'PM' ? isOwner : userRole !== 'Stakeholder';
                  if (!isVisible) return null;

                  const hasRebaseline = project.rebaselineRequests?.find(r => r.status === 'Approved');
                  const rebaselineLabel = hasRebaseline ? `Rebaselined ${format(new Date(hasRebaseline.reviewedAt || ''), 'MMM d')}` : null;

                  return (
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between" title={spiNow.tooltip}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <Activity className={cn("w-5 h-5", theme.text)} />
                            SPI
                          </h3>
                          <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Schedule Performance Index</p>
                        </div>
                        <span className={cn("px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest border", spiNow.color)}>
                          {spiNow.badge}
                        </span>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center my-auto">
                        <span className={cn("text-5xl font-black tracking-tighter", 
                          spiNow.badge === 'On Track' ? 'text-emerald-500' :
                          spiNow.badge === 'At Risk' ? 'text-amber-500' :
                          spiNow.badge === 'Delayed' ? 'text-red-500' : 'text-slate-400'
                        )}>
                          {spiNow.value}
                        </span>
                        {spiNow.isAnomaly && (
                           <AlertTriangle className="w-5 h-5 text-rose-500 mt-2" title="SPI is unusually high — consider reviewing completion data" />
                        )}
                        {rebaselineLabel && (
                          <span className="mt-3 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-100">
                            {rebaselineLabel}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100">
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">EV</p>
                          <p className="text-lg font-black text-slate-700">{spiNow.ev.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PV</p>
                          <p className="text-lg font-black text-slate-700">{spiNow.pv.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            {/* ── Additional Scope (Service Extensions) ───────────────────────── */}
            {(isRole(userRole, 'PM') || hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead'])) && !project.isInternalInitiative && (
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-teal-600" />
                    Ancillary Implementations
                    {additionalScopeExtensions.filter(e => e.mappingStatus === 'Pending').length > 0 && (
                      <span className="ml-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-black rounded-full">
                        {additionalScopeExtensions.filter(e => e.mappingStatus === 'Pending').length} Pending
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setNewImplServiceId('');
                      setNewImplSubServiceId(null);
                      setNewImplStartDate(project.startDate || new Date().toISOString().split('T')[0]);
                      setNewImplManager(project.assignedPM || userName || '');
                      setNewImplError(null);
                      setShowAddImplModal(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    Create Implementation
                  </button>
                </div>
                {!extensionsLoaded ? (
                  <div className="text-center py-4 text-slate-400 text-sm">Loading...</div>
                ) : additionalScopeExtensions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center">
                    <Wrench className="w-8 h-8 text-slate-400 mb-2 stroke-[1.5]" />
                    <p className="text-sm font-black text-slate-700">No Linked Implementations</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
                      No ancillary implementations are linked to this project. Create one directly below.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setNewImplServiceId('');
                        setNewImplSubServiceId(null);
                        setNewImplStartDate(project.startDate || new Date().toISOString().split('T')[0]);
                        setNewImplManager(project.assignedPM || userName || '');
                        setNewImplError(null);
                        setShowAddImplModal(true);
                      }}
                      className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                    >
                      + Create Implementation / Execution
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {additionalScopeExtensions.map(ext => {
                      const completed = ext.milestones.filter(m => m.completed).length;
                      const total = ext.milestones.length;
                      const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                      const isApproving = approvingId === ext.id;
                      const isRejecting = rejectingId === ext.id;
                      return (
                        <div key={ext.id} className={cn(
                          "p-4 rounded-2xl border transition-all",
                          ext.mappingStatus === 'Pending' ? "border-amber-200 bg-amber-50/50" :
                          ext.mappingStatus === 'Approved' ? "border-emerald-200 bg-emerald-50/30" :
                          "border-slate-100 bg-slate-50/30"
                        )}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-slate-900">{ext.serviceName}</span>
                                <span className="text-[10px] font-bold text-slate-400">({ext.serviceVariant || 'Standard'})</span>
                                <span className={cn("px-2 py-0.5 text-[10px] font-black uppercase rounded-md",
                                  ext.mappingStatus === 'Approved' ? "bg-emerald-100 text-emerald-700" :
                                  ext.mappingStatus === 'Pending' ? "bg-amber-100 text-amber-700" :
                                  "bg-slate-100 text-slate-500"
                                )}>{ext.mappingStatus}</span>
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-1">IM: {ext.implementationManager}</p>
                              {ext.mappingNotes && <p className="text-xs text-slate-500 mt-1 italic">"{ext.mappingNotes}"</p>}
                              {ext.mappingStatus === 'Approved' && total > 0 && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }}></div>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400">{completed}/{total} milestones</span>
                                </div>
                              )}
                              {onViewImplementation && (
                                <button 
                                  onClick={() => onViewImplementation(ext)}
                                  className="mt-3 px-3 py-1.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-200 transition-all flex items-center gap-1.5"
                                >
                                  <Layers className="w-3 h-3" />
                                  Manage Details
                                </button>
                              )}
                            </div>
                            {ext.mappingStatus === 'Pending' && (
                              <div className="flex gap-2 flex-shrink-0">
                                <button
                                  onClick={async () => {
                                    setApprovingId(ext.id);
                                    try {
                                      await api.serviceExtensions.approveMapping(ext.id, userName || 'System');
                                      setLinkedExtensions(prev => prev.map(e => e.id === ext.id ? { ...e, mappingStatus: 'Approved' } : e));
                                      onShowToast?.('Mapping approved.', 'success');
                                    } catch (err: any) { onShowToast?.(err.message, 'error'); }
                                    finally { setApprovingId(null); }
                                  }}
                                  disabled={isApproving}
                                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                                >{isApproving ? 'Approving...' : 'Approve'}</button>
                                <button onClick={() => setRejectingId(ext.id)} className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100">Reject</button>
                              </div>
                            )}
                          </div>
                          {isRejecting && (
                            <div className="mt-3 space-y-2 animate-in fade-in">
                              <textarea autoFocus placeholder="Reason for rejection (required)..." className="w-full px-3 py-2 bg-white border border-red-200 rounded-xl text-sm outline-none resize-none" rows={2} value={rejectComment} onChange={e => setRejectComment(e.target.value)} />
                              <div className="flex gap-2">
                                <button onClick={() => { setRejectingId(null); setRejectComment(''); }} className="px-3 py-1.5 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100">Cancel</button>
                                <button disabled={!rejectComment.trim()} onClick={async () => {
                                  try {
                                    await api.serviceExtensions.rejectMapping(ext.id, rejectComment);
                                    setLinkedExtensions(prev => prev.map(e => e.id === ext.id ? { ...e, mappingStatus: 'Rejected', linkedProjectId: null, mappingRejectionComment: rejectComment } : e));
                                    onShowToast?.('Mapping rejected.', 'success');
                                  } catch (err: any) { onShowToast?.(err.message, 'error'); }
                                  finally { setRejectingId(null); setRejectComment(''); }
                                }} className="px-3 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 disabled:opacity-50">Confirm Rejection</button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Clock className={cn("w-5 h-5", theme.text)} />
                  Phase Tracking
                </h3>
                
                <div className="space-y-8 relative before:absolute before:left-[19px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                  {project.phases.map((phase) => {
                    const isLocked = phase.status === 'Locked';
                    const isCompleted = phase.status === 'Completed';
                    const isInProgress = phase.status === 'In Progress' || phase.status === 'Pending';
                    const weight = project.phaseWeights?.[phase.id.toLowerCase() as keyof typeof project.phaseWeights] ?? (
                      phase.id === 'Initiation' ? 10 :
                      phase.id === 'Planning' ? 10 :
                      phase.id === 'Execution' ? 60 : 20
                    );
                    
                    return (
                      <div key={phase.id} className="relative pl-12 group">
                        <div className={cn(
                          "absolute left-0 top-1 w-10 h-10 rounded-full flex items-center justify-center z-10 border-4 border-white transition-all duration-300",
                          isCompleted ? "bg-emerald-500 text-white" : 
                          isInProgress ? cn(theme.bg, "text-white shadow-lg", theme.shadow) : "bg-slate-100 text-slate-400"
                        )}>
                          {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                           isLocked ? <Lock className="w-4 h-4" /> : <Clock className="w-5 h-5" />}
                        </div>
                        
                        <div className={cn(
                          "bg-slate-50 p-5 rounded-2xl border transition-all duration-300",
                          isLocked ? "border-transparent opacity-60 grayscale" : 
                          isInProgress ? cn(theme.border, theme.lightBg) : "border-slate-100 hover:border-slate-200"
                        )}>
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-exrabold text-slate-900 text-base">{phase.name}</h4>
                                <span className="text-[10px] font-black bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500 uppercase">
                                  {weight}% Weight
                                </span>
                              </div>
                              <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest",
                                isCompleted ? "text-emerald-500" :
                                isLocked ? "text-slate-400" : theme.text
                              )}>
                                {phase.status} {phase.completionDate && `• ${phase.completionDate}`}
                              </span>
                            </div>

                            {/* Phase Completion Button */}
                              {canEditPhase && !isLocked && !isCompleted && phase.id !== 'Execution' && (
                                <button
                                  onClick={() => handleCompletePhase(phase.id)}
                                  disabled={phase.id === 'Initiation' && !project.pidSignedOffDate}
                                  className={cn(
                                    "px-4 py-2 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                                    theme.bg, "text-white hover:shadow-lg"
                                  )}
                                >
                                  Mark Complete
                                </button>
                              )}
                          </div>

                          {/* Phase Specific Content */}
                          {!isLocked && (
                            <div className="bg-white rounded-xl p-4 border border-slate-100">
                              {phase.id === 'Initiation' && (
                                <div className="flex items-center justify-between">
                                  <div 
                                    className={cn("flex items-center gap-3", canEditPhase && !isCompleted && "cursor-pointer group")}
                                    onClick={() => canEditPhase && !isCompleted && handleTogglePID()}
                                  >
                                    <button 
                                      disabled={!canEditPhase || isCompleted}
                                      className={cn(
                                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors shadow-sm",
                                        project.pidSignedOffDate || isCompleted ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-300",
                                        canEditPhase && !project.pidSignedOffDate && !isCompleted ? "group-hover:border-emerald-500" : ""
                                      )}
                                    >
                                      {(project.pidSignedOffDate || isCompleted) && <Check className="w-3.5 h-3.5 text-white" />}
                                    </button>
                                    <div>
                                      <p className={cn("text-sm font-bold transition-colors flex items-center gap-2", 
                                        !isCompleted && canEditPhase ? "group-hover:text-emerald-700 text-slate-900" : "text-slate-900"
                                      )}>
                                        PID Sign-off
                                        {(isCompleted || project.pidSignedOffDate) && (
                                          <span className="text-slate-400 font-medium text-xs">Signed off · {project.pidSignedOffDate || project.startDate}</span>
                                        )}
                                      </p>
                                      <p className="text-xs text-slate-500">Must be completed before proceeding</p>
                                    </div>
                                  </div>
                                  
                                  {/* Phase Comments */}
                                  {(canEdit || !project.isInternalInitiative) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                       {project.phaseComments?.Initiation ? (
                                         <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                              {project.phaseComments.Initiation.author.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900">{project.phaseComments.Initiation.author}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{project.phaseComments.Initiation.timestamp}</span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">{project.phaseComments.Initiation.text}</p>
                                            </div>
                                         </div>
                                       ) : canEdit && !isCompleted && (
                                          <div className="flex gap-2">
                                            <input 
                                              placeholder="Initiation notes (optional)..."
                                              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-300"
                                              value={phaseCommentInputs.Initiation || ''}
                                              onChange={e => setPhaseCommentInputs({...phaseCommentInputs, Initiation: e.target.value})}
                                            />
                                            <button 
                                              onClick={() => handleSavePhaseComment('Initiation')}
                                              className={cn("p-1.5 rounded-lg text-white transition-all shadow-sm active:scale-95", theme.bg)}
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {phase.id === 'Execution' && (
                                <div className="space-y-4 pr-2 custom-scrollbar">
                                  {/* Unified: Milestones are now standard for ALL projects */}
                                  <>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                          Execution Score: {Math.round(scores.executionScore)}% / {project.phaseWeights.execution}%
                                        </span>
                                        {canEdit && !isCompleted && (
                                           <button 
                                             onClick={() => setShowAddMilestone(!showAddMilestone)}
                                             className={cn("px-3 py-1 bg-white border rounded-lg text-[10px] font-black uppercase transition-all", theme.text, theme.border, theme.hoverBg, "hover:text-white")}
                                           >
                                             {showAddMilestone ? "Cancel" : "+ Add Milestone"}
                                           </button>
                                        )}
                                      </div>
                                      
                                      {showAddMilestone && (
                                         <div className="flex gap-2 animate-in fade-in zoom-in duration-200 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                            <input 
                                              autoFocus
                                              placeholder="Milestone name..."
                                              className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1"
                                              value={newMilestoneName}
                                              onChange={e => setNewMilestoneName(e.target.value)}
                                              onKeyDown={e => e.key === 'Enter' && handleAddMilestone(newMilestoneName)}
                                            />
                                            <button 
                                              onClick={() => handleAddMilestone(newMilestoneName)}
                                              className={cn("px-4 py-1.5 text-white rounded-lg text-xs font-bold transition-all", theme.bg)}
                                            >
                                              Add
                                            </button>
                                         </div>
                                      )}

                                      <div className="space-y-2">
                                        {(project.milestones || []).length === 0 ? (
                                          <div className="p-4 border-2 border-dashed border-slate-100 rounded-xl text-center">
                                            <p className="text-xs text-slate-400 italic font-medium">At least one milestone is required. Add a milestone to continue.</p>
                                          </div>
                                        ) : (
                                          project.milestones?.map(milestone => {
                                            const weightPerMilestone = project.phaseWeights.execution / (project.milestones?.length || 1);
                                            return (
                                              <div key={milestone.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors group">
                                                <div className="flex flex-col">
                                                  <span className="text-sm font-bold text-slate-900">{milestone.name}</span>
                                                  <span className="text-[9px] font-bold text-slate-400 uppercase">Contributing {weightPerMilestone.toFixed(1)}% of 60%</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  {canEditPhase ? (
                                                    <div className="flex bg-slate-200 p-1 rounded-lg">
                                                      {(['Not Started', 'In Progress', 'Closed'] as ServiceState[]).map(s => (
                                                        <button
                                                          key={s}
                                                          onClick={() => handleMilestoneChange(milestone.id, s)}
                                                          className={cn(
                                                            "px-2.5 py-1 text-[9px] font-black uppercase tracking-widest rounded-md transition-all",
                                                            milestone.status === s 
                                                              ? s === 'Closed' ? "bg-emerald-500 text-white shadow-sm"
                                                              : s === 'In Progress' ? "bg-amber-500 text-white shadow-sm"
                                                              : "bg-slate-400 text-white shadow-sm"
                                                              : "text-slate-500 hover:text-slate-700"
                                                          )}
                                                        >
                                                          {s}
                                                        </button>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <span className={cn(
                                                      "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-lg",
                                                      milestone.status === 'Closed' ? "bg-emerald-100 text-emerald-700" :
                                                      milestone.status === 'In Progress' ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
                                                    )}>
                                                      {milestone.status}
                                                    </span>
                                                  )}
                                                  {canEdit && !isCompleted && (
                                                     <button 
                                                       onClick={() => handleDeleteMilestone(milestone.id)}
                                                       className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                     >
                                                       <X className="w-4 h-4" />
                                                     </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>
                                    </>
                                  </div>
                                )}

                            {phase.id === 'Planning' && (
                              <div className="space-y-4">
                                <p className="text-sm text-slate-500">Plan resources, create schedules, and prepare for execution.</p>
                                {canEditPhase && (
                                  <div className={cn("mt-4 pt-4 border-t border-slate-100")}>
                                     {project.phaseComments?.Planning ? (
                                         <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                              {project.phaseComments.Planning.author.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900">{project.phaseComments.Planning.author}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{project.phaseComments.Planning.timestamp}</span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">{project.phaseComments.Planning.text}</p>
                                            </div>
                                         </div>
                                       ) : canEdit && !isCompleted && (
                                          <div className="flex gap-2">
                                            <input 
                                              placeholder="Planning notes (optional)..."
                                              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-300"
                                              value={phaseCommentInputs.Planning || ''}
                                              onChange={e => setPhaseCommentInputs({...phaseCommentInputs, Planning: e.target.value})}
                                            />
                                            <button 
                                              onClick={() => handleSavePhaseComment('Planning')}
                                              className={cn("p-1.5 rounded-lg text-white transition-all shadow-sm active:scale-95", theme.bg)}
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {phase.id === 'Closure' && (
                                <div className="space-y-4">
                                  <p className="text-sm text-slate-500">Finalize documentation, hand over deliverables, and close the project.</p>
                                  {(canEdit) && (
                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                       {project.phaseComments?.Closure ? (
                                         <div className="flex gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                                              {project.phaseComments.Closure.author.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div>
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs font-bold text-slate-900">{project.phaseComments.Closure.author}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{project.phaseComments.Closure.timestamp}</span>
                                              </div>
                                              <p className="text-xs text-slate-600 leading-relaxed">{project.phaseComments.Closure.text}</p>
                                            </div>
                                         </div>
                                       ) : canEdit && !isCompleted && (
                                          <div className="flex flex-col gap-2">
                                            <textarea 
                                              placeholder="Closure notes (optional)..."
                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-slate-300 min-h-[60px]"
                                              value={phaseCommentInputs.Closure || ''}
                                              onChange={e => setPhaseCommentInputs({...phaseCommentInputs, Closure: e.target.value})}
                                            />
                                            <button 
                                              onClick={() => handleSavePhaseComment('Closure')}
                                              className={cn("self-end px-4 py-1.5 rounded-lg text-white text-xs font-bold transition-all shadow-sm active:scale-95 flex items-center gap-2", theme.bg)}
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              {project.isInternalInitiative ? "Confirm & Close Initiative" : "Save Closure Notes"}
                                            </button>
                                          </div>
                                       )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    Risks & Issues
                  </h3>
                  {canEdit && (
                    <button 
                      onClick={() => setIsAddingRisk(!isAddingRisk)}
                      className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isAddingRisk && (
                  <form onSubmit={handleAddRisk} className="mb-6 p-4 bg-red-50 rounded-2xl border border-red-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <input 
                      autoFocus
                      placeholder="Describe the risk or issue..."
                      className="w-full px-4 py-2 bg-white border border-red-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500/20"
                      value={newRisk.description}
                      onChange={e => setNewRisk({...newRisk, description: e.target.value})}
                    />
                    <div className="flex gap-3">
                      <select 
                        className="flex-1 px-3 py-2 bg-white border border-red-200 rounded-xl text-sm outline-none"
                        value={newRisk.impact}
                        onChange={e => setNewRisk({...newRisk, impact: e.target.value as any})}
                      >
                        <option value="Low">Low Impact</option>
                        <option value="Medium">Medium Impact</option>
                        <option value="High">High Impact</option>
                      </select>
                      {riskCategories.length > 0 && (
                        <select
                          className="flex-1 px-3 py-2 bg-white border border-red-200 rounded-xl text-sm outline-none"
                          value={newRisk.category}
                          onChange={e => setNewRisk({...newRisk, category: e.target.value})}
                        >
                          {riskCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      )}
                      <button type="submit" className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl text-sm">Log Risk</button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {project.risks.map(risk => (
                    <div key={risk.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{risk.description}</p>
                        <div className="flex gap-2 items-center">
                          <p className="text-[10px] text-slate-400 font-mono">Logged on {risk.createdAt}</p>
                          {risk.category && (
                            <>
                              <span className="text-slate-300 text-[10px]">•</span>
                              <span className="text-[10px] bg-slate-200/50 text-slate-500 uppercase font-black px-1.5 py-0.5 rounded tracking-widest">{risk.category}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                          risk.impact === 'High' ? "bg-red-100 text-red-700" : 
                          risk.impact === 'Medium' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {risk.impact}
                        </span>
                        {canEdit && riskCategories.length > 0 && (
                          <select 
                            value={risk.category || 'General'}
                            onChange={(e) => handleRiskCategoryChange(risk.id, e.target.value)}
                            className="text-[10px] font-bold uppercase flex items-center gap-1 bg-slate-100 border border-transparent hover:border-slate-300 rounded px-1.5 py-0.5 transition-all outline-none"
                          >
                            <option value="General">General</option>
                            {riskCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        )}
                        {canEdit ? (
                          <select 
                            value={risk.status}
                            onChange={(e) => handleRiskStatusChange(risk.id, e.target.value as any)}
                            className={cn(
                              "text-[10px] font-bold uppercase flex items-center gap-1 bg-transparent outline-none cursor-pointer border border-transparent hover:border-slate-300 rounded px-1 transition-all",
                              risk.status === 'Open' ? "text-red-500" : 
                              risk.status === 'Addressing' ? "text-amber-500" : "text-slate-400"
                            )}
                          >
                            <option value="Open">Open</option>
                            <option value="Addressing">Addressing</option>
                            <option value="Closed">Closed</option>
                          </select>
                        ) : (
                          <span className={cn(
                            "text-[10px] font-bold uppercase flex items-center gap-1",
                            risk.status === 'Open' ? "text-red-500" : 
                            risk.status === 'Addressing' ? "text-amber-500" : "text-slate-400"
                          )}>
                            <AlertTriangle className="w-3 h-3" />
                            {risk.status}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {project.risks.length === 0 && (
                    <div className="py-8 text-center text-slate-400">
                      <Shield className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm italic">No risks documented for this project.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm min-h-[500px]">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className={cn("w-5 h-5", theme.text)} />
                Activity Timeline
              </h3>
              <div className="space-y-6 relative before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {project.activities?.map((activity) => (
                  <div key={activity.id} className="relative pl-10">
                    <div className={cn(
                      "absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center z-10 border-4 border-white shadow-sm",
                      activity.type === 'StateChange' ? "bg-blue-500 text-white" :
                      activity.type === 'Phase' ? "bg-emerald-500 text-white" :
                      activity.type === 'Risk' ? "bg-red-500 text-white" :
                      activity.type === 'Comment' ? "bg-purple-500 text-white" :
                      activity.type === 'Rebaseline' ? "bg-amber-500 text-white" :
                      activity.type === 'Edit' ? "bg-indigo-500 text-white" :
                      activity.type === 'Milestone' ? "bg-teal-500 text-white" : "bg-slate-400 text-white"
                    )}>
                      {activity.type === 'StateChange' ? <RefreshCw className="w-4 h-4" /> :
                       activity.type === 'Phase' ? <CheckCircle2 className="w-4 h-4" /> :
                       activity.type === 'Risk' ? <AlertTriangle className="w-4 h-4" /> :
                       activity.type === 'Comment' ? <MessageSquare className="w-4 h-4" /> :
                       activity.type === 'Rebaseline' ? <RefreshCw className="w-4 h-4" /> :
                       activity.type === 'Edit' ? <Pencil className="w-4 h-4" /> :
                       activity.type === 'Milestone' ? <Check className="w-4 h-4" /> :
                       <Clock className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-900">{activity.user}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{activity.timestamp}</span>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 text-sm text-slate-600 leading-relaxed shadow-sm">
                        {activity.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-8">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900">Project Details</h3>
              {canEditDetails && !isEditingDetails && (
                <button
                  onClick={handleOpenEdit}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                    "bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400 hover:bg-white"
                  )}
                  title="Edit project details"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {isEditingDetails && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveDetails}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all", theme.bg)}
                  >
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditingDetails(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Assigned PM</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-900">{project.assignedPM}</p>
                </div>
              </div>

              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  {project.deliveryTrack === 'Customization' ? 'Engagement Type' : 'Package'}
                </p>
                {isEditingDetails && !project.isInternalInitiative && project.deliveryTrack !== 'Customization' && project.deliveryTrack !== 'Internal Initiative' ? (
                  <select
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.packageName}
                    onChange={e => setEditDraft(d => ({ ...d, packageName: e.target.value }))}
                  >
                    <option value="">— Select package —</option>
                    {packages.filter(p => p.name !== 'Internal Initiative').map(pkg => (
                      <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">
                    {project.deliveryTrack === 'Customization'
                      ? 'Custom Engagement'
                      : project.isInternalInitiative || project.deliveryTrack === 'Internal Initiative'
                        ? 'Internal Initiative'
                        : project.packageName || '—'}
                  </p>
                )}
              </div>

              <div className="col-span-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tier / Priority</p>
                {isEditingDetails ? (
                  <select
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.priority}
                    onChange={e => setEditDraft(d => ({ ...d, priority: e.target.value }))}
                  >
                    <option value="P1">P1 — Tier 1 Enterprise</option>
                    <option value="P2">P2 — Tier 2 Pro</option>
                    <option value="P3">P3 — Tier 3 Basic</option>
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">
                    {project.priority === 'P1' ? 'P1 — Tier 1 Enterprise' :
                     project.priority === 'P2' ? 'P2 — Tier 2 Pro' :
                     project.priority === 'P3' ? 'P3 — Tier 3 Basic' : project.priority || '—'}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Value</p>
                {isEditingDetails ? (
                  <input
                    type="number"
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.value}
                    onChange={e => setEditDraft(d => ({ ...d, value: parseFloat(e.target.value) || 0 }))}
                  />
                ) : (
                  <p 
                    className="text-sm font-semibold text-slate-900 py-1 cursor-help"
                    title={project.value > 0 ? formatCurrency(project.value, project.currency) : '0'}
                  >
                    {project.value > 0 ? formatCompactCurrency(project.value, project.currency) : '0'}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Currency</p>
                {isEditingDetails ? (
                  <select
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.currency}
                    onChange={e => setEditDraft(d => ({ ...d, currency: e.target.value }))}
                  >
                    {currencies.map(c => (
                      <option key={c.code} value={c.code}>{c.code}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-semibold text-slate-900 py-1">{project.currency}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Start Date</p>
                {isEditingDetails && (project.isInternalInitiative || project.deliveryTrack === 'Internal Initiative' || project.deliveryTrack === 'Customization') ? (
                  <input
                    type="date"
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.startDate}
                    onChange={e => setEditDraft(d => ({ ...d, startDate: e.target.value }))}
                  />
                ) : (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-900">{project.startDate}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Expected Duration</p>
                <p className="text-sm font-semibold text-slate-900">{project.expectedDuration || 0} Working Days</p>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Exp. Completion</p>
                {isEditingDetails && (project.isInternalInitiative || project.deliveryTrack === 'Internal Initiative' || project.deliveryTrack === 'Customization') ? (
                  <input
                    type="date"
                    className={cn(
                      "w-full text-sm font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 outline-none focus:ring-2 transition-all",
                      theme.ring
                    )}
                    value={editDraft.expectedCompletionDate}
                    onChange={e => setEditDraft(d => ({ ...d, expectedCompletionDate: e.target.value }))}
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-900">{project.expectedCompletionDate || project.startDate}</p>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Current Completion</p>
                <div className="flex items-center justify-between">
                  <p className={cn(
                    "text-sm font-bold",
                    project.currentCompletionDate !== project.expectedCompletionDate ? theme.text : "text-slate-900"
                  )}>
                    {project.currentCompletionDate || project.expectedCompletionDate || project.startDate}
                  </p>
                  {canRequestRebaseline && (
                    <button
                      onClick={() => setIsRebaselineModalOpen(true)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-[10px] font-bold rounded hover:bg-slate-100 transition-colors border border-slate-200",
                        theme.text
                      )}
                      title="Request Rebaseline"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="col-span-2 border-t border-slate-100 pt-3 mt-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Story Points Weight</p>
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <p className="text-sm font-semibold text-slate-900">
                      {project.storyPoints || packages?.find(p => p.name === project.packageName)?.storyPoints || 0} Points
                    </p>
                    {project.pendingStoryPointsRequest && (
                      <div className="flex items-center gap-1.5 mt-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg border border-amber-200 text-[10px] font-semibold animate-pulse">
                        <Clock className="w-3 h-3 text-amber-500" />
                        Pending adjustment: {project.pendingStoryPointsRequest.requestedPoints} PTS
                      </div>
                    )}
                  </div>
                  {(isRole(userRole, 'PM') || hasRole(userRole, ['Superadmin', 'Manager', 'Team Lead'])) && !project.pendingStoryPointsRequest && (
                    <button
                      onClick={() => {
                        const currentPoints = project.storyPoints || packages?.find(p => p.name === project.packageName)?.storyPoints || 3;
                        setRequestedPoints(currentPoints);
                        setIsStoryPointsModalOpen(true);
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-[10px] font-bold rounded-lg hover:bg-slate-100 transition-all border border-slate-200 uppercase tracking-wider",
                        theme.text
                      )}
                    >
                      Request Change
                    </button>
                  )}
                </div>
              </div>

              {project.state === 'Signed Off' && (
                <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                  <button
                    onClick={() => {
                      onShowToast?.('Reminder email sent to Finance team', 'success');
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-md shadow-slate-950/10 active:scale-95 animate-in fade-in slide-in-from-bottom-2 duration-200"
                  >
                    <Send className="w-4 h-4" />
                    Send Finance Reminder
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <MessageSquare className={cn("w-5 h-5", theme.text)} />
              Project Comments
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
              {project.comments.map(comment => (
                <div key={comment.id} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-900">{comment.author}</span>
                    <span className="text-[10px] text-slate-400">{comment.timestamp}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100">
                    <p className="text-sm text-slate-600 leading-relaxed">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {canEdit && (
              <form onSubmit={handleAddComment} className="relative">
                <input 
                  placeholder="Add a comment..."
                  className={cn(
                    "w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-2 transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                />
                <button type="submit" className={cn("absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white rounded-xl shadow-md", theme.bg)}>
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {isRebaselineModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Request Rebaseline</h2>
              <button onClick={() => setIsRebaselineModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleRebaselineSubmit} className="p-6 space-y-6">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 leading-relaxed font-medium">
                  Rebaselining should be requested for significant scope changes or unexpected delays. This request will be reviewed by your Team Lead or Manager.
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Date</label>
                  <p className="text-sm font-bold text-slate-900">{project.currentCompletionDate}</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Extension</label>
                  <div className="flex items-center gap-3">
                    <input 
                      type="number"
                      min="1"
                      className={cn("w-20 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none font-bold", theme.ring)}
                      value={rebaselineDays}
                      onChange={e => setRebaselineDays(parseInt(e.target.value) || 0)}
                    />
                    <span className="text-xs font-bold text-slate-500">Working Days</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for Extension</label>
                <textarea 
                  required
                  rows={3}
                  className={cn("w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 outline-none text-sm transition-all resize-none", theme.ring)}
                  value={rebaselineComment}
                  onChange={e => setRebaselineComment(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsRebaselineModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingRebaseline || !rebaselineComment.trim()} className={cn("flex-1 px-6 py-3 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50", theme.bg)}>
                  {isSubmittingRebaseline ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isStoryPointsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Request Story Point Adjustment</h2>
              <button onClick={() => setIsStoryPointsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleStoryPointsRequest} className="p-6 space-y-6">
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex gap-3">
                <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-indigo-700 leading-relaxed font-medium">
                  Adjust Story Points if scope is uniquely complex, requires extra customizations, or includes special services. Requests are sent directly to your Manager for review.
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested Story Points</label>
                <select 
                  className={cn("w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none font-bold text-sm", theme.ring)}
                  value={requestedPoints}
                  onChange={e => setRequestedPoints(parseInt(e.target.value) || 0)}
                >
                  {[1, 2, 3, 5, 8, 13, 20, 40, 100].map(pt => (
                    <option key={pt} value={pt}>{pt} Story Points</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason / Justification</label>
                <textarea 
                  required
                  rows={3}
                  placeholder="Describe why this project requires a customized point assignment..."
                  className={cn("w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 outline-none text-sm transition-all resize-none", theme.ring)}
                  value={pointsReason}
                  onChange={e => setPointsReason(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsStoryPointsModalOpen(false)} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingPoints || !pointsReason.trim()} className={cn("flex-1 px-6 py-3 text-white font-bold rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50", theme.bg)}>
                  {isSubmittingPoints ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto border-2 border-rose-100">
              <AlertTriangle className="w-10 h-10 text-rose-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Delete Project?</h3>
              <p className="text-sm text-slate-500 font-bold leading-relaxed px-4 uppercase tracking-wide">
                Are you sure you want to delete <span className="text-rose-600">"{project.clientName}"</span>? This action is permanent and will remove all project history.
              </p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isDeleting}
                className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  setIsDeleting(true);
                  try {
                    await onDeleteProject?.(project.id);
                    onBack();
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsDeleting(false);
                    setIsDeleteModalOpen(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
              >
                {isDeleting ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Auto-create Ancillary Implementation Modal */}
      <AnimatePresence>
        {showAddImplModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden p-8 flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Wrench className="w-6 h-6 text-teal-600" />
                    Create Implementation / Execution
                  </h3>
                  <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wide">
                    Linked to project: <span className="text-teal-600">{project.clientName}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddImplModal(false)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
                >
                  <X className="w-5 h-5 stroke-[2.5]" />
                </button>
              </div>

              {/* Modal Content / Form */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-5 -mr-1">
                {newImplError && (
                  <div className="p-4 bg-red-50 text-red-700 text-xs font-bold rounded-2xl border border-red-100 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{newImplError}</span>
                  </div>
                )}

                {/* Service Type Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Ancillary Service</label>
                  <select
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    value={newImplServiceId}
                    onChange={e => {
                      setNewImplServiceId(e.target.value);
                      setNewImplSubServiceId(null);
                    }}
                  >
                    <option value="">Select Service...</option>
                    {availableAncillaryServices.map(sb => (
                      <option key={sb.id} value={sb.id}>{sb.name}</option>
                    ))}
                  </select>
                </div>

                {/* Conditional Sub-Service Select */}
                {(() => {
                  const serviceObj = serviceBaselines.find(sb => sb.id === newImplServiceId);
                  const hasSub = serviceObj?.subServices && serviceObj.subServices.length > 0;
                  if (!hasSub) return null;
                  return (
                    <div className="space-y-1.5 animate-in fade-in duration-200">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Sub-Service / Gateway</label>
                      <select
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                        value={newImplSubServiceId || ''}
                        onChange={e => setNewImplSubServiceId(e.target.value || null)}
                      >
                        <option value="">Select Sub-Service...</option>
                        {serviceObj.subServices?.map(ss => (
                          <option key={ss.id} value={ss.id}>{ss.name}</option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {/* Start Date & Implementation Manager grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-mono"
                      value={newImplStartDate}
                      onChange={e => setNewImplStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Implementation Manager</label>
                    <select
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                      value={newImplManager}
                      onChange={e => setNewImplManager(e.target.value)}
                    >
                      <option value="">Select Manager...</option>
                      {availableIMs.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Timeline Target Closure Preview */}
                {(() => {
                  if (!newImplServiceId || !newImplStartDate) return null;
                  const serviceObj = serviceBaselines.find(sb => sb.id === newImplServiceId);
                  const subServiceObj = serviceObj?.subServices?.find(ss => ss.id === newImplSubServiceId);
                  const baselineDays = subServiceObj?.baselineDays ?? serviceObj?.baselineDays ?? 0;
                  const targetDate = calculateWorkingDays(newImplStartDate, baselineDays);
                  return (
                    <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100 flex justify-between items-center text-xs font-bold text-teal-800 shadow-sm animate-in slide-in-from-top-1">
                      <div>
                        <span>Baseline: </span>
                        <span className="text-slate-800 font-mono">{baselineDays} Working Days</span>
                      </div>
                      <div>
                        <span>Est. Closure: </span>
                        <span className="text-slate-800 font-mono">{targetDate}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Modal Footer / Submit Actions */}
              <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddImplModal(false)}
                  disabled={newImplLoading}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAutoCreateImplementation}
                  disabled={newImplLoading}
                  className="flex-1 py-3 bg-teal-600 text-white rounded-2xl font-bold hover:bg-teal-700 transition-all text-sm shadow-lg shadow-teal-100 flex items-center justify-center gap-2"
                >
                  {newImplLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Implementation'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailItem = ({ icon, label, value }: any) => (
  <div className="flex items-center gap-3">
    <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-1">{value}</p>
    </div>
  </div>
);
