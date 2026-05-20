import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PMStat } from './useResourceStats';
import { Project } from '../../types';

interface Props {
  pm: PMStat;
  packageName: string;
  themeLight: string;
  themeText: string;
  onBack: () => void;
}

export const PackageDetailView: React.FC<Props> = ({ pm, packageName, themeLight, themeText, onBack }) => {
  const pkgData = pm.packageTypes.find(p => p.name === packageName);
  const relatedProjects = pm.activeProjects.filter(proj => proj.packageName === packageName);

  if (!pkgData) return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {pm.name}
      </button>
      <p className="text-slate-400 text-sm text-center py-12">Package data not found.</p>
    </div>
  );

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to {pm.name}
      </button>

      {/* Header */}
      <div className="space-y-1">
        <span className={cn('inline-block text-xs font-semibold px-2.5 py-0.5 rounded-lg mb-1', themeLight, themeText)}>
          {packageName}
        </span>
        <h2 className="text-2xl font-black text-slate-900">
          {pkgData.inProgress} services in progress
        </h2>
        <p className="text-sm text-slate-500">
          Across {relatedProjects.length} project{relatedProjects.length !== 1 ? 's' : ''} — {pm.name}
        </p>
      </div>

      {/* Service count pills */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-wrap gap-6">
        {Object.entries(pkgData.services).map(([k, v]) => (
          <div key={k}>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold">{k}</p>
            <p className="text-3xl font-black text-slate-900 mt-0.5">{v}</p>
          </div>
        ))}
      </div>

      {/* Projects table */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Projects with this package
        </h3>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-left">Project</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center w-20">Weight</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-left">State</th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-left">Services</th>
              </tr>
            </thead>
            <tbody>
              {relatedProjects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-sm">No projects found.</td>
                </tr>
              )}
              {relatedProjects.map((proj: Project) => (
                <tr key={proj.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-sm text-slate-900">{proj.clientName}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{proj.packageName}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-sm font-bold text-slate-700">{proj.storyPoints ?? '—'}</span>
                    <p className="text-[10px] text-slate-400">pts</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-lg',
                      proj.state === 'On-Track' ? 'bg-emerald-50 text-emerald-700' :
                      proj.state === 'Delayed' ? 'bg-rose-50 text-rose-700' :
                      proj.state === 'Suspended' ? 'bg-slate-100 text-slate-600' :
                      'bg-slate-50 text-slate-600'
                    )}>
                      {proj.state}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(proj.services || []).map(s => (
                        <span key={s} className="bg-slate-100 text-slate-600 text-[11px] px-2 py-0.5 rounded-lg">{s}</span>
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
  );
};
