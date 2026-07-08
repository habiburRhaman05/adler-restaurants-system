import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  categoryService,
  type CategoryInput,
} from '../api/category.service';

export const categoryKeys = {
  all: ['categories'] as const,
  tree: () => [...categoryKeys.all, 'tree'] as const,
};

/** Fetch the category tree. */
export function useCategoryTree() {
  return useQuery({
    queryKey: categoryKeys.tree(),
    queryFn: () => categoryService.getTree(),
    placeholderData: keepPreviousData,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CategoryInput) => categoryService.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success(`Category "${res.data.category.name}" added`);
    },
    onError: () => {
      toast.error('Could not create category. Please try again.');
    },
  });
}

export function useCreateSubCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, name }: { parentId: string; name: string }) =>
      categoryService.addSubCategory(parentId, { name }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success(`Sub-category "${res.data.category.name}" added`);
    },
    onError: () => {
      toast.error('Could not create sub-category. Please try again.');
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; isActive?: boolean } }) =>
      categoryService.update(id, data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success(`Category "${res.data.category.name}" updated`);
    },
    onError: () => {
      toast.error('Could not update category. Please try again.');
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoryService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: categoryKeys.all });
      toast.success('Category deleted successfully');
    },
    onError: (error: any) => {
      const msg = error?.data?.message || error?.response?.data?.message || 'Could not delete category. Please try again.';
      toast.error(msg);
    },
  });
}
