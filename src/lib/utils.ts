import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addDays, isWeekend, parseISO, format, isSameDay } from 'date-fns';
import { Project, Phase, PhaseName, PhaseStatus } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Case-insensitive role check
 */
export function isRole(userRole: string | undefined, targetRole: string): boolean {
  if (!userRole) return false;
  return userRole.toLowerCase() === targetRole.toLowerCase();
}

/**
 * Checks if userRole is one of the allowed roles (case-insensitive)
 */
export function hasRole(userRole: string | undefined, allowedRoles: string[]): boolean {
  if (!userRole) return false;
  const roles = allowedRoles.map(r => r.toLowerCase());
  return roles.includes(userRole.toLowerCase());
}

/**
 * Derives the auto-managed state for a project.
 * - If suspended, the suspension takes visual priority — return 'Suspended'.
 * - If today > currentCompletionDate and not terminal-state, return 'Delayed'.
 * - If SPI < atRisk threshold and project has started, return 'Delayed'.
 * - Otherwise 'On-Track'.
 * Never overrides 'Signed Off', 'Billed', or 'Closed'.
 */
export function getAutoProjectState(
  project: Project,
  spiThresholds: { onTrack: number; atRisk: number }
): 'On-Track' | 'Delayed' | 'Suspended' {
  const { state } = project;
  if (state === 'Suspended') return 'Suspended';

  const today = format(new Date(), 'yyyy-MM-dd');
  const completionDate = project.currentCompletionDate || project.expectedCompletionDate;

  // Date overrun check
  if (completionDate && today > completionDate) return 'Delayed';

  // SPI check
  const spiData = calculateSPI(project, spiThresholds);
  if (spiData.rawSpi !== null && spiData.rawSpi < spiThresholds.atRisk) return 'Delayed';

  return 'On-Track';
}

/**
 * Returns valid next manual status transitions for a given role + current state.
 * 'On-Track' here means either 'On-Track' or 'Delayed' — the auto-state bucket.
 */
export function getValidTransitions(
  project: Project,
  userRole: string
): Array<{ value: string; label: string }> {
  const currentState = project.state;
  const isInternal = project.isInternalInitiative;
  const isPM = userRole === 'PM' || userRole === 'Team Lead' || userRole === 'Manager' || userRole === 'Superadmin';
  const isFinance = userRole === 'Finance';

  if (currentState === 'On-Track' || currentState === 'Delayed') {
    if (isFinance) return [];
    const base = [
      { value: 'Suspended', label: 'Suspend Project' }
    ];
    if (!isInternal) {
       base.push({ value: 'Signed Off', label: 'Sign Off' });
    }
    return base;
  }
  if (currentState === 'Suspended') {
    if (isFinance) return [];
    return [
      { value: 'On-Track', label: 'Reactivate' },
    ];
  }
  if (currentState === 'Signed Off') {
    if (isFinance) return [{ value: 'Billed', label: 'Mark as Billed' }];
    return []; // Awaiting Finance
  }
  if (currentState === 'Billed') {
    if (isFinance) return [];
    return [
      { value: 'Closed', label: 'Close Project' },
    ];
  }
  return [];
}


