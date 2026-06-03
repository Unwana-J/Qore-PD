import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, ChevronRight, Package } from 'lucide-react';
import { AppConfig, ServiceBaseline, ServiceSubService } from '../types';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { calculateWorkingDays } from '../lib/utils';

interface NewImplementationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  config: AppConfig;
  userName: string;
  userRole: string;
  users: any[];
}

export const NewImplementationModal: React.FC<NewImplementationModalProps> = ({
  isOpen, onClose, onSuccess, config, userName, userRole, users
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Step 1
  const [clientName, setClientName] = useState('');
  const [selectedService, setSelectedService] = useState<ServiceBaseline | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<ServiceSubService | null>(null);
  const [implementationManager, setImplementationManager] = useState(userName);
  const [selectedDeliverables, setSelectedDeliverables] = useState<string[]>([]);

  const isLead = userRole === 'IM Lead' || userRole === 'Superadmin' || userRole === 'Manager';
  const availableIMs = React.useMemo(() => {
    return Array.from(new Set([
      ...users.filter(u => u.role === 'IM' || u.role === 'IM Lead' || u.role === 'Superadmin').map(u => u.name),
      userName
    ])).sort();
  }, [users, userName]);

  // Step 2
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState<string>('');

  const hasSubServices = (selectedService?.subServices?.length ?? 0) > 0;
  const effectiveBaseline = selectedSubService?.baselineDays ?? selectedService?.baselineDays ?? 0;
  const effectiveMilestones: string[] = (selectedSubService?.milestones?.length ? selectedSubService.milestones : selectedService?.milestones) ?? [];
  const effectiveDeliverables: string[] = selectedSubService?.deliverables ?? selectedService?.deliverables ?? [];

  // Auto-suggest target date when sub-service/service is selected
  const suggestDate = (baselineDays: number, fromDate: string = startDate) => {
    const suggested = calculateWorkingDays(fromDate, baselineDays);
    setTargetDate(suggested);
  };

  const handleServiceSelect = (service: ServiceBaseline) => {
    setSelectedService(service);
    setSelectedSubService(null);
    if (!service.subServices?.length) {
      suggestDate(service.baselineDays);
      // Default: all top-level deliverables selected
      setSelectedDeliverables(service.deliverables ?? []);
    } else {
      setSelectedDeliverables([]);
    }
  };

  const handleSubServiceSelect = (ss: ServiceSubService) => {
    setSelectedSubService(ss);
    suggestDate(ss.baselineDays);
    // Default: all sub-service deliverables selected
    setSelectedDeliverables(ss.deliverables ?? selectedService?.deliverables ?? []);
  };

  const toggleDeliverable = (name: string) => {
    setSelectedDeliverables(prev =>
      prev.includes(name) ? prev.filter(d => d !== name) : [...prev, name]
    );
  };

  const handleNext = async () => {
    setError(null);
    if (!clientName.trim()) { setError('Client Name is required.'); return; }
    if (!selectedService) { setError('Please select a service.'); return; }
    if (hasSubServices && !selectedSubService) { setError('Please select a sub-service / gateway.'); return; }

    setLoading(true);
    try {
      const variantName = selectedSubService?.name ?? 'Standard';
      const isDup = await api.serviceExtensions.checkDuplicate(clientName.trim(), selectedService.id, variantName);
      if (isDup) {
        setDuplicateWarning(true);
      } else {
        setStep(2);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!targetDate) { setError('Target closure date is required.'); return; }
    setLoading(true);
    setError(null);
    try {
      // All milestones (execution steps) are always added
      const milestones = effectiveMilestones.map(m => ({
        name: m,
        completed: false,
        completedAt: null,
        completedBy: null,
      }));
      // Only selected deliverables are added
      const deliverables = selectedDeliverables.map(d => ({
        name: d,
        completed: false,
        completedAt: null,
        completedBy: null,
      }));

      await api.serviceExtensions.create({
        clientName: clientName.trim(),
        serviceId: selectedService!.id,
        serviceName: selectedService!.name,
        serviceVariant: selectedSubService?.name ?? 'Standard',
        subServiceId: selectedSubService?.id ?? null,
        baselineDays: effectiveBaseline,
        implementationManager: implementationManager,
        startDate: startDate,
        targetClosureDate: targetDate,
        status: 'Not Started',
        milestones,
        deliverables,
        linkedProjectId: null,
        mappingStatus: 'None',
        mappingRequestedAt: null,
        mappingApprovedAt: null,
        mappingRejectionComment: null,
        mappingNotes: null,
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
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to create implementation.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">New Ancillary Implementation</h2>
              <p className="text-slate-500 font-medium mt-0.5">
                {step === 1 ? 'Select the client and service details.' : 'Confirm timeline details.'}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Step indicator */}
              <div className="flex items-center gap-2">
                <span className={cn("w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center", step === 1 ? "bg-teal-600 text-white" : "bg-emerald-100 text-emerald-700")}>1</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className={cn("w-6 h-6 rounded-full text-[10px] font-black flex items-center justify-center", step === 2 ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-400")}>2</span>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar space-y-6">
            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            {duplicateWarning && step === 1 ? (
              <div className="space-y-6">
                <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-center">
                  <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                  <h3 className="text-lg font-black mb-2">Duplicate Detected</h3>
                  <p className="text-sm">An active implementation for <strong>{clientName}</strong> — <strong>{selectedService?.name} ({selectedSubService?.name ?? 'Standard'})</strong> already exists.</p>
                </div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setDuplicateWarning(false)} className="px-6 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200">Cancel</button>
                  <button onClick={() => setStep(2)} className="px-6 py-2.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600">Proceed Anyway</button>
                </div>
              </div>
            ) : step === 1 ? (
              <>
                {/* Client Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Client Name</label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                    placeholder="Enter client name..."
                    autoFocus
                  />
                </div>

                {/* Service Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Service</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {config.serviceBaselines.map(service => (
                      <button
                        key={service.id}
                        onClick={() => handleServiceSelect(service)}
                        className={cn(
                          "px-4 py-3 text-left rounded-2xl border transition-all",
                          selectedService?.id === service.id
                            ? "border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="text-sm font-black text-slate-900">{service.name}</div>
                        <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                          {service.subServices?.length
                            ? `${service.subServices.length} sub-services`
                            : `${service.baselineDays}d baseline`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-Service Selection (appears once service is selected and has sub-services) */}
                {selectedService && hasSubServices && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                      {selectedService.name} — Select Gateway / Sub-Service
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedService.subServices!.map(ss => (
                        <button
                          key={ss.id}
                          onClick={() => handleSubServiceSelect(ss)}
                          className={cn(
                            "px-4 py-3 text-left rounded-2xl border transition-all",
                            selectedSubService?.id === ss.id
                              ? "border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          )}
                        >
                          <div className="text-sm font-bold text-slate-900">{ss.name}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5">{ss.baselineDays}d baseline</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No sub-services — show info about default milestones */}
                {selectedService && !hasSubServices && (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 animate-in fade-in">
                    <span className="font-bold">{selectedService.name}</span> — {selectedService.baselineDays} working days ·{' '}
                    {effectiveMilestones.length > 0
                      ? `${effectiveMilestones.length} milestones: ${effectiveMilestones.slice(0, 3).join(', ')}${effectiveMilestones.length > 3 ? '…' : ''}`
                      : 'No milestones configured.'}
                  </div>
                )}

                {/* Deliverables Picker — shown when deliverables pool is configured */}
                {effectiveDeliverables.length > 0 && (selectedSubService || (selectedService && !hasSubServices)) && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">
                        Deliverables
                        <span className="ml-2 px-1.5 py-0.5 bg-teal-50 text-teal-700 border border-teal-200 rounded-md text-[9px]">
                          {selectedDeliverables.length} / {effectiveDeliverables.length} selected
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDeliverables(effectiveDeliverables)}
                          className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors"
                        >
                          All
                        </button>
                        <span className="text-slate-200">|</span>
                        <button
                          type="button"
                          onClick={() => setSelectedDeliverables([])}
                          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border border-slate-100 rounded-2xl min-h-[56px]">
                      {effectiveDeliverables.map(deliverable => {
                        const isSelected = selectedDeliverables.includes(deliverable);
                        return (
                          <button
                            key={deliverable}
                            type="button"
                            onClick={() => toggleDeliverable(deliverable)}
                            className={cn(
                              'px-3 py-1.5 rounded-xl text-xs font-black border transition-all',
                              isSelected
                                ? 'bg-teal-600 border-teal-600 text-white shadow-sm shadow-teal-600/20'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'
                            )}
                          >
                            {isSelected && <span className="mr-1">✓</span>}{deliverable}
                          </button>
                        );
                      })}
                    </div>
                    {selectedDeliverables.length === 0 && (
                      <p className="text-[10px] text-amber-600 font-bold px-1">
                        ⚠ No deliverables selected — implementation will have no trackable deliverables.
                      </p>
                    )}
                  </div>
                )}

                {/* IM Selection for Leads/Managers */}
                {isLead && (
                  <div className="space-y-2 animate-in fade-in">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Assign Implementation Manager</label>
                    <select
                      value={implementationManager}
                      onChange={e => setImplementationManager(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all cursor-pointer"
                    >
                      {availableIMs.map(im => (
                        <option key={im} value={im}>{im === userName ? `${im} (Me)` : im}</option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : (
              /* ── Step 2: Timeline ── */
              <div className="space-y-6">
                <div className="p-5 bg-teal-50 rounded-2xl border border-teal-100 space-y-1">
                  <p className="text-[10px] font-black uppercase text-teal-500 tracking-widest">Implementation Summary</p>
                  <p className="text-base font-black text-teal-900">{clientName}</p>
                  <p className="text-sm font-bold text-teal-700">
                    {selectedService?.name}
                    {selectedSubService ? ` — ${selectedSubService.name}` : ''}
                  </p>
                  <p className="text-xs text-teal-600 font-medium">
                    {effectiveBaseline} working day baseline · {selectedDeliverables.length} deliverable{selectedDeliverables.length !== 1 ? 's' : ''} selected
                  </p>
                  <button onClick={() => setStep(1)} className="text-[10px] font-black uppercase tracking-widest text-teal-500 hover:text-teal-700 underline mt-1">Edit</button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        if (effectiveBaseline > 0) {
                          const suggested = calculateWorkingDays(e.target.value, effectiveBaseline);
                          setTargetDate(suggested);
                        }
                      }}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Target Closure Date</label>
                      {effectiveBaseline > 0 && (
                        <button
                          onClick={() => suggestDate(effectiveBaseline)}
                          className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700"
                        >
                          Reset ({effectiveBaseline}d)
                        </button>
                      )}
                    </div>
                    <input
                      type="date"
                      value={targetDate}
                      onChange={e => setTargetDate(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:bg-white focus:ring-4 focus:ring-teal-500/10 focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>

                {effectiveBaseline > 0 && (
                  <p className="text-[10px] text-slate-400 font-bold px-2">
                    Baseline is {effectiveBaseline} working days. Target date is automatically adjusted when Start Date changes.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
            <button onClick={onClose} className="px-5 py-2.5 text-slate-500 font-bold rounded-xl hover:bg-slate-100 transition-colors">Cancel</button>
            {step === 1 ? (
              <button
                onClick={handleNext}
                disabled={loading || (duplicateWarning)}
                className="px-8 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Next →'}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-2.5 bg-teal-600 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 hover:bg-teal-700 transition-all disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Implementation'}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
