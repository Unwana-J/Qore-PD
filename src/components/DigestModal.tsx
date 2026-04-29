import React from 'react';
import { DigestData } from '../types';
import { format, parseISO } from 'date-fns';
import {
  X, BarChart2, CheckCircle2, AlertTriangle, Pause,
  TrendingUp, Users, DollarSign, Clock, ChevronRight,
  AlertCircle, RefreshCw, Wallet
} from 'lucide-react';
import { formatCompactCurrency, cn } from '../lib/utils';
import { motion } from 'motion/react';
import { getThemeClasses } from '../lib/theme';

interface DigestModalProps {
  digest: DigestData;
  historicalDigests?: DigestData[];
  themeColor?: string;
  userRole?: string;
  onClose: () => void;
  onNavigate: (view: string, filter?: string, pmFilter?: string) => void;
}

export const DigestModal: React.FC<DigestModalProps> = ({
  digest, historicalDigests = [], themeColor = 'teal', userRole, onClose, onNavigate
}) => {
  const theme = getThemeClasses(themeColor);
  const [selectedWeek, setSelectedWeek] = React.useState<string>(digest.weekOf);
  
  React.useEffect(() => {
    setSelectedWeek(digest.weekOf);
  }, [digest.weekOf]);

  const displayDigest = historicalDigests.find(d => d.weekOf === selectedWeek) || digest;


  const formatValues = (vals: Record<string, number>) =>
    Object.entries(vals).map(([code, v]) => formatCompactCurrency(v, code)).join(' · ') || '—';

  const getPMColour = (days: number) => {
    if (days >= 14) return { dot: 'bg-red-500', badge: 'bg-red-50 text-red-600', label: `${days}d` };
    if (days >= 7)  return { dot: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600', label: `${days}d` };
    return           { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-600', label: `${days}d` };
  };

  const healthPct = displayDigest.totalActive > 0
    ? Math.round((displayDigest.onTrackCount / displayDigest.totalActive) * 100)
    : 0;

  // Build the list of available weeks (current + history)
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

  const isPM = userRole === 'PM';
  const isFinance = userRole === 'Finance';
  const isAdmin = ['Superadmin', 'Manager', 'Team Lead'].includes(userRole || '');

  const title = isPM ? 'Personal Weekly Snapshot' : isFinance ? 'Financial Portfolio Digest' : 'Portfolio Snapshot';
  const Icon = isFinance ? Wallet : isPM ? CheckCircle2 : BarChart2;

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
                <Icon className={cn('w-5 h-5', theme.text)} />
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Weekly Digest</p>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              {title}
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

        {/* Body — scrollable */}
        <div className="bg-white overflow-y-auto flex-1 divide-y divide-slate-100">
          
          {/* Billing Pipeline (Top for Finance) */}
          {isFinance && (
            <section className="px-8 py-6 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Billing Pipeline</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => onNavigate('projects', 'Signed Off')}
                  className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left hover:scale-105 transition-all active:scale-95 group"
                >
                  <p className="text-2xl font-black text-amber-700 leading-none">{displayDigest.awaitingBillingCount}</p>
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mt-2">Awaiting Finance</p>
                  {Object.keys(displayDigest.awaitingBillingValue).length > 0 && (
                    <p className="text-xs font-bold text-amber-500 mt-1 font-mono">{formatValues(displayDigest.awaitingBillingValue)}</p>
                  )}
                  <ChevronRight className="w-3 h-3 text-amber-400 mt-2 group-hover:translate-x-1 transition-transform" />
                </button>
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <p className="text-2xl font-black text-emerald-700 leading-none">{displayDigest.billedThisWeekCount}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-2">Billed This Week</p>
                  {Object.keys(displayDigest.billedThisWeekValue).length > 0 && (
                    <p className="text-xs font-bold text-emerald-500 mt-1 font-mono">{formatValues(displayDigest.billedThisWeekValue)}</p>
                  )}
                </div>
                <div className={cn('p-4 rounded-2xl border', displayDigest.billingRejectionsThisWeek > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
                  <p className={cn('text-2xl font-black leading-none', displayDigest.billingRejectionsThisWeek > 0 ? 'text-red-700' : 'text-slate-400')}>{displayDigest.billingRejectionsThisWeek}</p>
                  <p className={cn('text-[10px] font-black uppercase tracking-wider mt-2', displayDigest.billingRejectionsThisWeek > 0 ? 'text-red-600' : 'text-slate-400')}>Finance Rejections</p>
                  <p className="text-[10px] text-slate-400 mt-1">this week</p>
                </div>
              </div>
            </section>
          )}

          {/* Portfolio Overview */}
          <section className="px-8 py-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{isPM ? 'Your Projects' : 'Portfolio Health'}</h3>
              {displayDigest.completedThisWeek > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  <CheckCircle2 className="w-3 h-3" />
                  {displayDigest.completedThisWeek} completed this week
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Active', value: displayDigest.totalActive, icon: <TrendingUp className="w-4 h-4" />, colour: 'text-slate-900', bg: 'bg-slate-50 border-slate-200', action: displayDigest.totalActive > 0 ? () => onNavigate('projects', 'All') : undefined },
                { label: 'On-Track', value: `${displayDigest.onTrackCount} (${healthPct}%)`, icon: <CheckCircle2 className="w-4 h-4" />, colour: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', action: displayDigest.onTrackCount > 0 ? () => onNavigate('projects', 'On-Track') : undefined },
                { label: 'Delayed', value: displayDigest.delayedCount, icon: <AlertTriangle className="w-4 h-4" />, colour: 'text-red-700', bg: 'bg-red-50 border-red-200', action: displayDigest.delayedCount > 0 ? () => onNavigate('projects', 'Delayed') : undefined },
                { label: 'Suspended', value: displayDigest.suspendedCount, icon: <Pause className="w-4 h-4" />, colour: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', action: displayDigest.suspendedCount > 0 ? () => onNavigate('projects', 'Suspended') : undefined },
              ].map(stat => (
                <button
                  key={stat.label}
                  onClick={stat.action}
                  disabled={!stat.action}
                  className={cn(
                    'p-4 rounded-2xl border flex flex-col gap-2 text-left transition-all',
                    stat.bg,
                    stat.action ? 'hover:scale-105 cursor-pointer active:scale-95' : 'cursor-default'
                  )}
                >
                  <div className={stat.colour}>{stat.icon}</div>
                  <p className={cn('text-2xl font-black leading-none', stat.colour)}>{stat.value}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                </button>
              ))}
            </div>
          </section>

          {/* PM Activity (Admins/Managers Only) */}
          {!isPM && !isFinance && (
            <section className="px-8 py-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">PM Inactivity</h3>
              </div>
              {displayDigest.pmActivity.length === 0 ? (
                <div className="flex items-center gap-3 py-3 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm font-semibold">All PMs have updated their projects recently.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {displayDigest.pmActivity.slice(0, 8).map(pm => {
                    const c = getPMColour(pm.lastUpdatedDaysAgo);
                    return (
                      <button 
                        key={pm.pmName} 
                        onClick={() => onNavigate('projects', 'All', pm.pmName)}
                        className="w-full flex items-center gap-3 py-2.5 px-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-white hover:shadow-sm transition-all group active:scale-[0.98]"
                      >
                        <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shrink-0 group-hover:bg-slate-300 transition-colors">
                          {pm.pmName.split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <p className="flex-1 text-sm font-semibold text-slate-900 text-left">{pm.pmName}</p>
                        <span className="text-[10px] font-bold text-slate-400">{pm.projectCount} project{pm.projectCount !== 1 ? 's' : ''}</span>
                        <span className={cn('px-2 py-1 rounded-lg text-[10px] font-black', c.badge)}>
                          {c.label} ago
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* Billing Pipeline (Standard for non-Finance) */}
          {!isFinance && (
            <section className="px-8 py-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">{isPM ? 'Your Billing Rejections' : 'Billing Pipeline'}</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {!isPM && (
                  <button
                    onClick={() => onNavigate('projects', 'Signed Off')}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left hover:scale-105 transition-all active:scale-95 group"
                  >
                    <p className="text-2xl font-black text-amber-700 leading-none">{displayDigest.awaitingBillingCount}</p>
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider mt-2">Awaiting Finance</p>
                    {Object.keys(displayDigest.awaitingBillingValue).length > 0 && (
                      <p className="text-xs font-bold text-amber-500 mt-1 font-mono">{formatValues(displayDigest.awaitingBillingValue)}</p>
                    )}
                    <ChevronRight className="w-3 h-3 text-amber-400 mt-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                )}
                {!isPM && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                    <p className="text-2xl font-black text-emerald-700 leading-none">{displayDigest.billedThisWeekCount}</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mt-2">Billed This Week</p>
                    {Object.keys(displayDigest.billedThisWeekValue).length > 0 && (
                      <p className="text-xs font-bold text-emerald-500 mt-1 font-mono">{formatValues(displayDigest.billedThisWeekValue)}</p>
                    )}
                  </div>
                )}
                <div className={cn('p-4 rounded-2xl border col-span-1', isPM && 'col-span-3', displayDigest.billingRejectionsThisWeek > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200')}>
                  <p className={cn('text-2xl font-black leading-none', displayDigest.billingRejectionsThisWeek > 0 ? 'text-red-700' : 'text-slate-400')}>{displayDigest.billingRejectionsThisWeek}</p>
                  <p className={cn('text-[10px] font-black uppercase tracking-wider mt-2', displayDigest.billingRejectionsThisWeek > 0 ? 'text-red-600' : 'text-slate-400')}>
                    {isPM ? 'Your Rejected Sign-offs' : 'Finance Rejections'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">this week</p>
                </div>
              </div>
            </section>
          )}

          {/* Rebaseline Queue (Admins/Managers Only) */}
          {!isFinance && !isPM && (
            <section className="px-8 py-6">
              <div className="flex items-center gap-2 mb-4">
                <RefreshCw className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Rebaseline Queue</h3>
              </div>
              {displayDigest.pendingRebaselineCount === 0 ? (
                <div className="flex items-center gap-3 py-3 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <p className="text-sm font-semibold">No pending rebaseline requests.</p>
                </div>
              ) : (
                <button
                  onClick={() => onNavigate('rebaseline-requests')}
                  className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-2xl hover:scale-[1.01] transition-all active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-sm font-black text-indigo-900">
                        {displayDigest.pendingRebaselineCount} pending request{displayDigest.pendingRebaselineCount !== 1 ? 's' : ''}
                      </p>
                      {displayDigest.oldestRebaselineDays > 0 && (
                        <p className="text-xs text-indigo-500 mt-0.5">Oldest: {displayDigest.oldestRebaselineDays} day{displayDigest.oldestRebaselineDays !== 1 ? 's' : ''} waiting</p>
                      )}
                    </div>
                    {displayDigest.oldestRebaselineDays >= 5 && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">
                        <AlertCircle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-indigo-400 group-hover:translate-x-1 transition-transform" />
                </button>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex items-center justify-between shrink-0">
          <p className="text-[10px] text-slate-400 font-medium">
            Generated {displayDigest.generatedAt ? format(displayDigest.generatedAt, 'EEE, dd MMM yyyy') : 'Live'}
            {selectedWeek === digest.weekOf ? ' · Refreshes weekly' : ' · Historical snapshot'}
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
