/**
 * Employees Dashboard Page
 * Refactored with better component chunking, improved UI theme, and optimized re-renders
 */

import { useState, useCallback, useMemo } from 'react';


import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  useUpdateEmployeeStatus,
  useMutatingIds,
} from '@/features/employees/hooks/use-employees';
import type { Employee, EmployeeInput } from '@/features/employees/api/employee.service';
import { useDebouncedValue } from '@/components/employee';
import { EmployeeDeleteConfirm, EmployeeFormModal } from '@/components/employee/modal-components';
import { EmployeeHeader } from '@/components/employee/employee-header-component';
import { EmployeeFilters } from '@/components/employee/employee-filters-component';
import { EmployeeTableContainer } from '@/components/employee/employee-table-container';

// ─────────────────────────────────────────────────────────────
// MAIN PAGE COMPONENT
// ─────────────────────────────────────────────────────────────

export function EmployeesPage() {
  // ─────────────────── STATE ────────────────────────
  
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebouncedValue(searchQuery, 300);

  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [isActiveFilter, setIsActiveFilter] = useState('all');

  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorStack, setCursorStack] = useState<string[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  // Reset pagination when filters change
  useMemo(() => {
    setCursor(undefined);
    setCursorStack([]);
  }, [debouncedSearch, departmentFilter, isActiveFilter]);

  // ─────────────────── QUERIES & MUTATIONS ────────────────────────

  const { data, isLoading, isError, isFetching } = useEmployees({
    search: debouncedSearch || undefined,
    isActive: isActiveFilter === 'all' ? undefined : isActiveFilter === 'true',
    cursor,
    limit: 10,
  });

  const createMut = useCreateEmployee();
  const updateMut = useUpdateEmployee();
  const deleteMut = useDeleteEmployee();
  const statusMut = useUpdateEmployeeStatus();

  const mutatingId = useMutatingIds(createMut, updateMut, deleteMut);

  // ─────────────────── DATA ────────────────────────

  const employees = data?.data?.users ?? [];
  const totalCount = data?.data?.counts?.active ?? 0;
  
  const hasNextPage = data?.meta?.pagination?.hasNextPage ?? false;
  const nextCursor = data?.meta?.pagination?.nextCursor ?? null;
  const page = cursorStack.length + 1;

  // Local filtering for department since it's not a backend parameter
  const filteredEmployees = useMemo(() => {
    if (departmentFilter === 'all') return employees;
    return employees.filter(emp => emp.department === departmentFilter);
  }, [employees, departmentFilter]);

  // ─────────────────── HANDLERS ────────────────────────

  const handleNextPage = useCallback(() => {
    if (hasNextPage && nextCursor) {
      setCursorStack(prev => [...prev, cursor || '']);
      setCursor(nextCursor);
    }
  }, [hasNextPage, nextCursor, cursor]);

  const handlePrevPage = useCallback(() => {
    setCursorStack(prev => {
      const newStack = [...prev];
      const prevCursor = newStack.pop();
      setCursor(prevCursor === '' ? undefined : prevCursor);
      return newStack;
    });
  }, []);

  const handleOpenAddModal = useCallback(() => {
    setEditingEmployee(null);
    setModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((emp: Employee) => {
    setEditingEmployee(emp);
    setModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingEmployee(null);
  }, []);

  const handleSaveEmployee = useCallback(
    (formData: EmployeeInput) => {
      if (editingEmployee) {
        updateMut.mutate(
          { id: editingEmployee.id, data: formData },
          { onSuccess: handleCloseModal }
        );
      } else {
        createMut.mutate(formData, { onSuccess: handleCloseModal });
      }
    },
    [editingEmployee, updateMut, createMut]
  );

  const handleToggleStatus = useCallback(
    (emp: Employee) => {
      const nextStatus = emp.isActive === false; // If inactive, activate. If active, deactivate.
      statusMut.mutate({ id: emp.id, isActive: nextStatus });
    },
    [statusMut]
  );

  const handleDeleteClick = useCallback((emp: Employee) => {
    setDeleteTarget(emp);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) {
      deleteMut.mutate(deleteTarget.id, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  }, [deleteTarget, deleteMut]);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  // ─────────────────── RENDER ────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="p-4 md:p-8 space-y-6 max-w-[1800px] mx-auto">
        {/* Header */}
        <EmployeeHeader onAddClick={handleOpenAddModal} totalCount={totalCount} />

        {/* Filters */}
        <EmployeeFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          departmentFilter={departmentFilter}
          onDepartmentChange={setDepartmentFilter}
          isActiveFilter={isActiveFilter}
          onIsActiveChange={setIsActiveFilter}
          isFetching={isFetching && !isLoading}
        />

        {/* Table */}
        <EmployeeTableContainer
          employees={filteredEmployees}
          isLoading={isLoading}
          isError={isError}
          isFetching={isFetching}
          mutatingId={mutatingId}
          onEdit={handleOpenEditModal}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteClick}
          onAdd={handleOpenAddModal}
          page={page}
          hasNextPage={hasNextPage}
          onNextPage={handleNextPage}
          onPrevPage={handlePrevPage}
        />

        {/* Modals */}
        <EmployeeFormModal
          open={modalOpen}
          onOpenChange={handleCloseModal}
          editing={editingEmployee}
          onSave={handleSaveEmployee}
          isLoading={createMut.isPending || updateMut.isPending}
        />

        <EmployeeDeleteConfirm
          open={!!deleteTarget}
          onOpenChange={handleCloseDeleteDialog}
          employee={deleteTarget}
          isLoading={deleteMut.isPending}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </div>
  );
}
