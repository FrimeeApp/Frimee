import type { ReactNode } from "react";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { CallProvider } from "@/providers/CallProvider";
import { PushProvider } from "@/providers/PushProvider";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <PushProvider>
        <CallProvider>
          <div className="min-h-dvh">
            {/* Blocks scroll bleed-through under the status bar on notched devices */}
            <div
              className="pointer-events-none fixed inset-x-0 top-0 z-[9999] bg-app"
              style={{ height: "env(safe-area-inset-top)" }}
            />
            {children}
          </div>
        </CallProvider>
      </PushProvider>
    </AuthGuard>
  );
}
