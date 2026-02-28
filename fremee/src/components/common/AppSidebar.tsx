"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";

type IconProps = {
  className?: string;
};

const items = [
  { key: "home", label: "Inicio", icon: HomeIcon, href: "/feed" },
  { key: "calendar", label: "Calendario", icon: CalendarIcon, href: "#" },
  { key: "cards", label: "Mis gastos", icon: CardIcon, href: "/mis-gastos" },
  { key: "send", label: "Mensajes", icon: SendIcon, href: "#" },
];

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const router = useRouter();
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const { profile } = useAuth();
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

  const openSettings = () => router.push("/settings");

  return (
    <>
      <nav
        className={`fixed inset-x-0 bottom-0 z-sticky flex h-[calc(var(--space-16)+env(safe-area-inset-bottom))] items-center justify-around border-t border-strong bg-surface px-[var(--space-2)] pb-safe transition-transform duration-[var(--duration-slow)] [transition-timing-function:var(--ease-decelerate)] lg:hidden ${
          mobileNavVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
          >
            <item.icon className="size-icon" />
          </Link>
        ))}

        <button
          type="button"
          aria-label="Crear plan"
          className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
        >
          <PlusIcon className="size-icon" />
        </button>

        <button
          type="button"
          aria-label="Perfil"
          onClick={openSettings}
          className="overflow-hidden rounded-avatar border border-strong bg-[var(--text-primary)] p-0 text-contrast-token transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)] disabled:opacity-[var(--disabled-opacity)]"
        >
          <div className={`flex items-center justify-center overflow-hidden rounded-avatar ${hasProfileImage ? "avatar-md" : "avatar-lg"}`}>
            {profile?.profile_image ? (
              <img
                src={profile.profile_image}
                alt="Foto de perfil"
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <ProfileIcon className="size-[calc(var(--icon-size)+6px)]" />
            )}
          </div>
        </button>
      </nav>

      <aside
        className={`fixed left-0 top-0 z-30 hidden h-dvh border-r border-strong bg-surface transition-[width] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] lg:flex lg:flex-col lg:items-center lg:py-[var(--space-6)] ${
          collapsed ? "w-[22px]" : "w-[102px]"
        }`}
      >
        <button
          type="button"
          aria-label={collapsed ? "Abrir sidebar" : "Ocultar sidebar"}
          onClick={onToggle}
          className="absolute -right-3 top-5 z-40 flex size-6 items-center justify-center rounded-full border border-strong bg-surface text-app shadow-elev-1 transition-colors duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:bg-[var(--interactive-hover-surface)]"
        >
          <ChevronIcon collapsed={collapsed} />
        </button>

        <div
          className={`flex w-full flex-1 flex-col items-center transition-all duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] ${
            collapsed ? "pointer-events-none translate-x-[-8px] opacity-0" : "translate-x-0 opacity-100"
          }`}
        >
          <div className="text-[var(--font-h1)] font-[var(--fw-medium)] leading-[var(--lh-h1)] tracking-[-0.02em] text-app">F.</div>

          <nav className="mt-[calc(var(--space-24)+var(--space-24)+var(--space-8))] flex w-full flex-col items-center gap-[var(--space-8)]">
            {items.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                aria-label={item.label}
                className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:opacity-70"
              >
                <item.icon className="size-icon" />
              </Link>
            ))}
          </nav>

          <button
            type="button"
            aria-label="Crear plan"
            className="mt-[var(--space-14)] text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:opacity-70"
          >
            <PlusIcon className="size-icon" />
          </button>

        <button
          type="button"
          aria-label="Perfil"
          onClick={openSettings}
          className="mt-auto overflow-hidden rounded-avatar border border-strong bg-[var(--text-primary)] p-0 text-contrast-token transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] hover:opacity-80 disabled:opacity-[var(--disabled-opacity)]"
        >
            <div className="flex avatar-lg items-center justify-center overflow-hidden rounded-avatar">
              {profile?.profile_image ? (
                <img
                  src={profile.profile_image}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <ProfileIcon className="size-[calc(var(--icon-size)+8px)]" />
              )}
            </div>
          </button>
        </div>
      </aside>
    </>
  );
}

function ChevronIcon({ collapsed, className = "size-[14px]" }: { collapsed: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
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

function HomeIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M3.5 10.3L12 3.5L20.5 10.3V19A1 1 0 0 1 19.5 20H4.5A1 1 0 0 1 3.5 19V10.3Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M9 20V13H15V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CalendarIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3V7M16 3V7M3 10.5H21" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CardIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <rect x="2.8" y="4.5" width="18.4" height="15" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2.8 10.2H21.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function SendIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
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

function PlusIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 4V20M4 12H20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function ProfileIcon({ className = "size-icon" }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.8 19C7 15.9 9.1 14.4 12 14.4C14.9 14.4 17 15.9 18.2 19" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
