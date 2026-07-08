import { useMemo } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  employeeService,
  type Employee,
  type EmployeeFilters,
  type EmployeeInput,
  type EmployeeListResponse
} from '../api/employee.service';

// ─── Query Keys ────────────────────────────────────────────
export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  list: (filters: EmployeeFilters) => [...employeeKeys.lists(), filters] as const,
  details: () => [...employeeKeys.all, 'detail'] as const,
  detail: (id: string) => [...employeeKeys.details(), id] as const,
  stats: () => [...employeeKeys.all, 'stats'] as const,
};

// ─── Queries ───────────────────────────────────────────────
export function useEmployees(
  filters: EmployeeFilters = {}
): UseQueryResult<EmployeeListResponse> {
  return useQuery({
    queryKey: employeeKeys.list(filters),
    queryFn: () => employeeService.getAll(filters),
    placeholderData: keepPreviousData,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useEmployee(id: string): UseQueryResult<{ data: { user: Employee } }> {
  return useQuery({
    queryKey: employeeKeys.detail(id),
    queryFn: () => employeeService.getById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Mutations ─────────────────────────────────────────────
export function useCreateEmployee(): UseMutationResult<{ data: { user: Employee } }, Error, EmployeeInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: EmployeeInput) => employeeService.create(data),
    onMutate: async () => {
      // Opting for simple invalidation on success instead of complex optimistic updates
      // for creation to avoid guessing ID and other backend-generated fields.
    },
    onError: (error, _variables, _context: any) => {
      toast.error(error instanceof Error ? error.message : 'Failed to create employee');
    },
    onSuccess: (res) => {
      const emp = res.data.user;
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      const displayName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || emp.email;
      toast.success(`✓ ${displayName} added`);
    },
  });
}

export function useUpdateEmployee(): UseMutationResult<
  { data: { user: Employee } }, Error, { id: string; data: Partial<EmployeeInput> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => employeeService.update(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: employeeKeys.detail(id) });
      const previous = qc.getQueryData<{ data: { user: Employee } }>(employeeKeys.detail(id));
      if (previous) {
        qc.setQueryData(employeeKeys.detail(id), {
          ...previous,
          data: { user: { ...previous.data.user, ...data } }
        });
      }
      return { previous };
    },
    onError: (error, variables, context: any) => {
      if (context?.previous) {
        qc.setQueryData(employeeKeys.detail(variables.id), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to update employee');
    },
    onSuccess: (res) => {
      qc.setQueryData(employeeKeys.detail(res.data.user.id), res);
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      const emp = res.data.user;
      const displayName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || emp.email;
      toast.success(`✓ ${displayName} updated`);
    },
  });
}

export function useDeleteEmployee(): UseMutationResult<{ message: string }, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => employeeService.remove(id),
    onMutate: async () => {
      // Opting out of optimistic delete, just invalidate on success
    },
    onError: (error, _id, _context: any) => {
      toast.error(error instanceof Error ? error.message : 'Failed to delete employee');
    },
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: employeeKeys.detail(id) });
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      toast.success('✓ Employee removed');
    },
  });
}

export function useUpdateEmployeeStatus(): UseMutationResult<
  { data: { user: Employee } }, Error, { id: string; isActive: boolean }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }) =>
      isActive ? employeeService.activate(id) : employeeService.deactivate(id),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: employeeKeys.detail(id) });
      const previous = qc.getQueryData<{ data: { user: Employee } }>(employeeKeys.detail(id));
      if (previous) {
        qc.setQueryData(employeeKeys.detail(id), {
          ...previous,
          data: { user: { ...previous.data.user, isActive } }
        });
      }
      return { previous };
    },
    onError: (error, variables, context: any) => {
      if (context?.previous) {
        qc.setQueryData(employeeKeys.detail(variables.id), context.previous);
      }
      toast.error(error instanceof Error ? error.message : 'Failed to update employee status');
    },
    onSuccess: (res) => {
      qc.setQueryData(employeeKeys.detail(res.data.user.id), res);
      qc.invalidateQueries({ queryKey: employeeKeys.lists() });
      const emp = res.data.user;
      const displayName = [emp.firstName, emp.lastName].filter(Boolean).join(' ') || emp.name || emp.email;
      toast.success(`✓ ${displayName} ${res.data.user.isActive ? 'activated' : 'deactivated'}`);
    },
  });
}

// ─── Utility Hooks ─────────────────────────────────────────
export function useMutatingIds(
  createMut: UseMutationResult<{ data: { user: Employee } }, Error, EmployeeInput>,
  updateMut: UseMutationResult<{ data: { user: Employee } }, Error, { id: string; data: Partial<EmployeeInput> }>,
  deleteMut: UseMutationResult<{ message: string }, Error, string>
): string | null {
  return useMemo(() => {
    if (createMut.isPending) return '__creating__';
    if (updateMut.isPending && updateMut.variables?.id) return updateMut.variables.id;
    if (deleteMut.isPending && deleteMut.variables) return deleteMut.variables;
    return null;
  }, [createMut.isPending, updateMut.isPending, updateMut.variables?.id, deleteMut.isPending, deleteMut.variables]);
}

export function useEmployeeStats(employees: Employee[]) {
  return useMemo(() => employeeService.getStats(employees), [employees]);
}

