import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, AlertTriangle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project, Phase, Role, ServiceBaseline, PackageConfig, ProductLineConfig, DeliveryTrack } from '../types';
import { cn, calculateWorkingDays, getPhaseListFromState, getWorkingDaysInRange } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';
import { ConfirmationModal } from './common/ConfirmationModal';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (project: Partial<Project>, force?: boolean) => Promise<any>;
  userRole: Role;
  getPMWorkload: (pmName: string) => Record<string, number>;
  workloadThresholds: Record<string, number>;
  currencies: any[];
  themeColor?: string;
  users: any[];
  importedPMs?: string[];
  serviceBaselines: ServiceBaseline[];
  packages: PackageConfig[];
  productLines: ProductLineConfig[];
  customTags?: { id: string; name: string; color: string }[];
  userName?: string;
}

const DELIVERY_TRACKS: { id: DeliveryTrack; label: string; desc: string; color: string }[] = [
  { id: 'Standard', label: 'Standard', desc: 'Package-based delivery', color: 'teal' },
  { id: 'Customization', label: 'Customization', desc: 'Ad-hoc service engagement', color: 'violet' },
  { id: 'Internal Initiative', label: 'Internal Initiative', desc: 'Internal project / no revenue', color: 'slate' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({ 
  isOpen, onClose, onSubmit, userRole, getPMWorkload, workloadThresholds, 
  themeColor = 'teal', currencies = [], users = [], importedPMs = [],
  serviceBaselines = [], packages = [], productLines = [], customTags = [],
  userName
}) => {
  const currentUserName = userRole === 'PM' ? (userName || 'Unknown PM') : 'Admin User';
  
  const [formData, setFormData] = useState({
    clientName: '',
    packageName: '',
    assignedPM: userRole === 'PM' ? currentUserName : '',
    startDate: '',
    value: '',
    currency: currencies.find(c => c.isActive)?.code || 'USD',
    priority: 'P2' as any,
    intakeType: 'New' as 'New' | 'Old',
    currentPhase: 'Initiation' as any,
    expectedCompletionDate: '',
    deliveryTrack: 'Standard' as DeliveryTrack,
    customDuration: '', // working days for Customization track
    tags: [] as string[],
  });

  const [pmSearch, setPmSearch] = useState('');
  const [showPmDropdown, setShowPmDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<{ pmName: string, load: number, limit: number } | null>(null);
  const [internalMilestones, setInternalMilestones] = useState<string[]>(['']);
  const [manualCompletionDate, setManualCompletionDate] = useState('');
  const [isCompletedAlready, setIsCompletedAlready] = useState(false);
  const [actualCompletionDate, setActualCompletionDate] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Auto-create Implementation states
  const [autoCreateImpl, setAutoCreateImpl] = useState(false);
  const [autoCreateItems, setAutoCreateItems] = useState<Array<{
    id: string;
    serviceId: string;
    subServiceId: string | null;
    startDate: string;
    manager: string;
  }>>([]);

  const isStandard = formData.deliveryTrack === 'Standard';
  const isCustomization = formData.deliveryTrack === 'Customization';
  const isInitiative = formData.deliveryTrack === 'Internal Initiative';

  // Sync implementation startDates with project startDate
  useEffect(() => {
    if (formData.startDate) {
      setAutoCreateItems(prev =>
        prev.map(item => ({ ...item, startDate: formData.startDate }))
      );
    }
  }, [formData.startDate]);

  // Sync implementation managers with project's assigned PM
  useEffect(() => {
    if (formData.assignedPM) {
      setAutoCreateItems(prev =>
        prev.map(item => ({ ...item, manager: formData.assignedPM }))
      );
    }
  }, [formData.assignedPM]);

  // Active list of selectable IMs for auto-creation
  const availableIMs = React.useMemo(() => {
    const list = users.filter(u => u.role === 'IM' || u.role === 'IM Lead').map(u => u.name);
    if (formData.assignedPM) list.push(formData.assignedPM);
    if (currentUserName) list.push(currentUserName);
    return Array.from(new Set(list.filter(Boolean))).sort();
  }, [users, formData.assignedPM, currentUserName]);

  // Compute allowed services based on selected package (Standard track only)
  const availableAncillaryServices = React.useMemo(() => {
    if (isStandard && formData.packageName) {
      const pkg = packages.find(p => p.name === formData.packageName);
      if (pkg) {
        return serviceBaselines.filter(sb =>
          pkg.services.includes(sb.id) || pkg.services.includes(sb.name)
        );
      }
      return [];
    }
    return serviceBaselines;
  }, [isStandard, formData.packageName, packages, serviceBaselines]);

  // Reset selected service/sub-service if it's no longer available
  useEffect(() => {
    setAutoCreateItems(prev =>
      prev.map(item => {
        if (item.serviceId && !availableAncillaryServices.some(sb => sb.id === item.serviceId)) {
          return { ...item, serviceId: '', subServiceId: null };
        }
        return item;
      })
    );
  }, [availableAncillaryServices]);

  const theme = getThemeClasses(themeColor);

  const profilePMs = users.filter(u => u.role === 'PM' && u.status === 'Active');
  const allPMInfo = [
    ...profilePMs.map(u => ({ id: u.id, name: u.name, hasAccount: true, status: u.status })),
    ...importedPMs
      .filter(name => !profilePMs.some(p => p.name.toLowerCase() === name.toLowerCase()))
      .map(name => ({ id: `imported-${name}`, name, hasAccount: false, status: 'Inactive' }))
  ];
  const filteredPMs = allPMInfo.filter(pm => pm.name.toLowerCase().includes(pmSearch.toLowerCase()));

  // Reset form state when track changes
  useEffect(() => {
    setSelectedServices([]);
    setFormData(prev => ({ ...prev, packageName: '', customDuration: '', tags: [] }));
    setInternalMilestones(['']);
    setManualCompletionDate('');
  }, [formData.deliveryTrack]);

  // Auto-populate services when package is selected (Standard track only)
  useEffect(() => {
    if (isStandard && formData.packageName) {
      const pkg = packages.find(p => p.name === formData.packageName);
      if (pkg) setSelectedServices(pkg.services);
    } else if (!isStandard) {
      // no-op — managed by track change effect above
    }
  }, [formData.packageName, packages, isStandard]);

  // Packages list excludes Internal Initiative (it moved to Delivery Track)
  const availablePackages = packages.filter(p => p.name !== 'Internal Initiative');

  const getServiceName = (idOrName: string) => {
    const service = serviceBaselines.find(sb => sb.id === idOrName || sb.name === idOrName);
    return service ? service.name : idOrName;
  };

  // Standard: duration from selected services' baselines
  const standardDuration = selectedServices.reduce((acc, sid) => {
    const baseline = serviceBaselines.find(sb => sb.id === sid);
    return acc + (baseline ? baseline.baselineDays : 0);
  }, 0);

  // Customization: duration from manual input
  const customDurationDays = parseInt(formData.customDuration) || 0;

  const activeDuration = isCustomization ? customDurationDays : standardDuration;

  const expectedEndDate = formData.startDate && activeDuration > 0
    ? calculateWorkingDays(formData.startDate, activeDuration)
    : null;

  const toggleService = (serviceId: string) => {
    if (isCustomization) {
      // Free selection from all service baselines
      setSelectedServices(prev =>
        prev.includes(serviceId) ? prev.filter(s => s !== serviceId) : [...prev, serviceId]
      );
      return;
    }
    // Standard: restrict to package
    const pkg = packages.find(p => p.name === formData.packageName);
    if (!pkg) { setError('Please select a package first.'); return; }
    if (!pkg.services.includes(serviceId)) {
      setError(`Service '${getServiceName(serviceId)}' is not part of ${pkg.name}.`);
      return;
    }
    setSelectedServices(prev =>
      prev.includes(serviceId) ? prev.filter(s => s !== serviceId) : [...prev, serviceId]
    );
  };

  const addMilestoneField = () => setInternalMilestones([...internalMilestones, '']);
  const removeMilestoneField = (index: number) => setInternalMilestones(internalMilestones.filter((_, i) => i !== index));
  const updateMilestoneValue = (index: number, val: string) => {
    const next = [...internalMilestones];
    next[index] = val;
    setInternalMilestones(next);
  };

  if (!isOpen) return null;

  const canCreate = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead' || userRole === 'PM';
  if (!canCreate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 mb-6">Your role does not have permission to create projects.</p>
          <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">Close</button>
        </div>
      </div>
    );
  }

  if (isOpen && userRole === 'PM' && (serviceBaselines || []).length === 0) {
    return (
      <div className="fixed inset-0 z-[150] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto border-2 border-amber-100">
            <AlertTriangle className="w-10 h-10 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">Project Creation Blocked</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">Projects cannot be created until your admin has configured service types. Please contact your Super Admin or Manager.</p>
          </div>
          <button type="button" onClick={onClose} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all font-bold">Acknowledge</button>
        </motion.div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    setError(null);
    setWarning(null);

    // --- Validation ---
    if (isInitiative) {
      if (internalMilestones.length === 0 || internalMilestones.some(m => !m.trim())) {
        setError('At least one milestone name is required for Internal Initiatives');
        return;
      }
      if (!manualCompletionDate) {
        setError('Please set a completion date for the initiative');
        return;
      }
    } else if (isCustomization) {
      if (internalMilestones.length === 0 || internalMilestones.some(m => !m.trim())) {
        setError('At least one execution milestone is required for Customization projects');
        return;
      }
      if (!formData.customDuration || customDurationDays <= 0) {
        setError('Please enter a valid expected duration in working days');
        return;
      }
    } else {
      // Standard
      if (!formData.value) {
        setError('Project value is required');
        return;
      }
    }

    // Validate auto-created implementations if toggled
    if (autoCreateImpl && !isInitiative) {
      if (autoCreateItems.length === 0) {
        setError('Please add at least one ancillary service implementation.');
        return;
      }
      for (let i = 0; i < autoCreateItems.length; i++) {
        const item = autoCreateItems[i];
        if (!item.serviceId) {
          setError(`Please select an ancillary service for Implementation #${i + 1}.`);
          return;
        }
        const service = availableAncillaryServices.find(sb => sb.id === item.serviceId);
        const hasSub = (service?.subServices?.length ?? 0) > 0;
        if (hasSub && !item.subServiceId) {
          setError(`Please select a sub-service / gateway for Implementation #${i + 1}.`);
          return;
        }
        if (!item.startDate) {
          setError(`Please select a start date for Implementation #${i + 1}.`);
          return;
        }
        if (!item.manager) {
          setError(`Please select an Implementation Manager for Implementation #${i + 1}.`);
          return;
        }
      }
    }

    try {
      const isOld = formData.intakeType === 'Old';
      let expectedCompletionDate: string;
      let baselineDays: number;
      let currentState = 'On-Track' as any;

      if (isOld) {
        if (!formData.expectedCompletionDate) {
          setError('Expected Completion Date is required for older projects');
          return;
        }
        baselineDays = getWorkingDaysInRange(formData.startDate, formData.expectedCompletionDate, true);
        expectedCompletionDate = formData.expectedCompletionDate;
        if (isCompletedAlready) {
          if (!actualCompletionDate) {
            setError('Actual Completion Date is required for completed projects');
            return;
          }
          currentState = 'Closed';
        }
      } else if (isInitiative) {
        baselineDays = 0;
        expectedCompletionDate = manualCompletionDate;
      } else if (isCustomization) {
        baselineDays = customDurationDays;
        expectedCompletionDate = expectedEndDate || formData.startDate;
      } else {
        // Standard
        baselineDays = standardDuration;
        expectedCompletionDate = expectedEndDate || formData.startDate;
      }

      const milestonesForInitiativeOrCustom = (isInitiative || isCustomization)
        ? internalMilestones.map(m => ({
            id: Math.random().toString(36).substr(2, 9),
            name: m,
            status: 'Not Started' as const,
          }))
        : undefined;

      const result = await onSubmit({
        ...formData,
        deliveryTrack: formData.deliveryTrack,
        isInternalInitiative: isInitiative,
        priority: isInitiative ? 'Initiative' : formData.priority,
        packageName: isCustomization ? 'Custom Engagement' : (isInitiative ? 'Internal Initiative' : formData.packageName),
        value: formData.value ? Number(formData.value) : 0,
        services: isInitiative ? [] : selectedServices,
        expectedDuration: baselineDays,
        expectedCompletionDate,
        currentCompletionDate: expectedCompletionDate,
        milestones: milestonesForInitiativeOrCustom,
        currency: formData.currency,
        state: currentState,
        comments: [],
        phases: isOld ? getPhaseListFromState(
          formData.currentPhase,
          isCompletedAlready,
          formData.startDate,
          actualCompletionDate
        ) : [],
        risks: [],
        tags: formData.tags,
        actualCompletionDate: isCompletedAlready ? actualCompletionDate : undefined,
        phaseWeights: { initiation: 10, planning: 10, execution: 60, closure: 20 },
        // Extra fields for auto-create implementation
        autoCreateImplementation: autoCreateImpl,
        autoCreateItems: autoCreateImpl ? autoCreateItems : []
      } as any, force);

      if (result?.warning) {
        setWarning(result.warning);
        return;
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <ConfirmationModal
        isOpen={!!confirmationData}
        onClose={() => setConfirmationData(null)}
        onConfirm={() => {
          if (confirmationData) {
            setFormData({ ...formData, assignedPM: confirmationData.pmName });
            setPmSearch('');
            setShowPmDropdown(false);
          }
        }}
        title="Workload Warning"
        message={confirmationData ? `${confirmationData.pmName} is at ${formData.priority} limit (${confirmationData.load}/${confirmationData.limit}). This could lead to delivery delays. Assign anyway?` : ''}
        confirmLabel="Assign Anyway"
        cancelLabel="Choose Another"
        variant="warning"
        themeColor={themeColor}
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">Create New Project</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar">

            {/* Intake Type Toggle */}
            <div className="flex p-1 bg-slate-100 rounded-2xl w-fit mb-2">
              <button type="button" onClick={() => setFormData({ ...formData, intakeType: 'New' })}
                className={cn("px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all", formData.intakeType === 'New' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                New Intake
              </button>
              <button type="button" onClick={() => setFormData({ ...formData, intakeType: 'Old' })}
                className={cn("px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl transition-all", formData.intakeType === 'Old' ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600")}>
                Older Project
              </button>
            </div>

            {/* Row 1: Client Name + Delivery Track */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  {isInitiative ? 'Initiative Name' : 'Client Name'}
                </label>
                <div className="flex flex-col gap-2">
                  <input
                    required
                    className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                    value={formData.clientName}
                    onChange={e => setFormData({ ...formData, clientName: e.target.value })}
                  />
                  {isInitiative && (
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 self-start">
                      Internal Initiative — no revenue tracked
                    </span>
                  )}
                  {isCustomization && (
                    <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 self-start">
                      Custom Engagement — free service selection
                    </span>
                  )}
                </div>
              </div>

              {/* Delivery Track */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Delivery Track</label>
                <div className="grid grid-cols-3 gap-2">
                  {DELIVERY_TRACKS.map(track => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, deliveryTrack: track.id })}
                      className={cn(
                        "flex flex-col items-center justify-center p-2.5 rounded-xl border-2 text-center transition-all",
                        formData.deliveryTrack === track.id
                          ? track.id === 'Standard'
                            ? "border-teal-500 bg-teal-50 text-teal-700"
                            : track.id === 'Customization'
                              ? "border-violet-500 bg-violet-50 text-violet-700"
                              : "border-slate-600 bg-slate-100 text-slate-700"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider leading-tight">{track.label}</span>
                      <span className="text-[9px] font-medium opacity-70 mt-0.5 leading-none">{track.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: PM + Priority */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-500 uppercase">Assigned PM</label>
                {userRole === 'PM' ? (
                  <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold">{formData.assignedPM}</div>
                ) : (
                  <div className="relative">
                    <input
                      required
                      placeholder="Search PM..."
                      className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                      value={pmSearch || formData.assignedPM}
                      onChange={e => {
                        setPmSearch(e.target.value);
                        setShowPmDropdown(true);
                        if (formData.assignedPM) setFormData({ ...formData, assignedPM: '' });
                      }}
                      onFocus={() => setShowPmDropdown(true)}
                    />
                    {showPmDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] max-h-60 overflow-y-auto">
                        {filteredPMs.length > 0 ? filteredPMs.map(pm => {
                          const activePriority = isInitiative ? 'Initiative' : formData.priority;
                          const workload = getPMWorkload(pm.name);
                          const currentLoad = workload[activePriority as keyof typeof workload] || 0;
                          const assignedPmUser = users.find(u => u.id === pm.id || u.name === pm.name);
                          const pmThresholds = assignedPmUser?.workloadThresholds || workloadThresholds;
                          const limit = pmThresholds[activePriority as keyof typeof pmThresholds] || workloadThresholds[activePriority as keyof typeof workloadThresholds] || 20;
                          const isAtLimit = currentLoad >= limit;
                          return (
                            <button key={pm.id} type="button"
                              className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                              onClick={() => {
                                if (isAtLimit) {
                                  setConfirmationData({ pmName: pm.name, load: currentLoad, limit });
                                } else {
                                  setFormData({ ...formData, assignedPM: pm.name });
                                  setPmSearch('');
                                  setShowPmDropdown(false);
                                }
                              }}>
                              <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{pm.name}</span>
                                  {!pm.hasAccount && <span className="text-[9px] font-black bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">Imported</span>}
                                </div>
                                {isAtLimit && <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-wider">At Limit</span>}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[9px] font-bold text-slate-400">
                                <span className={cn(activePriority === 'P1' && "text-slate-600")}>Tier 1: {workload.P1}/{(assignedPmUser?.workloadThresholds?.P1 ?? workloadThresholds.P1)}</span>
                                <span className={cn(activePriority === 'P2' && "text-slate-600")}>Tier 2: {workload.P2}/{(assignedPmUser?.workloadThresholds?.P2 ?? workloadThresholds.P2)}</span>
                                <span className={cn(activePriority === 'P3' && "text-slate-600")}>Tier 3: {workload.P3}/{(assignedPmUser?.workloadThresholds?.P3 ?? workloadThresholds.P3)}</span>
                                {isInitiative && <span className="text-slate-600">Initiative: {workload.Initiative}/{(assignedPmUser?.workloadThresholds?.Initiative ?? workloadThresholds.Initiative)}</span>}
                              </div>
                            </button>
                          );
                        }) : <div className="px-4 py-3 text-sm text-slate-400 italic">No PMs found</div>}
                      </div>
                    )}
                    {showPmDropdown && <div className="fixed inset-0 z-[55]" onClick={() => setShowPmDropdown(false)} />}
                  </div>
                )}
              </div>

              {!isInitiative && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
                  <select required
                    className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                    value={formData.priority}
                    onChange={e => setFormData({ ...formData, priority: e.target.value as any })}>
                    <option value="P1">Tier 1 - Enterprise</option>
                    <option value="P2">Tier 2 - Pro</option>
                    <option value="P3">Tier 3 - Basic</option>
                  </select>
                </div>
              )}
            </div>

            {/* Custom Tags Section */}
            {customTags.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Project Tags <span className="text-normal lowercase font-medium">(optional)</span></label>
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  {customTags.map(tag => {
                    const isSelected = formData.tags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => {
                           setFormData({
                             ...formData,
                             tags: isSelected ? formData.tags.filter(t => t !== tag.id) : [...formData.tags, tag.id]
                           });
                        }}
                        className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold transition-all border",
                          isSelected 
                            ? `bg-${tag.color}-100 text-${tag.color}-700 border-${tag.color}-300 shadow-sm` 
                            : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Row 3: Package (Standard only) or empty placeholder */}
            {isStandard && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Package</label>
                <select required
                  className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                  value={formData.packageName}
                  onChange={e => setFormData({ ...formData, packageName: e.target.value })}>
                  <option value="">Select a package</option>
                  {availablePackages.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            )}

            {/* Row 4: Start Date + Project Value */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                <input required type="date"
                  className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                  value={formData.startDate}
                  onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>

              {/* Project value: required for Standard, optional for Customization, hidden for Initiative */}
              {!isInitiative && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Project Value {isCustomization && <span className="text-slate-400 normal-case font-medium">(optional)</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      required={isStandard}
                      type="number"
                      placeholder="0.00"
                      className={cn("flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all font-mono", theme.ring, theme.focusBorder)}
                      value={formData.value}
                      onChange={e => setFormData({ ...formData, value: e.target.value })}
                    />
                    <select required
                      className={cn("w-36 flex-shrink-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all font-bold", theme.ring, theme.focusBorder)}
                      value={formData.currency}
                      onChange={e => setFormData({ ...formData, currency: e.target.value })}>
                      {currencies.filter(c => c.isActive).map(c => (
                        <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Customization: Expected Duration input */}
            {isCustomization && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Expected Duration (Working Days)</label>
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="e.g. 45"
                  className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all font-mono", theme.ring, theme.focusBorder)}
                  value={formData.customDuration}
                  onChange={e => setFormData({ ...formData, customDuration: e.target.value })}
                />
              </div>
            )}

            {/* Manual Completion Date: Initiative or Old project */}
            {(isInitiative || formData.intakeType === 'Old') && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  {isInitiative ? 'Completion Date' : 'Expected Completion Date'}
                </label>
                <input
                  required
                  type="date"
                  className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                  value={isInitiative ? manualCompletionDate : formData.expectedCompletionDate}
                  onChange={e => isInitiative
                    ? setManualCompletionDate(e.target.value)
                    : setFormData({ ...formData, expectedCompletionDate: e.target.value })}
                />
              </div>
            )}

            {/* Starting Phase for Old projects */}
            {formData.intakeType === 'Old' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Starting Phase</label>
                <div className="flex flex-col gap-3">
                  <select required
                    className={cn("w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                    value={formData.currentPhase}
                    onChange={e => setFormData({ ...formData, currentPhase: e.target.value as any })}>
                    <option value="Initiation">Initiation</option>
                    <option value="Planning">Planning</option>
                    <option value="Execution">Execution</option>
                    <option value="Closure">Closure</option>
                  </select>

                  {formData.currentPhase === 'Closure' && (
                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isCompletedAlready} onChange={e => setIsCompletedAlready(e.target.checked)}
                          className="w-4 h-4 rounded text-amber-600 border-slate-300 focus:ring-amber-500" />
                        <span className="text-xs font-bold text-amber-800">Is this project already completed?</span>
                      </label>
                      {isCompletedAlready && (
                        <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                          <label className="text-[10px] font-black text-amber-600 uppercase">Actual Completion Date</label>
                          <input type="date" required={isCompletedAlready}
                            className="w-full px-3 py-2 bg-white border border-amber-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 outline-none"
                            value={actualCompletionDate}
                            onChange={e => setActualCompletionDate(e.target.value)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Duration / End Date summary (Standard and Customization) */}
            {!isInitiative && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expected Duration</label>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Clock className={cn("w-4 h-4", theme.text)} />
                    <span className="text-sm font-bold">
                      {isCustomization ? (customDurationDays > 0 ? `${customDurationDays} Working Days` : '—') : `${standardDuration} Working Days`}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exp. End Date</label>
                  <div className="flex items-center gap-2 text-slate-900">
                    <Calendar className={cn("w-4 h-4", theme.text)} />
                    <span className="text-sm font-bold">{expectedEndDate || '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ======= STANDARD: Services in Scope ======= */}
            {isStandard && (
              <div className="pt-6 border-t border-slate-100 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-slate-500 uppercase">Services in Scope</label>
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter", theme.lightText, theme.lightBg)}>
                    {selectedServices.length} Selected
                  </span>
                </div>

                {/* No package selected yet */}
                {!formData.packageName && (
                  <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                    <p className="text-sm text-slate-400 italic font-medium">Select a package above to load services</p>
                  </div>
                )}

                {/* Package selected — show all services as chips; selected = teal, deselected = faded */}
                {formData.packageName && (() => {
                  const pkg = packages.find(p => p.name === formData.packageName);
                  if (!pkg) return null;
                  return (
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      {pkg.services.map(serviceId => {
                        const isSelected = selectedServices.includes(serviceId);
                        const serviceName = getServiceName(serviceId);
                        return (
                          <button
                            key={serviceId}
                            type="button"
                            onClick={() => {
                              setSelectedServices(prev =>
                                isSelected ? prev.filter(s => s !== serviceId) : [...prev, serviceId]
                              );
                            }}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95",
                              isSelected
                                ? cn(theme.bg, "text-white border-transparent shadow-sm")
                                : "bg-white text-slate-400 border-slate-200 line-through opacity-60 hover:opacity-100 hover:no-underline hover:text-slate-600"
                            )}
                            title={isSelected ? `Click to remove "${serviceName}" from scope` : `Click to add "${serviceName}" back to scope`}
                          >
                            {serviceName}
                            {isSelected && <X className="w-3 h-3 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {formData.packageName && selectedServices.length === 0 && (
                  <p className="text-xs text-red-500 font-bold">⚠ At least one service must be in scope</p>
                )}
              </div>
            )}


            {/* ======= CUSTOMIZATION: Free-pick services ======= */}
            {isCustomization && (
              <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Products / Services Affected</label>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">Select all services this customization touches</p>
                  </div>
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter", "bg-violet-50 text-violet-600")}>
                    {selectedServices.length} Selected
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-100 max-h-[160px] overflow-y-auto custom-scrollbar">
                  {serviceBaselines.map(sb => {
                    const isSelected = selectedServices.includes(sb.id);
                    return (
                      <button key={sb.id} type="button" onClick={() => toggleService(sb.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-xs font-bold transition-all border active:scale-95",
                          isSelected
                            ? "bg-violet-600 text-white border-transparent shadow-md"
                            : "bg-white text-slate-500 border-slate-200 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                        )}>
                        {sb.name}
                      </button>
                    );
                  })}
                  {serviceBaselines.length === 0 && (
                    <p className="text-[10px] italic text-slate-400 py-4">No services configured. Ask your admin to add services first.</p>
                  )}
                </div>
              </div>
            )}

            {/* ======= MILESTONES: Initiative + Customization ======= */}
            {(isInitiative || isCustomization) && (
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Execution Milestones</h3>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {isCustomization
                        ? 'Key deliverables for this customization. Each contributes equally to the 60% Execution weight.'
                        : 'These milestones will appear under the Execution phase. Each contributes equally to the 60% Execution weight.'}
                    </p>
                  </div>
                  <button type="button" onClick={addMilestoneField}
                    className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border shadow-sm transition-all",
                      isCustomization ? "text-violet-600 border-violet-200 bg-violet-50 hover:bg-violet-600 hover:text-white" : cn(theme.text, theme.border, theme.hoverBg, "hover:text-white")
                    )}>
                    + Add Milestone
                  </button>
                </div>
                <div className="space-y-3">
                  {internalMilestones.map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <input required placeholder="Milestone name"
                        className={cn("flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 transition-all",
                          isCustomization ? "focus:ring-violet-400/30" : theme.ring
                        )}
                        value={m}
                        onChange={e => updateMilestoneValue(i, e.target.value)} />
                      <button type="button" onClick={() => removeMilestoneField(i)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ======= AUTO-CREATE ANCILLARY IMPLEMENTATION (Optional, only for Standard/Customization) ======= */}
            {!isInitiative && (
              <div className="pt-6 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Ancillary Implementation</h4>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      Auto-create associated ancillary implementations for this project
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={autoCreateImpl}
                      onChange={e => {
                        const checked = e.target.checked;
                        setAutoCreateImpl(checked);
                        if (checked && autoCreateItems.length === 0) {
                          setAutoCreateItems([{
                            id: Math.random().toString(36).substr(2, 9),
                            serviceId: '',
                            subServiceId: null,
                            startDate: formData.startDate || new Date().toISOString().split('T')[0],
                            manager: formData.assignedPM || currentUserName
                          }]);
                        }
                      }}
                    />
                    <div className={cn(
                      "w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"
                    )}></div>
                  </label>
                </div>

                <AnimatePresence>
                  {autoCreateImpl && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden space-y-4"
                    >
                      {autoCreateItems.map((item, idx) => {
                        const service = availableAncillaryServices.find(sb => sb.id === item.serviceId);
                        const hasSub = (service?.subServices?.length ?? 0) > 0;
                        const subService = service?.subServices?.find(ss => ss.id === item.subServiceId);
                        const baseline = subService?.baselineDays ?? service?.baselineDays ?? 0;
                        const closureDate = (service && item.startDate) ? calculateWorkingDays(item.startDate, baseline) : null;

                        return (
                          <div
                            key={item.id}
                            className="relative space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner group transition-all"
                          >
                            {/* Card Header with count and Delete action */}
                            <div className="flex justify-between items-center border-b border-slate-200/50 pb-2 mb-2">
                              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                Implementation #{idx + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setAutoCreateItems(prev => {
                                    const filtered = prev.filter(x => x.id !== item.id);
                                    if (filtered.length === 0) setAutoCreateImpl(false);
                                    return filtered;
                                  });
                                }}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Remove this implementation"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Service Type */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Ancillary Service</label>
                                <select
                                  required={autoCreateImpl}
                                  className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                                  value={item.serviceId}
                                  onChange={e => {
                                    const newServiceId = e.target.value;
                                    setAutoCreateItems(prev =>
                                      prev.map(x => x.id === item.id ? { ...x, serviceId: newServiceId, subServiceId: null } : x)
                                    );
                                  }}
                                >
                                  <option value="">Select Service...</option>
                                  {availableAncillaryServices.map(sb => (
                                    <option key={sb.id} value={sb.id}>{sb.name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Sub-Service (Optional, conditionally required if has sub-services) */}
                              {hasSub && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                  <label className="text-xs font-bold text-slate-500 uppercase">Sub-Service / Gateway</label>
                                  <select
                                    required={autoCreateImpl && hasSub}
                                    className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                                    value={item.subServiceId || ''}
                                    onChange={e => {
                                      const newSubServiceId = e.target.value;
                                      setAutoCreateItems(prev =>
                                        prev.map(x => x.id === item.id ? { ...x, subServiceId: newSubServiceId || null } : x)
                                      );
                                    }}
                                  >
                                    <option value="">Select Sub-Service...</option>
                                    {service?.subServices?.map(ss => (
                                      <option key={ss.id} value={ss.id}>{ss.name}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Start Date */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
                                <input
                                  required={autoCreateImpl}
                                  type="date"
                                  className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 outline-none transition-all font-mono", theme.ring, theme.focusBorder)}
                                  value={item.startDate}
                                  onChange={e => {
                                    const newDate = e.target.value;
                                    setAutoCreateItems(prev =>
                                      prev.map(x => x.id === item.id ? { ...x, startDate: newDate } : x)
                                    );
                                  }}
                                />
                              </div>

                              {/* Implementation Manager */}
                              <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase">Implementation Manager</label>
                                <select
                                  required={autoCreateImpl}
                                  className={cn("w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 outline-none transition-all", theme.ring, theme.focusBorder)}
                                  value={item.manager}
                                  onChange={e => {
                                    const newManager = e.target.value;
                                    setAutoCreateItems(prev =>
                                      prev.map(x => x.id === item.id ? { ...x, manager: newManager } : x)
                                    );
                                  }}
                                >
                                  <option value="">Select Manager...</option>
                                  {availableIMs.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Timeline Preview */}
                            {closureDate && (
                              <div className="p-3 bg-white rounded-xl border border-slate-100 flex justify-between items-center text-[10px] font-bold text-slate-500 shadow-sm animate-in slide-in-from-top-1">
                                <div>
                                  <span>Baseline: </span>
                                  <span className="text-slate-800 font-mono">{baseline} Working Days</span>
                                </div>
                                <div>
                                  <span>Est. Closure: </span>
                                  <span className="text-slate-800 font-mono">{closureDate}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Add another implementation button */}
                      <button
                        type="button"
                        onClick={() => {
                          setAutoCreateItems(prev => [
                            ...prev,
                            {
                              id: Math.random().toString(36).substr(2, 9),
                              serviceId: '',
                              subServiceId: null,
                              startDate: formData.startDate || new Date().toISOString().split('T')[0],
                              manager: formData.assignedPM || currentUserName
                            }
                          ]);
                        }}
                        className="flex items-center justify-center gap-1.5 px-4 py-3 border-2 border-dashed border-slate-200 text-slate-500 rounded-2xl hover:border-teal-500 hover:text-teal-600 font-bold transition-all text-xs w-full mt-2 hover:bg-teal-50/20 active:scale-[0.98]"
                      >
                        + Add Implementation
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Errors / Warnings */}
            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 animate-in slide-in-from-top-2 duration-200">
                ⚠️ {error}
              </div>
            )}
            {warning && (
              <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-700 animate-in slide-in-from-top-2 duration-200 flex flex-col gap-2">
                <p>⚠️ {warning}</p>
                <button type="button" onClick={(e) => handleSubmit(e, true)}
                  className="px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-bold">
                  Confirm Override
                </button>
              </div>
            )}

            {/* CTA */}
            <div className="pt-6 border-t border-slate-100 flex gap-3">
              <button type="button" onClick={onClose}
                className="flex-1 px-6 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
                Cancel
              </button>
              <button type="submit"
                className={cn("flex-1 px-6 py-3.5 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95",
                  isCustomization ? "bg-violet-600 hover:bg-violet-700 shadow-violet-500/25" : cn(theme.bg, theme.hoverBg, theme.shadow)
                )}>
                {isInitiative ? 'Create Initiative' : isCustomization ? 'Create Custom Project' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};
