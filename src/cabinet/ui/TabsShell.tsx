"use client";

import type { ReactNode } from "react";
import { RequireAuth } from "./layout";
import TabBar from "./TabBar";

export default function TabsShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      {children}
      <TabBar />
    </RequireAuth>
  );
}
