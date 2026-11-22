"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BookUser, Check, LogOut, Settings, UserPlus } from "lucide-react";
import { applyThemePreference, cacheThemePreference, type AppThemePreference } from "@/services/theme/preferences";
import { saveThemePreference } from "@/services/api/repositories/settings.repository";

type MenuTheme = Exclude<AppThemePreference, "SYSTEM">;

type Props = {
  open: boolean;
  onClose: (returnFocus: boolean) => void;
  /** Account row: the menu opens upwards, to the right of the sidebar, bottom-aligned with it. */
  anchorRef: RefObject<HTMLElement | null>;
  sidebarRef: RefObject<HTMLElement | null>;
  userId: string | null;
  /** Anonymous guest: «Guardar mi cuenta» instead of Ajustes and Cerrar sesión (board sb-d-invitado). */
  isGuest: boolean;
  name: string;
  /** «@usuario», or the e-mail when there is no username. */
  handle: string | null;
  image: string | null;
  initial: string;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onSaveAccount: () => void;
  onSignOut: () => Promise<void>;
  /** Guest: leave the demo session and go to the login. */
  onLogin: () => Promise<void>;
};

// «Sistema» stays in Ajustes; here only the two explicit ones.
const THEMES: { value: MenuTheme; label: string }[] = [
  { value: "DARK", label: "Oscuro" },
  { value: "LIGHT", label: "Claro" },
];

const ROW = "group flex h-[44px] w-full items-center gap-[12px] rounded-[6px] px-[10px] text-left text-[15px] text-app transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none disabled:opacity-60";
const ICON = "size-[18px] shrink-0 text-muted transition-colors group-hover:text-app group-focus-visible:text-app";

const currentTheme = (): MenuTheme =>
  document.documentElement.classList.contains("dark") ? "DARK" : "LIGHT";

