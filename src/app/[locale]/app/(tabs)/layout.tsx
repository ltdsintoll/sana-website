import type { ReactNode } from "react";
import TabsShell from "@/cabinet/ui/TabsShell";

export default function TabsLayout({ children }: { children: ReactNode }) {
  return <TabsShell>{children}</TabsShell>;
}
