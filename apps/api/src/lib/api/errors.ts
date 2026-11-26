import type { MissingService } from "@/env";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ServiceNotConfiguredError extends ApiError {
  constructor(public readonly service: MissingService | "openrouter") {
    super(
      503,
      "service_not_configured",
      `The "${service}" service is not configured yet. Add the required environment variables and restart the server.`,
      { service }
    );
    this.name = "ServiceNotConfiguredError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Sign in required.") {
    super(401, "unauthorized", message);
    this.name = "UnauthorizedError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(404, "not_found", `${resource} not found.`);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(400, "validation_error", message, details);
    this.name = "ValidationError";
  }
}

export type OpenRouterErrorCode = "ai_rate_limited" | "ai_timeout" | "ai_unavailable";

export class OpenRouterError extends ApiError {
  public readonly upstreamStatus?: number;
  public readonly model?: string;

  constructor(opts: {
    status: 429 | 502 | 503 | 504;
    code: OpenRouterErrorCode;
    message: string;
    upstreamStatus?: number;
    model?: string;
    details?: unknown;
    cause?: unknown;
  }) {
    super(opts.status, opts.code, opts.message, opts.details);
    this.name = "OpenRouterError";
    this.upstreamStatus = opts.upstreamStatus;
    this.model = opts.model;
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }
}
