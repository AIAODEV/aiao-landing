import { describe, it, expect, beforeEach } from "vitest";
import handler from "../api/auth/callback";

beforeEach(() => {
  process.env.ENTRA_TENANT_ID = "TEN";
  process.env.ENTRA_CLIENT_ID = "CID";
  process.env.ENTRA_CLIENT_SECRET = "SEC";
  process.env.SESSION_SECRET = "kkkkkkkkkkkkkkkk";
});

describe("/api/auth/callback", () => {
  it("redirecter til login når state-cookie mangler", async () => {
    const res = await handler(new Request("https://www.aiao.dev/api/auth/callback?code=abc&state=xyz"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/api/auth/login");
  });

  it("afviser når state ikke matcher cookie", async () => {
    // tx-cookie med state=AAA, men query siger state=BBB
    const { signJwt } = await import("../lib/jwt");
    const tx = await signJwt("kkkkkkkkkkkkkkkk", { state: "AAA", nonce: "n", verifier: "v", next: "/" }, 600);
    const res = await handler(
      new Request("https://www.aiao.dev/api/auth/callback?code=abc&state=BBB", {
        headers: { cookie: `aiao_oauth_tx=${tx}` },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/api/auth/login");
  });
});
