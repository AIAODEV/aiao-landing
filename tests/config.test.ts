import { describe, it, expect, beforeEach } from "vitest";
import { getConfig, REDIRECT_URI, SESSION_TTL_SECONDS } from "../lib/config";

describe("config", () => {
  beforeEach(() => {
    delete process.env.ENTRA_TENANT_ID;
    delete process.env.ENTRA_CLIENT_ID;
    delete process.env.ENTRA_CLIENT_SECRET;
    delete process.env.SESSION_SECRET;
  });

  it("kaster når env mangler", () => {
    expect(() => getConfig()).toThrow();
  });

  it("returnerer værdier når env er sat", () => {
    process.env.ENTRA_TENANT_ID = "t";
    process.env.ENTRA_CLIENT_ID = "c";
    process.env.ENTRA_CLIENT_SECRET = "s";
    process.env.SESSION_SECRET = "k";
    expect(getConfig()).toEqual({ tenantId: "t", clientId: "c", clientSecret: "s", sessionSecret: "k" });
  });

  it("har korrekt redirect-URI og 8t session-levetid", () => {
    expect(REDIRECT_URI).toBe("https://www.aiao.dev/api/auth/callback");
    expect(SESSION_TTL_SECONDS).toBe(28800);
  });
});
