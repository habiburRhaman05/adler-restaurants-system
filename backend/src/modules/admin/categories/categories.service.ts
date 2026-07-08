import { prisma } from "../../../config/db";
import { AppError } from "../../../utils/AppError";
import type {
  CreateCategoryInput,
  CreateSubCategoryInput,
  UpdateCategoryInput,
} from "./categories.validation";
import type { Prisma } from "../../../generated/prisma/client";

const categorySelect = {
  id: true,
  name: true,
  parentId: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CategorySelect;

// Prisma's @@unique([parentId, name]) does not enforce uniqueness when parentId
// is NULL (SQL treats NULLs as distinct), so we guard duplicates manually,
// scoped to the same parent (siblings).
const assertNameAvailable = async (
  name: string,
  parentId: string | null,
  excludeId?: string
) => {
  const existing = await prisma.category.findFirst({
    where: {
      parentId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) {
    throw new AppError(
      parentId
        ? "A sub-category with this name already exists here."
        : "A category with this name already exists.",
      409
    );
  }
};

// Sub-categories may only hang off a top-level category (no deep nesting).
const assertValidParent = async (parentId: string) => {
  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { id: true, parentId: true },
  });
  if (!parent) {
    throw new AppError("Parent category does not exist.", 404);
  }
  if (parent.parentId) {
    throw new AppError("Sub-categories cannot be nested more than one level.", 409);
  }
};

// ─── Create Category (or sub-category via parentId) ──────────────
const createCategory = async (data: CreateCategoryInput) => {
  const parentId = data.parentId ?? null;
  if (parentId) await assertValidParent(parentId);
  await assertNameAvailable(data.name, parentId);

  const createData: Prisma.CategoryCreateInput = { name: data.name };
  if (data.isActive !== undefined) createData.isActive = data.isActive;
  if (parentId) createData.parent = { connect: { id: parentId } };

  return prisma.category.create({ data: createData, select: categorySelect });
};

// ─── Create Sub-Category (nested route convenience) ──────────────
const createSubCategory = async (parentId: string, data: CreateSubCategoryInput) => {
  await assertValidParent(parentId);
  await assertNameAvailable(data.name, parentId);

  return prisma.category.create({
    data: { name: data.name, parent: { connect: { id: parentId } } },
    select: categorySelect,
  });
};

// ─── Category Tree (parents + sub-categories + qualified counts) ─
const getCategoryTree = async () => {
  const categories = await prisma.category.findMany({
    where: { parentId: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { users: true, children: true } },
      children: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          isActive: true,
          _count: { select: { users: true } },
        },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    createdAt: c.createdAt,
    qualifiedCount: c._count.users, // employees assigned to this role
    subCategoryCount: c._count.children,
    children: c.children.map((child) => ({
      id: child.id,
      name: child.name,
      isActive: child.isActive,
      qualifiedCount: child._count.users,
    })),
  }));
};

// ─── Update Category ─────────────────────────────────────────────
const updateCategory = async (categoryId: string, data: UpdateCategoryInput) => {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new AppError("Category not found.", 404);
  }

  if (data.name && data.name.toLowerCase() !== existing.name.toLowerCase()) {
    await assertNameAvailable(data.name, existing.parentId, categoryId);
  }

  const updateData: Prisma.CategoryUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  return prisma.category.update({
    where: { id: categoryId },
    data: updateData,
    select: categorySelect,
  });
};

// ─── Delete Category (force) ─────────────────────────────────────
// An admin delete always removes the category. Everything tied to it — and to
// its sub-categories — is removed with it in one transaction: day-level Demands,
// Workload staffing demands, shift offers (their responses + swaps cascade),
// roster shifts (their swaps cascade), and employee assignments. Sub-categories
// are deleted too. All the FKs here are onDelete: Restrict, so we clear the
// dependents explicitly rather than letting the DB reject the delete.
const deleteCategory = async (categoryId: string) => {
  const existing = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, children: { select: { id: true } } },
  });
  if (!existing) {
    throw new AppError("Category not found.", 404);
  }

  const childIds = existing.children.map((c) => c.id);
  const allIds = [categoryId, ...childIds];

  await prisma.$transaction([
    prisma.dayDemand.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.staffingDemand.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.shiftOffer.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.shift.deleteMany({ where: { categoryId: { in: allIds } } }),
    prisma.userCategory.deleteMany({ where: { categoryId: { in: allIds } } }),
    // Sub-categories reference the parent (Restrict), so remove them first.
    ...(childIds.length
      ? [prisma.category.deleteMany({ where: { id: { in: childIds } } })]
      : []),
    prisma.category.delete({ where: { id: categoryId } }),
  ]);
};

// ─── Get All Categories ──────────────────────────────────────────
const getAllCategories = async (query: {
  page: number;
  limit: number;
  isActive?: boolean;
  search?: string;
}) => {
  const { page, limit, isActive, search } = query;
  const skip = (page - 1) * limit;

  const where: Prisma.CategoryWhereInput = { parentId: null };
  if (isActive !== undefined) where.isActive = isActive;
  if (search) where.name = { contains: search, mode: "insensitive" };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        ...categorySelect,
        _count: { select: { shiftOffers: true } },
      },
    }),
    prisma.category.count({ where }),
  ]);

  return {
    categories,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

// ─── Get Category By ID ──────────────────────────────────────────
const getCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: categorySelect,
  });
  if (!category) {
    throw new AppError("Category not found.", 404);
  }
  return category;
};

export const categoryServices = {
  createCategory,
  createSubCategory,
  getCategoryTree,
  updateCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
};
