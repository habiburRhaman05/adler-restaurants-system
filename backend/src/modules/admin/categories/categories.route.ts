import { Router } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { validateRequest } from "../../../middleware/validateRequest";
import { authenticate, authorizeAdmin } from "../../../middleware/auth";
import {
  createCategorySchema,
  createSubCategorySchema,
  updateCategorySchema,
  listCategoriesQuerySchema,
} from "./categories.validation";
import * as categoryController from "./categories.controller";

const categoryRouter = Router();

// All category management routes require admin authentication.
categoryRouter.use(authenticate, authorizeAdmin);

categoryRouter.post(
  "/",
  validateRequest(createCategorySchema),
  asyncHandler(categoryController.createCategory)
);

categoryRouter.get(
  "/",
  validateRequest(listCategoriesQuerySchema),
  asyncHandler(categoryController.getAllCategories)
);

// Full parent → sub-category tree with qualified-employee counts (Categories page).
categoryRouter.get("/tree", asyncHandler(categoryController.getCategoryTree));

// Add a sub-category under a top-level category.
categoryRouter.post(
  "/:categoryId/subcategories",
  validateRequest(createSubCategorySchema),
  asyncHandler(categoryController.createSubCategory)
);

categoryRouter.get("/:categoryId", asyncHandler(categoryController.getCategoryById));

categoryRouter.patch(
  "/:categoryId",
  validateRequest(updateCategorySchema),
  asyncHandler(categoryController.updateCategory)
);

categoryRouter.delete("/:categoryId", asyncHandler(categoryController.deleteCategory));

export default categoryRouter;
