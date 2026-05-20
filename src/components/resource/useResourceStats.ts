import { useMemo } from 'react';
import { Project, User, PackageConfig, ServiceBaseline } from '../../types';
import { calculatePhaseScores, getServiceNames } from '../../lib/utils';

export type CapState = 'over' | 'near' | 'good';

export interface PackageTypeStat {
  name: string;
  inProgress: number;
  services: Record<string, number>;
}

export interface PMStat {
  id: string;
  name: string;
  role: string;
  wipLimit: number;
  serviceWeight: number;
  utilizationPct: number;
  capState: CapState;
  isBurnedOut: boolean;
  daysOverloaded: number;
  activeProjects: Project[];
  completedProjects: Project[];
  totalProjects: Project[];
  packageTypes: PackageTypeStat[];
}

const TERMINAL_STATES = ['Closed', 'Billed'];
const DONE_STATES = ['Closed', 'Billed', 'Signed Off'];

export function useResourceStats(
  projects: Project[],
  users: User[],
  packages: PackageConfig[],
  serviceBaselines: ServiceBaseline[]
): PMStat[] {
  return useMemo(() => {
    const pms = users.filter(u => u.role === 'PM' || u.role === 'Team Lead');

    return pms.map(pm => {
      const total = projects.filter(p => p.assignedPM === pm.name);
      const active = total.filter(p => !TERMINAL_STATES.includes(p.state) && p.state !== 'Signed Off');
      const completed = total.filter(p => DONE_STATES.includes(p.state));

      // Service weight = sum of remaining story points across active projects
      let serviceWeight = 0;
      active.forEach(proj => {
        const pkg = packages.find(p => p.name === proj.packageName);
        const base = proj.storyPoints || pkg?.storyPoints || 0;
        const pct = calculatePhaseScores(proj).totalPercentage / 100;
        serviceWeight += base * (1 - pct);
      });

      const wipLimit = pm.wipLimit || 30;
      const utilizationPct = (serviceWeight / wipLimit) * 100;
      const capState: CapState = utilizationPct > 100 ? 'over' : utilizationPct > 80 ? 'near' : 'good';

      // Burnout: over 100% for 14+ days
      let daysOverloaded = 0;
      if (utilizationPct > 100) {
        const oldest = active.reduce<Date | null>((min, p) => {
          if (!p.startDate) return min;
          const d = new Date(p.startDate);
          return !min || d < min ? d : min;
        }, null);
        if (oldest) {
          daysOverloaded = Math.ceil((Date.now() - oldest.getTime()) / 86400000);
        }
      }

      // Group by packageName
      const pkgMap: Record<string, PackageTypeStat> = {};
      active.forEach(proj => {
        const name = proj.packageName || 'Other';
        if (!pkgMap[name]) pkgMap[name] = { name, inProgress: 0, services: {} };
        pkgMap[name].inProgress++;
        getServiceNames(proj.services || [], serviceBaselines).forEach(svc => {
          pkgMap[name].services[svc] = (pkgMap[name].services[svc] || 0) + 1;
        });
      });

      return {
        id: pm.id,
        name: pm.name,
        role: pm.role,
        wipLimit,
        serviceWeight,
        utilizationPct,
        capState,
        isBurnedOut: utilizationPct > 100 && daysOverloaded >= 14,
        daysOverloaded,
        activeProjects: active,
        completedProjects: completed,
        totalProjects: total,
        packageTypes: Object.values(pkgMap),
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [projects, users, packages, serviceBaselines]);
}
