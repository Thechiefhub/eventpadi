/**
 * Pure helpers for turning a qr-check-in response into scanner UI copy.
 * Kept free of React/Supabase so it can be unit-tested in isolation.
 */
export type ScanStatus = "checked_in" | "already" | "not_found" | "invalid";

export type ScanResult = {
  ok: boolean;
  status: ScanStatus;
  reason?: string;
  attendee?: {
    name?: string;
    role?: string;
    admits?: number;
    ticket_id?: string;
    email?: string;
    phone?: string;
  } | null;
  checkedInAt?: string | null;
  checkedInByName?: string | null;
  tierCounts?: Record<string, { total: number; checkedIn: number }>;
};

export type ConflictCopy = {
  /** Whether this outcome should interrupt the operator with a dialog. */
  blocking: boolean;
  tone: "success" | "warning" | "danger";
  title: string;
  /** One-line plain-English explanation of what happened. */
  explanation: string;
  /** What the door team should physically do next. */
  action: string;
};

export function formatCheckedInAgo(iso?: string | null, now: number = Date.now()): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const secs = Math.max(0, Math.round((now - t) / 1000));
  if (secs < 60) return secs <= 5 ? "just now" : `${secs} seconds ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function describeScan(result: ScanResult, now: number = Date.now()): ConflictCopy {
  const name = result.attendee?.name?.trim() || "This attendee";

  if (result.status === "checked_in") {
    return {
      blocking: false,
      tone: "success",
      title: `Welcome, ${name}!`,
      explanation: "Badge verified and check-in recorded.",
      action: "Admit them through.",
    };
  }

  if (result.status === "already") {
    const ago = formatCheckedInAgo(result.checkedInAt, now);
    const who = result.checkedInByName ? ` by ${result.checkedInByName}` : "";
    return {
      blocking: true,
      tone: "warning",
      title: `${name} is already inside`,
      explanation: ago
        ? `This badge was scanned${who} ${ago}, so it can't be used again.`
        : `This badge has already been used${who}, so it can't be used again.`,
      action:
        "If this is the same person re-entering, admit them manually. If it's a different person, the badge has been shared or copied — verify their ID before letting them in.",
    };
  }

  if (result.status === "invalid") {
    return {
      blocking: true,
      tone: "danger",
      title: "Invalid badge — do not admit",
      explanation: result.reason || "This QR code could not be verified for this event.",
      action: "Ask the guest to open their confirmation email, or look them up by name at the desk.",
    };
  }

  return {
    blocking: true,
    tone: "danger",
    title: "Ticket not recognised",
    explanation: result.reason || "No attendee on this event's list matches this badge.",
    action: "Search for them by name or email on the check-in list, or register them on the spot.",
  };
}

/**
 * Scan de-duplication: the same code shouldn't fire twice while the camera
 * holds it in frame, but a *different* badge must never be delayed.
 */
export function shouldSubmitScan(
  decoded: string,
  last: { code: string; at: number },
  now: number,
  windowMs = 2500,
): boolean {
  if (!decoded) return false;
  if (decoded !== last.code) return true;
  return now - last.at >= windowMs;
}
