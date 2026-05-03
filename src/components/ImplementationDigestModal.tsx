import React from 'react';
import { ImplementationDigestData, IMDigestActivityEntry } from '../types';
import { format, parseISO } from 'date-fns';
import {
  X, BarChart2, CheckCircle2, AlertTriangle, Pause,
  TrendingUp, Users, Clock, ChevronRight,
  AlertCircle, Layers, Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { getThemeClasses } from '../lib/theme';

interface ImplementationDigestModalProps {
  digest: ImplementationDigestData;
  historicalDigests?: ImplementationDigestData[];
  themeColor?: string;
  onClose: () => void;
  onNavigate: (view: string, filter?: string, imFilter?: string) => void;
}

export const ImplementationDigestModal: React.FC<ImplementationDigestModalProps> = ({
  digest, historicalDigests = [], themeColor = 'teal', onClose, onNavigate
}) => {
  const theme = getThemeClasses(themeColor);
  const [selectedWeek, setSelectedWeek] = React.useState<string>(digest.weekOf);
  
  React.useEffect(() => {
    setSelectedWeek(digest.weekOf);
  }, [digest.weekOf]);

  const displayDigest = historicalDigests.find(d => d.weekOf === selectedWeek) || digest;

  const getIMColour = (days: number) => {
    if (days >= 14) return { dot: 'bg-red-500', badge: 'bg-red-50 text-red-600', label: `${days}d` };
    if (days >= 7)  return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600', label: `${days}d` };
    return           { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600', label: `${days}d` };
  };

  // Build the list of available weeks
  const availableWeeks = React.useMemo(() => {
    const weeksMap = new Map<string, string>();
    weeksMap.set(digest.weekOf, 'Current Week');
    historicalDigests.forEach(d => {
      if (d.weekOf !== digest.weekOf) {
        weeksMap.set(d.weekOf, format(parseISO(d.weekOf), 'dd MMM yyyy'));
      }
    });
    return Array.from(weeksMap.entries());
  }, [digest.weekOf, historicalDigests]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="relative bg-slate-900 px-8 py-7 flex items-start justify-between shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-1">
              <div className={cn('p-2 rounded-xl', theme.lightBg)}>
                <Layers className={cn('w-5 h-5', theme.text)} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Implementation Digest</p>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Weekly Review Snapshot
            </h2>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Week of:</span>
              <select
                value={selectedWeek}
                onChange={e => setSelectedWeek(e.target.value)}
                className="bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-700 outline-none focus:ring-2 focus:ring-teal-500 transition-all cursor-pointer"
              >
                {availableWeeks.map(([weekValue, weekLabel]) => (
                  <option key={weekValue} value={weekValue}>{weekLabel}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={onClose}
            className="relative p-2 text-slate-500 hover:bg-white/10 hover:text-white rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="bg-white overflow-y-auto flex-1 divide-y divide-slate-100">
          
          {/* High Level Stats */}
          <section className="px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Portfolio Health</h3>
              {displayDigest.completedThisWeek > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  <CheckCircle2 className="w-3 h-3" />
                  {displayDigest.completedThisWeek} completed this week
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Active', value: displayDigest.totalActive, icon: <TrendingUp className="w-4 h-4" />, colour: 'text-slate-900', bg: 'bg-slate-50 border-slate-200', action: () => onNavigate('implementations', 'All') },
                { label: 'Completed', value: displayDigest.completedThisWeek, icon: <CheckCircle2 className="w-4 h-4" />, colour: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', action: () => onNavigate('implementations', 'Completed') },
                { label: 'Overdue', value: displayDigest.overdueCount, icon: <AlertCircle className="w-4 h-4" />, colour: 'text-red-700', bg: 'bg-red-50 border-red-200', action: () => onNavigate('implementations', 'Delayed') },
                { label: 'Open Issues', value: displayDigest.openIssuesCount || 0, icon: <AlertTriangle className="w-4 h-4" />, colour: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', action: () => onNavigate('implementations', 'All') },
              ].map(stat => (
                <button
                  key={stat.label}
                  onClick={stat.action}
                  className={cn(
                    'p-4 rounded-2xl border flex flex-col gap-2 text-left transition-all hover:scale-105 active:scale-95 group',
                    stat.bg
                  )}
                >
                  <div className={cn(stat.colour, "group-hover:scale-110 transition-transform")}>{stat.icon}</div>
                  <p className={cn('text-2xl font-black leading-none', stat.colour)}>{stat.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Pending Requests */}
          <section className="px-8 py-6 bg-slate-50/30">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Review Items</h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Mappings', count: displayDigest.mappingRequestsPending, color: 'indigo', action: () => onNavigate('implementations', 'Mapping Pending') },
                { label: 'Suspensions', count: displayDigest.suspensionRequestsPending, color: 'amber', action: () => onNavigate('implementations', 'Suspension Pending') },
                { label: 'Extensions', count: displayDigest.dateExtensionRequestsPending, color: 'rose', action: () => onNavigate('implementations', 'Extension Pending') }
              ].map(item => (
                <button 
                  key={item.label} 
                  onClick={item.count > 0 ? item.action : undefined}
                  disabled={item.count === 0}
                  className={cn(
                  'p-4 rounded-2xl border transition-all flex flex-col gap-1 text-left',
                  item.count > 0 ? `bg-${item.color}-50 border-${item.color}-200 hover:scale-105 active:scale-95 cursor-pointer` : 'bg-white border-slate-100 opacity-60 cursor-default'
                )}>
                  <p className={cn('text-2xl font-black', item.count > 0 ? `text-${item.color}-700` : 'text-slate-300')}>{item.count}</p>
                  <div className="flex items-center justify-between">
                    <p className={cn('text-[10px] font-black uppercase tracking-wider', item.count > 0 ? `text-${item.color}-600` : 'text-slate-400')}>Pending {item.label}</p>
                    {item.count > 0 && <ChevronRight className={cn("w-3 h-3", `text-${item.color}-400`)} />}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* IM Inactivity */}
          <section className="px-8 py-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">IM Inactivity</h3>
            </div>
            <div className="space-y-2">
              {displayDigest.imActivity.length === 0 ? (
                <div className="flex items-center gap-3 py-3 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm font-semibold">All IMs have updated their implementations recently.</p>
                </div>
              ) : (
                displayDigest.imActivity.map(im => {
                  const c = getIMColour(im.lastUpdatedDaysAgo);
                  return (
                    <button 
                      key={im.imName} 
                      onClick={() => onNavigate('implementations', 'All', im.imName)}
                      className="w-full flex items-center gap-3 py-2.5 px-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-white hover:shadow-sm transition-all group active:scale-[0.98]"
                    >
                      <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shrink-0 group-hover:bg-teal-100 group-hover:text-teal-700 transition-colors">
                        {im.imName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-slate-900">{im.imName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{im.totalActive} implementation{im.totalActive !== 1 ? 's' : ''}</span>
                          {im.overdueCount > 0 && (
                            <span className="text-[10px] font-black text-red-500 uppercase tracking-wider">· {im.overdueCount} Overdue</span>
                          )}
                        </div>
                      </div>
                      <span className={cn('px-2 py-1 rounded-lg text-[10px] font-black', c.badge)}>
                        {c.label} ago
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Upcoming Deadlines */}
          <section className="px-8 py-6 bg-slate-50/50">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Upcoming Deadlines (7 Days)</h3>
            </div>
            {displayDigest.upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No deadlines approaching in the next 7 days.</p>
            ) : (
              <div className="space-y-2">
                {displayDigest.upcomingDeadlines.slice(0, 5).map(deadline => (
                  <div key={deadline.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-teal-200 transition-all">
                    <div>
                      <p className="text-sm font-black text-slate-900">{deadline.clientName}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">{deadline.serviceName} · {deadline.im}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900">{format(parseISO(deadline.targetDate), 'MMM dd')}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Due date</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-400 font-medium">
            Generated {displayDigest.generatedAt ? format(new Date(displayDigest.generatedAt), 'EEE, dd MMM yyyy') : 'Live'}
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white text-xs font-black rounded-xl hover:bg-slate-800 transition-all active:scale-95"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};
