import type { Request, Response } from "express";
import { userShiftServices } from "./shifts.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { RespondToShiftInput, ListUserShiftsQuery } from "./shifts.validation";

// ─── List Available Shifts ───────────────────────────────────────
export const listShifts = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const validated = req.validated as ListUserShiftsQuery;

  const query: {
    page: number;
    limit: number;
    categoryId?: string;
    mine?: "accepted" | "rejected" | "pending";
    upcoming?: boolean;
  } = { page: validated.page, limit: validated.limit };
  if (validated.categoryId !== undefined) query.categoryId = validated.categoryId;
  if (validated.mine !== undefined) query.mine = validated.mine;
  if (validated.upcoming !== undefined) query.upcoming = validated.upcoming;

  const result = await userShiftServices.listAvailableShifts(userId, query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shifts fetched successfully.",
    data: { shifts: result.shifts },
    meta: { pagination: result.pagination },
  });
};

// ─── Get Single Shift ────────────────────────────────────────────
export const getShift = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const shiftId = req.params.shiftId as string;

  const shift = await userShiftServices.getShiftForUser(userId, shiftId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shift fetched successfully.",
    data: { shift },
  });
};

// ─── Respond to Shift (accept / reject) ──────────────────────────
export const respondToShift = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const shiftId = req.params.shiftId as string;
  const data = req.validated as RespondToShiftInput;

  const response = await userShiftServices.respondToShift(userId, shiftId, data);

  sendSuccess(res, {
    statusCode: 200,
    message:
      data.status === "ACCEPTED"
        ? "Shift accepted successfully."
        : "Shift declined.",
    data: { response },
  });
};
