import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createSignedToken, verifySignedToken } from "../renderSigner";

describe("renderSigner", () => {
  beforeEach(() => {
    process.env.RENDER_SIGNING_SECRET = "test-secret";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates and verifies a valid signed token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const token = createSignedToken("render-abc", 120);
    expect(verifySignedToken("render-abc", token.exp, token.sig)).toBe(true);
  });

  it("rejects expired tokens", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const token = createSignedToken("render-abc", 5);
    vi.setSystemTime(new Date("2026-01-01T00:00:10.000Z"));

    expect(verifySignedToken("render-abc", token.exp, token.sig)).toBe(false);
  });

  it("rejects tampered signatures", () => {
    const token = createSignedToken("render-abc", 120);
    expect(verifySignedToken("render-abc", token.exp, `${token.sig.slice(0, -1)}0`)).toBe(false);
  });
});
