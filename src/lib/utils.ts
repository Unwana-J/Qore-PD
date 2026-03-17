import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { addDays, isWeekend, parseISO, format, isSameDay } from 'date-fns';
import { Project } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

export function calculatePhaseScores(project: Project) {
  const weights = project.phaseWeights || { initiation: 10, planning: 10, execution: 60, closure: 20 };
  
  let initiationScore = 0;
  let planningScore = 0;
  let executionScore = 0;
  let closureScore = 0;

  const initiationPhase = project.phases.find(p => p.id === 'Initiation');
  if (initiationPhase?.status === 'Completed') {
    initiationScore = weights.initiation;
  }

  const planningPhase = project.phases.find(p => p.id === 'Planning');
  if (planningPhase?.status === 'Completed') {
    planningScore = weights.planning;
  }

  // Execution score calculation
  const executionPhase = project.phases.find(p => p.id === 'Execution');
  if (executionPhase?.status === 'Completed') {
    executionScore = weights.execution;
  } else if (project.services.length > 0) {
    const weightPerService = weights.execution / project.services.length;
    let currentExecutionSum = 0;
    
    project.services.forEach(service => {
      const state = project.serviceStates?.[service] || 'Not Started';
      if (state === 'Closed') {
        currentExecutionSum += weightPerService;
      } else if (state === 'In Progress') {
        currentExecutionSum += (weightPerService * 0.5);
      }
    });
    executionScore = currentExecutionSum;
  }

  const closurePhase = project.phases.find(p => p.id === 'Closure');
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
