import type { Request, Response } from "express";
import { adminSwapServices } from "./swaps.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { ListSwapsQuery, ReviewSwapInput } from "./swaps.validation";

// ─── List Swaps ──────────────────────────────────────────────────
export const listSwaps = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ListSwapsQuery;

  const query: {
    page: number;
    limit: number;
    status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  } = { page: validated.page, limit: validated.limit };
  if (validated.status !== undefined) query.status = validated.status;

  const result = await adminSwapServices.listSwaps(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap requests fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination },
  });
};

// ─── Approve Swap ────────────────────────────────────────────────
export const approveSwap = async (req: Request, res: Response): Promise<void> => {
  const swapId = req.params.swapId as string;
  const adminId = res.locals.auth!.userId;
  const { note } = req.validated as ReviewSwapInput;

  const swap = await adminSwapServices.approveSwap(swapId, adminId, note);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap approved and shifts exchanged.",
    data: { swap },
  });
};

// ─── Reject Swap ─────────────────────────────────────────────────
export const rejectSwap = async (req: Request, res: Response): Promise<void> => {
  const swapId = req.params.swapId as string;
  const adminId = res.locals.auth!.userId;
  const { note } = req.validated as ReviewSwapInput;

  const swap = await adminSwapServices.rejectSwap(swapId, adminId, note);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap request rejected.",
    data: { swap },
  });
};
