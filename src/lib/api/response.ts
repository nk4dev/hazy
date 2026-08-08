import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "./errors";

export function ok<T>(data: T, init?: { status?: number }) {
  return NextResponse.json({ data }, { status: init?.status ?? 200 });
}

export function fail(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
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
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong." } },
    { status: 500 }
  );
}

/** Wrap a Route Handler body so every thrown ApiError/ZodError maps to the shared envelope. */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(error);
    }
  };
}
