import type { Ymd } from "../api/types";

let selected: Ymd | null = null;
const KEY = "sana-selected-day";

/** The day opened in /app/day. Kept out of the URL on purpose (privacy). */
export function setSelectedDay(ymd: Ymd) {
  selected = ymd;
  try {
    sessionStorage.setItem(KEY, ymd);
  } catch {
    /* ignore */
  }
}

export function clearSelectedDay() {
  selected = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function getSelectedDay(): Ymd | null {
  if (selected) return selected;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

const PARTNER_KEY = "sana-selected-partner";

/** The partner link opened in /app/partner (the invite id is a secret: not in the URL). */
export function setSelectedPartner(uuid: string) {
  try {
    sessionStorage.setItem(PARTNER_KEY, uuid);
  } catch {
    /* ignore */
  }
}

export function getSelectedPartner(): string | null {
  try {
    return sessionStorage.getItem(PARTNER_KEY);
  } catch {
    return null;
  }
}

const INVITE_KEY = "sana-pending-invite";

/** Invite id from /app/partner/accept?invite=..., kept while the partner signs in. */
export function setPendingInvite(uuid: string | null) {
  try {
    if (uuid) sessionStorage.setItem(INVITE_KEY, uuid);
    else sessionStorage.removeItem(INVITE_KEY);
  } catch {
    /* ignore */
  }
}

export function getPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(INVITE_KEY);
  } catch {
    return null;
  }
}

/** Everything this tab remembers about the signed-in account's navigation. */
export function clearSelections() {
  clearSelectedDay();
  try {
    sessionStorage.removeItem(PARTNER_KEY);
  } catch {
    /* ignore */
  }
}
