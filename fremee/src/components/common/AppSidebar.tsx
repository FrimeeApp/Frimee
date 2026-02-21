"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

const items = [
  { key: "home", label: "Inicio", icon: HomeIcon, href: "/feed" },
  { key: "calendar", label: "Calendario", icon: CalendarIcon, href: "#" },
  { key: "cards", label: "Planes", icon: CardIcon, href: "#" },
  { key: "send", label: "Mensajes", icon: SendIcon, href: "#" },
];

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const { profile, signOut } = useAuth();
  const hasProfileImage = Boolean(profile?.profile_image);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const threshold = 10;
    lastScrollYRef.current = window.scrollY;

    const onScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;

      if (currentY <= 8) {
        setMobileNavVisible(true);
      } else if (delta > threshold) {
        setMobileNavVisible(false);
      } else if (delta < -threshold) {
        setMobileNavVisible(true);
      }

      lastScrollYRef.current = currentY;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onSignOut = async () => {
    try {
      setSigningOut(true);
      await signOut();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <nav
        className={`fixed inset-x-0 bottom-0 z-40 flex h-[calc(4rem+var(--safe-bottom))] items-center justify-around border-t border-[#b9b9b9] bg-[#f4f4f4] px-2 pb-[var(--safe-bottom)] transition-transform duration-250 ease-out lg:hidden ${
          mobileNavVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className="text-[#1A1F1D] transition-opacity active:opacity-60"
          >
            <item.icon />
          </Link>
        ))}

        <button
          type="button"
          aria-label="Crear plan"
          className="text-[#1A1F1D] transition-opacity active:opacity-60"
        >
          <PlusIcon />
        </button>

        <button
          type="button"
          aria-label="Perfil"
          onClick={onSignOut}
          disabled={signingOut}
          className="overflow-hidden rounded-full border border-[#b9b9b9] bg-[#1f1f1f] p-0 text-white transition-opacity active:opacity-60 disabled:opacity-60"
        >
          <div className={`flex items-center justify-center overflow-hidden rounded-full ${hasProfileImage ? "size-8" : "size-9"}`}>
            {profile?.profile_image ? (
              <img
                src={profile.profile_image}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ProfileIcon className="size-7" />
            )}
          </div>
        </button>
      </nav>

      <aside
        className={`fixed left-0 top-0 z-30 hidden h-dvh border-r border-[#b9b9b9] bg-[#f4f4f4] transition-[width] duration-300 ease-in-out lg:flex lg:flex-col lg:items-center lg:py-6 ${
          collapsed ? "w-[22px]" : "w-[102px]"
        }`}
      >
        <button
          type="button"
          aria-label={collapsed ? "Abrir sidebar" : "Ocultar sidebar"}
          onClick={onToggle}
          className="absolute -right-3 top-5 z-40 flex size-6 items-center justify-center rounded-full border border-[#b9b9b9] bg-white text-[#1A1F1D] shadow-sm transition hover:bg-[#f5f5f5]"
        >
          <ChevronIcon collapsed={collapsed} />
        </button>

        <div
          className={`flex w-full flex-1 flex-col items-center transition-all duration-200 ${
            collapsed ? "pointer-events-none translate-x-[-8px] opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          <div className="text-[46px] font-medium leading-none tracking-tight text-[#1A1F1D]">F.</div>

          <nav className="mt-56 flex w-full flex-col items-center gap-8">
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-label={item.label}
                className="text-[#1A1F1D] transition-opacity hover:opacity-70"
              >
                <item.icon />
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label="Crear plan"
            className="mt-14 text-[#1A1F1D] transition-opacity hover:opacity-70"
          >
            <PlusIcon />
          </button>

          <button
            type="button"
            aria-label="Perfil"
            onClick={onSignOut}
            disabled={signingOut}
            className="mt-auto overflow-hidden rounded-full border border-[#b9b9b9] bg-[#1f1f1f] p-0 text-white transition-opacity hover:opacity-80 disabled:opacity-60"
          >
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-full">
              {profile?.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ProfileIcon className="size-8" />
              )}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d={collapsed ? "M9 6L15 12L9 18" : "M15 6L9 12L15 18"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3.5 10.3L12 3.5L20.5 10.3V19A1 1 0 0 1 19.5 20H4.5A1 1 0 0 1 3.5 19V10.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20V13H15V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3V7M16 3V7M3 10.5H21" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.8" y="4.5" width="18.4" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.8 10.2H21.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M21 3L10 14" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M21 3L14.5 21L10 14L3 9.5L21 3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileIcon({ className = "size-[18px]" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.8 19C7 15.9 9.1 14.4 12 14.4C14.9 14.4 17 15.9 18.2 19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
