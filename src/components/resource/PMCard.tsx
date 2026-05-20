import React from 'react';
import { Flame, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { PMStat, PackageTypeStat } from './useResourceStats';

const AVATAR_PALETTE = [
  'bg-teal-100 text-teal-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-sky-100 text-sky-700',
];

const CAP = {
  over: { bar: 'bg-rose-500', light: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-300', dark: 'text-rose-700' },
  near: { bar: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-300', dark: 'text-amber-700' },
  good: { bar: 'bg-emerald-500', light: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-slate-200', dark: 'text-emerald-700' },
};

interface PMCardProps {
  pm: PMStat;
  index: number;
  themeLight: string;
  themeText: string;
  onViewDetails: () => void;
  onViewPackage: (pkgName: string) => void;
}

export const PMCard: React.FC<PMCardProps> = ({ pm, index, themeLight, themeText, onViewDetails, onViewPackage }) => {
  const col = CAP[pm.capState];
  const av = AVATAR_PALETTE[index % AVATAR_PALETTE.length];
  const barPct = Math.min(100, pm.utilizationPct);
  const donePct = pm.totalProjects.length > 0
    ? Math.round((pm.completedProjects.length / pm.totalProjects.length) * 100) : 0;

  return (
    <div className={cn(
      'bg-white rounded-2xl border flex flex-col gap-4 p-5 shadow-sm hover:shadow-md transition-shadow',
      pm.capState === 'over' ? 'border-rose-300' : 'border-slate-200'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0', av)}>
            {pm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">{pm.name}</p>
            <p className="text-xs text-slate-400">{pm.role}</p>
          </div>
        </div>
        {pm.capState === 'over' && (
          <span className="bg-rose-50 text-rose-600 border border-rose-100 text-[11px] font-semibold px-2 py-0.5 rounded-lg">
            Over Capacity
          </span>
        )}
      </div>

      {/* Service Weight Bar */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Service Weight</span>
          <span className={cn('text-sm font-bold', col.text)}>
            {pm.serviceWeight.toFixed(1)} <span className="text-slate-400 font-normal">/ {pm.wipLimit} wip</span>
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700', col.bar)} style={{ width: `${barPct}%` }} />
        </div>
        <p className={cn('text-[11px] font-medium', col.text)}>{Math.round(pm.utilizationPct)}% utilized</p>
      </div>

      {/* 3-stat row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Done', value: `${donePct}%`, sub: `${pm.completedProjects.length}/${pm.totalProjects.length}` },
          { label: 'Active', value: pm.activeProjects.length, sub: 'projects' },
          { label: 'WIP Pts', value: pm.serviceWeight.toFixed(0), sub: `of ${pm.wipLimit}` },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-xl p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-semibold">{s.label}</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">{s.value}</p>
            <p className="text-[10px] text-slate-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Package types table */}
      {pm.packageTypes.length > 0 ? (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-semibold mb-1.5">Package types in progress</p>
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Package</th>
                  <th className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-center w-12">Count</th>
                  <th className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Services</th>
                </tr>
              </thead>
              <tbody>
                {pm.packageTypes.map((pkg: PackageTypeStat) => (
                  <tr key={pkg.name} className="border-t border-slate-100">
                    <td className="px-3 py-2 text-xs font-medium text-slate-700 truncate max-w-[120px]">{pkg.name}</td>
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => onViewPackage(pkg.name)}
                        className={cn('text-xs font-semibold px-2 py-0.5 rounded-lg', themeLight, themeText)}
                      >
                        {pkg.inProgress}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-slate-400 truncate">
                      {Object.entries(pkg.services).map(([k, v]) => `${k} ${v}`).join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 italic text-center py-1">No active projects</p>
      )}

      {/* Burnout banner */}
      {pm.isBurnedOut && (
        <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 flex gap-2.5">
          <Flame className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-rose-700">Severe Burnout Alert</p>
            <p className="text-xs text-rose-600 mt-0.5">
              At {Math.round(pm.utilizationPct)}% for {pm.daysOverloaded} days. Offloading recommended.
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onViewDetails}
        className="w-full py-2 text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
      >
        View PM details <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
