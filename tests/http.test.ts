import { describe, it, expect } from "vitest";
import { parseCookies, serializeCookie, safeNextPath } from "../lib/http";

describe("http cookies", () => {
  it("parser cookie-header", () => {
    expect(parseCookies("a=1; b=hello")).toEqual({ a: "1", b: "hello" });
  });
  it("returnerer tomt objekt ved null", () => {
    expect(parseCookies(null)).toEqual({});
  });
  it("serialiserer med flag", () => {
    const c = serializeCookie("aiao_session", "tok", { maxAge: 60, httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
    expect(c).toContain("aiao_session=tok");
    expect(c).toContain("HttpOnly");
    expect(c).toContain("Secure");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Max-Age=60");
    expect(c).toContain("Path=/");
  });
});

describe("safeNextPath", () => {
  it("tillader lokal sti", () => {
    expect(safeNextPath("/byg")).toBe("/byg");
  });
  it("blokerer protokol-relativ URL (//evil.com)", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
  });
  it("blokerer absolut URL (https://evil.com)", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
  });
  it("blokerer backslash-bypass (/\\evil.com → browser normaliserer \\→/)", () => {
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\\/evil.com")).toBe("/");
  });
  it("bevarer sti + query", () => {
    expect(safeNextPath("/byg?x=1")).toBe("/byg?x=1");
  });
  it("håndterer null", () => {
    expect(safeNextPath(null)).toBe("/");
  });
});
