import type { Request, Response } from "express";
import { userManagementServices } from "./employees.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { CreateUserInput, UpdateUserInput, ListUsersQuery } from "./employees.validation";

// ─── Create User ─────────────────────────────────────────────────
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateUserInput;

  const user = await userManagementServices.createUser(data);

  sendSuccess(res, {
    statusCode: 201,
    message: "User created successfully.",
    data: { user },
  });
};

// ─── Update User ─────────────────────────────────────────────────
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;
  const data = req.validated as UpdateUserInput;

  const user = await userManagementServices.updateUser(userId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "User updated successfully.",
    data: { user },
  });
};

// ─── Delete User ─────────────────────────────────────────────────
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  await userManagementServices.deleteUser(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "User deleted successfully.",
  });
};

// ─── Deactivate User ─────────────────────────────────────────────
export const deactivateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  const user = await userManagementServices.deactivateUser(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "User deactivated successfully.",
    data: { user },
  });
};

// ─── Activate User ───────────────────────────────────────────────
export const activateUser = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  const user = await userManagementServices.activateUser(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "User activated successfully.",
    data: { user },
  });
};

// ─── Get All Users ───────────────────────────────────────────────
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ListUsersQuery;

  const query: {
    limit: number;
    cursor?: string;
    isActive?: boolean;
    search?: string;
    categoryId?: string;
  } = {
    limit: validated.limit,
  };
  if (validated.cursor !== undefined) query.cursor = validated.cursor;
  if (validated.isActive !== undefined) query.isActive = validated.isActive;
  if (validated.search !== undefined) query.search = validated.search;
  if (validated.categoryId !== undefined) query.categoryId = validated.categoryId;

  const result = await userManagementServices.getAllUsers(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Users fetched successfully.",
    data: { users: result.users, counts: result.counts },
    meta: { pagination: result.pagination },
  });
};

// ─── Get User By ID ──────────────────────────────────────────────
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const userId = req.params.userId as string;

  const user = await userManagementServices.getUserById(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "User fetched successfully.",
    data: { user },
  });
};
