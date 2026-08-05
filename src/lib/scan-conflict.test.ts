import { describe, it, expect } from "vitest";
import { describeScan, formatCheckedInAgo, shouldSubmitScan, type ScanResult } from "./scan-conflict";

const NOW = Date.parse("2026-08-05T10:00:00.000Z");

describe("formatCheckedInAgo", () => {
  it("returns null for missing/invalid timestamps", () => {
    expect(formatCheckedInAgo(null, NOW)).toBeNull();
    expect(formatCheckedInAgo("not-a-date", NOW)).toBeNull();
  });
  it("formats recent, minute, hour and day distances", () => {
    expect(formatCheckedInAgo("2026-08-05T09:59:58.000Z", NOW)).toBe("just now");
    expect(formatCheckedInAgo("2026-08-05T09:59:20.000Z", NOW)).toBe("40 seconds ago");
    expect(formatCheckedInAgo("2026-08-05T09:59:00.000Z", NOW)).toBe("1 minute ago");
    expect(formatCheckedInAgo("2026-08-05T09:30:00.000Z", NOW)).toBe("30 minutes ago");
    expect(formatCheckedInAgo("2026-08-05T07:00:00.000Z", NOW)).toBe("3 hours ago");
    expect(formatCheckedInAgo("2026-08-03T10:00:00.000Z", NOW)).toBe("2 days ago");
  });
});

describe("describeScan", () => {
  it("treats a successful check-in as non-blocking", () => {
    const copy = describeScan({ ok: true, status: "checked_in", attendee: { name: "Ada" } }, NOW);
    expect(copy.blocking).toBe(false);
    expect(copy.tone).toBe("success");
    expect(copy.title).toContain("Ada");
  });

  it("explains a duplicate badge with who scanned it and when", () => {
    const r: ScanResult = {
      ok: false, status: "already", attendee: { name: "Ada" },
      checkedInAt: "2026-08-05T09:45:00.000Z", checkedInByName: "Tolu",
    };
    const copy = describeScan(r, NOW);
    expect(copy.blocking).toBe(true);
    expect(copy.tone).toBe("warning");
    expect(copy.explanation).toContain("by Tolu");
    expect(copy.explanation).toContain("15 minutes ago");
    expect(copy.action.toLowerCase()).toContain("verify their id");
  });

  it("falls back gracefully when duplicate metadata is missing", () => {
    const copy = describeScan({ ok: false, status: "already" }, NOW);
    expect(copy.title).toBe("This attendee is already inside");
    expect(copy.explanation).toContain("already been used");
  });

  it("flags forged/cross-event badges as dangerous and blocking", () => {
    const copy = describeScan({ ok: false, status: "invalid", reason: "This badge was issued for a different event." }, NOW);
    expect(copy.tone).toBe("danger");
    expect(copy.blocking).toBe(true);
    expect(copy.explanation).toContain("different event");
  });

  it("guides staff to the list when a ticket is unknown", () => {
    const copy = describeScan({ ok: false, status: "not_found" }, NOW);
    expect(copy.tone).toBe("danger");
    expect(copy.action.toLowerCase()).toContain("search");
  });
});

describe("shouldSubmitScan", () => {
  it("submits a brand new code immediately", () => {
    expect(shouldSubmitScan("TKT-A", { code: "", at: 0 }, NOW)).toBe(true);
  });
  it("never delays a different badge held back-to-back", () => {
    expect(shouldSubmitScan("TKT-B", { code: "TKT-A", at: NOW - 10 }, NOW)).toBe(true);
  });
  it("de-dupes the same badge inside the window", () => {
    expect(shouldSubmitScan("TKT-A", { code: "TKT-A", at: NOW - 500 }, NOW)).toBe(false);
  });
  it("allows the same badge again after the window", () => {
    expect(shouldSubmitScan("TKT-A", { code: "TKT-A", at: NOW - 3000 }, NOW)).toBe(true);
  });
  it("ignores empty decodes", () => {
    expect(shouldSubmitScan("", { code: "", at: 0 }, NOW)).toBe(false);
  });
});
