import { describe, it, expect, beforeEach } from "vitest";
import handler from "../api/auth/login";

beforeEach(() => {
  process.env.ENTRA_TENANT_ID = "TEN";
  process.env.ENTRA_CLIENT_ID = "CID";
  process.env.ENTRA_CLIENT_SECRET = "SEC";
  process.env.SESSION_SECRET = "kkkkkkkkkkkkkkkk";
});

describe("/api/auth/login", () => {
  it("redirecter til Microsoft og sætter state-cookie", async () => {
    const res = await handler(new Request("https://www.aiao.dev/api/auth/login?next=%2Fbyg"));
    expect(res.status).toBe(302);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("login.microsoftonline.com/TEN/oauth2/v2.0/authorize");
    expect(loc).toContain("client_id=CID");
    expect(loc).toContain("code_challenge=");
    expect(loc).toContain("code_challenge_method=S256");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("aiao_oauth_tx=");
    expect(cookie).toContain("HttpOnly");
  });
});
