import React, { useState } from 'react';
import { ArrowLeft, Pencil, Check, X } from 'lucide-react';
import { cn, getServiceNames } from '../../lib/utils';
import { PMStat, PackageTypeStat } from './useResourceStats';
import { ServiceBaseline } from '../../types';

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
  onBack: () => void;
  onViewPackage: (pkgName: string) => void;
  onEditWip: (userId: string, current: number) => void;
  editingUserId: string | null;
  editWipValue: number;
  setEditWipValue: (v: number) => void;
  onSaveWip: (userId: string) => void;
  isSaving: boolean;
}

export const PMDetailView: React.FC<Props> = ({
  pm, themeLight, themeText, themeBg, serviceBaselines,
  onBack, onViewPackage, onEditWip, editingUserId,
  editWipValue, setEditWipValue, onSaveWip, isSaving
}) => {
  const donePct = pm.totalProjects.length > 0
    ? Math.round(pm.completedProjects.length / pm.totalProjects.length * 100) : 0;

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to overview
      </button>

      {/* PM Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-4">
          <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-base font-bold', themeLight, themeText)}>
            {pm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">{pm.name}</h2>
            <p className="text-sm text-slate-400">{pm.role} · {pm.activeProjects.length} active projects</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Service Weight with WIP editor */}
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Service Weight</p>
            <p className={cn('text-xl font-black mt-1', CAP_TEXT[pm.capState])}>{pm.serviceWeight.toFixed(1)}</p>
            <div className="flex items-center gap-1 mt-0.5">
              {editingUserId === pm.id ? (
                <>
                  <span className="text-[11px] text-slate-400">of</span>
                  <input
                    type="number" min="1"
                    className="w-14 px-1 py-0.5 border border-slate-300 rounded text-xs font-bold text-center outline-none"
                    value={editWipValue}
                    onChange={e => setEditWipValue(parseInt(e.target.value) || 0)}
                    autoFocus
                  />
                  <button onClick={() => onSaveWip(pm.id)} disabled={isSaving} className={cn('p-0.5 rounded', themeBg, 'text-white')}>
                    <Check className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onEditWip(pm.id, pm.wipLimit)}
                  className="group flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-700"
                >
                  of {pm.wipLimit} wip
                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Utilization</p>
            <p className={cn('text-xl font-black mt-1', CAP_TEXT[pm.capState])}>{Math.round(pm.utilizationPct)}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{pm.capState === 'over' ? 'Over capacity' : 'Within limit'}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Open Projects</p>
            <p className="text-xl font-black text-slate-900 mt-1">{pm.activeProjects.length}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">active</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Packages Done</p>
            <p className="text-xl font-black text-slate-900 mt-1">{donePct}%</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{pm.completedProjects.length} of {pm.totalProjects.length}</p>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', CAP_BAR[pm.capState])}
            style={{ width: `${Math.min(100, pm.utilizationPct)}%` }}
          />
        </div>
      </div>

      {/* Projects */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Projects</h3>
        {pm.activeProjects.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No active projects</p>
        )}
        {pm.activeProjects.map(proj => {
          const pkgConfig = null; // storyPoints from proj directly
          const base = proj.storyPoints || 0;
          const pct = base > 0 ? Math.round(((base - (base * 0)) / base) * 100) : 0;
          const svcNames = getServiceNames(proj.services || [], serviceBaselines);

          // Group services by packageName (just show this project's services)
          const pkgRows = [{
            type: proj.packageName || 'Package',
            services: svcNames.reduce<Record<string, number>>((acc, s) => { acc[s] = 1; return acc; }, {})
          }];

          return (
            <div key={proj.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">{proj.clientName}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {proj.packageName} · Weight {proj.storyPoints ?? '—'} pts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-slate-700">{proj.state}</p>
                  <p className="text-[11px] text-slate-400">status</p>
                </div>
              </div>

              {/* Services */}
              <div className="flex flex-wrap gap-1.5">
                {svcNames.map(s => (
                  <span key={s} className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-lg">{s}</span>
                ))}
              </div>

              {/* Package link */}
              {proj.packageName && (
                <button
                  onClick={() => onViewPackage(proj.packageName!)}
                  className={cn('text-xs font-semibold underline decoration-dotted underline-offset-2', themeText)}
                >
                  View {proj.packageName} breakdown →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Package Types Summary */}
      {pm.packageTypes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Package Types Summary</h3>
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-left">Package</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center w-24">In Progress</th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-left">Services</th>
                </tr>
              </thead>
              <tbody>
                {pm.packageTypes.map((pkg: PackageTypeStat) => (
                  <tr key={pkg.name} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-800">{pkg.name}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onViewPackage(pkg.name)}
                        className={cn('text-xs font-bold px-2.5 py-1 rounded-lg', themeLight, themeText)}
                      >
                        {pkg.inProgress}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(pkg.services).map(([k, v]) => (
                          <span key={k} className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-lg">
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
      )}
    </div>
  );
};
