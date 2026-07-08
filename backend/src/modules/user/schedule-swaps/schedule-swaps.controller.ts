import type { Request, Response } from "express";
import { scheduleSwapsServices } from "./schedule-swaps.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  SearchSwapTargetsQuery,
  CreateScheduleSwapInput,
  ListMySwapsQuery,
  RespondSwapInput,
} from "./schedule-swaps.validation";

const authUserId = (res: Response) => (res.locals.auth as { userId: string }).userId;

export const searchSwapTargets = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as SearchSwapTargetsQuery;

  const result = await scheduleSwapsServices.searchSwapTargets(authUserId(res), query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swappable shifts fetched successfully.",
    data: result,
  });
};

export const createSwap = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateScheduleSwapInput;

  const swap = await scheduleSwapsServices.createSwap(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Swap request sent. The other employee has been notified.",
    data: { swap },
  });
};

export const listMySwaps = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListMySwapsQuery;

  const result = await scheduleSwapsServices.listMySwaps(authUserId(res), query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Your swap requests fetched successfully.",
    data: { swaps: result.swaps },
    meta: { pagination: result.pagination },
  });
};

export const respondToSwap = async (req: Request, res: Response): Promise<void> => {
  const swapId = req.params.swapId as string;
  const data = req.validated as RespondSwapInput;

  const swap = await scheduleSwapsServices.respondToSwap(authUserId(res), swapId, data);

  sendSuccess(res, {
    statusCode: 200,
    message:
      data.action === "ACCEPT"
        ? "Swap accepted. It now awaits admin approval."
        : "Swap declined.",
    data: { swap },
  });
};

export const cancelSwap = async (req: Request, res: Response): Promise<void> => {
  const swapId = req.params.swapId as string;

  const swap = await scheduleSwapsServices.cancelSwap(authUserId(res), swapId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Swap request cancelled.",
    data: { swap },
  });
};
