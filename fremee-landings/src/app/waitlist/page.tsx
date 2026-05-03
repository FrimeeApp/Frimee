import type { Metadata } from "next";
import WaitlistSection from "@/components/landing/WaitlistSection";

export const metadata: Metadata = {
  title: "Waitlist",
  description: "Apuntate a la waitlist de Frimee para probar la app antes que nadie.",
};

export default function WaitlistPage() {
  return (
    <main className="landing-page v3-page h-dvh overflow-hidden">
      <WaitlistSection standalone showModel={false} />
    </main>
  );
}
