/**
 * spi.worker.ts
 *
 * Runs SPI calculations for every project off the main UI thread.
 * Receives: { projects: Project[], thresholds: { onTrack: number; atRisk: number } }
 * Posts back: Record<projectId, SPIResult>
 *
 * Pure functions are inlined here so the worker has no external imports
 * (Vite workers support `import.meta.url` module workers, but inlining keeps
 * this zero-dependency and future-proof against bundler edge cases).
 */

// ── Inlined pure helpers (no DOM, no Supabase, no side-effects) ──────────────

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function parseISO(str: string): Date {
  return new Date(str);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function format(date: Date, fmt: string): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return fmt.replace('yyyy', String(y)).replace('MM', m).replace('dd', d);
}

function getWorkingDaysInRange(startD: string, endD: string): number {
  let current = parseISO(startD);
  const end = parseISO(endD);
  if (current > end) return 0;
  let count = 0;
  while (current <= end) {
    if (!isWeekend(current)) count++;
    current = addDays(current, 1);
  }
  return count;
}

function getActiveDaysCount(project: any, refDateStr?: string) {
  const isClosed = project.state === 'Closed' || project.state === 'Billed';
  const todayStr = refDateStr || format(new Date(), 'yyyy-MM-dd');
  const startStr = project.startDate;
  const endStr = isClosed
    ? project.actualCompletionDate || project.currentCompletionDate || todayStr
    : todayStr;

  if (!startStr || (!endStr && !isClosed)) {
    if (isClosed && project.totalActiveDays !== undefined) {
      return { days: project.totalActiveDays, isStarted: true, isSuspended: false };
    }
    return { days: 0, isStarted: false, isSuspended: false };
  }

  if (startStr > endStr && !isClosed) return { days: 0, isStarted: false, isSuspended: false };

  let totalDaysCount = 0;
  const cycles = project.suspensionCycles || [];

  const baseRangeEnd =
    cycles.length > 0
      ? cycles[0].suspensionDate < endStr
        ? cycles[0].suspensionDate
        : endStr
      : endStr;
  totalDaysCount += getWorkingDaysInRange(startStr, baseRangeEnd);

  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    if (cycle.reactivationDate && cycle.reactivationDate <= endStr) {
      const nextEnd =
        i + 1 < cycles.length
          ? cycles[i + 1].suspensionDate < endStr
            ? cycles[i + 1].suspensionDate
            : endStr
          : endStr;
      totalDaysCount += getWorkingDaysInRange(cycle.reactivationDate, nextEnd);
    }
  }

  return { days: totalDaysCount, isStarted: true, isSuspended: project.state === 'Suspended' };
}

function calculatePhaseScores(project: any) {
  const weights = {
    initiation: project.phaseWeights?.initiation ?? 10,
    planning: project.phaseWeights?.planning ?? 10,
    execution: project.phaseWeights?.execution ?? 60,
    closure: project.phaseWeights?.closure ?? 20,
  };
  const phases = project.phases || [];
  const services = project.services || [];

  let initiationScore = 0;
  let planningScore = 0;
  let executionScore = 0;
  let closureScore = 0;

  if (phases.find((p: any) => p.id === 'Initiation')?.status === 'Completed') {
    initiationScore = weights.initiation;
  }
  if (phases.find((p: any) => p.id === 'Planning')?.status === 'Completed') {
    planningScore = weights.planning;
  }

  const executionPhase = phases.find((p: any) => p.id === 'Execution');
  if (executionPhase?.status === 'Completed') {
    executionScore = weights.execution;
  } else if (project.milestones && project.milestones.length > 0) {
    const weightPerMilestone = weights.execution / project.milestones.length;
    let sum = 0;
    project.milestones.forEach((m: any) => {
      if (m.status === 'Closed') sum += weightPerMilestone;
      else if (m.status === 'In Progress') sum += weightPerMilestone * 0.5;
    });
    executionScore = sum;
  } else if (services.length > 0) {
    const weightPerService = weights.execution / services.length;
    let sum = 0;
    services.forEach((service: any) => {
      const state = project.serviceStates?.[service] || 'Not Started';
      if (state === 'Closed') sum += weightPerService;
      else if (state === 'In Progress') sum += weightPerService * 0.5;
    });
    executionScore = sum;
  }

  if (phases.find((p: any) => p.id === 'Closure')?.status === 'Completed') {
    closureScore = weights.closure;
  }

  const totalPercentage = initiationScore + planningScore + executionScore + closureScore;
  return { totalPercentage: Math.min(100, Math.round(totalPercentage)) };
}

