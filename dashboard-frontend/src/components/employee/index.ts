/**
 * Features/Employees Index
 * Central export point for all employees feature components, hooks, and services
 * Usage: import { EmployeesPage, useEmployees } from '@/features/employees'
 */

// ─────────────────────────────────────────────────────────────
// PAGE COMPONENT
// ─────────────────────────────────────────────────────────────



// ─────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────

export {
  useEmployees,
  useEmployee,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useUpdateEmployeeStatus,
  useMutatingIds,
  useEmployeeStats,
  employeeKeys as employeeQueryKeys,
} from '@/features/employees/hooks/use-employees';

// ─────────────────────────────────────────────────────────────
// API & SERVICES
// ─────────────────────────────────────────────────────────────

export {
  employeeService,
  employeeSchema,
  EMPLOYMENT_TYPES,
  type Employee,
  type EmployeeInput,
  type EmployeeFilters,
} from '@/features/employees/api/employee.service';

// ─────────────────────────────────────────────────────────────
// UTILITIES & CONSTANTS
// ─────────────────────────────────────────────────────────────

export {
  useDebouncedValue,
  validateEmployeeForm,
  DEPARTMENTS,
  type ValidationError,
} from '@/lib/employee-utilities';
