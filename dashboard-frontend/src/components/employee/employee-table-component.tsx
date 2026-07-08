/**
 * Employee Table Component
 * Refactored to smaller sub-components for better maintainability and memoization
 */

import { memo } from 'react';
import {
  MoreVertical,
  Pencil,
  Trash2,
  Mail,
  Phone,
  Ban,
  CheckCircle2,
  Users,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import type { Employee } from '@/features/employees/api/employee.service';

// ─────────────────────────────────────────────────────────────
// MAIN TABLE COMPONENT
// ─────────────────────────────────────────────────────────────

interface EmployeeTableProps {
  employees: Employee[];
  isLoading: boolean;
  isError: boolean;
  isFetching?: boolean;
  mutatingId: string | null;
  onEdit: (emp: Employee) => void;
  onToggleStatus: (emp: Employee) => void;
  onDelete: (emp: Employee) => void;
  onAdd: () => void;
  page: number;
  hasNextPage: boolean;
  onNextPage: () => void;
  onPrevPage: () => void;
}

export const EmployeeTable = memo(function EmployeeTable({
  employees,
  isLoading,
  isError,
  isFetching,
  mutatingId,
  onEdit,
  onToggleStatus,
  onDelete,
  onAdd,
  page,
  hasNextPage,
  onNextPage,
  onPrevPage,
}: EmployeeTableProps) {
  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden flex flex-col">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-medium uppercase tracking-wider text-xs">
            <tr>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Contact</th>
              <th className="px-6 py-4">Role & Dept</th>
              <th className="px-6 py-4">Contract</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Loading State */}
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <EmployeeTableRowSkeleton key={i} />
              ))}

            {/* Error State */}
            {!isLoading && isError && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-red-500">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <Ban className="h-8 w-8 mb-2 opacity-50" />
                    Failed to load employees
                  </div>
                </td>
              </tr>
            )}

            {/* Data Rows */}
            {!isLoading && !isError && employees.length > 0 && (
              <>
                {employees.map((emp) => (
                  <EmployeeTableRow
                    key={emp.id}
                    employee={emp}
                    isMutating={mutatingId === emp.id}
                    isDimmed={isFetching && !mutatingId}
                    onEdit={onEdit}
                    onToggleStatus={onToggleStatus}
                    onDelete={onDelete}
                  />
                ))}
              </>
            )}

            {/* Empty State */}
            {!isLoading && !isError && employees.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyTableState onAdd={onAdd} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && !isError && (page > 1 || hasNextPage) && (
        <div className="border-t border-slate-200 p-4 flex items-center justify-between bg-slate-50/50">
          <p className="text-sm text-slate-500">
            Page <span className="font-medium text-slate-900">{page}</span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={onPrevPage}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNextPage || isFetching}
              onClick={onNextPage}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// TABLE ROW COMPONENT
// ─────────────────────────────────────────────────────────────

interface EmployeeTableRowProps {
  employee: Employee;
  isMutating: boolean;
  isDimmed?: boolean;
  onEdit: (emp: Employee) => void;
  onToggleStatus: (emp: Employee) => void;
  onDelete: (emp: Employee) => void;
}

const EmployeeTableRow = memo(function EmployeeTableRow({
  employee: emp,
  isMutating,
  isDimmed,
  onEdit,
  onToggleStatus,
  onDelete,
}: EmployeeTableRowProps) {
  // Format avatar initials
  const displayName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || 'Unnamed Employee';
  const initials = displayName.substring(0, 2).toUpperCase();

  // Determine contract display
  let contractDisplay = 'N/A';
  if (emp.contractType === 'HOURLY') {
    contractDisplay = `${emp.hourlyRate} CHF/hr`;
  } else if (emp.contractType === 'MONTHLY_SALARY') {
    contractDisplay = `${emp.monthlySalary} CHF/mo`;
  } else if (emp.contractType === 'WORKLOAD_PERCENT') {
    contractDisplay = `${emp.workloadPercent}% (${emp.monthlySalary} CHF/mo)`;
  }

  return (
    <tr
      className={cn(
        'group transition-colors hover:bg-slate-50/50',
        isMutating && 'opacity-50 pointer-events-none bg-slate-50',
        isDimmed && 'opacity-60'
      )}
    >
      {/* Employee Column */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold shadow-inner flex-shrink-0">
             {initials}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{displayName}</div>
            <div className="text-slate-500 text-xs mt-0.5">{emp.employeeType?.replace('_', ' ') || 'N/A'}</div>
          </div>
        </div>
      </td>

      {/* Contact Column */}
      <td className="px-6 py-4">
        <div className="space-y-1.5">
          <div className="flex items-center text-slate-600 text-sm">
            <Mail className="mr-2 h-3.5 w-3.5 text-slate-400" />
            {emp.email}
          </div>
          {emp.phone && (
            <div className="flex items-center text-slate-600 text-sm">
              <Phone className="mr-2 h-3.5 w-3.5 text-slate-400" />
              {emp.phone}
            </div>
          )}
        </div>
      </td>

      {/* Role & Dept Column */}
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900">{emp.designation || 'N/A'}</div>
        <div className="text-slate-500 text-xs mt-0.5">{emp.department || 'N/A'}</div>
      </td>

      {/* Contract Column */}
      <td className="px-6 py-4">
        <div className="font-medium text-slate-900">{emp.contractType?.replace('_', ' ') || 'N/A'}</div>
        <div className="text-slate-500 text-xs mt-0.5 font-mono">{contractDisplay}</div>
      </td>

      {/* Status Column */}
      <td className="px-6 py-4">
        <Badge
          variant="outline"
          className={cn(
            'px-2.5 py-1 text-xs font-semibold border-0',
            emp.isActive !== false
              ? 'bg-green-100 text-green-700'
              : 'bg-slate-100 text-slate-600'
          )}
        >
          {emp.isActive !== false ? 'Active' : 'Inactive'}
        </Badge>
      </td>

      {/* Actions Column */}
      <td className="px-6 py-4 text-right">
        <EmployeeActionMenu
          employee={emp}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      </td>
    </tr>
  );
});

// ─────────────────────────────────────────────────────────────
// ACTION MENU COMPONENT
// ─────────────────────────────────────────────────────────────

interface EmployeeActionMenuProps {
  employee: Employee;
  onEdit: (emp: Employee) => void;
  onToggleStatus: (emp: Employee) => void;
  onDelete: (emp: Employee) => void;
}

const EmployeeActionMenu = memo(function EmployeeActionMenu({
  employee: emp,
  onEdit,
  onToggleStatus,
  onDelete,
}: EmployeeActionMenuProps) {
  const isActive = emp.isActive !== false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-100 rounded-lg">
          <MoreVertical className="h-4 w-4 text-slate-500" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 rounded-xl border-slate-200 shadow-xl">
        <DropdownMenuItem onClick={() => onEdit(emp)} className="rounded-md cursor-pointer">
          <Pencil className="mr-2 h-4 w-4 text-slate-500" /> Edit Details
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onToggleStatus(emp)}
          className="rounded-md cursor-pointer"
        >
          {isActive ? (
            <>
              <Ban className="mr-2 h-4 w-4 text-orange-500" /> Deactivate
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Activate
            </>
          )}
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-slate-100" />

        <DropdownMenuItem
          onClick={() => onDelete(emp)}
          className="rounded-md cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-700"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete Employee
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// ─────────────────────────────────────────────────────────────
// TABLE ROW SKELETON COMPONENT
// ─────────────────────────────────────────────────────────────

function EmployeeTableRowSkeleton() {
  return (
    <tr>
      <td className="px-6 py-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-32 rounded-lg" />
            <Skeleton className="h-3 w-20 rounded-lg" />
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-40 rounded-lg" />
          <Skeleton className="h-3.5 w-28 rounded-lg" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24 rounded-lg" />
          <Skeleton className="h-3 w-20 rounded-lg" />
        </div>
      </td>
      <td className="px-6 py-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-28 rounded-lg" />
          <Skeleton className="h-3 w-16 rounded-lg" />
        </div>
      </td>
      <td className="px-6 py-4">
        <Skeleton className="h-6 w-16 rounded-lg" />
      </td>
      <td className="px-6 py-4 text-right">
        <Skeleton className="h-8 w-8 rounded-lg ml-auto" />
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE COMPONENT
// ─────────────────────────────────────────────────────────────

function EmptyTableState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="py-16 text-center flex flex-col items-center gap-4">
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shadow-sm">
        <Users className="h-8 w-8 text-slate-400" />
      </div>
      <div>
        <p className="text-slate-500 font-semibold text-sm">No employees found</p>
        <p className="text-slate-400 text-xs mt-1">
          Try adjusting your filters or add a new employee
        </p>
      </div>
      <Button
        onClick={onAdd}
        size="sm"
        className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow-lg shadow-blue-600/25"
      >
        <Sparkles className="mr-1.5 h-3.5 w-3.5" /> Add first employee
      </Button>
    </div>
  );
}
