import { describe, it, expect } from "vitest";
import { randomToken, sha256Base64Url, buildAuthorizeUrl } from "../lib/oauth";

describe("oauth helpers", () => {
  it("randomToken er base64url og unik", () => {
    const a = randomToken();
    const b = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
  });

  it("sha256Base64Url matcher kendt RFC7636-vektor", async () => {
    // RFC 7636 Appendix B: verifier -> challenge
    const challenge = await sha256Base64Url("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("buildAuthorizeUrl indeholder single-tenant + alle params", () => {
    const url = buildAuthorizeUrl({
      tenantId: "TEN", clientId: "CID", redirectUri: "https://www.aiao.dev/api/auth/callback",
      state: "ST", nonce: "NO", codeChallenge: "CH",
    });
    expect(url).toContain("https://login.microsoftonline.com/TEN/oauth2/v2.0/authorize");
    expect(url).toContain("client_id=CID");
    expect(url).toContain("response_type=code");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fwww.aiao.dev%2Fapi%2Fauth%2Fcallback");
    expect(url).toContain("scope=openid+profile+email");
    expect(url).toContain("state=ST");
    expect(url).toContain("nonce=NO");
    expect(url).toContain("code_challenge=CH");
    expect(url).toContain("code_challenge_method=S256");
  });
});
