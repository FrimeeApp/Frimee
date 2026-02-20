import type { ReactNode } from "react";
import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthSplitLayout>{children}</AuthSplitLayout>;
}
