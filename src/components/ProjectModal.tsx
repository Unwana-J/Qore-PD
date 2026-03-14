import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { PACKAGES, PRODUCT_LINES, DEFAULT_MILESTONES } from '../constants';
import { Project, Milestone, Role } from '../types';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (project: Partial<Project>, force?: boolean) => Promise<any>;
  userRole: Role;
  getPMWorkload: (pmName: string) => Record<string, number>;
  workloadThresholds: Record<string, number>;
  themeColor?: string;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({ isOpen, onClose, onSubmit, userRole, themeColor = 'teal' }) => {
  const [formData, setFormData] = useState({
    clientName: '',
    packageName: '',
    assignedPM: userRole === 'PM' ? 'Sarah Jenkins' : '',
    startDate: '',
    value: '',
    priority: 'P2' as any,
  });

  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const theme = getThemeClasses(themeColor);

  useEffect(() => {
    if (formData.packageName) {
      const pkg = PACKAGES.find(p => p.name === formData.packageName);
      if (pkg) {
        const autoServices = PRODUCT_LINES
          .filter(pl => pkg.productLines.includes(pl.name))
          .flatMap(pl => pl.services);
        setSelectedServices(autoServices);
      }
    }
  }, [formData.packageName]);

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
    
    const pkg = PACKAGES.find(p => p.name === formData.packageName);
    const milestones: Milestone[] = DEFAULT_MILESTONES.map((m, i) => ({
      id: `m-${Date.now()}-${i}`,
      name: m,
      targetDate: formData.startDate,
      status: 'Pending'
    }));

    try {
      const result = await onSubmit({
        ...formData,
        value: Number(formData.value),
        services: selectedServices,
        productLines: pkg?.productLines || [],
        state: 'Active',
        milestones,
        comments: [],
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

  const toggleService = (service: string) => {
    setSelectedServices(prev => 
      prev.includes(service) ? prev.filter(s => s !== service) : [...prev, service]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-xl font-bold text-slate-900">Create New Project</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Client Name</label>
              <input 
                required
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                  theme.ring, theme.focusBorder
                )}
                value={formData.clientName}
                onChange={e => setFormData({...formData, clientName: e.target.value})}
              />
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
                {PACKAGES.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Assigned PM</label>
              <input 
                required
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all",
                  theme.ring, theme.focusBorder
                )}
                value={formData.assignedPM}
                onChange={e => setFormData({...formData, assignedPM: e.target.value})}
              />
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
                <option value="P1">P1 - Highest Priority</option>
                <option value="P2">P2 - Standard Priority</option>
                <option value="P3">P3 - Lower Priority</option>
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
              <label className="text-xs font-bold text-slate-500 uppercase">Project Value ($)</label>
              <input 
                required
                type="number"
                className={cn(
                  "w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 outline-none transition-all font-mono",
                  theme.ring, theme.focusBorder
                )}
                value={formData.value}
                onChange={e => setFormData({...formData, value: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-slate-500 uppercase">Services in Scope</label>
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", theme.lightText, theme.lightBg)}>
                {selectedServices.length} Services Selected
              </span>
            </div>
            
            <div className="space-y-4">
              {PRODUCT_LINES.filter(pl => {
                // Only show product lines that have at least one selected service
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

              {selectedServices.length === 0 && (
                <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-2xl">
                  <p className="text-sm text-slate-400 italic">No services selected. Select a package to auto-populate.</p>
                </div>
              )}
            </div>

            {/* Manual Add Section */}
            <div className="pt-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Add More Services</p>
              <div className="flex flex-wrap gap-2">
                {PRODUCT_LINES.flatMap(pl => pl.services)
                  .filter(s => !selectedServices.includes(s))
                  .map(service => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={cn(
                        "px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 transition-all",
                        theme.hoverBorder, theme.hoverText
                      )}
                    >
                      + {service}
                    </button>
                  ))}
              </div>
            </div>
          </div>

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
                className="px-4 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                Confirm Override
              </button>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className={cn(
                "flex-1 px-6 py-3 text-white font-bold rounded-xl transition-all shadow-lg",
                theme.bg, theme.hoverBg, theme.shadow
              )}
            >
              Create Project
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
