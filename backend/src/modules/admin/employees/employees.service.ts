import { prisma } from "../../../config/db";
import { hashPassword } from "../../../utils/bcrypt";
import { AppError } from "../../../utils/AppError";
import type { CreateUserInput, UpdateUserInput } from "./employees.validation";
import type { Prisma } from "../../../generated/prisma/client";

// Shared projection so password hashes are never returned in API responses.
const userSelect = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  phone: true,
  address: true,
  department: true,
  designation: true,
  employeeType: true,
  contractType: true,
  workloadPercent: true,
  hourlyRate: true,
  monthlySalary: true,
  contractedHoursMonthly: true,
  hireDate: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    select: { category: { select: { id: true, name: true, parentId: true } } },
    orderBy: { assignedAt: "asc" },
  },
} satisfies Prisma.UserSelect;

// Flatten the UserCategory join rows into a plain category array for the client.
const flattenUser = <
  T extends {
    categories: { category: { id: string; name: string; parentId: string | null } }[];
  }
>(
  user: T
) => {
  const { categories, ...rest } = user;
  return { ...rest, categories: categories.map((c) => c.category) };
};

// Opaque keyset cursor: base64url of a user's `id`. The list is ordered by
// (createdAt desc, id desc); `id` — a unique column — is the tiebreaker Prisma
// keys the cursor on, so pages stay stable even when two rows share createdAt.
const encodeCursor = (id: string) => Buffer.from(id, "utf8").toString("base64url");
const decodeCursor = (cursor: string): string => {
  const id = Buffer.from(cursor, "base64url").toString("utf8");
  if (!id) throw new AppError("Invalid pagination cursor.", 400);
  return id;
};

// Guard that every referenced category exists before assigning.
const assertCategoriesExist = async (categoryIds: string[]) => {
  if (categoryIds.length === 0) return;
  const unique = [...new Set(categoryIds)];
  const found = await prisma.category.count({ where: { id: { in: unique } } });
  if (found !== unique.length) {
    throw new AppError("One or more selected categories do not exist.", 400);
  }
};

// ─── Create User ─────────────────────────────────────────────────
const createUser = async (data: CreateUserInput) => {
  // 1. Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (existingUser) {
    throw new AppError("A user with this email already exists.", 409);
  }

  // 2. Hash password
  const passwordHash = await hashPassword(data.password);

  // 3. Build create payload — only include fields that are provided
  //    (exactOptionalPropertyTypes forbids passing undefined to nullable Prisma fields)
  const createData: Prisma.UserCreateInput = {
    email: data.email,
    passwordHash,
    mustChangePassword: true,
  };

  if (data.name !== undefined) createData.name = data.name;
  if (data.firstName !== undefined) createData.firstName = data.firstName;
  if (data.lastName !== undefined) createData.lastName = data.lastName;
  if (data.phone !== undefined) createData.phone = data.phone;
  if (data.address !== undefined) createData.address = data.address;
  if (data.department !== undefined) createData.department = data.department;
  if (data.designation !== undefined) createData.designation = data.designation;
  if (data.employeeType !== undefined) createData.employeeType = data.employeeType;
  if (data.isActive !== undefined) createData.isActive = data.isActive;
  if (data.contractType !== undefined) createData.contractType = data.contractType;
  if (data.workloadPercent !== undefined) createData.workloadPercent = data.workloadPercent;
  if (data.hourlyRate !== undefined) createData.hourlyRate = data.hourlyRate;
  if (data.monthlySalary !== undefined) createData.monthlySalary = data.monthlySalary;
  if (data.contractedHoursMonthly !== undefined) createData.contractedHoursMonthly = data.contractedHoursMonthly;
  if (data.hireDate !== undefined) createData.hireDate = new Date(data.hireDate);

  // Category (role) assignments
  if (data.categoryIds && data.categoryIds.length > 0) {
    await assertCategoriesExist(data.categoryIds);
    createData.categories = {
      create: [...new Set(data.categoryIds)].map((categoryId) => ({
        category: { connect: { id: categoryId } },
      })),
    };
  }

  // 4. Create user
  const user = await prisma.user.create({
    data: createData,
    select: userSelect,
  });

  return flattenUser(user);
};

