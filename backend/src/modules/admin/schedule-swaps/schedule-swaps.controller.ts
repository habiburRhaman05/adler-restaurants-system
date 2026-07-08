import type { Request, Response } from "express";
import { adminScheduleSwapsServices } from "./schedule-swaps.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  ListScheduleSwapsQuery,
  ReviewScheduleSwapInput,
} from "./schedule-swaps.validation";

const authAdminId = (res: Response) => (res.locals.auth as { userId: string }).userId;

export const listSwaps = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListScheduleSwapsQuery;

  const result = await adminScheduleSwapsServices.listSwaps(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Schedule swap requests fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination },
  });
};

export const approveSwap = async (req: Request, res: Response): Promise<void> => {
  const swapId = req.params.swapId as string;
  const data = req.validated as ReviewScheduleSwapInput;

  const swap = await adminScheduleSwapsServices.approveSwap(swapId, authAdminId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap approved. The two shifts have been exchanged.",
    data: { swap },
  });
};

export const rejectSwap = async (req: Request, res: Response): Promise<void> => {
  const swapId = req.params.swapId as string;
  const data = req.validated as ReviewScheduleSwapInput;

  const swap = await adminScheduleSwapsServices.rejectSwap(swapId, authAdminId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap rejected.",
    data: { swap },
  });
};
