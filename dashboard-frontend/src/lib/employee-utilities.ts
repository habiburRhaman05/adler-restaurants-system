/**
 * Helper Hooks & Utilities
 * Reusable utilities for employees feature
 */

import { useState, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// DEBOUNCE HOOK
// ─────────────────────────────────────────────────────────────

/**
 * Debounces a value with configurable delay
 * Keeps input responsive while delaying API calls
 */
export function useDebouncedValue<T>(value: T, delayMs: number = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ─────────────────────────────────────────────────────────────
// FORM VALIDATION
// ─────────────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
}

export function validateEmployeeForm(data: any): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.email?.trim()) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!isValidEmail(data.email)) {
    errors.push({ field: 'email', message: 'Invalid email address' });
  }

  // password is required only on create (or if provided, it must be min 6)
  if (data.isNew && (!data.password || data.password.length < 6)) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
  } else if (!data.isNew && data.password && data.password.length < 6) {
    errors.push({ field: 'password', message: 'Password must be at least 6 characters' });
  }

  if (data.workloadPercent !== undefined && data.workloadPercent < 0) {
    errors.push({ field: 'workloadPercent', message: 'Workload percent cannot be negative' });
  }
  if (data.workloadPercent > 100) {
    errors.push({ field: 'workloadPercent', message: 'Workload percent cannot exceed 100' });
  }
  
  if (data.hourlyRate !== undefined && data.hourlyRate < 0) {
    errors.push({ field: 'hourlyRate', message: 'Hourly rate cannot be negative' });
  }
  if (data.monthlySalary !== undefined && data.monthlySalary < 0) {
    errors.push({ field: 'monthlySalary', message: 'Monthly salary cannot be negative' });
  }
  if (data.contractedHoursMonthly !== undefined && data.contractedHoursMonthly < 0) {
    errors.push({ field: 'contractedHoursMonthly', message: 'Contracted hours cannot be negative' });
  }

  if (data.phone && !/^\+?[0-9\s\-()]+$/.test(data.phone)) {
    errors.push({ field: 'phone', message: 'Invalid phone number' });
  }

  return errors;
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
export const DEPARTMENTS = [
  'Service',
  'Kitchen',
  'Bar',
  'Management',
  'Cleaning',
  'Delivery',
  'Reception'
] as const;

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME'] as const;
export const CONTRACT_TYPES = ['HOURLY', 'MONTHLY_SALARY', 'WORKLOAD_PERCENT'] as const;
export const EMPLOYEE_STATUSES = ['Active', 'Inactive'] as const;
