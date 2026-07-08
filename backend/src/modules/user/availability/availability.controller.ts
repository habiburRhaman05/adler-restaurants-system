import type { Request, Response } from "express";
import { userAvailabilityServices } from "./availability.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { SetDaysInput } from "./availability.validation";

// ─── List my availability months ─────────────────────────────────
export const listMyMonths = async (_req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;

  const months = await userAvailabilityServices.listMyMonths(userId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Availability months fetched successfully.",
    data: { months },
  });
};

// ─── Get my availability for a month ─────────────────────────────
export const getMyMonth = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const year = Number(req.params.year);
  const month = Number(req.params.month);

  const availability = await userAvailabilityServices.getMyMonth(userId, year, month);

  sendSuccess(res, {
    statusCode: 200,
    message: "Availability fetched successfully.",
    data: { availability },
  });
};

// ─── Set my day entries ──────────────────────────────────────────
export const setDays = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const { year, month, days } = req.validated as SetDaysInput;

  const availability = await userAvailabilityServices.setDays(userId, year, month, days);

  sendSuccess(res, {
    statusCode: 200,
    message: "Availability saved.",
    data: { availability },
  });
};

// ─── Submit bindingly ────────────────────────────────────────────
export const submit = async (req: Request, res: Response): Promise<void> => {
  const userId = res.locals.auth!.userId;
  const year = Number(req.params.year);
  const month = Number(req.params.month);

  const availability = await userAvailabilityServices.submit(userId, year, month);

  sendSuccess(res, {
    statusCode: 200,
    message: "Availability submitted.",
    data: { availability },
  });
};
