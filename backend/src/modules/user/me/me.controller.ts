import type { Request, Response } from "express";
import { meServices } from "./me.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  MyShiftsQuery,
  RespondShiftInput,
  BatchRespondInput,
  MyHoursQuery,
} from "./me.validation";

const authUserId = (res: Response) => (res.locals.auth as { userId: string }).userId;

export const getMyShifts = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as MyShiftsQuery;

  const result = await meServices.getMyShifts(authUserId(res), query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Your shifts fetched successfully.",
    data: result,
  });
};

export const respondToShift = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as RespondShiftInput;

  const shift = await meServices.respondToShift(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: `Shift ${data.action === "ACCEPT" ? "accepted" : "rejected"} successfully.`,
    data: { shift },
  });
};

export const batchRespond = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as BatchRespondInput;

  const result = await meServices.batchRespond(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: `${result.succeeded} response(s) applied, ${result.failed} failed.`,
    data: result,
  });
};

export const getMyHours = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as MyHoursQuery;

  const result = await meServices.getMyHours(authUserId(res), query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Your hours fetched successfully.",
    data: result,
  });
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as { firstName?: string; lastName?: string; phone?: string; address?: string };

  const user = await meServices.updateProfile(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Profile updated successfully.",
    data: { user },
  });
};
