import { useMemo } from 'react';
import { Project, User, PackageConfig, ServiceBaseline } from '../../types';
import { calculatePhaseScores, getServiceNames } from '../../lib/utils';

export type CapState = 'over' | 'near' | 'good';

export interface PackageTypeStat {
  name: string;
  inProgress: number;
  totalWeight: number;
  services: Record<string, number>; // resolved service name -> count
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
  // per-project remaining weight map
  projectWeights: Record<string, number>;
}

const DONE_STATES = ['Closed', 'Billed', 'Signed Off'];
const TERMINAL_STATES = ['Closed', 'Billed'];

export function useResourceStats(
  projects: Project[],
  users: User[],
  packages: PackageConfig[],
  serviceBaselines: ServiceBaseline[]
): PMStat[] {
  return useMemo(() => {
    const pms = users.filter(u => u.role === 'PM' || u.role === 'Team Lead');

    return pms.map(pm => {
      const totalProjects = projects.filter(p => p.assignedPM === pm.name);
      const activeProjects = totalProjects.filter(p => !DONE_STATES.includes(p.state));
      const completedProjects = totalProjects.filter(p => DONE_STATES.includes(p.state));

      // Compute remaining weight per project
      const projectWeights: Record<string, number> = {};
      let serviceWeight = 0;

      activeProjects.forEach(proj => {
        const pkg = packages.find(p => p.name === proj.packageName);
        const base = proj.storyPoints ?? pkg?.storyPoints ?? 0;
        const pct = calculatePhaseScores(proj).totalPercentage / 100;
        const remaining = base * (1 - pct);
        projectWeights[proj.id] = remaining;
        serviceWeight += remaining;
      });

      const wipLimit = pm.wipLimit || 30;
      const utilizationPct = wipLimit > 0 ? (serviceWeight / wipLimit) * 100 : 0;
      const capState: CapState = utilizationPct > 100 ? 'over' : utilizationPct > 80 ? 'near' : 'good';

      // Burnout: over 100% AND oldest active project >= 14 days old
      let daysOverloaded = 0;
      if (utilizationPct > 100) {
        const oldest = activeProjects.reduce<Date | null>((min, p) => {
          if (!p.startDate) return min;
          const d = new Date(p.startDate);
          return !min || d < min ? d : min;
        }, null);
        if (oldest) daysOverloaded = Math.ceil((Date.now() - oldest.getTime()) / 86400000);
      }

      // Group by packageName — resolve service IDs to names
      const pkgMap: Record<string, PackageTypeStat> = {};
      activeProjects.forEach(proj => {
        const name = proj.packageName || 'Other';
        if (!pkgMap[name]) pkgMap[name] = { name, inProgress: 0, totalWeight: 0, services: {} };
        pkgMap[name].inProgress++;
        pkgMap[name].totalWeight += projectWeights[proj.id] || 0;

        // Resolve service IDs → display names
        const resolvedNames = getServiceNames(proj.services || [], serviceBaselines);
        resolvedNames.forEach(svc => {
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
        activeProjects,
        completedProjects,
        totalProjects,
        packageTypes: Object.values(pkgMap),
        projectWeights,
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
  }, [projects, users, packages, serviceBaselines]);
}
