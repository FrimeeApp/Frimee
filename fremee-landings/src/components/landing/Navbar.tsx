"use client";

import Image from "next/image";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { APP_REGISTER_URL } from "@/config/links";
import { applyThemePreference, cacheThemePreference, type AppThemePreference } from "@/services/theme/preferences";

const navLinks = [
  { href: "#producto", label: "Producto" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#demo", label: "Pruebalo ahora" },
];

function subscribeToThemeClass(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  return () => observer.disconnect();
}

function getThemeSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerThemeSnapshot() {
  return false;
}

export default function Navbar() {
  const isDark = useSyncExternalStore(subscribeToThemeClass, getThemeSnapshot, getServerThemeSnapshot);

  function setTheme(nextTheme: AppThemePreference) {
    applyThemePreference(nextTheme);
    cacheThemePreference(nextTheme);
  }

  return (
    <header className="landing-pill-navbar fixed inset-x-4 top-3 z-50 transition-colors duration-200 sm:inset-x-6 md:inset-x-8">
      <div className="relative z-10 grid h-14 w-full grid-cols-[auto_1fr] items-center gap-4 px-4 sm:px-6 md:grid-cols-[1fr_auto_1fr] lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-black transition-colors duration-200 hover:text-black/70 dark:text-white dark:hover:text-white/70"
        >
          <span className="relative h-5 w-5 shrink-0">
            <Image
              src="/images/logo-frimee-black.png"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain opacity-100 transition-opacity duration-200 dark:opacity-0"
            />
            <Image
              src="/images/logo-frimee.png"
              alt=""
              width={20}
              height={20}
              className="absolute inset-0 h-5 w-5 object-contain opacity-0 transition-opacity duration-200 dark:opacity-100"
            />
          </span>
        </Link>

        <nav className="hidden items-center justify-center gap-8 md:flex lg:gap-16 xl:gap-20" aria-label="Navegacion principal">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative inline-flex h-6 items-center overflow-hidden text-sm font-medium leading-6 text-black transition-colors duration-200 hover:text-black/60 dark:text-white/82 dark:hover:text-white"
            >
              <span className="block h-6 leading-6 transition-transform duration-300 ease-out group-hover:-translate-y-full">
                {link.label}
              </span>
              <span className="absolute left-0 top-full block h-6 leading-6 transition-transform duration-300 ease-out group-hover:-translate-y-full">
                {link.label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <label
            className="group relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--radius-button)] text-black transition-colors duration-200 hover:text-black/60 dark:text-white/88 dark:hover:text-white"
            aria-label="Cambiar tema"
          >
            <input
              type="checkbox"
              checked={isDark}
              onChange={(event) => setTheme(event.target.checked ? "DARK" : "LIGHT")}
              className="sr-only"
            />
            <svg
              aria-hidden="true"
              className="absolute h-5 w-5 fill-current opacity-0 rotate-90 scale-75 transition-all duration-300 ease-out group-has-[:checked]:rotate-0 group-has-[:checked]:scale-100 group-has-[:checked]:opacity-100"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
            </svg>
            <svg
              aria-hidden="true"
              className="absolute h-5 w-5 fill-current opacity-100 rotate-0 scale-100 transition-all duration-300 ease-out group-has-[:checked]:-rotate-90 group-has-[:checked]:scale-75 group-has-[:checked]:opacity-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
            >
              <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
            </svg>
          </label>
          <Link
            href={APP_REGISTER_URL}
            className="group inline-flex h-10 items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-button)] bg-[var(--primary)] px-4 text-sm font-medium text-white transition-colors duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30 focus-visible:ring-offset-2 dark:text-black sm:px-6"
          >
            <span>Empezar</span>
            <span className="w-0 opacity-0 transition-all duration-200 group-hover:w-4 group-hover:opacity-100">
              <svg
                aria-hidden="true"
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M14 5l7 7m0 0l-7 7m7-7H3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
