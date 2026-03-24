import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CallProvider } from "@/providers/CallProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <CallProvider>
        <div className="min-h-dvh">{children}</div>
      </CallProvider>
    </AuthGuard>
  );
}
