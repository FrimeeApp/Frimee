import type { Metadata } from "next";
import LandingV2 from "@/components/landingv2/LandingV2";

export const metadata: Metadata = {
  title: "Frimee Landing v2",
  description: "Base alternativa para iterar una nueva landing de Frimee.",
};

export default function LandingV2Page() {
  return <LandingV2 />;
}
