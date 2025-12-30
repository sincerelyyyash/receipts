import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

// Custom error class for API errors
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ApiError";
  }
}

// Not found error
export class NotFoundError extends ApiError {
  constructor(resource: string = "Resource") {
    super(`${resource} not found`, 404);
    this.name = "NotFoundError";
  }
}

// Validation error
export class ValidationError extends ApiError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

// External service error
export class ExternalServiceError extends ApiError {
  constructor(service: string, message: string) {
    super(`${service} error: ${message}`, 502);
    this.name = "ExternalServiceError";
  }
}

// Global error handler middleware
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  console.error("Error:", err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: "Validation error",
      details: err.errors.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      })),
    });
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Handle Prisma errors
  if (err.name === "PrismaClientKnownRequestError") {
    const prismaError = err as any;
    if (prismaError.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "A record with this identifier already exists",
      });
    }
    if (prismaError.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: "Record not found",
      });
    }
  }

  // Default server error
  return res.status(500).json({
    success: false,
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal server error",
  });
};

// Async handler wrapper to catch errors
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

