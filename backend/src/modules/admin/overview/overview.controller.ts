import type { Request, Response } from "express";
import { overviewServices } from "./overview.service";
import { sendSuccess } from "../../../utils/apiResponse";

export const getOverview = async (_req: Request, res: Response): Promise<void> => {
  const overview = await overviewServices.getOverview();

  sendSuccess(res, {
    statusCode: 200,
    message: "Overview fetched successfully.",
    data: overview,
  });
};
