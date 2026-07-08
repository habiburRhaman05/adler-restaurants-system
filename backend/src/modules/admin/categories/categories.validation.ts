import { z } from "zod";

export const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Category name is required" })
    .trim()
    .min(1, "Category name cannot be empty")
    .max(100, "Category name is too long"),
  isActive: z.boolean().optional(),
  // Provide to create a sub-category under an existing top-level category.
  parentId: z.string().min(1).optional(),
});

export const createSubCategorySchema = z.object({
  name: z
    .string({ required_error: "Sub-category name is required" })
    .trim()
    .min(1, "Sub-category name cannot be empty")
    .max(100),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1, "Category name cannot be empty").max(100).optional(),
  isActive: z.boolean().optional(),
});

export const categoryIdParamSchema = z.object({
  categoryId: z.string({ required_error: "Category ID is required" }).min(1),
});

export const listCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  isActive: z
    .enum(["true", "false"])
    .transform((val) => val === "true")
    .optional(),
  search: z.string().trim().optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateSubCategoryInput = z.infer<typeof createSubCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
