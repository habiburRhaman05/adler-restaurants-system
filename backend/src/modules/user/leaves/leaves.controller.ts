import type { Request, Response } from "express";
import { leavesServices } from "./leaves.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { CreateLeaveInput, MyLeavesQuery } from "./leaves.validation";

const authUserId = (res: Response) => (res.locals.auth as { userId: string }).userId;

export const createLeave = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateLeaveInput;

  const leave = await leavesServices.createLeave(authUserId(res), data);

  sendSuccess(res, {
    statusCode: 201,
    message: "Leave request submitted. The admin team has been notified.",
    data: { leave },
  });
};

export const getMyLeaves = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as MyLeavesQuery;

  const result = await leavesServices.getMyLeaves(authUserId(res), query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Your leave requests fetched successfully.",
    data: { leaves: result.leaves },
    meta: { pagination: result.pagination },
  });
};

export const cancelLeave = async (req: Request, res: Response): Promise<void> => {
  const leaveId = req.params.leaveId as string;

  const leave = await leavesServices.cancelLeave(authUserId(res), leaveId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Leave request cancelled.",
    data: { leave },
  });
};
