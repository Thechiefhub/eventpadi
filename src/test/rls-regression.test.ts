/**
 * Regression suite guarding the RLS policy graph.
 *
 * These tests hit the live backend with the public (anon) key and assert two
 * things for every surface the organiser flow touches:
 *   1. No policy ever evaluates recursively ("infinite recursion detected").
 *   2. Denied access fails cleanly with a 4xx permission error — never a 5xx.
 *
 * They exercise event creation, the scan/check-in API and attendee access,
 * which are exactly the paths that previously broke.
 */
import { describe, it, expect, beforeAll } from "vitest";

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const headers = {
  apikey: ANON,
  Authorization: `Bearer ${ANON}`,
  "Content-Type": "application/json",
};

type Probe = { status: number; body: string };

async function rest(path: string, init: RequestInit = {}): Promise<Probe> {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  return { status: res.status, body: await res.text() };
}

/** Every probe must satisfy these invariants, whatever the access outcome. */
function expectHealthyPolicy(probe: Probe, label: string) {
  expect(probe.body.toLowerCase(), `${label}: recursive policy detected`).not.toContain("infinite recursion");
  expect(probe.body.toLowerCase(), `${label}: stack depth blowout`).not.toContain("stack depth limit");
  expect(probe.status, `${label}: server error ${probe.status} — ${probe.body.slice(0, 200)}`).toBeLessThan(500);
}

describe("RLS regression — no recursion, no server errors", () => {
  beforeAll(() => {
    expect(URL_BASE, "VITE_SUPABASE_URL must be set").toBeTruthy();
    expect(ANON, "VITE_SUPABASE_PUBLISHABLE_KEY must be set").toBeTruthy();
  });

  it("reads events without recursing through team-member policies", async () => {
    const probe = await rest("events?select=id,name&limit=1");
    expectHealthyPolicy(probe, "events select");
  });

  it("rejects anonymous event creation with a permission error, not a policy crash", async () => {
    const probe = await rest("events", {
      method: "POST",
      body: JSON.stringify({ name: "RLS regression probe", user_id: "00000000-0000-0000-0000-000000000000" }),
    });
    expectHealthyPolicy(probe, "events insert");
    expect(probe.status, "anonymous insert must be denied").toBeGreaterThanOrEqual(400);
  });

  it("evaluates event_team_members policies without looping back into events", async () => {
    const probe = await rest("event_team_members?select=id&limit=1");
    expectHealthyPolicy(probe, "event_team_members select");
  });

  it("evaluates attendee access cleanly", async () => {
    const probe = await rest("attendees?select=id,checked_in&limit=1");
    expectHealthyPolicy(probe, "attendees select");
  });

  it("does not leak attendees to anonymous callers", async () => {
    const probe = await rest("attendees?select=id&limit=1");
    if (probe.status === 200) expect(JSON.parse(probe.body)).toHaveLength(0);
  });

  it("keeps public registration pages readable and organiser contacts private", async () => {
    const pages = await rest("event_registration_pages?select=id,slug&is_published=eq.true&limit=1");
    expectHealthyPolicy(pages, "registration pages select");

    const contacts = await rest("event_registration_page_contacts?select=contact_email&limit=1");
    expectHealthyPolicy(contacts, "registration contacts select");
    if (contacts.status === 200) expect(JSON.parse(contacts.body)).toHaveLength(0);
  });

  it("evaluates badge share log and check-in audit policies without recursion", async () => {
    for (const table of ["badge_share_log", "check_in_note_audits", "event_registrations"]) {
      const probe = await rest(`${table}?select=id&limit=1`);
      expectHealthyPolicy(probe, `${table} select`);
    }
  });
});

describe("Scan API regression", () => {
  it("rejects an unauthenticated check-in with 401 rather than crashing", async () => {
    const res = await fetch(`${URL_BASE}/functions/v1/qr-check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON },
      body: JSON.stringify({ eventId: "00000000-0000-0000-0000-000000000000", code: "TKT-NOPE" }),
    });
    const body = await res.text();
    expect(res.status, `unexpected status ${res.status} — ${body.slice(0, 200)}`).toBeLessThan(500);
    expect([401, 403]).toContain(res.status);
  });

  it("refuses a signed-out caller with a valid-looking anon token", async () => {
    const res = await fetch(`${URL_BASE}/functions/v1/qr-check-in`, {
      method: "POST",
      headers,
      body: JSON.stringify({ eventId: "00000000-0000-0000-0000-000000000000", code: '{"t":"TKT-FORGED","e":"other"}' }),
    });
    const body = await res.text();
    expect(res.status, body.slice(0, 200)).toBe(401);
  });

  it("answers CORS preflight so the scanner can warm the function", async () => {
    const res = await fetch(`${URL_BASE}/functions/v1/qr-check-in`, { method: "OPTIONS" });
    expect(res.status).toBeLessThan(500);
  });
});
