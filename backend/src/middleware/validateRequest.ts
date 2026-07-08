import z, { AnyZodObject, ZodError } from "zod";
import { Request, Response, NextFunction } from "express";
import { formatZodError } from "../utils/formatZodError";



  export const validateRequest = (schema: z.ZodType<any>) => (req:any, res:Response, next:NextFunction) => {
  try {
    const result = schema.parse({
      ...req.body,
      ...req.params,
      ...req.query,
    });
    req.validated = result; // attach validated data to req
    next();
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      errors: err.errors || err.message,
    });
  }
};