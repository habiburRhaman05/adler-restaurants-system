import { Response } from "express";

type SuccessOptions = {
  statusCode?: number;
  message?: string;
  data?: any;
  meta?: any;
};

type ErrorOptions = {
  statusCode?: number;
  message: string;
  errors?: any;
};

export const sendSuccess = (
  res: Response,
  { statusCode = 200, message = "Success", data,meta }: SuccessOptions
) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    meta:  {
      timestamp: new Date().toISOString(),
      ...meta
    },
  });
};

export const sendError = (
  res: Response,
  {
    statusCode = 500,
    message = "Something went wrong",
    errors,

  }: ErrorOptions
) => {
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    meta: {
      timestamp: new Date().toISOString(),
    },
  });
};
