import { APEX_HOST, CANONICAL_HOST } from "./config";

export type GateDecision =
  | { action: "next" }
  | { action: "redirect"; status: 301 | 302; location: string };

export function gateDecision(p: {
  hostname: string;
  pathname: string;
  search: string;
  sessionValid: boolean;
}): GateDecision {
  if (p.hostname === APEX_HOST) {
    return { action: "redirect", status: 301, location: `https://${CANONICAL_HOST}${p.pathname}${p.search}` };
  }
  if (p.sessionValid) return { action: "next" };
  const next = encodeURIComponent(`${p.pathname}${p.search}`);
  return { action: "redirect", status: 302, location: `/api/auth/login?next=${next}` };
}
