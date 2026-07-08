import type { Request, Response } from "express";
import { userSwapServices } from "./swaps.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { CreateSwapInput, ListUserSwapsQuery } from "./swaps.validation";

// ─── Create Swap Request ─────────────────────────────────────────
export const createSwap = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const data = req.validated as CreateSwapInput;

  const swap = await userSwapServices.createSwap(userId, data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Swap request submitted for admin approval.",
    data: { swap },
  });
};

// ─── List My Swaps ───────────────────────────────────────────────
export const listMySwaps = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const validated = req.validated as ListUserSwapsQuery;

  const query: {
    page: number;
    limit: number;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    role?: "initiated" | "received";
  } = { page: validated.page, limit: validated.limit };
  if (validated.status !== undefined) query.status = validated.status;
  if (validated.role !== undefined) query.role = validated.role;

  const result = await userSwapServices.listMySwaps(userId, query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swaps fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination },
  });
};

// ─── Cancel My Swap ──────────────────────────────────────────────
export const cancelSwap = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const swapId = req.params.swapId as string;

  const swap = await userSwapServices.cancelSwap(userId, swapId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap request cancelled.",
    data: { swap },
  });
};