export function formatCurrency(amount: number, currencyCode: string = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Calculates a date by adding a number of working days to a start date.
 * Skips weekends (Saturday, Sunday) and can be extended to skip public holidays.
 */
export function calculateWorkingDays(startDate: string | Date, days: number, holidays: string[] = []): string {
  let currentDate = typeof startDate === 'string' ? parseISO(startDate) : startDate;
  let addedDays = 0;

  // If days is 0, just return the start date (but ensure it's a working day if needed?)
  // Requirement says "count forward by the Expected Duration", so if duration is 1, it's 1 working day.
  // Usually, a 1-day task starting on Monday ends on Monday. 
  // But requirement says "Start from project start date and count forward by duration".
  // If start is Monday and duration is 1, next day is Tuesday? 
  // "How many additional working days do you need?" -> adding to current completion date.
  // I will assume "duration" means total span of work. 1 day duration = same day completion.
  // Wait, "CBA -> 30 working days". If it starts Jan 1, it ends Jan 30 (approx).
  
  let remainingDays = days > 0 ? days - 1 : 0; // If 1 day duration, we don't add any days.

  while (remainingDays > 0) {
    currentDate = addDays(currentDate, 1);
    const holidayList = holidays.map(h => parseISO(h));
    const isHoliday = holidayList.some(h => isSameDay(h, currentDate));
    
    if (!isWeekend(currentDate) && !isHoliday) {
      remainingDays--;
    }
  }

  return format(currentDate, 'yyyy-MM-dd');
}

export function getWorkingDaysInRange(startD: string, endD: string, inclusiveStart: boolean): number {
  let current = parseISO(startD);
  const end = parseISO(endD);
  
  // Requirement: If start and end are provided, it should count from start to end (inclusive)
  // Most industry standards for project duration (e.g. 1 day task) are inclusive.
  if (current > end) return 0;
  
  let count = 0;
  while (current <= end) {
    if (!isWeekend(current)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

export function getActiveDaysCount(project: Project, refDateStr?: string) {
  const isClosed = project.state === 'Closed' || project.state === 'Billed';
  
  const todayStr = refDateStr || format(new Date(), 'yyyy-MM-dd');
  const startStr = project.startDate;
  // Priority: If dates are provided, always calculate from them to ensure consistency
  // Only fall back to stored totalActiveDays if start/end dates are missing (rarer case)
  const endStr = isClosed ? (project.actualCompletionDate || project.currentCompletionDate || todayStr) : todayStr;

  if (!startStr || (!endStr && !isClosed)) {
    if (isClosed && project.totalActiveDays !== undefined) {
      return { days: project.totalActiveDays, text: `${project.totalActiveDays} working days`, label: 'Total Active Days', isStarted: true, isSuspended: false };
    }
    return { days: 0, text: 'Not Started', label: 'Active Days', isStarted: false, isSuspended: false };
  }

  if (startStr > endStr && !isClosed) {
    const daysUntil = getWorkingDaysInRange(todayStr, startStr, true);
    return { days: 0, text: `Starts in ${daysUntil} working days`, isStarted: false, isSuspended: false };
  }

  let totalDaysCount = 0;
  const cycles = project.suspensionCycles || [];
  
  // Calculate active span: Start -> End, minus suspension durations
  const baseRangeEnd = cycles.length > 0 ? (cycles[0].suspensionDate < endStr ? cycles[0].suspensionDate : endStr) : endStr;
  totalDaysCount += getWorkingDaysInRange(startStr, baseRangeEnd, true);
  
  for (let i = 0; i < cycles.length; i++) {
    const cycle = cycles[i];
    if (cycle.reactivationDate && cycle.reactivationDate <= endStr) {
      const nextEnd = (i + 1 < cycles.length) ? (cycles[i+1].suspensionDate < endStr ? cycles[i+1].suspensionDate : endStr) : endStr;
      totalDaysCount += getWorkingDaysInRange(cycle.reactivationDate, nextEnd, true);
    }
  }

  const isSuspended = project.state === 'Suspended';
  const label = isClosed ? 'Total Active Days' : 'Active Days';
  
  return { days: totalDaysCount, text: `${totalDaysCount} working days`, label, isStarted: true, isSuspended };
}

export function calculateSPI(project: Project, thresholds = { onTrack: 1.0, atRisk: 0.8 }, refDateStr?: string) {
  if (!project.startDate || !project.currentCompletionDate) {
    return { value: 'N/A', badge: 'N/A', tooltip: 'Start date and completion date are required to calculate SPI', color: 'bg-slate-100 text-slate-500', isAnomaly: false, ev: 0, pv: 0, rawSpi: null };
  }

  const activeStats = getActiveDaysCount(project, refDateStr);
  const elapsedDays = activeStats.days;
  
  // Denominator: The standard/planned duration for the chosen package
  const totalPlannedDays = project.expectedDuration || getWorkingDaysInRange(project.startDate, project.expectedCompletionDate || project.currentCompletionDate, true);
  
  if (totalPlannedDays === 0) {
    return { value: 'N/A', badge: 'N/A', tooltip: 'Project duration is too short to calculate SPI', color: 'bg-slate-100 text-slate-500', isAnomaly: false, ev: 0, pv: 0, rawSpi: null };
  }

  if (elapsedDays === 0 && !activeStats.isStarted) {
    return { value: 'N/A', badge: 'N/A', tooltip: 'SPI will be available once the project progresses past the start date', color: 'bg-slate-100 text-slate-500', isAnomaly: false, ev: 0, pv: 0, rawSpi: null };
  }

  const ev = calculatePhaseScores(project).totalPercentage / 100;
  
  // PV Logic: 
  // If Today < Start, PV = 0
  // If Today > Planned End, PV = 1.0
  // Otherwise PV = Elapsed / TotalPlanned
  const pv = Math.max(0.01, Math.min(1.0, elapsedDays / totalPlannedDays));
  
  const rawSpi = ev / pv;
  const roundedSpi = isFinite(rawSpi) ? rawSpi.toFixed(2) : '1.00';
  let isAnomaly = false;

  const isClosed = project.state === 'Closed' || project.state === 'Billed';

  if (isClosed) {
    return { value: roundedSpi, badge: 'Final SPI', tooltip: 'Final SPI at project closure', color: 'bg-slate-800 text-white', isAnomaly: false, ev, pv, rawSpi: isFinite(rawSpi) ? rawSpi : 1.0 };
  }

  if (project.state === 'Suspended') {
    return { value: roundedSpi, badge: 'Suspended', tooltip: 'SPI frozen at suspension', color: 'bg-slate-200 text-slate-600', isAnomaly: false, ev, pv, rawSpi: isFinite(rawSpi) ? rawSpi : 1.0 };
  }

  let badge = 'Delayed';
  let color = 'bg-red-100 text-red-700';

  const numericSpi = isFinite(rawSpi) ? rawSpi : 1.0;

  if (numericSpi >= thresholds.onTrack) {
    badge = 'On Track';
    color = 'bg-emerald-100 text-emerald-700';
    if (numericSpi > 1.5) isAnomaly = true;
  } else if (numericSpi >= thresholds.atRisk) {
    badge = 'At Risk';
    color = 'bg-amber-100 text-amber-700';
  }

  return { value: roundedSpi, badge, tooltip: 'SPI compares your actual progress to where you should be today.', color, isAnomaly, ev, pv, rawSpi: numericSpi };
}

export function calculatePhaseScores(project: Project) {
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

  const initiationPhase = phases.find(p => p.id === 'Initiation');
  if (initiationPhase?.status === 'Completed') {
    initiationScore = weights.initiation;
  }

  const planningPhase = phases.find(p => p.id === 'Planning');
  if (planningPhase?.status === 'Completed') {
    planningScore = weights.planning;
  }

  // Execution score calculation
  const executionPhase = phases.find(p => p.id === 'Execution');
  if (executionPhase?.status === 'Completed') {
    executionScore = weights.execution;
  } else if (project.milestones && project.milestones.length > 0) {
    const weightPerMilestone = weights.execution / project.milestones.length;
    let currentExecutionSum = 0;
    project.milestones.forEach(m => {
      if (m.status === 'Closed') {
        currentExecutionSum += weightPerMilestone;
      } else if (m.status === 'In Progress') {
        currentExecutionSum += (weightPerMilestone * 0.5);
      }
    });
    executionScore = currentExecutionSum;
  } else if (services.length > 0) {
    const weightPerService = weights.execution / services.length;
    let currentExecutionSum = 0;
    
    services.forEach(service => {
      const state = project.serviceStates?.[service] || 'Not Started';
      if (state === 'Closed') {
        currentExecutionSum += weightPerService;
      } else if (state === 'In Progress') {
        currentExecutionSum += (weightPerService * 0.5);
      }
    });
    executionScore = currentExecutionSum;
  }

  const closurePhase = phases.find(p => p.id === 'Closure');
  if (closurePhase?.status === 'Completed') {
    closureScore = weights.closure;
  }

  const totalPercentage = initiationScore + planningScore + executionScore + closureScore;

  return {
    initiationScore,
    planningScore,
    executionScore,
    closureScore,
    totalPercentage: Math.min(100, Math.round(totalPercentage))
  };
}

/**
 * Generates a standard 4-phase list with statuses adjusted for legacy projects.
 * For example, if a project starts in 'Execution', Initiation and Planning are auto-completed.
 */
export function getPhaseListFromState(
  startPhase: PhaseName | string, 
  isCompleted: boolean, 
  startDate: string,
  actualCompletionDate?: string
): Phase[] {
  const phaseNames: PhaseName[] = ['Initiation', 'Planning', 'Execution', 'Closure'];
  const targetPhase = startPhase as PhaseName;
  const startIndex = phaseNames.indexOf(targetPhase);
  
  return phaseNames.map((name, index) => {
    let status: PhaseStatus = 'Locked';
    let completionDate: string | undefined = undefined;

    if (isCompleted) {
      status = 'Completed';
      // If the whole project is completed, use the actual completion date for the final phase
      // and the start date for others as a fallback
      completionDate = (index === 3) ? (actualCompletionDate || startDate) : startDate;
    } else if (index < startIndex) {
      status = 'Completed';
      completionDate = startDate; // Assume historical phases are done
    } else if (index === startIndex) {
      status = 'In Progress';
    } else if (index === startIndex + 1) {
      status = 'Pending';
    } else {
      status = 'Locked';
    }

    return { id: name, name, status, completionDate };
  });
}
