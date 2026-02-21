import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div className="safe-area-y min-h-dvh">{children}</div>
    </AuthGuard>
  );
}
