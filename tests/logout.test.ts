import { describe, it, expect } from "vitest";
import handler from "../api/auth/logout";

describe("/api/auth/logout", () => {
  it("rydder session-cookie og redirecter til login", async () => {
    const res = await handler(new Request("https://www.aiao.dev/api/auth/logout"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/api/auth/login");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("aiao_session=");
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
  });
});
