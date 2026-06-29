import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "../lib/jwt";

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
});
