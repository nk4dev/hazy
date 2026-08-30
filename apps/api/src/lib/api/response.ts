import { ZodError } from "zod";
import { ApiError } from "./errors";

/** Success envelope: `{ data: T }`. */
export function ok<T>(data: T, init?: { status?: number }): Response {
  return Response.json({ data }, { status: init?.status ?? 200 });
}

/**
 * Failure envelope: `{ error: { code, message, details? } }`. Used as the body
 * of Hono's `onError` — every thrown `ApiError` / `ZodError` maps here, anything
 * else becomes a logged 500.
 */
export function fail(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "validation_error",
          message: "Request validation failed.",
          details: error.flatten(),
        },
      },
      { status: 400 }
    );
  }
  console.error("Unhandled API error:", error);
  return Response.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500 }
  );
}
