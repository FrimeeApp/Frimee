"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
type IconProps = {
  className?: string;
};

const items = [
  { key: "home", label: "Inicio", icon: HomeIcon, href: "/feed" },
  { key: "calendar", label: "Calendario", icon: CalendarIcon, href: "/calendar" },
  { key: "cards", label: "Mis gastos", icon: CardIcon, href: "/mis-gastos" },
  { key: "send", label: "Mensajes", icon: SendIcon, href: "/messages" },
];

type AppSidebarProps = {
  onCreatePlan?: () => void;
};

export default function AppSidebar({ onCreatePlan }: AppSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavVisible, setMobileNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const [hovered, setHovered] = useState(false);

  const { user, profile } = useAuth();
  const hasProfileImage = Boolean(profile?.profile_image);

  const expanded = hovered;

  // Mobile scroll hide/show
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

  const openProfile = () => router.push(user?.id ? `/profile/${user.id}` : "/settings");
  const openCreatePlan = () => {
    if (onCreatePlan) {
      onCreatePlan();
      return;
    }
    router.push("/plans/new");
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile bottom nav */}
      <nav
        className={`fixed inset-x-0 bottom-0 z-sticky flex h-[calc(var(--space-16)+env(safe-area-inset-bottom))] items-center justify-around border-t border-strong bg-app px-[var(--space-2)] pb-safe transition-transform duration-[var(--duration-slow)] [transition-timing-function:var(--ease-decelerate)] md:hidden ${
          mobileNavVisible ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {items.slice(0, 2).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
          >
            <item.icon className="size-[24px]" />
          </Link>
        ))}

        <button
          type="button"
          aria-label="Crear plan"
          onClick={openCreatePlan}
          className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
        >
          <PlusIcon className="size-[24px]" />
        </button>

        {items.slice(2).map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-label={item.label}
            className="text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
          >
            <item.icon className="size-[24px]" />
          </Link>
        ))}

        <button
          type="button"
          aria-label="Perfil"
          onClick={openProfile}
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

      {/* Desktop sidebar */}
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`fixed left-0 top-0 z-30 hidden h-dvh border-r border-strong bg-app transition-[width] duration-200 ease-out md:flex md:flex-col md:py-[var(--space-6)] ${
          expanded ? "w-[220px]" : "w-[102px]"
        }`}
      >
        <div className="flex w-full flex-1 flex-col overflow-hidden">
          {/* Logo — icon always centered in the 102px zone */}
          <div className="flex h-[40px] w-[102px] shrink-0 items-center justify-center">
            <span className="text-[var(--font-h1)] font-[var(--fw-medium)] leading-[var(--lh-h1)] tracking-[-0.02em] text-app">F.</span>
          </div>

          {/* Nav items — icon always at same position */}
          <nav className="mt-[calc(var(--space-24)+var(--space-14))] flex w-full flex-col gap-[var(--space-8)]">
            {items.map((item) => {
              const active = isActive(item.href);
              const cls = `flex h-[24px] items-center text-app transition-opacity duration-150 hover:opacity-70 ${active && expanded ? "opacity-100" : ""}`;
              return (
                <Link key={item.key} href={item.href} aria-label={item.label} className={cls}>
                  <div className="flex w-[102px] shrink-0 items-center justify-center">
                    <item.icon className="size-[24px]" />
                  </div>
                  {expanded && <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Create button */}
          <button
            type="button"
            aria-label="Crear plan"
            onClick={openCreatePlan}
            className="mt-[var(--space-14)] flex h-[24px] items-center text-app transition-opacity duration-150 hover:opacity-70"
          >
            <div className="flex w-[102px] shrink-0 items-center justify-center">
              <PlusIcon className="size-[24px]" />
            </div>
            {expanded && <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">Crear plan</span>}
          </button>

          {/* Profile button */}
          <button
            type="button"
            aria-label="Perfil"
            onClick={openProfile}
            className="mt-auto flex items-center transition-opacity duration-150 hover:opacity-80"
          >
            <div className="flex w-[102px] shrink-0 items-center justify-center">
              <div className="overflow-hidden rounded-avatar border border-strong bg-[var(--text-primary)] p-0 text-contrast-token">
                <div className="flex avatar-lg items-center justify-center overflow-hidden rounded-avatar">
                  {profile?.profile_image ? (
                    <img src={profile.profile_image} alt="Foto de perfil" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <ProfileIcon className="size-[calc(var(--icon-size)+8px)]" />
                  )}
                </div>
              </div>
            </div>
            {expanded && (
              <span className="min-w-0 truncate -ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)] text-app">
                {profile?.nombre || "Perfil"}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
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
