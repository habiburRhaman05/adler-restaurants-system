import type { Request, Response } from "express";
import { settingsServices } from "./settings.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { UpdateSettingsInput } from "./settings.validation";

export const getSettings = async (_req: Request, res: Response): Promise<void> => {
  const settings = await settingsServices.getSettings();

  sendSuccess(res, {
    statusCode: 200,
    message: "Settings fetched successfully.",
    data: { settings },
  });
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as UpdateSettingsInput;
  const adminId = res.locals.auth!.userId;

  const settings = await settingsServices.updateSettings(data, adminId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Settings updated successfully.",
    data: { settings },
  });
};