// ─── Update User ─────────────────────────────────────────────────
const updateUser = async (userId: string, data: UpdateUserInput) => {
  // 1. Check user exists
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  // 2. If email is changing, check uniqueness
  if (data.email && data.email !== existingUser.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (emailTaken) {
      throw new AppError("A user with this email already exists.", 409);
    }
  }

  // 3. Build update payload
  const updateData: Prisma.UserUpdateInput = {};

  if (data.email !== undefined) updateData.email = data.email;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.department !== undefined) updateData.department = data.department;
  if (data.designation !== undefined) updateData.designation = data.designation;
  if (data.employeeType !== undefined) updateData.employeeType = data.employeeType;
  if (data.contractType !== undefined) updateData.contractType = data.contractType;
  if (data.workloadPercent !== undefined) updateData.workloadPercent = data.workloadPercent;
  if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;
  if (data.monthlySalary !== undefined) updateData.monthlySalary = data.monthlySalary;
  if (data.contractedHoursMonthly !== undefined) updateData.contractedHoursMonthly = data.contractedHoursMonthly;
  if (data.hireDate !== undefined) updateData.hireDate = new Date(data.hireDate);
  if (data.mustChangePassword !== undefined) updateData.mustChangePassword = data.mustChangePassword;

  // Status toggle (Active / Inactive). Keep deactivatedAt consistent.
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
    updateData.deactivatedAt = data.isActive ? null : new Date();
  }

  // Category (role) assignments — a provided list fully replaces the old set.
  if (data.categoryIds !== undefined) {
    await assertCategoriesExist(data.categoryIds);
    updateData.categories = {
      deleteMany: {},
      create: [...new Set(data.categoryIds)].map((categoryId) => ({
        category: { connect: { id: categoryId } },
      })),
    };
  }

  // 4. If password is being updated, hash it
  if (data.password) {
    updateData.passwordHash = await hashPassword(data.password);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: userSelect,
  });

  return flattenUser(user);
};

// ─── Delete User ─────────────────────────────────────────────────
const deleteUser = async (userId: string) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  await prisma.user.delete({ where: { id: userId } });
};

// ─── Deactivate User ─────────────────────────────────────────────
const deactivateUser = async (userId: string) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  if (!existingUser.isActive) {
    throw new AppError("User is already deactivated.", 400);
  }

  // Revoke all active refresh tokens when deactivating
  await prisma.userRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deactivatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      deactivatedAt: true,
    },
  });

  return user;
};

// ─── Activate User ───────────────────────────────────────────────
const activateUser = async (userId: string) => {
  const existingUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!existingUser) {
    throw new AppError("User not found.", 404);
  }

  if (existingUser.isActive) {
    throw new AppError("User is already active.", 400);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: true,
      deactivatedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
    },
  });

  return user;
};

// ─── Get All Users (cursor / keyset pagination) ──────────────────
const getAllUsers = async (query: {
  limit: number;
  cursor?: string;
  isActive?: boolean;
  search?: string;
  categoryId?: string;
}) => {
  const { limit, cursor, isActive, search, categoryId } = query;

  const where: Prisma.UserWhereInput = {};

  if (isActive !== undefined) {
    where.isActive = isActive;
  }

  if (categoryId) {
    where.categories = { some: { categoryId } };
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { department: { contains: search, mode: "insensitive" } },
      { designation: { contains: search, mode: "insensitive" } },
    ];
  }

  // Resolve + validate the cursor up-front so a stale/garbage cursor returns a
  // clean 400 instead of a raw Prisma "cursor does not exist" error.
  let cursorId: string | undefined;
  if (cursor) {
    cursorId = decodeCursor(cursor);
    const exists = await prisma.user.findUnique({
      where: { id: cursorId },
      select: { id: true },
    });
    if (!exists) {
      throw new AppError("Invalid or expired pagination cursor.", 400);
    }
  }

  // Active/inactive tallies power the "11 active · 1 inactive" header. They are
  // computed over the same filters EXCEPT the isActive filter itself.
  const countWhere: Prisma.UserWhereInput = { ...where };
  delete countWhere.isActive;

  // Fetch one extra row beyond `limit` to detect whether another page follows.
  const [rows, activeCount, inactiveCount] = await Promise.all([
    prisma.user.findMany({
      where,
      take: limit + 1,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      // A unique tiebreaker (id) makes the ordering total, which keyset
      // pagination requires to never skip or repeat a row.
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        department: true,
        designation: true,
        employeeType: true,
        contractType: true,
        workloadPercent: true,
        hourlyRate: true,
        monthlySalary: true,
        isActive: true,
        lastLoginAt: true,
        hireDate: true,
        createdAt: true,
        categories: {
          select: { category: { select: { id: true, name: true, parentId: true } } },
          orderBy: { assignedAt: "asc" },
        },
      },
    }),
    prisma.user.count({ where: { ...countWhere, isActive: true } }),
    prisma.user.count({ where: { ...countWhere, isActive: false } }),
  ]);

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? encodeCursor(lastRow.id) : null;

  return {
    users: pageRows.map(flattenUser),
    counts: { active: activeCount, inactive: inactiveCount },
    pagination: { limit, nextCursor, hasNextPage },
  };
};

// ─── Get User By ID ──────────────────────────────────────────────
const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  return flattenUser(user);
};

export const userManagementServices = {
  createUser,
  updateUser,
  deleteUser,
  deactivateUser,
  activateUser,
  getAllUsers,
  getUserById,
};