export default function ProfileMenu(props: Props) {
  const { open, onClose, anchorRef, sidebarRef, userId, isGuest } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const [theme, setTheme] = useState<MenuTheme>("DARK");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [themeError, setThemeError] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    setCopied(false);
    setThemeError(false);
    // With «Sistema» saved in Ajustes, the one on screen is the one marked.
    setTheme(currentTheme());
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      const s = sidebarRef.current?.getBoundingClientRect();
      if (!a || !s) return;
      setPos({ left: s.right + 8, bottom: window.innerHeight - a.bottom });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, anchorRef, sidebarRef]);

  useEffect(() => {
    if (!open || !pos) return;
    menuRef.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!open || !pos || typeof document === "undefined") return null;

  const chooseTheme = (value: MenuTheme) => {
    const previous = theme;
    setTheme(value);
    setThemeError(false);
    applyThemePreference(value);
    cacheThemePreference(value);
    // Saved in the account too, so it comes back after signing in again (or on another device).
    // A guest keeps it on this device only.
    if (!userId || isGuest) return;
    void saveThemePreference(userId, value).catch(() => {
      setTheme(previous);
      applyThemePreference(previous);
      cacheThemePreference(previous);
      setThemeError(true);
    });
  };

  const copyLink = () => {
    if (!userId) return;
    const link = `${window.location.origin}/profile/${userId}`;
    void navigator.clipboard.writeText(link).then(() => setCopied(true)).catch(() => setCopied(false));
  };

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(true); return; }
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    const isRadio = (el?: HTMLElement) => el?.getAttribute("role") === "menuitemradio";
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // The theme options count as one stop for up/down; left/right moves between them.
      const step = e.key === "ArrowDown" ? 1 : -1;
      let next = (i + step + items.length) % items.length;
      while (isRadio(items[i]) && isRadio(items[next]) && next !== i) next = (next + step + items.length) % items.length;
      if (isRadio(items[next])) next = items.findIndex((el) => el.getAttribute("aria-checked") === "true");
      items[next]?.focus();
      return;
    }
    if (isRadio(items[i]) && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const radios = items.filter((el) => isRadio(el));
      const r = radios.indexOf(document.activeElement as HTMLElement);
      radios[(r + (e.key === "ArrowRight" ? 1 : -1) + radios.length) % radios.length]?.focus();
    }
  };

  const themeBlock = (
    <div className="px-[10px] pb-[4px] pt-[6px]">
      <p id="cuenta-tema" className="mb-[6px] text-[12px] font-[var(--fw-semibold)] text-muted">Tema</p>
      <div role="group" aria-labelledby="cuenta-tema" className="grid h-[44px] grid-cols-2 gap-[2px] rounded-[8px] bg-[var(--surface-2)] p-[4px]">
        {THEMES.map((t) => {
          const on = theme === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="menuitemradio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => chooseTheme(t.value)}
              className={`rounded-[6px] text-[14px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] ${
                on ? "bg-app font-[var(--fw-semibold)] text-app shadow-[var(--shadow-sm)]" : "text-muted hover:text-app"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {themeError && <p role="alert" className="mt-[6px] text-[13px] text-[var(--error)]">No se pudo guardar el tema.</p>}
    </div>
  );

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Cuenta"
      onKeyDown={onKey}
      style={{ left: pos.left, bottom: pos.bottom }}
      className="fixed z-[1250] w-[280px] rounded-[8px] border border-app bg-app p-[6px] shadow-[var(--shadow-md)]"
    >
      {isGuest ? (
        <>
          <div className="px-[10px] pb-[10px] pt-[8px]">
            <p className="text-[15px] font-[var(--fw-semibold)] text-app">Estás en modo invitado</p>
            <p className="mt-[2px] text-[13px] text-muted">Cuenta de ejemplo con tres planes</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => { onClose(false); props.onSaveAccount(); }}
              className="mt-[12px] flex h-[44px] w-full items-center justify-center rounded-[8px] bg-[var(--text-primary)] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2"
            >
              Guardar mi cuenta
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => void run(props.onLogin)}
              className="mt-[8px] flex h-[36px] w-full items-center justify-center rounded-[6px] text-[14px] text-muted transition-colors hover:text-app focus-visible:bg-[var(--surface-2)] focus-visible:outline-none disabled:opacity-60"
            >
              Ya tengo cuenta · <span className="ml-[4px] font-[var(--fw-semibold)] text-app">Entrar</span>
            </button>
          </div>
          <div role="separator" className="mx-[-6px] my-[6px] h-px bg-[var(--border)]" />
          <button type="button" role="menuitem" onClick={() => { onClose(false); props.onOpenProfile(); }} className={ROW}>
            <BookUser className={ICON} aria-hidden />
            <span className="flex-1">Ver mi pasaporte</span>
          </button>
          {themeBlock}
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={() => { onClose(false); props.onOpenProfile(); }}
            className="flex w-full items-center gap-[12px] rounded-[6px] px-[10px] py-[10px] text-left transition-colors hover:bg-[var(--surface-2)] focus-visible:bg-[var(--surface-2)] focus-visible:outline-none"
          >
            {props.image ? (
              <span className="block size-[40px] shrink-0 overflow-hidden rounded-full border border-strong">
                <Image src={props.image} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
              </span>
            ) : (
              <span className="flex size-[40px] shrink-0 items-center justify-center rounded-full border border-strong bg-surface-inset text-body font-[var(--fw-semibold)] text-app">{props.initial}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-[var(--fw-semibold)] text-app">{props.name}</span>
              <span className="block truncate text-[13px] text-muted">{props.handle ? `${props.handle} · Ver perfil` : "Ver perfil"}</span>
            </span>
          </button>

          <div role="separator" className="mx-[-6px] my-[6px] h-px bg-[var(--border)]" />

          <button type="button" role="menuitem" onClick={copyLink} className={ROW}>
            <UserPlus className={ICON} aria-hidden />
            <span className="flex-1">Añadir amigos</span>
            <span aria-live="polite" className="flex items-center gap-[4px] text-[13px] text-muted">
              {copied && <><Check className="size-[14px]" aria-hidden />Enlace copiado</>}
            </span>
          </button>
          <button type="button" role="menuitem" onClick={() => { onClose(false); props.onOpenSettings(); }} className={ROW}>
            <Settings className={ICON} aria-hidden />
            <span className="flex-1">Ajustes</span>
          </button>

          {themeBlock}

          <div role="separator" className="mx-[-6px] my-[6px] h-px bg-[var(--border)]" />

          <button type="button" role="menuitem" disabled={busy} onClick={() => void run(props.onSignOut)} className={ROW}>
            <LogOut className={ICON} aria-hidden />
            <span className="flex-1">{busy ? "Cerrando sesión…" : "Cerrar sesión"}</span>
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}
