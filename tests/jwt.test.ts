import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../lib/jwt";
import { SESSION_AUD, STATE_AUD } from "../lib/config";

const SECRET = "test-secret-0123456789";

describe("jwt", () => {
  it("signerer og verificerer en payload", async () => {
    const t = await signJwt(SECRET, { sub: "u1", email: "a@ao.dk" }, 60);
    const p = await verifyJwt<{ sub: string; email: string }>(SECRET, t);
    expect(p?.sub).toBe("u1");
    expect(p?.email).toBe("a@ao.dk");
  });

  it("afviser manipuleret token", async () => {
    const t = await signJwt(SECRET, { sub: "u1" }, 60);
    expect(await verifyJwt(SECRET, t + "x")).toBeNull();
  });

  it("afviser forkert secret", async () => {
    const t = await signJwt(SECRET, { sub: "u1" }, 60);
    expect(await verifyJwt("andet-secret", t)).toBeNull();
  });

  it("afviser udløbet token", async () => {
    const t = await signJwt(SECRET, { sub: "u1" }, -10); // exp i fortiden
    expect(await verifyJwt(SECRET, t)).toBeNull();
  });

  it("håndhæver audience: korrekt aud accepteres, forkert afvises", async () => {
    const t = await signJwt(SECRET, { sub: "u1" }, 60, SESSION_AUD);
    expect(await verifyJwt(SECRET, t, { audience: SESSION_AUD })).not.toBeNull();
    expect(await verifyJwt(SECRET, t, { audience: STATE_AUD })).toBeNull();
  });

  it("REGRESSION: et oauth-tx-token kan ikke bruges som session-token", async () => {
    // login udleverer et tx-token (STATE_AUD) uden auth. Det må ALDRIG passere som session.
    const tx = await signJwt(SECRET, { state: "s", nonce: "n", verifier: "v", next: "/" }, 600, STATE_AUD);
    expect(await verifyJwt(SECRET, tx, { audience: SESSION_AUD })).toBeNull();
  });
});
