import { ZodError } from "zod";

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const validationErrorResponse = (error: ZodError) => ({
  error: "ValidationError",
  message: "Request validation failed",
  issues: error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }))
});

export const errorMessage = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === "string") {
    return value;
  }

  return "Unknown error";
};
