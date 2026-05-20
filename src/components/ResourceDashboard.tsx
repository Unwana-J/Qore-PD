import React, { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Project, User, PackageConfig, ServiceBaseline } from '../types';
import { getThemeClasses } from '../lib/theme';
import { useResourceStats, PMStat } from './resource/useResourceStats';
import { PMCard } from './resource/PMCard';
import { PMDetailView } from './resource/PMDetailView';
import { PackageDetailView } from './resource/PackageDetailView';

interface ResourceDashboardProps {
  projects: Project[];
  users: User[];
  packages: PackageConfig[];
  serviceBaselines: ServiceBaseline[];
  onUpdateProject?: (project: Project) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onUpdateUser?: (userId: string, updates: Partial<User>) => Promise<void>;
  onViewProject?: (project: Project) => void;
  themeColor?: string;
}

type ViewState = 'overview' | 'pm-detail' | 'package-detail';
const PAGE_SIZE = 10;

export const ResourceDashboard: React.FC<ResourceDashboardProps> = ({
  projects, users, packages, serviceBaselines,
  onUpdateProject, onShowToast, onUpdateUser, onViewProject, themeColor = 'teal'
}) => {
  const theme = getThemeClasses(themeColor);
  const pmStats = useResourceStats(projects, users, packages, serviceBaselines);

  const [view, setView] = useState<ViewState>('overview');
  const [selectedPM, setSelectedPM] = useState<PMStat | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [overviewPage, setOverviewPage] = useState(1);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editWipValue, setEditWipValue] = useState(30);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveWip = async (userId: string) => {
    if (!onUpdateUser) return;
    setIsSaving(true);
    try {
      await onUpdateUser(userId, { wipLimit: editWipValue });
      onShowToast?.('WIP Limit updated!', 'success');
      setEditingUserId(null);
    } catch {
      onShowToast?.('Failed to update WIP Limit', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const totalOverviewPages = Math.ceil(pmStats.length / PAGE_SIZE);
  const pagedPMStats = pmStats.slice((overviewPage - 1) * PAGE_SIZE, overviewPage * PAGE_SIZE);

  const pendingRequests = projects.filter(p => p.pendingStoryPointsRequest != null);
  const totalOpen = pmStats.reduce((s, p) => s + p.activeProjects.length, 0);
  const overCap = pmStats.filter(p => p.capState === 'over').length;
  const activePMs = pmStats.filter(p => p.wipLimit > 0);
  const avgUtil = activePMs.length > 0
    ? Math.round(activePMs.reduce((s, p) => s + p.utilizationPct, 0) / activePMs.length) : 0;

  // ── Package Detail ──────────────────────────────────────────────────────────
  if (view === 'package-detail' && selectedPM && selectedPackage) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PackageDetailView
          pm={selectedPM}
          packageName={selectedPackage}
          themeLight={theme.lightBg}
          themeText={theme.lightText}
          serviceBaselines={serviceBaselines}
          packages={packages}
          onBack={() => { setView('pm-detail'); setSelectedPackage(null); }}
        />
      </div>
    );
  }

  // ── PM Detail ───────────────────────────────────────────────────────────────
  if (view === 'pm-detail' && selectedPM) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <PMDetailView
          pm={selectedPM}
          themeLight={theme.lightBg}
          themeText={theme.lightText}
          themeBg={theme.bg}
          serviceBaselines={serviceBaselines}
          packages={packages}
          onBack={() => { setView('overview'); setSelectedPM(null); }}
          onViewPackage={(pkg) => { setSelectedPackage(pkg); setView('package-detail'); }}
          onViewProject={(proj) => { onViewProject?.(proj); }}
          onEditWip={(id, val) => { setEditingUserId(id); setEditWipValue(val); }}
          editingUserId={editingUserId}
          editWipValue={editWipValue}
          setEditWipValue={setEditWipValue}
          onSaveWip={handleSaveWip}
          isSaving={isSaving}
        />
      </div>
    );
  }

  // ── Overview ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-slate-400" />
          Resource Management
        </h2>
        <p className="text-sm font-semibold text-slate-500 mt-1">
          PM utilization tracked by open service weight vs WIP limit, with package-type breakdown.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total PMs', value: pmStats.length },
          { label: 'Open Projects', value: totalOpen },
          { label: 'Over Capacity', value: overCap, warn: overCap > 0 },
          { label: 'Avg Utilization', value: `${avgUtil}%` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            <p className={cn('text-3xl font-black mt-1', s.warn ? 'text-rose-600' : 'text-slate-900')}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending story points queue */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-ping" />
              <h3 className="text-xs font-black text-amber-900 uppercase tracking-widest">
                Pending Story Point Adjustments ({pendingRequests.length})
              </h3>
            </div>
            <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Requires Review</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingRequests.map(project => {
              const req = project.pendingStoryPointsRequest!;
              const current = project.storyPoints || packages.find(p => p.name === project.packageName)?.storyPoints || 0;
              return (
                <div key={project.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-black text-slate-900 text-sm">{project.clientName}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{project.packageName}</p>
                    </div>
                    <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg border', theme.lightBg, theme.lightText, theme.lightBorder)}>
                      {current} → {req.requestedPoints} pts
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <p className="text-xs font-semibold text-slate-600 italic">"{req.reason}"</p>
                    <p className="text-[10px] font-bold text-slate-400 mt-1.5 uppercase tracking-wider">by {req.requestedBy}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => {
                        try {
                          await onUpdateProject?.({ ...project, storyPoints: req.requestedPoints, pendingStoryPointsRequest: undefined });
                          onShowToast?.('Approved!', 'success');
                        } catch { onShowToast?.('Failed', 'error'); }
                      }}
                      className={cn('flex-1 py-1.5 text-xs font-black rounded-xl text-white', theme.bg, theme.hoverBg)}
                    >Approve</button>
                    <button
                      onClick={async () => {
                        try {
                          await onUpdateProject?.({ ...project, pendingStoryPointsRequest: undefined });
                          onShowToast?.('Declined', 'info');
                        } catch { onShowToast?.('Failed', 'error'); }
                      }}
                      className="flex-1 py-1.5 text-xs font-black rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PM Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {pagedPMStats.map((pm, i) => (
          <PMCard
            key={pm.id}
            pm={pm}
            index={(overviewPage - 1) * PAGE_SIZE + i}
            themeLight={theme.lightBg}
            themeText={theme.lightText}
            onViewDetails={() => { setSelectedPM(pm); setView('pm-detail'); }}
            onViewPackage={(pkg) => { setSelectedPM(pm); setSelectedPackage(pkg); setView('package-detail'); }}
          />
        ))}
        {pmStats.length === 0 && (
          <div className="col-span-full py-16 text-center font-black text-slate-400">
            No Project Managers found.
          </div>
        )}
      </div>

      {/* Overview pagination */}
      {totalOverviewPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button disabled={overviewPage === 1} onClick={() => setOverviewPage(p => p - 1)}
            className="px-4 py-2 text-sm font-black text-slate-500 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 disabled:opacity-30 transition-all">
            ← Previous
          </button>
          <span className="text-sm font-black text-slate-500">
            Page {overviewPage} of {totalOverviewPages}
          </span>
          <button disabled={overviewPage === totalOverviewPages} onClick={() => setOverviewPage(p => p + 1)}
            className="px-4 py-2 text-sm font-black text-slate-500 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 disabled:opacity-30 transition-all">
            Next →
          </button>
        </div>
      )}
    </div>
  );
};
