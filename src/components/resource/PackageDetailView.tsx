import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn, getServiceNames } from '../../lib/utils';
import { PMStat } from './useResourceStats';
import { Project, ServiceBaseline, PackageConfig } from '../../types';
import { calculatePhaseScores } from '../../lib/utils';

const STATE_COLORS: Record<string, string> = {
  'On-Track': 'bg-emerald-50 text-emerald-700',
  'Delayed': 'bg-rose-50 text-rose-600',
  'Suspended': 'bg-slate-100 text-slate-600',
};

interface Props {
  pm: PMStat;
  packageName: string;
  themeLight: string;
  themeText: string;
  serviceBaselines: ServiceBaseline[];
  packages: PackageConfig[];
  onBack: () => void;
}

export const PackageDetailView: React.FC<Props> = ({
  pm, packageName, themeLight, themeText, serviceBaselines, packages, onBack
}) => {
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const pkgData = pm.packageTypes.find(p => p.name === packageName);
  const relatedProjects = pm.activeProjects.filter(proj => proj.packageName === packageName);
  const totalPages = Math.ceil(relatedProjects.length / PAGE_SIZE);
  const pagedProjects = relatedProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!pkgData) return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {pm.name}
      </button>
      <p className="text-slate-400 font-semibold text-sm text-center py-12">Package not found.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {pm.name}
      </button>

      {/* Header */}
      <div className="space-y-1">
        <span className={cn('inline-block text-xs font-black px-2.5 py-0.5 rounded-xl mb-1', themeLight, themeText)}>
          {packageName}
        </span>
        <h2 className="text-2xl font-black text-slate-900">{pkgData.inProgress} projects in progress</h2>
        <p className="text-sm font-semibold text-slate-500">
          Total remaining weight: <span className="font-black text-slate-700">{pkgData.totalWeight.toFixed(1)} pts</span> · {pm.name}
        </p>
      </div>

      {/* Service count pills */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Services across all projects</p>
        <div className="flex flex-wrap gap-4">
          {Object.entries(pkgData.services).map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k}</p>
              <p className="text-3xl font-black text-slate-900 mt-0.5">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Projects table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Projects ({relatedProjects.length})
          </h3>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="text-[11px] font-black text-slate-400 hover:text-slate-700 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                ← Prev
              </button>
              <span className="text-[11px] font-black text-slate-500">{page} / {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="text-[11px] font-black text-slate-400 hover:text-slate-700 disabled:opacity-30 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors">
                Next →
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[560px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-5 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Project</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-24">Weight Rem.</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left w-28">State</th>
                  <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Outstanding Services</th>
                </tr>
              </thead>
              <tbody>
                {relatedProjects.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center font-semibold text-slate-400 text-sm">
                      No projects found.
                    </td>
                  </tr>
                )}
                {pagedProjects.map((proj: Project) => {
                  // Outstanding = not Closed
                  const outstandingIds = (proj.services || []).filter(s => proj.serviceStates?.[s] !== 'Closed');
                  const outstandingNames = getServiceNames(outstandingIds, serviceBaselines);
                  const weight = pm.projectWeights[proj.id] ?? 0;

                  return (
                    <tr key={proj.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-black text-sm text-slate-900">{proj.clientName}</p>
                        <p className="text-[11px] font-semibold text-slate-400 mt-0.5">{proj.packageName}</p>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className="text-sm font-black text-slate-700">{weight.toFixed(1)}</span>
                        <p className="text-[10px] font-semibold text-slate-400">pts</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={cn(
                          'text-[11px] font-black px-2 py-0.5 rounded-lg',
                          STATE_COLORS[proj.state] || 'bg-slate-50 text-slate-600'
                        )}>
                          {proj.state}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1.5">
                          {outstandingNames.length > 0
                            ? outstandingNames.map(s => (
                              <span key={s} className="bg-slate-100 text-slate-700 text-[11px] font-bold px-2 py-0.5 rounded-lg">
                                {s}
                              </span>
                            ))
                            : <span className="text-[11px] font-semibold text-slate-400 italic">All services complete</span>
                          }
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