function calculateSPI(
  project: any,
  thresholds = { onTrack: 1.0, atRisk: 0.8 },
  refDateStr?: string
) {
  const NA = {
    value: 'N/A',
    badge: 'N/A',
    tooltip: '',
    color: 'bg-slate-100 text-slate-500',
    isAnomaly: false,
    ev: 0,
    pv: 0,
    rawSpi: null as number | null,
  };

  if (!project.startDate || !project.currentCompletionDate) return NA;

  const isClosed = project.state === 'Closed' || project.state === 'Billed';
  const activeStats = getActiveDaysCount(project, refDateStr);
  const elapsedDays = activeStats.days;

  const totalPlannedDays =
    project.expectedDuration ||
    getWorkingDaysInRange(
      project.startDate,
      project.expectedCompletionDate || project.currentCompletionDate
    );

  if (totalPlannedDays === 0) return NA;
  if (elapsedDays === 0 && !activeStats.isStarted) return NA;

  const ev = calculatePhaseScores(project).totalPercentage / 100;
  const pv = Math.max(0.01, Math.min(1.0, elapsedDays / Math.max(1, totalPlannedDays)));
  let rawSpi = ev / pv;

  if (isClosed && elapsedDays === 0) rawSpi = 1.0;
  if (rawSpi > 5.0) rawSpi = 5.0;

  const roundedSpi = isFinite(rawSpi) ? rawSpi.toFixed(2) : '1.00';
  let isAnomaly = false;

  if (isClosed) {
    return { value: roundedSpi, badge: 'Final SPI', tooltip: 'Final SPI at project closure', color: 'bg-slate-800 text-white', isAnomaly: false, ev, pv, rawSpi: isFinite(rawSpi) ? rawSpi : 1.0 };
  }
  if (project.state === 'Suspended') {
    return { value: roundedSpi, badge: 'Suspended', tooltip: 'SPI frozen at suspension', color: 'bg-slate-200 text-slate-600', isAnomaly: false, ev, pv, rawSpi: isFinite(rawSpi) ? rawSpi : 1.0 };
  }

  const numericSpi = isFinite(rawSpi) ? rawSpi : 1.0;
  let badge = 'Delayed';
  let color = 'bg-red-100 text-red-700';

  if (numericSpi >= thresholds.onTrack) {
    badge = 'On Track';
    color = 'bg-emerald-100 text-emerald-700';
    if (numericSpi > 1.5) isAnomaly = true;
  } else if (numericSpi >= thresholds.atRisk) {
    badge = 'At Risk';
    color = 'bg-amber-100 text-amber-700';
  }

  return {
    value: roundedSpi,
    badge,
    tooltip: 'SPI compares your actual progress to where you should be today.',
    color,
    isAnomaly,
    ev,
    pv,
    rawSpi: numericSpi,
  };
}

// ── Worker message handler ────────────────────────────────────────────────────

self.onmessage = (event: MessageEvent) => {
  const { projects, thresholds } = event.data as {
    projects: any[];
    thresholds: { onTrack: number; atRisk: number };
  };

  const results: Record<string, ReturnType<typeof calculateSPI>> = {};

  for (const project of projects) {
    results[project.id] = calculateSPI(project, thresholds);
  }

  self.postMessage(results);
};
