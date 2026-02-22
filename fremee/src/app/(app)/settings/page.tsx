"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import { useAuth } from "@/providers/AuthProvider";

type ThemeMode = "light" | "dark";
type BusyAction = "signout" | "delete" | null;

const THEME_STORAGE_KEY = "fremee-theme-mode";

export default function SettingsPage() {
  const router = useRouter();
  const { profile, signOut } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayName = useMemo(() => {
    const base = profile?.nombre?.trim();
    return base && base.length > 0 ? base : "Tu perfil";
  }, [profile?.nombre]);

  const avatarFallback = displayName[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initial: ThemeMode =
      stored === "dark" || stored === "light"
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setThemeMode(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);

  const setTheme = (next: ThemeMode) => {
    setThemeMode(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    }
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/feed");
  };

  const onSignOut = async () => {
    setErrorMsg(null);
    try {
      setBusyAction("signout");
      await signOut();
      router.replace("/login");
    } finally {
      setBusyAction(null);
    }
  };

  const onDeleteAccount = async () => {
    setErrorMsg("Eliminar cuenta estará disponible próximamente.");
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

        <main
          className={`px-[var(--space-4)] pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] lg:pb-[var(--space-8)] lg:pr-[var(--space-14)] ${
            sidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[136px]"
          }`}
        >
          <div className="mx-auto w-full max-w-[1120px]">
            <section className="rounded-b-[var(--radius-modal)] bg-primary-token px-[var(--space-4)] pb-[var(--space-8)] pt-[var(--space-4)] text-white lg:hidden">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Volver"
                  className="rounded-full p-[var(--space-2)] transition-opacity active:opacity-[var(--disabled-opacity)]"
                >
                  <ArrowLeftIcon />
                </button>
                <button
                  type="button"
                  aria-label="Ajustes"
                  className="rounded-full p-[var(--space-2)] transition-opacity active:opacity-[var(--disabled-opacity)]"
                >
                  <GearIcon />
                </button>
              </div>

              <div className="mt-[var(--space-4)] flex flex-col items-center">
                <Avatar profileImage={profile?.profile_image ?? null} fallback={avatarFallback} />
                <p className="mt-[var(--space-3)] text-[var(--font-h4)] font-[var(--fw-semibold)] leading-[var(--lh-h4)]">
                  {displayName}
                </p>
              </div>
            </section>

            <div className="mt-[-12px] rounded-modal border border-strong bg-surface px-[var(--space-4)] pb-[var(--space-6)] pt-[var(--space-5)] text-app shadow-elev-2 lg:hidden">
              <SettingsSection title="Cuenta">
                <SettingsRow icon={<UserIcon />} label="Editar perfil" />
                <SettingsRow icon={<ShieldIcon />} label="Seguridad" />
                <SettingsRow
                  icon={<MoonIcon />}
                  label="Modo oscuro"
                  right={
                    <Switch
                      checked={themeMode === "dark"}
                      onChange={(checked) => setTheme(checked ? "dark" : "light")}
                    />
                  }
                />
                <SettingsRow
                  icon={<BellIcon />}
                  label="Notificaciones"
                  right={<Switch checked={notificationsEnabled} onChange={setNotificationsEnabled} />}
                />
              </SettingsSection>

              <SettingsSection title="Acciones">
                <SettingsButton
                  icon={<LogOutIcon />}
                  label={busyAction === "signout" ? "Cerrando sesión..." : "Cerrar sesión"}
                  onClick={onSignOut}
                  disabled={busyAction !== null}
                />
                <SettingsButton
                  icon={<TrashIcon />}
                  label={busyAction === "delete" ? "Eliminando cuenta..." : "Eliminar cuenta"}
                  onClick={onDeleteAccount}
                  disabled={busyAction !== null}
                  danger
                />
              </SettingsSection>

              {errorMsg && <p className="mt-[var(--space-3)] text-body-sm text-error-token">{errorMsg}</p>}
            </div>

            <div className="hidden lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-[var(--space-6)]">
              <aside className="rounded-modal border border-strong bg-primary-token p-[var(--space-6)] text-contrast-token">
                <div className="flex flex-col items-center text-center">
                  <Avatar profileImage={profile?.profile_image ?? null} fallback={avatarFallback} />
                  <p className="mt-[var(--space-4)] text-[var(--font-h3)] font-[var(--fw-semibold)]">{displayName}</p>
                  <p className="mt-[var(--space-1)] text-body-sm opacity-85">{profile?.email ?? "sin correo"}</p>
                </div>
              </aside>

              <section className="rounded-modal border border-strong bg-surface p-[var(--space-6)]">
                <SettingsSection title="Cuenta" desktop>
                  <SettingsRow icon={<UserIcon />} label="Editar perfil" desktop />
                  <SettingsRow icon={<ShieldIcon />} label="Seguridad" desktop />
                  <SettingsRow
                    icon={<MoonIcon />}
                    label="Modo oscuro"
                    right={
                      <div className="flex items-center gap-[var(--space-2)]">
                        <button
                          type="button"
                          onClick={() => setTheme("light")}
                          className={`rounded-chip border px-[var(--space-3)] py-[var(--space-1)] text-body-sm ${
                            themeMode === "light"
                              ? "border-primary-token bg-primary-token text-contrast-token"
                              : "border-app bg-surface text-app"
                          }`}
                        >
                          Light
                        </button>
                        <button
                          type="button"
                          onClick={() => setTheme("dark")}
                          className={`rounded-chip border px-[var(--space-3)] py-[var(--space-1)] text-body-sm ${
                            themeMode === "dark"
                              ? "border-primary-token bg-primary-token text-contrast-token"
                              : "border-app bg-surface text-app"
                          }`}
                        >
                          Dark
                        </button>
                      </div>
                    }
                    desktop
                  />
                  <SettingsRow
                    icon={<BellIcon />}
                    label="Notificaciones"
                    right={<Switch checked={notificationsEnabled} onChange={setNotificationsEnabled} />}
                    desktop
                  />
                </SettingsSection>

                <SettingsSection title="Acciones" desktop>
                  <SettingsButton
                    icon={<LogOutIcon />}
                    label={busyAction === "signout" ? "Cerrando sesión..." : "Cerrar sesión"}
                    onClick={onSignOut}
                    disabled={busyAction !== null}
                    desktop
                  />
                  <SettingsButton
                    icon={<TrashIcon />}
                    label={busyAction === "delete" ? "Eliminando cuenta..." : "Eliminar cuenta"}
                    onClick={onDeleteAccount}
                    disabled={busyAction !== null}
                    danger
                    desktop
                  />
                </SettingsSection>

                {errorMsg && <p className="mt-[var(--space-3)] text-body-sm text-error-token">{errorMsg}</p>}
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  children,
  desktop = false,
}: {
  title: string;
  children: ReactNode;
  desktop?: boolean;
}) {
  return (
    <div className={desktop ? "mb-[var(--space-6)]" : "mb-[var(--space-5)]"}>
      <h2 className="mb-[var(--space-3)] text-[var(--font-h5)] font-[var(--fw-semibold)] text-app">
        {title}
      </h2>
      <div className={desktop ? "space-y-[var(--space-2)]" : "space-y-[var(--space-1)]"}>{children}</div>
    </div>
  );
}

function SettingsRow({
  icon,
  label,
  right,
  desktop = false,
}: {
  icon: ReactNode;
  label: string;
  right?: ReactNode;
  desktop?: boolean;
}) {
  return (
    <div className={desktop ? "flex items-center justify-between rounded-input border border-app bg-surface-inset px-[var(--space-3)] py-[var(--space-3)]" : "flex items-center justify-between rounded-input border border-app bg-surface-inset px-[var(--space-2)] py-[var(--space-2)]"}>
      <div className="flex items-center gap-[var(--space-3)]">
        <span className="text-app">{icon}</span>
        <span className="text-body text-app">{label}</span>
      </div>
      {right ?? <ChevronRightIcon className="text-tertiary" />}
    </div>
  );
}

function SettingsButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  desktop = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  desktop?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center justify-between rounded-input px-[var(--space-3)] py-[var(--space-3)] text-left transition-opacity disabled:opacity-[var(--disabled-opacity)] ${
        desktop
          ? danger
            ? "border border-error-token bg-[color-mix(in_srgb,var(--error)_12%,var(--surface)_88%)] text-error-token"
            : "border border-app bg-surface-inset text-app"
          : danger
            ? "border border-error-token bg-[color-mix(in_srgb,var(--error)_12%,var(--surface)_88%)] text-error-token"
            : "border border-app bg-surface-inset text-app"
      }`}
    >
      <span className="flex items-center gap-[var(--space-3)]">
        {icon}
        <span className="text-body font-[var(--fw-medium)]">{label}</span>
      </span>
      <ChevronRightIcon className="text-tertiary" />
    </button>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-label={checked ? "Desactivar" : "Activar"}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 overflow-hidden rounded-chip transition-colors ${
        checked ? "bg-primary-token" : "bg-[color-mix(in_srgb,var(--text-primary)_26%,transparent)]"
      }`}
    >
      <span
        className={`absolute left-1 top-1 size-5 rounded-full bg-white transition-transform duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Avatar({ profileImage, fallback }: { profileImage: string | null; fallback: string }) {
  return (
    <div className="flex size-[92px] items-center justify-center overflow-hidden rounded-avatar border border-[color-mix(in_srgb,var(--contrast)_35%,transparent)] bg-[color-mix(in_srgb,var(--surface)_65%,var(--contrast)_35%)] shadow-elev-2">
      {profileImage ? (
        <img src={profileImage} alt="Foto de perfil" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span className="text-[34px] font-[var(--fw-semibold)] text-app">{fallback}</span>
      )}
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path d="M14.5 5L7.5 12L14.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
      <path
        d="M12 8.8A3.2 3.2 0 1 0 12 15.2A3.2 3.2 0 0 0 12 8.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19.2 13.1L20.7 12L19.2 10.9L18.9 9L17 8.8L15.9 7.3L14.3 8L12.5 7.3L11.5 8.8L9.6 9L9.3 10.9L7.8 12L9.3 13.1L9.6 15L11.5 15.2L12.5 16.7L14.3 16L15.9 16.7L17 15.2L18.9 15L19.2 13.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true" className={className}>
      <path d="M10 6L16 12L10 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.8 19C7 15.9 9.1 14.4 12 14.4C14.9 14.4 17 15.9 18.2 19" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M12 3L19 6V11.5C19 15.3 16.2 18.8 12 20.5C7.8 18.8 5 15.3 5 11.5V6L12 3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9.5 11.8L11.1 13.4L14.6 9.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M6.5 16H17.5L16.8 14.8V10.8C16.8 8.1 14.7 6 12 6C9.3 6 7.2 8.1 7.2 10.8V14.8L6.5 16Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.1 18.2C10.4 19.1 11.1 19.7 12 19.7C12.9 19.7 13.6 19.1 13.9 18.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M14.8 4.7C10.8 5.2 7.8 8.6 7.8 12.7C7.8 16.9 11.2 20.3 15.4 20.3C17 20.3 18.4 19.8 19.6 18.9C18.8 19.1 18 19.2 17.2 19.2C12.9 19.2 9.5 15.8 9.5 11.5C9.5 8.9 10.8 6.6 12.8 5.2C13.4 4.8 14.1 4.6 14.8 4.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M9 5.5H6.8C5.8 5.5 5 6.3 5 7.3V16.7C5 17.7 5.8 18.5 6.8 18.5H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M13 16.5L17.5 12L13 7.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M17.5 12H9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M4.8 7H19.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M9.5 4.8H14.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M8 7L8.6 18.1C8.6 18.9 9.2 19.5 10 19.5H14C14.8 19.5 15.4 18.9 15.4 18.1L16 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.2 10.3V16.1M13.8 10.3V16.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
