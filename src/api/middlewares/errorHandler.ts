import { Prisma } from "@prisma/client";
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

const prismaErrorMessages: Record<string, string> = {
  P2001: "Related record not found. Please check your input.",
  P2002: "Duplicate record. The value must be unique.",
  P2003: "Invalid reference. Cannot link to the provided record.",
  P2025: "Record not found. The target does not exist.",
};

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: err.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const statusMap: Record<string, number> = {
      P2001: 404,
      P2002: 409,
      P2003: 400,
      P2025: 404,
    };

    const status = statusMap[err.code] || 500;
    const userMessage = prismaErrorMessages[err.code] || err.message;

    return res.status(status).json({
      error: userMessage,
      code: err.code,
    });
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      error: "Invalid data or query provided",
      details: err.message,
    });
  }

  // TODO: if u fallback here then add your "error handler if condition"
  console.error("Unhandled error:", err);

  return res.status(500).json({
    error: "Internal Server Error",
    message: err.message || "Something went wrong",
  });
}
