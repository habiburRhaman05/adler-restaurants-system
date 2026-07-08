/**
 * Employee Table Container Component
 * Wrapper around EmployeeTable with proper data flow
 */

import type { Employee } from "@/features/employees/api/employee.service";
import { EmployeeTable } from "./employee-table-component";

interface EmployeeTableContainerProps {
  employees: Employee[];
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
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

export function EmployeeTableContainer({
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
}: EmployeeTableContainerProps) {
  return (
    <EmployeeTable
      employees={employees}
      isLoading={isLoading}
      isError={isError}
      isFetching={isFetching}
      mutatingId={mutatingId}
      onEdit={onEdit}
      onToggleStatus={onToggleStatus}
      onDelete={onDelete}
      onAdd={onAdd}
      page={page}
      hasNextPage={hasNextPage}
      onNextPage={onNextPage}
      onPrevPage={onPrevPage}
    />
  );
}
