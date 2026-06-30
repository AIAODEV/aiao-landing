import { describe, it, expect } from "vitest";
import { gateDecision } from "../lib/gate";

describe("gateDecision", () => {
  it("301-redirecter apex til www", () => {
    const d = gateDecision({ hostname: "aiao.dev", pathname: "/byg", search: "", sessionValid: true });
    expect(d).toEqual({ action: "redirect", status: 301, location: "https://www.aiao.dev/byg" });
  });
  it("lukker ind når session er gyldig", () => {
    const d = gateDecision({ hostname: "www.aiao.dev", pathname: "/", search: "", sessionValid: true });
    expect(d).toEqual({ action: "next" });
  });
  it("redirecter til login når session mangler (husker next)", () => {
    const d = gateDecision({ hostname: "www.aiao.dev", pathname: "/ledelse", search: "?x=1", sessionValid: false });
    expect(d).toEqual({ action: "redirect", status: 302, location: "/api/auth/login?next=%2Fledelse%3Fx%3D1" });
  });
});
