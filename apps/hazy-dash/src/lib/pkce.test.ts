import { expect, test } from "bun:test";
import { pkceChallenge, randomToken } from "./pkce";

test("S256 challenge matches RFC 7636 Appendix B", async () => {
  expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe(
    "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
  );
});

test("random tokens are valid verifiers", () => {
  const token = randomToken();
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(randomToken()).not.toBe(token);
});
