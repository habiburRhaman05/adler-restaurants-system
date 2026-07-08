import type { Request, Response } from "express";
import { adminLeavesServices } from "./leaves.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type { ListLeavesQuery, ReviewLeaveInput } from "./leaves.validation";

const authAdminId = (res: Response) => (res.locals.auth as { userId: string }).userId;

export const listLeaves = async (req: Request, res: Response): Promise<void> => {
  const query = req.validated as ListLeavesQuery;

  const result = await adminLeavesServices.listLeaves(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Leave requests fetched successfully.",
    data: { leaves: result.leaves },
    meta: { pagination: result.pagination },
  });
};

export const approveLeave = async (req: Request, res: Response): Promise<void> => {
  const leaveId = req.params.leaveId as string;
  const data = req.validated as ReviewLeaveInput;

  const result = await adminLeavesServices.approveLeave(leaveId, authAdminId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message:
      result.cancelledShiftCount > 0
        ? `Leave approved. ${result.cancelledShiftCount} scheduled shift(s) were cancelled.`
        : "Leave approved.",
    data: result,
  });
};

export const rejectLeave = async (req: Request, res: Response): Promise<void> => {
  const leaveId = req.params.leaveId as string;
  const data = req.validated as ReviewLeaveInput;

  const result = await adminLeavesServices.rejectLeave(leaveId, authAdminId(res), data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Leave rejected.",
    data: result,
  });
};
