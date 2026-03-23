import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { Project, Phase, Role, ServiceBaseline, PackageConfig, ProductLineConfig } from '../types';
import { cn, calculateWorkingDays } from '../lib/utils';
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
  serviceBaselines: ServiceBaseline[];
  packages: PackageConfig[];
  productLines: ProductLineConfig[];
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ 
  isOpen, onClose, onSubmit, userRole, getPMWorkload, workloadThresholds, 
  themeColor = 'teal', currencies = [], users = [],
  serviceBaselines = [], packages = [], productLines = []
}) => {
  const currentUserName = userRole === 'PM' ? 'Sarah Jenkins' : 'Admin User'; // In full app this would come from auth
  
  const [formData, setFormData] = useState({
    clientName: '',
    packageName: '',
    assignedPM: userRole === 'PM' ? currentUserName : '',
    startDate: '',
    value: '',
    currency: currencies.find(c => c.isActive)?.code || 'USD',
    priority: 'P2' as any,
  });

  const [pmSearch, setPmSearch] = useState('');
  const [showPmDropdown, setShowPmDropdown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [confirmationData, setConfirmationData] = useState<{ pmName: string, load: number, limit: number } | null>(null);
  const [internalMilestones, setInternalMilestones] = useState<string[]>(['']);
  const [manualCompletionDate, setManualCompletionDate] = useState('');

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const theme = getThemeClasses(themeColor);

  const activePMs = users.filter(u => u.role === 'PM' && u.status === 'Active');
  const filteredPMs = activePMs.filter(pm => 
    pm.name.toLowerCase().includes(pmSearch.toLowerCase())
  );

  useEffect(() => {
    if (formData.packageName) {
      const pkg = packages.find(p => p.name === formData.packageName);
      if (pkg) {
        setSelectedServices(pkg.services);
      }
    } else {
      setSelectedServices([]);
    }
  }, [formData.packageName]);

  const isInternalInitiative = formData.packageName === 'Internal Initiative';

  const totalDuration = selectedServices.reduce((acc, s) => {
    const baseline = serviceBaselines.find(sb => sb.name === s);
    return acc + (baseline ? baseline.baselineDays : 0);
  }, 0);

  const expectedEndDate = formData.startDate ? calculateWorkingDays(formData.startDate, totalDuration) : null;

  if (!isOpen) return null;

  const canCreate = userRole === 'Superadmin' || userRole === 'Manager' || userRole === 'Team Lead' || userRole === 'PM';

  if (!canCreate) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">Access Denied</h2>
          <p className="text-sm text-slate-500 mb-6">Your role does not have permission to create projects.</p>
          <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors">
            Close
          </button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent, force: boolean = false) => {
    e.preventDefault();
    setError(null);
    setWarning(null);
    
    const pkg = packages.find(p => p.name === formData.packageName);

    if (isInternalInitiative) {
      if (internalMilestones.length === 0) {
        setError('At least one execution milestone is required for Internal Initiatives');
        return;
      }
      if (internalMilestones.some(m => !m.trim())) {
        setError('Milestone name cannot be empty');
        return;
      }
      if (!manualCompletionDate) {
        setError('Please set a completion date for the initiative');
        return;
      }
    } else {
      if (!formData.value) {
        setError('Project value is required');
        return;
      }
    }

    try {
      const result = await onSubmit({
        ...formData,
        value: formData.value ? Number(formData.value) : 0,
        services: isInternalInitiative ? [] : selectedServices,
        expectedCompletionDate: isInternalInitiative ? manualCompletionDate : (expectedEndDate || formData.startDate),
        currentCompletionDate: isInternalInitiative ? manualCompletionDate : (expectedEndDate || formData.startDate),
        isInternalInitiative,
        milestones: isInternalInitiative ? internalMilestones.map(m => ({
          id: Math.random().toString(36).substr(2, 9),
          name: m,
          status: 'Not Started' as const
        })) : undefined,
        currency: formData.currency,
        state: 'On-Track',
        comments: [],
        phases: [],
        risks: []
      }, force);

      if (result?.warning) {
        setWarning(result.warning);
        return;
      }

      onClose();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addMilestoneField = () => {
    setInternalMilestones([...internalMilestones, '']);
  };

  const removeMilestoneField = (index: number) => {
    setInternalMilestones(internalMilestones.filter((_, i) => i !== index));
  };

  const updateMilestoneValue = (index: number, val: string) => {
    const next = [...internalMilestones];
    next[index] = val;
    setInternalMilestones(next);
  };

  const toggleService = (service: string) => {
    const pkg = packages.find(p => p.name === formData.packageName);
    if (!pkg) {
      setError("Please select a package first.");
      return;
    }
    
    if (!pkg.services.includes(service)) {
      setError(`Service '${service}' is not part of the ${pkg.name}.`);
      return;
    }

    setSelectedServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  return (
    <>
      <ConfirmationModal 
        isOpen={!!confirmationData}
        onClose={() => setConfirmationData(null)}
        onConfirm={() => {
          if (confirmationData) {
            setFormData({...formData, assignedPM: confirmationData.pmName});
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

          <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">{isInternalInitiative ? "Initiative Name" : "Client Name"}</label>
                <div className="flex flex-col gap-2">
                  <input 
                    required
                    className={cn(
                      "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                      theme.ring, theme.focusBorder
                    )}
                    value={formData.clientName}
                    onChange={e => setFormData({...formData, clientName: e.target.value})}
                  />
                  {isInternalInitiative && (
                    <span className="text-[10px] font-black text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100 self-start">
                      Internal Initiative — no services required
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Package</label>
                <select 
                  required
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={formData.packageName}
                  onChange={e => setFormData({...formData, packageName: e.target.value})}
                >
                  <option value="">Select a package</option>
                  {packages.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5 relative">
                <label className="text-xs font-bold text-slate-500 uppercase">Assigned PM</label>
                {userRole === 'PM' ? (
                  <div className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-bold">
                    {formData.assignedPM}
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      required
                      placeholder="Search PM..."
                      className={cn(
                        "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                        theme.ring, theme.focusBorder
                      )}
                      value={pmSearch || formData.assignedPM}
                      onChange={e => {
                        setPmSearch(e.target.value);
                        setShowPmDropdown(true);
                        if (formData.assignedPM) setFormData({...formData, assignedPM: ''});
                      }}
                      onFocus={() => setShowPmDropdown(true)}
                    />
                    {showPmDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-[60] max-h-60 overflow-y-auto">
                        {filteredPMs.length > 0 ? (
                          filteredPMs.map(pm => {
                            const workload = getPMWorkload(pm.name);
                            const currentLoad = workload[formData.priority] || 0;
                            const limit = workloadThresholds[formData.priority];
                            const isAtLimit = currentLoad >= limit;

                            return (
                              <button
                                key={pm.id}
                                type="button"
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                onClick={() => {
                                  if (isAtLimit) {
                                    setConfirmationData({ pmName: pm.name, load: currentLoad, limit });
                                  } else {
                                    setFormData({...formData, assignedPM: pm.name});
                                    setPmSearch('');
                                    setShowPmDropdown(false);
                                  }
                                }}
                              >
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-900">{pm.name}</span>
                                  {isAtLimit && (
                                    <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-2 py-0.5 rounded uppercase tracking-wider" title={`At ${formData.priority} limit — override required`}>
                                      At Limit
                                    </span>
                                  )}
                                </div>
                                <div className="flex gap-3 text-[10px] font-bold text-slate-400">
                                  <span className={cn(formData.priority === 'P1' && "text-slate-600")}>Tier 1 - Enterprise: {workload.P1}/{workloadThresholds.P1}</span>
                                  <span className={cn(formData.priority === 'P2' && "text-slate-600")}>Tier 2 - Pro: {workload.P2}/{workloadThresholds.P2}</span>
                                  <span className={cn(formData.priority === 'P3' && "text-slate-600")}>Tier 3 - Basic: {workload.P3}/{workloadThresholds.P3}</span>
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-3 text-sm text-slate-400 italic">No PMs found</div>
                        )}
                      </div>
                    )}
                    {showPmDropdown && <div className="fixed inset-0 z-[55]" onClick={() => setShowPmDropdown(false)} />}
                  </div>
                )}
              </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Priority</label>
              <select 
                required
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                  theme.ring, theme.focusBorder
                )}
                value={formData.priority}
                onChange={e => setFormData({...formData, priority: e.target.value as any})}
              >
                <option value="P1">Tier 1 - Enterprise</option>
                <option value="P2">Tier 2 - Pro</option>
                <option value="P3">Tier 3 - Basic</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Start Date</label>
              <input 
                required
                type="date"
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                  theme.ring, theme.focusBorder
                )}
                value={formData.startDate}
                onChange={e => setFormData({...formData, startDate: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Project Value</label>
              <div className="flex gap-2">
                <input 
                  required={!isInternalInitiative}
                  type="number"
                  placeholder="0.00"
                  className={cn(
                    "flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all font-mono",
                    theme.ring, theme.focusBorder
                  )}
                  value={formData.value}
                  onChange={e => setFormData({...formData, value: e.target.value})}
                />
                <select
                  required
                  className={cn(
                    "w-40 flex-shrink-0 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all font-bold",
                    theme.ring, theme.focusBorder
                  )}
                  value={formData.currency}
                  onChange={e => setFormData({...formData, currency: e.target.value})}
                >
                  {currencies.filter(c => c.isActive).map(c => (
                    <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                  ))}
                </select>
              </div>
            </div>
            {isInternalInitiative && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Completion Date</label>
                <input 
                  required
                  type="date"
                  className={cn(
                    "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                    theme.ring, theme.focusBorder
                  )}
                  value={manualCompletionDate}
                  onChange={e => setManualCompletionDate(e.target.value)}
                />
              </div>
            )}
            </div>

            {isInternalInitiative ? (
               <div className="pt-6 border-t border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Execution Milestones</h3>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">These milestones will appear under the Execution phase. Each one contributes equally to the 60% Execution weight.</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={addMilestoneField}
                      className={cn("px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border shadow-sm transition-all", theme.text, theme.border, theme.hoverBg, "hover:text-white")}
                    >
                      + Add Milestone
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {internalMilestones.map((m, i) => (
                      <div key={i} className="flex gap-2">
                        <input 
                          required
                          placeholder="Milestone name"
                          className={cn("flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 transition-all", theme.ring)}
                          value={m}
                          onChange={e => updateMilestoneValue(i, e.target.value)}
                        />
                        <button 
                          type="button"
                          onClick={() => removeMilestoneField(i)}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
               </div>
            ) : (
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expected Duration</label>
                <div className="flex items-center gap-2 text-slate-900">
                  <Clock className={cn("w-4 h-4", theme.text)} />
                  <span className="text-sm font-bold">{totalDuration} Working Days</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exp. Completion</label>
                <div className="flex items-center gap-2 text-slate-900">
                  <Calendar className={cn("w-4 h-4", theme.text)} />
                  <span className="text-sm font-bold">{expectedEndDate || '—'}</span>
                </div>
              </div>
            </div>
            )}

            {!isInternalInitiative && (
            <div className="pt-6 border-t border-slate-100 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase">Services in Scope</label>
              <span className={cn("text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter", theme.lightText, theme.lightBg)}>
                {selectedServices.length} Selected
              </span>
            </div>
            
            <div className="max-h-[160px] overflow-y-auto px-1 pr-2 space-y-4 custom-scrollbar">
              {productLines.filter(pl => {
                return pl.services.some(s => selectedServices.includes(s));
              }).map(pl => (
                <div key={pl.name} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <div className={cn("w-1.5 h-1.5 rounded-full", theme.bg)} />
                    {pl.name}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {pl.services.filter(s => selectedServices.includes(s)).map(service => (
                      <div 
                        key={service}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm group animate-in zoom-in duration-150"
                      >
                        <span>{service}</span>
                        <button 
                          type="button"
                          onClick={() => toggleService(service)}
                          className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Handle services not in any product line */}
              {(() => {
                const untrackedServices = selectedServices.filter(s => 
                  !productLines.some(pl => pl.services.includes(s))
                );
                
                if (untrackedServices.length === 0) return null;

                return (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 italic">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Other Services
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {untrackedServices.map(service => (
                        <div 
                          key={service}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 shadow-sm group animate-in zoom-in duration-150"
                        >
                          <span>{service}</span>
                          <button 
                            type="button"
                            onClick={() => toggleService(service)}
                            className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {selectedServices.length === 0 && (
                <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-sm text-slate-400 italic font-medium">No services selected. Select a package to auto-populate.</p>
                </div>
              )}

              {/* Manual Add Section integrated inside scroll area to prevent pushing CTA down */}
              <div className="pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Add More Services (In Package)</p>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    const pkg = packages.find(p => p.name === formData.packageName);
                    if (!pkg) return <p className="text-[10px] italic text-slate-400">Select a package to see available services</p>;
                    
                    const unselectedInPkg = pkg.services.filter(s => !selectedServices.includes(s));
                    if (unselectedInPkg.length === 0) return <p className="text-[10px] italic text-slate-400">All package services selected</p>;

                    return unselectedInPkg.map(service => (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={cn(
                          "px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 transition-all active:scale-95 shadow-sm hover:shadow-md",
                          theme.hoverBorder, theme.hoverText
                        )}
                      >
                        + {service}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
          )}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-xs font-bold text-red-600 animate-in slide-in-from-top-2 duration-200">
              ⚠️ {error}
            </div>
          )}

          {warning && (
            <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-700 animate-in slide-in-from-top-2 duration-200 flex flex-col gap-2">
              <p>⚠️ {warning}</p>
              <button 
                type="button"
                onClick={(e) => handleSubmit(e, true)}
                className="px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-bold"
              >
                Confirm Override
              </button>
            </div>
          )}

          <div className="pt-6 border-t border-slate-100 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className={cn(
                "flex-1 px-6 py-3.5 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95",
                theme.bg, theme.hoverBg, theme.shadow
              )}
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};
