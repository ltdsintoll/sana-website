"use client";

import { useSyncExternalStore } from "react";
import { store, type Snapshot } from "./store";

export function useCabinet(): Snapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
