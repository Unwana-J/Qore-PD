import React, { useState } from 'react';
import { ArrowLeft, Pencil, Check, ExternalLink } from 'lucide-react';
import { cn, getServiceNames } from '../../lib/utils';
import { PMStat, PackageTypeStat } from './useResourceStats';
import { Project, ServiceBaseline, PackageConfig } from '../../types';

const CAP_BAR: Record<string, string> = {
  over: 'bg-rose-500', near: 'bg-amber-500', good: 'bg-emerald-500',
};
const CAP_TEXT: Record<string, string> = {
  over: 'text-rose-600', near: 'text-amber-600', good: 'text-emerald-600',
};

interface Props {
  pm: PMStat;
  themeLight: string;
  themeText: string;
  themeBg: string;
  serviceBaselines: ServiceBaseline[];
  packages: PackageConfig[];
  onBack: () => void;
  onViewPackage: (pkgName: string) => void;
  onViewProject: (project: Project) => void;
  onEditWip: (userId: string, current: number) => void;
  editingUserId: string | null;
  editWipValue: number;
  setEditWipValue: (v: number) => void;
  onSaveWip: (userId: string) => void;
  isSaving: boolean;
}

export const PMDetailView: React.FC<Props> = ({
  pm, themeLight, themeText, themeBg, serviceBaselines, packages,
  onBack, onViewPackage, onViewProject, onEditWip,
  editingUserId, editWipValue, setEditWipValue, onSaveWip, isSaving
}) => {
  const [projectPage, setProjectPage] = useState(1);
  const PAGE_SIZE = 10;
  const donePct = pm.totalProjects.length > 0
    ? Math.round(pm.completedProjects.length / pm.totalProjects.length * 100) : 0;

  const totalProjectPages = Math.ceil(pm.activeProjects.length / PAGE_SIZE);
  const pagedProjects = pm.activeProjects.slice((projectPage - 1) * PAGE_SIZE, projectPage * PAGE_SIZE);

  // Get outstanding services per project (exclude Closed)
  const getOutstandingServices = (proj: Project) => {
    const ids = (proj.services || []).filter(s => proj.serviceStates?.[s] !== 'Closed');
    return getServiceNames(ids, serviceBaselines);
  };

  // Computed remaining weight per project
  const getProjectWeight = (proj: Project) => {
    return pm.projectWeights[proj.id] ?? 0;
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to overview
      </button>

      {/* PM Header */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black', themeLight, themeText)}>
            {pm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900">{pm.name}</h2>
            <p className="text-sm font-semibold text-slate-400">{pm.role} · {pm.activeProjects.length} active projects</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* WIP with inline editor */}
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Weight</p>
            <p className={cn('text-2xl font-black mt-1', CAP_TEXT[pm.capState])}>{pm.serviceWeight.toFixed(1)}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {editingUserId === pm.id ? (
                <>
                  <span className="text-[11px] font-semibold text-slate-400">of</span>
                  <input
                    type="number" min="1"
                    className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs font-black text-center outline-none"
                    value={editWipValue}
                    onChange={e => setEditWipValue(parseInt(e.target.value) || 0)}
                    autoFocus
                  />
                  <button onClick={() => onSaveWip(pm.id)} disabled={isSaving}
                    className={cn('p-1 rounded-lg text-white', themeBg)}>
                    <Check className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onEditWip(pm.id, pm.wipLimit)}
                  className="group flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-700"
                >
                  of {pm.wipLimit} wip
                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Utilization</p>
            <p className={cn('text-2xl font-black mt-1', CAP_TEXT[pm.capState])}>{Math.round(pm.utilizationPct)}%</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{pm.capState === 'over' ? 'Over capacity' : 'Within limit'}</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Active Projects</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{pm.activeProjects.length}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">in progress</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Packages Done</p>
            <p className="text-2xl font-black text-slate-900 mt-1">{donePct}%</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{pm.completedProjects.length} of {pm.totalProjects.length}</p>
          </div>
        </div>

        {/* Util bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700', CAP_BAR[pm.capState])}
            style={{ width: `${Math.min(100, pm.utilizationPct)}%` }} />
        </div>
      </div>

      {/* Package Types Summary — MOVED TO TOP */}
      {pm.packageTypes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Package Types Summary</h3>
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Package</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-28">Weight (Rem.)</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24">In Progress</th>
                    <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Services</th>
                  </tr>
                </thead>
                <tbody>
                  {pm.packageTypes.map((pkg: PackageTypeStat) => (
                    <tr key={pkg.name} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <button
                          onClick={() => onViewPackage(pkg.name)}
                          className={cn('text-sm font-black text-left underline decoration-dotted underline-offset-2', themeText)}
                        >
                          {pkg.name}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-black text-slate-700">{pkg.totalWeight.toFixed(1)}</span>
                        <span className="text-[10px] font-semibold text-slate-400 ml-1">pts</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn('text-xs font-black px-2.5 py-1 rounded-xl', themeLight, themeText)}>
                          {pkg.inProgress}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(pkg.services).map(([k, v]) => (
                            <span key={k} className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-lg whitespace-nowrap">
                              {k} <span className="text-slate-400">{v}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Projects */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Active Projects ({pm.activeProjects.length})
          </h3>
          {totalProjectPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={projectPage === 1} onClick={() => setProjectPage(p => p - 1)}
                className="text-[11px] font-black text-slate-400 hover:text-slate-700 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                ← Prev
              </button>
              <span className="text-[11px] font-black text-slate-500">{projectPage} / {totalProjectPages}</span>
              <button disabled={projectPage === totalProjectPages} onClick={() => setProjectPage(p => p + 1)}
                className="text-[11px] font-black text-slate-400 hover:text-slate-700 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>

        {pm.activeProjects.length === 0 && (
          <p className="text-center font-semibold text-slate-400 text-sm py-8">No active projects</p>
        )}

        {pagedProjects.map(proj => {
          const outstandingServices = getOutstandingServices(proj);
          const weight = getProjectWeight(proj);

          return (
            <div key={proj.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-black text-slate-900">{proj.clientName}</p>
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    {proj.packageName} · <span className="font-black text-slate-600">{weight.toFixed(1)} pts remaining</span>
                  </p>
                </div>
                <span className={cn(
                  'text-[11px] font-black px-2 py-0.5 rounded-lg',
                  proj.state === 'On-Track' ? 'bg-emerald-50 text-emerald-700' :
                  proj.state === 'Delayed' ? 'bg-rose-50 text-rose-600' :
                  proj.state === 'Suspended' ? 'bg-slate-100 text-slate-600' :
                  'bg-slate-50 text-slate-600'
                )}>
                  {proj.state}
                </span>
              </div>

              {/* Outstanding services only (not Closed) */}
              {outstandingServices.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {outstandingServices.map(s => (
                    <span key={s} className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-lg">{s}</span>
                  ))}
                </div>
              )}
              {outstandingServices.length === 0 && (
                <p className="text-[11px] font-semibold text-slate-400 italic">All services completed or none assigned</p>
              )}

              {/* View project details */}
              <button
                onClick={() => onViewProject(proj)}
                className={cn('flex items-center gap-1 text-xs font-black transition-colors', themeText)}
              >
                <ExternalLink className="w-3 h-3" /> View project details
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
