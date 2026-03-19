import React, { useState, useMemo } from 'react';
import { Project, Role, ProductLine } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { 
  TrendingUp, 
  Award, 
  DollarSign, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Calendar,
  User,
  ArrowUpDown,
  Check,
  ChevronRight,
  Filter
} from 'lucide-react';
import { getThemeClasses } from '../lib/theme';
import { format, differenceInDays, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface FinanceDashboardProps {
  projects: Project[];
  onBillProject: (projectId: string) => Promise<any>;
  themeColor?: string;
  currencies: any[];
}

type SortField = 'clientName' | 'signedOffAt' | 'value' | 'assignedPM';
type SortOrder = 'asc' | 'desc';

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ projects, onBillProject, themeColor = 'teal', currencies }) => {
  const theme = getThemeClasses(themeColor);
  const [currencyFilter, setCurrencyFilter] = useState<'All' | string>('All');
  const [sortField, setSortField] = useState<SortField>('signedOffAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [billingConfirmation, setBillingConfirmation] = useState<Project | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const now = new Date();

  // Filter projects based on currency toggle
  const filteredProjects = useMemo(() => {
    if (currencyFilter === 'All') return projects;
    return projects.filter(p => p.currency === currencyFilter);
  }, [projects, currencyFilter]);

  // Revenue Stats
  const getGroupedRevenue = (filterFn: (p: Project) => boolean) => {
    const totals: Record<string, number> = {};
    filteredProjects.filter(filterFn).forEach(p => {
      totals[p.currency] = (totals[p.currency] || 0) + p.value;
    });
    return totals;
  };

  const intakeGroups = getGroupedRevenue(() => true);
  const pendingGroups = getGroupedRevenue(p => p.state !== 'Billed' && p.state !== 'Closed');
  const achievedGroups = getGroupedRevenue(p => p.state === 'Billed' || p.state === 'Closed');
  
  const readyForBillingQueue = useMemo(() => {
    return projects
      .filter(p => p.state === 'Signed Off')
      .sort((a, b) => {
        let comparison = 0;
        if (sortField === 'clientName') comparison = a.clientName.localeCompare(b.clientName);
        else if (sortField === 'signedOffAt') {
          comparison = (a.signedOffAt || '').localeCompare(b.signedOffAt || '');
        }
        else if (sortField === 'value') comparison = a.value - b.value;
        else if (sortField === 'assignedPM') comparison = a.assignedPM.localeCompare(b.assignedPM);
        
        return sortOrder === 'asc' ? comparison : -comparison;
      });
  }, [projects, sortField, sortOrder]);

  const signedOffCount = projects.filter(p => p.state === 'Signed Off').length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleBillProject = async () => {
    if (!billingConfirmation) return;
    setIsProcessing(true);
    try {
      await onBillProject(billingConfirmation.id);
      setBillingConfirmation(null);
    } catch (error) {
      console.error('Billing failed', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-8 p-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Finance Dashboard</h1>
          <p className="text-slate-500 font-medium mt-1">{format(now, 'EEEE, d MMMM yyyy')}</p>
        </div>
        
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
          <button 
            onClick={() => setCurrencyFilter('All')}
            className={cn(
              "px-4 py-2 text-xs font-bold rounded-lg transition-all",
              currencyFilter === 'All' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            All
          </button>
          {currencies.map(c => (
            <button 
              key={c.code}
              onClick={() => setCurrencyFilter(c.code)}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                currencyFilter === c.code ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {c.symbol} {c.code}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1 - KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FinanceStatCard 
          label="Total Intake Revenue" 
          values={intakeGroups} 
          subValue="All contracted revenue" 
          icon={<TrendingUp className="w-5 h-5" />} 
          themeColor={themeColor} 
        />
        <FinanceStatCard 
          label="Total Pending Revenue" 
          values={pendingGroups} 
          subValue="Unbilled & in progress" 
          icon={<DollarSign className="w-5 h-5" />} 
          themeColor={themeColor} 
        />
        <FinanceStatCard 
          label="Total Achieved Revenue" 
          values={achievedGroups} 
          subValue="Billed & closed" 
          icon={<Award className="w-5 h-5" />} 
          color="emerald"
          themeColor={themeColor} 
        />
        <div className={cn(
          "p-6 rounded-3xl border shadow-sm flex flex-col justify-between transition-all duration-300",
          signedOffCount > 0 
            ? "bg-amber-50 border-amber-200" 
            : "bg-emerald-50 border-emerald-200"
        )}>
          <div className="flex justify-between items-start">
            <p className={cn(
              "text-sm font-bold uppercase tracking-wider",
              signedOffCount > 0 ? "text-amber-600" : "text-emerald-600"
            )}>Signed Off</p>
            <div className={cn(
              "p-2 rounded-xl border",
              signedOffCount > 0 
                ? "bg-amber-100 border-amber-200 text-amber-600" 
                : "bg-emerald-100 border-emerald-200 text-emerald-600"
            )}>
              {signedOffCount > 0 ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
          </div>
          <div>
            <p className={cn(
              "text-4xl font-black mt-4",
              signedOffCount > 0 ? "text-amber-700" : "text-emerald-700"
            )}>
              {signedOffCount === 0 ? 'All clear' : signedOffCount}
            </p>
            <p className={cn(
              "text-xs font-semibold mt-1",
              signedOffCount > 0 ? "text-amber-500" : "text-emerald-500"
            )}>
              {signedOffCount === 0 ? 'No pending items' : 'Awaiting Finance action'}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2 - Billing Queue */}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-xl", theme.lightBg, theme.lightText)}>
              <Activity className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Billing Queue</h2>
          </div>
          <span className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-xs font-bold">
            {readyForBillingQueue.length} Projects
          </span>
        </div>

        <div className="overflow-x-auto">
          {readyForBillingQueue.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/30 border-b border-slate-100">
                  <SortableHeader field="clientName" label="Client / Project" currentField={sortField} order={sortOrder} onSort={handleSort} />
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Package & Scope</th>
                  <SortableHeader field="value" label="Value" currentField={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableHeader field="assignedPM" label="PM" currentField={sortField} order={sortOrder} onSort={handleSort} />
                  <SortableHeader field="signedOffAt" label="Date Flagged" currentField={sortField} order={sortOrder} onSort={handleSort} />
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Wait Time</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readyForBillingQueue.map((project) => {
                  const waitTime = differenceInDays(now, parseISO(project.signedOffAt || project.updatedAt));
                  const isLongWait = waitTime >= 7;

                  return (
                    <motion.tr 
                      key={project.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-1 h-8 rounded-full", getPriorityColor(project.priority))} />
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-teal-600 transition-colors">{project.clientName}</p>
                            <p className="text-xs text-slate-500">{project.packageName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {project.productLines.map(pl => (
                            <span key={pl} className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-extrabold uppercase tracking-tighter">
                              {pl}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="font-mono font-bold text-slate-900">{formatCurrency(project.value, project.currency)}</p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-slate-600">
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold">
                            {project.assignedPM.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-sm font-medium">{project.assignedPM}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <p className="text-sm text-slate-600 font-medium">
                          {project.signedOffAt ? format(parseISO(project.signedOffAt), 'MMM dd, yyyy') : '-'}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold",
                          isLongWait ? "bg-red-50 text-red-600 animate-pulse" : "bg-slate-100 text-slate-500"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          {waitTime} days
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <button 
                          onClick={() => setBillingConfirmation(project)}
                          className={cn(
                            "px-4 py-2 text-white text-xs font-bold rounded-xl transition-all shadow-md group-hover:scale-105 active:scale-95",
                            theme.bg, theme.hoverBg
                          )}
                        >
                          Mark as Billed
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center bg-slate-50/50">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">No projects awaiting billing</h3>
              <p className="text-slate-500">Everything is up to date.</p>
            </div>
          )}
        </div>
      </section>

      {/* Row 3 - Placeholder for Distribution / Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Calendar className={cn("w-5 h-5", theme.text)} />
              Billing Projections
            </h3>
            <div className="h-64 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl">
              <p className="text-slate-400 text-sm italic">Coming Soon: Monthly revenue forecasting based on milestone dates</p>
            </div>
         </div>
         <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <CheckCircle2 className={cn("w-5 h-5", theme.text)} />
              Recently Billed
            </h3>
            <div className="space-y-4">
               {projects.filter(p => p.state === 'Billed').slice(0, 3).map(p => (
                 <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">{p.clientName}</p>
                      <p className="text-xs text-slate-500">Billed on {p.billedAt || p.updatedAt}</p>
                    </div>
                    <p className="font-mono font-bold text-emerald-600">{formatCurrency(p.value, p.currency)}</p>
                 </div>
               ))}
               {projects.filter(p => p.state === 'Billed').length === 0 && (
                 <p className="text-center py-10 text-slate-400 italic">No billed projects yet.</p>
               )}
            </div>
         </div>
      </div>

      {/* Billing Confirmation Modal */}
      <AnimatePresence>
        {billingConfirmation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8 text-center">
                <div className={cn("w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center", theme.lightBg)}>
                   <Check className={cn("w-10 h-10", theme.text)} />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Confirm Billing</h2>
                <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Client</span>
                    <span className="text-sm font-bold text-slate-900">{billingConfirmation.clientName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase">Amount</span>
                    <span className="text-sm font-bold text-emerald-600 font-mono">
                      {formatCurrency(billingConfirmation.value, billingConfirmation.currency)}
                    </span>
                  </div>
                </div>
                <p className="mt-6 text-slate-500 text-sm leading-relaxed">
                  Moving this project to <strong>Billed</strong> state will record today's date as the billing date and update your achieved revenue charts.
                </p>
              </div>
              <div className="px-8 pb-8 flex gap-3">
                <button 
                  disabled={isProcessing}
                  onClick={() => setBillingConfirmation(null)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  disabled={isProcessing}
                  onClick={handleBillProject}
                  className={cn(
                    "flex-1 py-4 text-white font-black rounded-2xl transition-all shadow-lg shadow-teal-500/25 active:scale-95 flex items-center justify-center gap-2",
                    theme.bg, theme.hoverBg
                  )}
                >
                  {isProcessing ? 'Processing...' : 'Confirm'}
                  {!isProcessing && <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FinanceStatCard = ({ label, values, subValue, icon, color = 'theme', themeColor = 'teal' }: any) => {
  const theme = getThemeClasses(themeColor);
  
  const colors: any = {
    theme: `${theme.lightBg} ${theme.lightText} ${theme.lightBorder}`,
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <div className={cn("p-2 rounded-xl border", colors[color])}>
          {icon}
        </div>
      </div>
      <div className="space-y-2">
        {Object.entries(values).map(([code, amount]: any) => (
          <p key={code} className="text-2xl font-black text-slate-900 leading-none font-mono">
            {formatCurrency(amount, code)}
          </p>
        ))}
        {Object.keys(values).length === 0 && <p className="text-2xl font-black text-slate-900">-</p>}
      </div>
      <p className="text-xs font-semibold text-slate-400 mt-4 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
        {subValue}
      </p>
    </div>
  );
};

const SortableHeader = ({ field, label, currentField, order, onSort }: { field: SortField, label: string, currentField: SortField, order: SortOrder, onSort: (f: SortField) => void }) => (
  <th 
    className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100/50 transition-colors"
    onClick={() => onSort(field)}
  >
    <div className="flex items-center gap-1.5">
      {label}
      <ArrowUpDown className={cn("w-3 h-3 transition-colors", currentField === field ? "text-slate-900" : "text-slate-300")} />
    </div>
  </th>
);

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'P1': return 'bg-red-500';
    case 'P2': return 'bg-amber-500';
    case 'P3': return 'bg-sky-500';
    default: return 'bg-slate-400';
  }
};
