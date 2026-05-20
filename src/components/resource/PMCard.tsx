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
  over: { bar: 'bg-rose-500', text: 'text-rose-600', badge: 'bg-rose-50 text-rose-600 border-rose-200' },
  near: { bar: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-50 text-amber-600 border-amber-200' },
  good: { bar: 'bg-emerald-500', text: 'text-emerald-600', badge: '' },
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
      'bg-white rounded-3xl border flex flex-col gap-4 p-5 shadow-sm hover:shadow-md transition-all',
      pm.capState === 'over' ? 'border-rose-300' : 'border-slate-200'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-black shrink-0', av)}>
            {pm.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm leading-tight">{pm.name}</p>
            <p className="text-xs font-semibold text-slate-400">{pm.role}</p>
          </div>
        </div>
        {pm.capState === 'over' && (
          <span className={cn('text-[11px] font-black px-2 py-0.5 rounded-lg border', col.badge)}>
            Over Capacity
          </span>
        )}
        {pm.capState === 'near' && (
          <span className={cn('text-[11px] font-black px-2 py-0.5 rounded-lg border', col.badge)}>
            Near Limit
          </span>
        )}
      </div>

      {/* Service Weight Bar */}
      <div className="bg-slate-50 rounded-2xl p-3 space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Service Weight</span>
          <span className={cn('text-sm font-black', col.text)}>
            {pm.serviceWeight.toFixed(1)}<span className="text-slate-400 font-semibold text-xs"> / {pm.wipLimit} wip</span>
          </span>
        </div>
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-700', col.bar)} style={{ width: `${barPct}%` }} />
        </div>
        <p className={cn('text-[11px] font-bold', col.text)}>{Math.round(pm.utilizationPct)}% utilized</p>
      </div>

      {/* 3-stat row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Done', value: `${donePct}%`, sub: `${pm.completedProjects.length}/${pm.totalProjects.length}` },
          { label: 'Active', value: pm.activeProjects.length, sub: 'projects' },
          { label: 'WIP Pts', value: pm.serviceWeight.toFixed(0), sub: `of ${pm.wipLimit}` },
        ].map(s => (
          <div key={s.label} className="bg-slate-50 rounded-2xl p-2.5 text-center">
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black">{s.label}</p>
            <p className="text-lg font-black text-slate-900 mt-0.5 leading-tight">{s.value}</p>
            <p className="text-[10px] text-slate-400 font-semibold">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Package types table — scrollable */}
      {pm.packageTypes.length > 0 ? (
        <div>
          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-black mb-1.5">Package types in progress</p>
          <div className="border border-slate-100 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50">
                  <th className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wide whitespace-nowrap">Package</th>
                  <th className="px-2 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wide text-center w-12">Count</th>
                  <th className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wide">Services</th>
                </tr>
              </thead>
              <tbody>
                {pm.packageTypes.map((pkg: PackageTypeStat) => (
                  <tr key={pkg.name} className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors">
                    {/* Package name = clickable → goes to breakdown */}
                    <td className="px-3 py-2 max-w-[110px]">
                      <button
                        onClick={() => onViewPackage(pkg.name)}
                        className={cn('text-xs font-black text-left truncate w-full underline decoration-dotted underline-offset-2', themeText)}
                        title={pkg.name}
                      >
                        {pkg.name}
                      </button>
                    </td>
                    {/* Count = plain badge (not clickable) */}
                    <td className="px-2 py-2 text-center">
                      <span className={cn('text-xs font-black px-2 py-0.5 rounded-lg', themeLight, themeText)}>
                        {pkg.inProgress}
                      </span>
                    </td>
                    {/* Services — horizontally scrollable */}
                    <td className="px-3 py-2 max-w-[130px]">
                      <div className="overflow-x-auto">
                        <div className="flex gap-1 flex-nowrap">
                          {Object.entries(pkg.services).map(([k, v]) => (
                            <span key={k} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                              {k} <span className="text-slate-400">{v}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="text-xs font-semibold text-slate-400 italic text-center py-1">No active projects</p>
      )}

      {/* Burnout banner */}
      {pm.isBurnedOut && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 flex gap-2.5">
          <Flame className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black text-rose-700">Severe Burnout Alert</p>
            <p className="text-xs font-semibold text-rose-600 mt-0.5">
              At {Math.round(pm.utilizationPct)}% for {pm.daysOverloaded} days. Offloading recommended.
            </p>
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onViewDetails}
        className="w-full py-2.5 text-sm font-black text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
      >
        View PM details <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
