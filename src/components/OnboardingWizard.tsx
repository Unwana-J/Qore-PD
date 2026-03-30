import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building2, 
  Settings2, 
  Activity, 
  Users, 
  Upload, 
  ChevronRight, 
  X,
  Plus,
  Trash2,
  Mail,
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { AppConfig, Role, ProjectLifecycleWeights, ServiceBaseline, Currency } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { BulkImportView } from './BulkImportView';
import { api } from '../lib/api';

interface OnboardingWizardProps {
  config: AppConfig;
  onUpdateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  onFinish: () => void;
  onSkip: () => void;
  userRole: Role;
}

type Step = 'welcome' | 'profile' | 'services' | 'thresholds' | 'team' | 'import';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ 
  config, 
  onUpdateConfig, 
  onFinish, 
  onSkip,
  userRole 
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [formData, setFormData] = useState({
    orgName: config.orgName || '',
    logoUrl: config.logoUrl || '',
    defaultCurrency: config.defaultCurrency || 'NGN',
    serviceBaselines: [...(config.serviceBaselines || [])],
    projectLifecycleWeights: { ...(config.projectLifecycleWeights || { initiation: 10, planning: 10, execution: 60, closure: 20 }) },
    spiThresholds: { ...(config.spiThresholds || { onTrack: 1.0, atRisk: 0.8 }) }
  });

  const [invites, setInvites] = useState<{ email: string; role: Role; name: string }[]>([]);
  const [newInvite, setNewInvite] = useState<{ email: string; role: Role; name: string }>({ email: '', role: 'PM', name: '' });
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const steps: Step[] = ['welcome', 'profile', 'services', 'thresholds', 'team', 'import'];
  const stepIndex = steps.indexOf(currentStep);

  const handleNext = async () => {
    const nextStep = steps[stepIndex + 1];
    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      await onUpdateConfig({ ...formData, isSetupComplete: true });
      onFinish();
    }
  };

  const handleSaveStep = async () => {
    await onUpdateConfig(formData);
    handleNext();
  };

  const handleSendInvites = async () => {
    if (invites.length === 0) {
      setInviteError('Please add at least one invite to send.');
      return;
    }

    setInviteStatus('sending');
    setInviteMessage(null);
    setInviteError(null);

    try {
      const results = await Promise.allSettled(
        invites.map(invite => api.invites.send(invite.email, invite.role, invite.name))
      );

      const successfulInvites = results.filter(r => r.status === 'fulfilled').length;
      const failedInvites = results.filter(r => r.status === 'rejected').length;

      if (successfulInvites > 0 && failedInvites === 0) {
        setInviteStatus('success');
        setInviteMessage(`Successfully sent ${successfulInvites} invite(s).`);
        setInvites([]); // Clear invites after successful send
      } else if (successfulInvites > 0 && failedInvites > 0) {
        setInviteStatus('error');
        setInviteMessage(`Sent ${successfulInvites} invite(s), but ${failedInvites} failed. Please check console for details.`);
      } else {
        setInviteStatus('error');
        setInviteMessage('Failed to send any invites. Please try again.');
      }
    } catch (error) {
      console.error("Error sending invites:", error);
      setInviteStatus('error');
      setInviteMessage('An unexpected error occurred while sending invites.');
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'welcome':
        return (
          <div className="text-center space-y-6 max-w-2xl mx-auto py-12">
            <div className="h-24 flex items-center justify-center mx-auto">
               <img src="/logo.png" alt="Logo" className="h-full w-auto object-contain" />
            </div>
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">Solution Delivery Project Information System</h1>
              <h2 className="text-2xl font-bold text-slate-600">Welcome — let's set up your organisation</h2>
            </div>
            <p className="text-slate-500 font-medium leading-relaxed">
              This takes about 5 minutes. You can skip any step and come back later — your team can still use the platform while setup is in progress.
            </p>
            <div className="pt-8 flex flex-col items-center gap-4">
              <button 
                onClick={handleNext}
                className="w-full sm:w-64 py-4 bg-teal-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-teal-100 hover:bg-teal-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Get Started
              </button>
              <button 
                onClick={onSkip}
                className="text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-xs"
              >
                Skip for now — go to dashboard
              </button>
            </div>
          </div>
        );

      case 'profile':
        return (
          <div className="space-y-8 max-w-xl mx-auto py-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Your Organisation Profile</h2>
              <p className="text-slate-500 font-medium">Basic identity for your platform instance.</p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Organisation Name</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all"
                  placeholder="e.g. Acme Corporation"
                  value={formData.orgName}
                  onChange={e => setFormData({ ...formData, orgName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Organisation Logo (Optional)</label>
                <div className="flex items-center gap-4 p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl group hover:border-teal-500 transition-all cursor-pointer">
                  {formData.logoUrl ? (
                    <div className="relative w-20 h-20 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
                      <img src={formData.logoUrl} alt="Logo preview" className="w-full h-full object-contain" />
                      <button 
                        onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, logoUrl: '' }); }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border border-slate-100 group-hover:bg-teal-50 transition-colors">
                      <Upload className="w-8 h-8 text-slate-300 group-hover:text-teal-500" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-700">Click or drag to upload</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">PNG, JPG up to 2MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Default Currency</label>
                <select 
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 transition-all appearance-none cursor-pointer"
                  value={formData.defaultCurrency}
                  onChange={e => setFormData({ ...formData, defaultCurrency: e.target.value as Currency })}
                >
                  <option value="NGN">NGN - Nigerian Naira</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="GBP">GBP - British Pound</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="KES">KES - Kenyan Shilling</option>
                  <option value="GHS">GHS - Ghanaian Cedi</option>
                  <option value="ZAR">ZAR - South African Rand</option>
                </select>
              </div>
            </div>

            <div className="pt-8 flex items-center justify-between gap-4">
              <button 
                onClick={onSkip}
                className="text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
              >
                Skip this step
              </button>
              <button 
                disabled={!formData.orgName}
                onClick={handleSaveStep}
                className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Continue
              </button>
            </div>
          </div>
        );

      case 'services':
        return (
          <div className="space-y-8 max-w-4xl mx-auto py-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Configure Your Services</h2>
              <p className="text-slate-500 font-medium">Baseline durations are used to calculate project timelines and SPI. You can update these anytime in Settings.</p>
            </div>

            <div className="bg-white border-2 border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Name</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Baseline Duration (Working Days)</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {formData.serviceBaselines.map((service, idx) => (
                    <tr key={idx} className="group hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          className="bg-transparent font-bold text-slate-700 focus:outline-none focus:text-teal-600 w-full"
                          value={service.name}
                          onChange={e => {
                            const newBaselines = [...formData.serviceBaselines];
                            newBaselines[idx].name = e.target.value;
                            setFormData({ ...formData, serviceBaselines: newBaselines });
                          }}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          className="bg-transparent font-black text-slate-900 focus:outline-none focus:text-teal-600 w-24"
                          value={service.baselineDays}
                          onChange={e => {
                            const newBaselines = [...formData.serviceBaselines];
                            newBaselines[idx].baselineDays = parseInt(e.target.value) || 0;
                            setFormData({ ...formData, serviceBaselines: newBaselines });
                          }}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => {
                            setFormData({
                              ...formData,
                              serviceBaselines: formData.serviceBaselines.filter((_, i) => i !== idx)
                            });
                          }}
                          className="p-2 bg-red-50 text-red-500 rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button 
                onClick={() => {
                  setFormData({
                    ...formData,
                    serviceBaselines: [
                      ...formData.serviceBaselines,
                      { id: Math.random().toString(36).substr(2, 9), name: 'New Service', baselineDays: 5 }
                    ]
                  });
                }}
                className="w-full py-4 border-t border-slate-50 text-slate-400 hover:text-teal-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-slate-50/50 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Service
              </button>
            </div>

            {formData.serviceBaselines.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-700 leading-relaxed">
                  Service types are not configured. PMs cannot create projects until at least one service type is added.
                </p>
              </div>
            )}

            <div className="pt-8 flex items-center justify-between gap-4">
              <button 
                onClick={handleNext}
                className="text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
              >
                Skip this step
              </button>
              <button 
                onClick={handleSaveStep}
                className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all"
              >
                Save & Continue
              </button>
            </div>
          </div>
        );

      case 'thresholds':
        const weightsSum = Object.values(formData.projectLifecycleWeights).reduce((a: number, b: number) => a + b, 0);
        const isWeightValid = weightsSum === 100;

        return (
          <div className="space-y-12 max-w-4xl mx-auto py-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Set Your Performance Thresholds</h2>
                <p className="text-slate-500 font-medium">Define how project health is calculated across your organisation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {/* Phase Weights */}
                <div className="space-y-6">
                   <div className="flex items-center gap-2">
                     <Settings2 className="w-5 h-5 text-teal-600" />
                     <h3 className="text-lg font-black text-slate-900 tracking-tight">Phase Weights</h3>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                     {Object.entries(formData.projectLifecycleWeights).map(([key, val]) => (
                       <div key={key} className="space-y-2">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{key}</label>
                         <div className="relative">
                           <input 
                             type="number"
                             className="w-full pl-5 pr-10 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black focus:outline-none focus:border-teal-500 transition-all"
                             value={val}
                             onChange={e => {
                               setFormData({
                                 ...formData,
                                 projectLifecycleWeights: { ...formData.projectLifecycleWeights, [key]: parseInt(e.target.value) || 0 }
                               });
                             }}
                           />
                           <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 font-black">%</span>
                         </div>
                       </div>
                     ))}
                   </div>
                   <div className={cn(
                     "p-4 rounded-2xl border flex items-center justify-between",
                     isWeightValid ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"
                   )}>
                     <span className="text-xs font-bold uppercase tracking-wider">Total Weight</span>
                     <span className="text-xl font-black">{weightsSum}%</span>
                   </div>
                   {!isWeightValid && (
                     <p className="text-[10px] font-black text-red-500 uppercase tracking-widest text-center animate-pulse">
                        Weights must sum to exactly 100%
                     </p>
                   )}
                </div>

                {/* SPI Thresholds */}
                <div className="space-y-6">
                   <div className="flex items-center gap-2">
                     <Activity className="w-5 h-5 text-teal-600" />
                     <h3 className="text-lg font-black text-slate-900 tracking-tight">SPI Thresholds</h3>
                   </div>
                   <div className="space-y-6">
                      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm" />
                             <span className="text-xs font-black text-slate-600 uppercase tracking-widest">On-Track</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-400 font-mono">SPI ≥</span>
                             <input 
                               type="number" step="0.01" 
                               className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-black focus:outline-none focus:border-teal-500"
                               value={formData.spiThresholds.onTrack}
                               onChange={e => setFormData({ ...formData, spiThresholds: { ...formData.spiThresholds, onTrack: parseFloat(e.target.value) || 0 } })}
                             />
                           </div>
                        </div>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                             <span className="text-xs font-black text-slate-600 uppercase tracking-widest">At-Risk</span>
                           </div>
                           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                             <span>SPI 0.8 to 0.99</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-between">
                           <div className="flex items-center gap-2">
                             <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                             <span className="text-xs font-black text-slate-600 uppercase tracking-widest">Delayed</span>
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-xs font-bold text-slate-400 font-mono">SPI &lt;</span>
                             <input 
                               type="number" step="0.01" 
                               className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm font-black focus:outline-none focus:border-teal-500"
                               value={formData.spiThresholds.atRisk}
                               onChange={e => setFormData({ ...formData, spiThresholds: { ...formData.spiThresholds, atRisk: parseFloat(e.target.value) || 0 } })}
                             />
                           </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold italic leading-relaxed">
                        These bounds automatically determine project status colors and dashboard health reports.
                      </p>
                   </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex items-center justify-between gap-4">
              <button 
                onClick={handleNext}
                className="text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
              >
                Skip this step
              </button>
              <button 
                disabled={!isWeightValid}
                onClick={handleSaveStep}
                className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save & Continue
              </button>
            </div>
          </div>
        );

      case 'team':
        return (
          <div className="space-y-8 max-w-2xl mx-auto py-6">
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Add Your Team</h2>
              <p className="text-slate-500 font-medium">You can always add more users in Settings → User Management.</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-6">
               <div className="flex flex-col sm:flex-row gap-4">
                 <div className="flex-1 space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Full Name</label>
                   <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500"
                    placeholder="John Doe"
                    value={newInvite.name}
                    onChange={e => setNewInvite({ ...newInvite, name: e.target.value })}
                   />
                 </div>
                 <div className="flex-1 space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Email Address</label>
                   <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="email" 
                        className="w-full pl-11 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500"
                        placeholder="team@organisation.com"
                        value={newInvite.email}
                        onChange={e => { setNewInvite({ ...newInvite, email: e.target.value }); setInviteError(null); }}
                      />
                   </div>
                 </div>
                 <div className="sm:w-48 space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Role</label>
                   <select 
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-bold focus:outline-none focus:border-teal-500 appearance-none"
                    value={newInvite.role}
                    onChange={e => setNewInvite({ ...newInvite, role: e.target.value as Role })}
                   >
                     <option value="Manager">Manager</option>
                     <option value="Team Lead">Team Lead</option>
                     <option value="PM">Project Manager</option>
                     <option value="Finance">Finance</option>
                     <option value="Executive">Executive</option>
                   </select>
                 </div>
                 <div className="flex items-end">
                   <button 
                     disabled={!newInvite.email || !newInvite.name || inviteStatus === 'sending'}
                     onClick={() => {
                        if (invites.some(i => i.email === newInvite.email)) {
                          setInviteError('This email has already been added to the list');
                          return;
                        }
                        setInvites([...invites, newInvite]);
                        setNewInvite({ email: '', role: 'PM', name: '' });
                     }}
                     className="h-[60px] px-6 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                   >
                     Add
                   </button>
                 </div>
               </div>

               {inviteError && <p className="text-xs font-bold text-red-500 pl-1">{inviteError}</p>}

               {invites.length > 0 && (
                 <div className="pt-4 divide-y divide-slate-50 border-t border-slate-50">
                    {invites.map((invite, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between group">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 px-2 font-black text-[10px]">
                              {invite.role[0]}
                            </div>
                            <div>
                               <p className="text-sm font-bold text-slate-900">{invite.name || invite.email}</p>
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{invite.role}</p>
                            </div>
                         </div>
                         <button 
                          onClick={() => setInvites(invites.filter((_, i) => i !== idx))}
                          disabled={inviteStatus === 'sending'}
                          className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-30"
                         >
                           <Trash2 className="w-4 h-4" />
                         </button>
                      </div>
                    ))}
                 </div>
               )}
            </div>

            <div className="pt-8 flex flex-col items-center gap-4">
              {inviteStatus !== 'idle' && (
                <div className={cn(
                  "w-full p-4 rounded-2xl flex items-center gap-3",
                  inviteStatus === 'sending' ? "bg-slate-50 text-slate-600" :
                  inviteStatus === 'success' ? "bg-emerald-50 text-emerald-600" :
                  "bg-red-50 text-red-600"
                )}>
                  {inviteStatus === 'sending' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                   inviteStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> : 
                   <AlertTriangle className="w-4 h-4" />}
                  <span className="text-xs font-bold">{inviteMessage}</span>
                </div>
              )}
              
              <div className="w-full flex items-center justify-between gap-4">
                <button 
                  onClick={handleNext}
                  className="text-slate-400 font-bold hover:text-slate-600 transition-colors uppercase tracking-widest text-[10px]"
                >
                  Skip this step
                </button>
                <button 
                  onClick={handleSendInvites}
                  disabled={inviteStatus === 'sending'}
                  className="px-8 py-4 bg-teal-600 text-white rounded-2xl font-black shadow-lg shadow-teal-100 hover:bg-teal-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {inviteStatus === 'sending' ? 'Sending...' : 
                   invites.length > 0 ? `Send ${invites.length} Invites & Continue` : 'Continue'}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );

      case 'import':
        return (
          <div className="space-y-8 max-w-5xl mx-auto py-6">
            <div className="space-y-2 text-center">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Import Your Projects</h2>
              <p className="text-slate-500 font-medium">Already tracking projects elsewhere? Import them here to hit the ground running.</p>
            </div>

            {formData.serviceBaselines.length === 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 mx-auto max-w-3xl">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">Configuration Warning</p>
                  <p className="text-xs font-bold text-amber-700 leading-relaxed">
                    Service types are not configured. Imported projects will have incomplete data — Expected Duration and SPI cannot be calculated. Complete service configuration first in Settings.
                  </p>
                </div>
              </div>
            )}

            <div className="scale-90 origin-top -mt-8">
              <BulkImportView 
                onImport={(added, updated) => {
                  console.log(`Imported ${added} projects`);
                  handleNext();
                }}
                userRole={userRole}
              />
            </div>

            <div className="pt-8 flex flex-col items-center gap-4">
               <button 
                  onClick={async () => {
                    await onUpdateConfig({ ...formData, isSetupComplete: true });
                    onFinish();
                  }}
                  className="px-12 py-5 bg-slate-900 text-white rounded-2xl font-black shadow-2xl hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  Skip — go to dashboard
                </button>
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Final Step</span>
                </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-50 flex flex-col overflow-y-auto">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-teal-50 rounded-bl-[100%] transition-all -z-10 opacity-30" />
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-slate-100 rounded-tr-[100%] transition-all -z-10 opacity-30" />

      {/* Progress Bar */}
      {currentStep !== 'welcome' && (
        <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center px-12 h-20 shrink-0">
          <div className="flex-1 flex items-center justify-between max-w-5xl mx-auto">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center text-white font-black">
                 {stepIndex}
               </div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Step {stepIndex} of {steps.length - 1}</p>
                  <p className="text-sm font-bold text-slate-900 capitalize">{currentStep} configuration</p>
               </div>
             </div>
             <div className="flex gap-1.5">
               {steps.slice(1).map((s, idx) => (
                 <div 
                  key={s} 
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-500",
                    steps.indexOf(currentStep) >= steps.indexOf(s) ? "bg-teal-600 w-12" : "bg-slate-200 w-4"
                  )} 
                 />
               ))}
             </div>
          </div>
          <button 
            onClick={onSkip}
            className="p-3 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-12 py-20 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <div className="p-8 text-center shrink-0">
         <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Built for high-performance project delivery</p>
      </div>
    </div>
  );
};
