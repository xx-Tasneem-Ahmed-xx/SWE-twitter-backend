import { Response } from "express";
import { AppError } from "@/errors/AppError";
import { RESPONSES } from "@/application/constants/responses";

// Throws an AppError based on RESPONSES.ERRORS
export const throwError = (key: keyof typeof RESPONSES.ERRORS): never => {
  const error = RESPONSES.ERRORS[key];
  throw new AppError(error.message, error.status);
};

// Sends a success response based on RESPONSES.SUCCESS
export const sendResponse = (
  res: Response,
  key: keyof typeof RESPONSES.SUCCESS,
  data?: Record<string, any>
) => {
  const response = RESPONSES.SUCCESS[key];
  return res
    .status(response.status)
    .json({ message: response.message, ...data });
};
