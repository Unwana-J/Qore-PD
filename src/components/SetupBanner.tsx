import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckCircle2, 
  Circle, 
  AlertTriangle, 
  ChevronRight, 
  X,
  Building2,
  DollarSign,
  Layers,
  Settings2,
  Activity,
  Users
} from 'lucide-react';
import { AppConfig, Role } from '../types';
import { cn } from '../lib/utils';
import { getThemeClasses } from '../lib/theme';

interface SetupBannerProps {
  config: AppConfig;
  userRole: Role;
  onUpdateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  onNavigateToSettings: (tab: string) => void;
  themeColor?: string;
}

export const SetupBanner: React.FC<SetupBannerProps> = ({ 
  config, 
  userRole, 
  onUpdateConfig, 
  onNavigateToSettings,
  themeColor = 'teal'
}) => {
  const isAdmin = ['Superadmin', 'Manager'].includes(userRole);
  const isSuperAdmin = userRole === 'Superadmin';

  if (!isAdmin || config.isSetupComplete) return null;

  const checklistItems = [
    {
      id: 'profile',
      label: 'Organisation profile (name and logo)',
      isDone: !!(config.orgName && config.logoUrl),
      icon: <Building2 className="w-4 h-4" />,
      tab: 'brand',
      critical: false
    },
    {
      id: 'currency',
      label: 'Default currency configured',
      isDone: !!config.defaultCurrency,
      icon: <DollarSign className="w-4 h-4" />,
      tab: 'currencies',
      critical: false
    },
    {
      id: 'services',
      label: 'Service types and baseline durations configured',
      isDone: (config.serviceBaselines || []).length > 0,
      icon: <Layers className="w-4 h-4" />,
      tab: 'packages',
      critical: true
    },
    {
      id: 'weights',
      label: 'Phase weights configured',
      isDone: !!config.projectLifecycleWeights,
      icon: <Settings2 className="w-4 h-4" />,
      tab: 'project',
      critical: false
    },
    {
      id: 'thresholds',
      label: 'SPI thresholds configured',
      isDone: !!config.spiThresholds,
      icon: <Activity className="w-4 h-4" />,
      tab: 'performance',
      critical: false
    },
    {
      id: 'team',
      label: 'Team members invited',
      isDone: (config.maxImportRows > 0), // Simple proxy for "have we used the app" or check users table
      icon: <Users className="w-4 h-4" />,
      tab: 'users',
      critical: false
    }
  ];

  const dismissedItems = config.dismissedChecklistItems || [];
  const visibleItems = checklistItems.filter(item => !dismissedItems.includes(item.id));
  const activeItems = visibleItems.filter(item => !item.isDone);

  if (activeItems.length === 0) return null;

  const handleDismiss = async (id: string) => {
    if (!window.confirm("Mark this item as not applicable? It will be removed from your checklist.")) return;
    const newDismissed = [...dismissedItems, id];
    await onUpdateConfig({ dismissedChecklistItems: newDismissed });
  };

  const theme = getThemeClasses(themeColor);

  return (
    <motion.div 
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8 bg-white rounded-3xl border-2 border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden"
    >
      <div className="flex flex-col md:flex-row">
        {/* Left: Branding & Status */}
        <div className="bg-slate-900 md:w-80 p-8 flex flex-col justify-between relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
           <div className="space-y-4 relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/10">
                 <Settings2 className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white tracking-tight">Setup Checklist</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                  {checklistItems.filter(i => i.isDone).length} of {checklistItems.length} Complete
                </p>
              </div>
           </div>
           
           <div className="mt-8 relative z-10">
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(checklistItems.filter(i => i.isDone).length / checklistItems.length) * 100}%` }}
                  className="h-full bg-teal-400 rounded-full shadow-[0_0_10px_rgba(45,212,191,0.5)]" 
                />
              </div>
           </div>
        </div>

        {/* Right: Items */}
        <div className="flex-1 p-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {visibleItems.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => onNavigateToSettings(item.tab)}
                className={cn(
                  "group relative p-4 rounded-2xl border-2 transition-all cursor-pointer select-none",
                  item.isDone 
                    ? "bg-slate-50 border-slate-100 opacity-60" 
                    : "bg-white border-slate-100 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-50"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-xl border transition-colors",
                    item.isDone ? "bg-emerald-50 text-emerald-500 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-teal-50 group-hover:text-teal-600 group-hover:border-teal-100"
                  )}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn(
                        "text-[10px] font-black uppercase tracking-widest leading-none",
                        item.isDone ? "text-emerald-600" : "text-slate-400 group-hover:text-teal-600"
                      )}>
                        {item.isDone ? 'Complete' : 'Pending'}
                      </p>
                      {item.critical && !item.isDone && (
                        <span className="flex items-center gap-1 text-[8px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter animate-pulse">
                          Critical
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-sm font-bold mt-1.5 leading-tight",
                      item.isDone ? "text-slate-500 line-through" : "text-slate-900 group-hover:text-teal-900"
                    )}>
                      {item.label}
                    </p>
                  </div>
                  {!item.isDone && (
                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-400 transition-all group-hover:translate-x-1" />
                  )}
                </div>

                {/* Dismiss Button (Super Admin only) */}
                {isSuperAdmin && !item.isDone && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDismiss(item.id); }}
                    className="absolute -top-2 -right-2 p-1.5 bg-white border border-slate-200 rounded-full text-slate-300 hover:text-red-500 hover:border-red-200 hover:shadow-md transition-all opacity-0 group-hover:opacity-100"
                    title="Dismiss item"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}

                {/* Completed Checkmark Overlay */}
                {item.isDone && (
                   <div className="absolute top-2 right-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                   </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Footer Warning if critical items missing */}
      {activeItems.some(i => i.critical) && (
        <div className="px-8 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between gap-4">
           <div className="flex items-center gap-2 text-red-600">
             <AlertTriangle className="w-4 h-4 shrink-0" />
             <p className="text-[10px] font-black uppercase tracking-widest">
               Critical setup required: Some features may be restricted until services are configured.
             </p>
           </div>
           <button 
            onClick={() => onNavigateToSettings('packages')}
            className="text-[10px] font-black text-red-600 hover:underline uppercase tracking-widest"
           >
             Go to Service Config
           </button>
        </div>
      )}
    </motion.div>
  );
};
