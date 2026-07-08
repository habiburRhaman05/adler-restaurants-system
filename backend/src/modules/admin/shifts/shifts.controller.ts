import type { Request, Response } from "express";
import { shiftServices } from "./shifts.service";
import { sendSuccess } from "../../../utils/apiResponse";
import type {
  CreateShiftInput,
  UpdateShiftInput,
  ListShiftsQuery,
  RejectResponseInput,
  ListApprovalsQuery,
} from "./shifts.validation";

// ─── Create Shift ────────────────────────────────────────────────
export const createShift = async (req: Request, res: Response): Promise<void> => {
  const data = req.validated as CreateShiftInput;
  const adminId = res.locals.auth!.userId;

  const shift = await shiftServices.createShift(data, adminId);

  sendSuccess(res, {
    statusCode: 201,
    message: "Shift created successfully.",
    data: { shift },
  });
};

// ─── Update Shift ────────────────────────────────────────────────
export const updateShift = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;
  const data = req.validated as UpdateShiftInput;

  const shift = await shiftServices.updateShift(shiftId, data);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shift updated successfully.",
    data: { shift },
  });
};

// ─── Delete Shift ────────────────────────────────────────────────
export const deleteShift = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;

  await shiftServices.deleteShift(shiftId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shift deleted successfully.",
  });
};

// ─── Notify Employees ────────────────────────────────────────────
export const notifyShift = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;

  const result = await shiftServices.notifyShift(shiftId);

  sendSuccess(res, {
    statusCode: 200,
    message: `Notification sent to ${result.notifiedCount} employee(s).`,
    data: { shift: result.shift, notifiedCount: result.notifiedCount },
  });
};

// ─── Get All Shifts ──────────────────────────────────────────────
export const getAllShifts = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ListShiftsQuery;

  const query: {
    page: number;
    limit: number;
    categoryId?: string;
    notified?: boolean;
    upcoming?: boolean;
  } = { page: validated.page, limit: validated.limit };
  if (validated.categoryId !== undefined) query.categoryId = validated.categoryId;
  if (validated.notified !== undefined) query.notified = validated.notified;
  if (validated.upcoming !== undefined) query.upcoming = validated.upcoming;

  const result = await shiftServices.getAllShifts(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shifts fetched successfully.",
    data: { shifts: result.shifts },
    meta: { pagination: result.pagination },
  });
};

// ─── Get Shift By ID ─────────────────────────────────────────────
export const getShiftById = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;

  const shift = await shiftServices.getShiftById(shiftId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shift fetched successfully.",
    data: { shift },
  });
};

// ─── Get Shift Responses ─────────────────────────────────────────
export const getShiftResponses = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;

  const result = await shiftServices.getShiftResponses(shiftId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shift responses fetched successfully.",
    data: {
      shift: result.shift,
      accepted: result.accepted,
      declined: result.declined,
      counts: result.counts,
    },
  });
};

// ─── List Shifts Awaiting Approval ───────────────────────────────
export const getShiftsForApproval = async (req: Request, res: Response): Promise<void> => {
  const validated = req.validated as ListApprovalsQuery;

  const query: { page: number; limit: number; pendingOnly?: boolean } = {
    page: validated.page,
    limit: validated.limit,
  };
  if (validated.pendingOnly !== undefined) query.pendingOnly = validated.pendingOnly;

  const result = await shiftServices.getShiftsForApproval(query);

  sendSuccess(res, {
    statusCode: 200,
    message: "Shifts awaiting approval fetched successfully.",
    data: { shifts: result.shifts },
    meta: { pagination: result.pagination },
  });
};

// ─── Approve an Acceptance ───────────────────────────────────────
export const approveResponse = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;
  const responseId = req.params.responseId as string;
  const adminId = res.locals.auth!.userId;

  const response = await shiftServices.approveResponse(shiftId, responseId, adminId);

  sendSuccess(res, {
    statusCode: 200,
    message: "Employee approved for this shift.",
    data: { response },
  });
};

// ─── Reject an Acceptance ────────────────────────────────────────
export const rejectResponse = async (req: Request, res: Response): Promise<void> => {
  const shiftId = req.params.shiftId as string;
  const responseId = req.params.responseId as string;
  const adminId = res.locals.auth!.userId;
  const { note } = req.validated as RejectResponseInput;

  const response = await shiftServices.rejectResponse(shiftId, responseId, adminId, note);

  sendSuccess(res, {
    statusCode: 200,
    message: "Employee not assigned to this shift.",
    data: { response },
  });
};
