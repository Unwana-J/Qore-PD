import React from 'react';
import { Project, Risk } from '../types';
import { cn } from '../lib/utils';
import { AlertTriangle, Shield, Clock, CheckCircle } from 'lucide-react';

interface RisksTableProps {
  projects: Project[];
}

export const RisksTable: React.FC<RisksTableProps> = ({ projects }) => {
  const allRisks = projects.flatMap(project => 
    project.risks.map(risk => ({
      ...risk,
      clientName: project.clientName,
      packageName: project.packageName,
      projectId: project.id
    }))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Risks & Issues Registry</h2>
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
            <AlertTriangle className="w-3 h-3" />
            {allRisks.filter(r => r.status === 'Open').length} Open
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold border border-emerald-100">
            <CheckCircle className="w-3 h-3" />
            {allRisks.filter(r => r.status === 'Closed').length} Resolved
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Risk Description</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Institution</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Project Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Impact</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Logged</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {allRisks.map((risk) => (
              <tr key={risk.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <p className="text-sm font-semibold text-slate-900">{risk.description}</p>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{risk.clientName}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{risk.packageName}</td>
                <td className="px-6 py-4">
                  <ImpactBadge impact={risk.impact} />
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={risk.status} />
                </td>
                <td className="px-6 py-4 text-xs text-slate-400 font-mono">{risk.createdAt}</td>
              </tr>
            ))}
            {allRisks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-20 text-center">
                  <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-medium">No risks documented across your projects.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ImpactBadge = ({ impact }: { impact: Risk['impact'] }) => {
  const styles = {
    'High': 'bg-red-100 text-red-700',
    'Medium': 'bg-amber-100 text-amber-700',
    'Low': 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", styles[impact])}>
      {impact}
    </span>
  );
};

const StatusBadge = ({ status }: { status: Risk['status'] }) => {
  const styles = {
    'Open': 'text-red-500',
    'Addressing': 'text-amber-500',
    'Closed': 'text-slate-400',
  };
  const icons = {
    'Open': <AlertTriangle className="w-3 h-3" />,
    'Addressing': <Clock className="w-3 h-3" />,
    'Closed': <CheckCircle className="w-3 h-3" />,
  };
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase", styles[status])}>
      {icons[status]}
      {status}
    </div>
  );
};
