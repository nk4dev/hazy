import { describe, expect, test } from "bun:test";
import { createApp } from "@/app";
import { getPasskeyRpId } from "@/env";
import { isAllowedAdminEmail } from "@/lib/auth/better-auth";

describe("Better Auth single-user gate & CORS boundaries", () => {
  test("isAllowedAdminEmail enforces exact case-insensitive match and fails closed", () => {
    expect(isAllowedAdminEmail("owner@example.com", "owner@example.com")).toBe(true);
    expect(isAllowedAdminEmail("  Owner@Example.com ", "owner@example.com")).toBe(true);
    expect(isAllowedAdminEmail("intruder@example.com", "owner@example.com")).toBe(false);
    expect(isAllowedAdminEmail("", "owner@example.com")).toBe(false);
    expect(isAllowedAdminEmail(null, "owner@example.com")).toBe(false);
    expect(isAllowedAdminEmail("owner@example.com", undefined)).toBe(false);
    expect(isAllowedAdminEmail("owner@example.com", "")).toBe(false);
  });

  test("health and auth-config return expected envelopes", async () => {
    const app = createApp();

    const healthRes = await app.request("/health");
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toEqual({ ok: true });

    const authConfigRes = await app.request("/v1/auth-config");
    expect(authConfigRes.status).toBe(200);
    const body = (await authConfigRes.json()) as {
      data: { betterAuth: boolean; github: boolean; passkey: boolean };
    };
    expect(typeof body.data.betterAuth).toBe("boolean");
    expect(typeof body.data.github).toBe("boolean");
    expect(typeof body.data.passkey).toBe("boolean");
  });

  test("getPasskeyRpId strips leading dot from cookie domain and falls back to auth URL host", () => {
    expect(getPasskeyRpId("hz.nknighta.me", ".hz.nknighta.me", "https://api.hz.nknighta.me")).toBe(
      "hz.nknighta.me"
    );
    expect(getPasskeyRpId(undefined, ".hz.nknighta.me", "https://api.hz.nknighta.me")).toBe(
      "hz.nknighta.me"
    );
    expect(getPasskeyRpId(undefined, undefined, "http://localhost:8787")).toBe("localhost");
  });

  test("unauthenticated protected /v1/* endpoints return 401 unauthorized envelope with CORS", async () => {
    const app = createApp();
    for (const path of [
      "/v1/items",
      "/v1/me",
      "/v1/collections",
      "/v1/read-later",
      "/v1/connect/apps",
    ]) {
      const res = await app.request(path, {
        headers: { Origin: "http://localhost:3100" },
      });
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unauthorized");
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3100");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    }
  });

  test("CORS preflight on /api/auth/* allows first-party origins only with credentials", async () => {
    const app = createApp();

    const allowed = await app.request("/api/auth/get-session", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3100",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3100");
    expect(allowed.headers.get("Access-Control-Allow-Credentials")).toBe("true");

    const unknown = await app.request("/api/auth/get-session", {
      method: "OPTIONS",
      headers: {
        Origin: "https://evil.example",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(unknown.status).toBe(204);
    expect(unknown.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(unknown.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });

  test("CORS preflight on /v1/items allows first-party with credentials and blocks unknown origins", async () => {
    const app = createApp();

    const allowed = await app.request("/v1/items", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3100",
        "Access-Control-Request-Method": "GET",
      },
    });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:3100");
    expect(allowed.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  test("CORS preflight on /v1/connect/token allows third-party origins without credentials", async () => {
    const app = createApp();

    const res = await app.request("/v1/connect/token", {
      method: "OPTIONS",
      headers: {
        Origin: "https://dash.example",
        "Access-Control-Request-Method": "POST",
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("https://dash.example");
    expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
  });
});
