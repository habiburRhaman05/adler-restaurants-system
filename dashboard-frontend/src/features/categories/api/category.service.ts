import { z } from 'zod';
import api from '@/lib/axios';

// ─── Schemas & Types ────────────────────────────────────────

export const categoryChildSchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  qualifiedCount: z.number().optional().default(0),
});
export type CategoryChild = z.infer<typeof categoryChildSchema>;

export const categoryTreeItemSchema = categoryChildSchema.extend({
  subCategoryCount: z.number().optional().default(0),
  children: z.array(categoryChildSchema).optional().default([]),
  createdAt: z.string().optional(),
});
export type CategoryTreeItem = z.infer<typeof categoryTreeItemSchema>;

export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  parentId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

export interface CategoryTreeResponse {
  success: boolean;
  data: {
    categories: CategoryTreeItem[];
  };
}

export type CategoryInput = {
  name: string;
  isActive?: boolean;
  parentId?: string;
};

// ─── Service ────────────────────────────────────────────────

export const categoryService = {
  /** Fetch the hierarchical tree of categories */
  getTree: (): Promise<CategoryTreeResponse> =>
    api.get(`/admin/categories/tree`).then((res) => res.data),

  /** Create new category (top-level or sub-category if parentId provided) */
  create: (data: CategoryInput): Promise<{ data: { category: Category } }> =>
    api.post('/admin/categories', data).then((res) => res.data),

  /** Add a sub-category directly to a parent (convenience endpoint) */
  addSubCategory: (parentId: string, data: { name: string }): Promise<{ data: { category: Category } }> =>
    api.post(`/admin/categories/${parentId}/subcategories`, data).then((res) => res.data),

  /** Update existing category */
  update: (id: string, data: { name?: string; isActive?: boolean }): Promise<{ data: { category: Category } }> =>
    api.patch(`/admin/categories/${id}`, data).then((res) => res.data),

  /** Delete category */
  remove: (id: string): Promise<{ message: string }> =>
    api.delete(`/admin/categories/${id}`).then((res) => res.data),
};
