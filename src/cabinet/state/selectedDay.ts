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
