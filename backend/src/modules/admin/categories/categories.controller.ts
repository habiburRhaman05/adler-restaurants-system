import type { Request, Response } from "express";
import { categoryServices } from "./categories.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  CreateCategoryInput,
  CreateSubCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
} from "./categories.validation";

// ─── Create Category ─────────────────────────────────────────────
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateCategoryInput;
  const category = await categoryServices.createCategory(data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Category created successfully.",
    data: { category },
  });
};

// ─── Update Category ─────────────────────────────────────────────
export const updateCategory = async (req: Request, res: Response): Promise<void> => {
  const categoryId = req.params.categoryId as string;
  const data = req.validated as UpdateCategoryInput;
  const category = await categoryServices.updateCategory(categoryId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Category updated successfully.",
    data: { category },
  });
};

// ─── Delete Category ─────────────────────────────────────────────
export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
  const categoryId = req.params.categoryId as string;
  await categoryServices.deleteCategory(categoryId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Category deleted successfully.",
  });
};

// ─── Create Sub-Category ─────────────────────────────────────────
export const createSubCategory = async (req: Request, res: Response): Promise<void> => {
  const categoryId = req.params.categoryId as string;
  const data = req.validated as CreateSubCategoryInput;
  const category = await categoryServices.createSubCategory(categoryId, data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Sub-category created successfully.",
    data: { category },
  });
};

// ─── Get Category Tree ───────────────────────────────────────────
export const getCategoryTree = async (_req: Request, res: Response): Promise<void> => {
  const categories = await categoryServices.getCategoryTree();

  sendSuccess(res, {
    statusCode: 200,
    message: "Category tree fetched successfully.",
    data: { categories },
  });
};

// ─── Get All Categories ──────────────────────────────────────────
export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ListCategoriesQuery;

  const query: { page: number; limit: number; isActive?: boolean; search?: string } = {
    page: validated.page,
    limit: validated.limit,
  };
  if (validated.isActive !== undefined) query.isActive = validated.isActive;
  if (validated.search !== undefined) query.search = validated.search;

  const result = await categoryServices.getAllCategories(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Categories fetched successfully.",
    data: { categories: result.categories },
    meta: { pagination: result.pagination },
  });
};

// ─── Get Category By ID ──────────────────────────────────────────
export const getCategoryById = async (req: Request, res: Response): Promise<void> => {
  const categoryId = req.params.categoryId as string;
  const category = await categoryServices.getCategoryById(categoryId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Category fetched successfully.",
    data: { category },
  });
};
