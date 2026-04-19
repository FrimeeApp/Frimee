"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { applyThemePreference, cacheThemePreference } from "@/services/theme/preferences";
import {
  getUserSettings,
  saveUserProfileAndSettings,
  uploadProfileImage,
  type UserSettingsTheme,
  type UserSettingsVisibility,
} from "@/services/api/repositories/settings.repository";

type BusyAction = "save" | "signout" | "delete" | "upload-image" | null;
type ThemeOption = UserSettingsTheme;
type VisibilityOption = UserSettingsVisibility;

type SettingsForm = {
  nombre: string;
  fechaNac: string;
  profileImage: string | null;
  theme: ThemeOption;
  language: string;
  timezone: string;
  notifyPush: boolean;
  notifyEmail: boolean;
  notifyInApp: boolean;
  profileVisibility: VisibilityOption;
  allowFriendRequests: boolean;
  googleSyncEnabled: boolean;
  googleSyncExportPlans: boolean;
};

const DEFAULT_SETTINGS: SettingsForm = {
  nombre: "",
  fechaNac: "",
  profileImage: null,
  theme: "SYSTEM",
  language: "es",
  timezone: "Europe/Madrid",
  notifyPush: true,
  notifyEmail: true,
  notifyInApp: true,
  profileVisibility: "PUBLICO",
  allowFriendRequests: true,
  googleSyncEnabled: false,
  googleSyncExportPlans: true,
};

const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
];

const TIMEZONE_OPTIONS = [
  { value: "Europe/Madrid", label: "Europe/Madrid" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Mexico_City", label: "America/Mexico_City" },
];

const VISIBILITY_OPTIONS: { value: VisibilityOption; label: string }[] = [
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
];

function normalizeTheme(value: unknown): ThemeOption {
  if (value === "SYSTEM" || value === "LIGHT" || value === "DARK") return value;
  return "SYSTEM";
}

function normalizeVisibility(value: unknown): VisibilityOption {
  if (value === "PUBLICO" || value === "PRIVADO") return value;
  return "PUBLICO";
}

function normalizeDate(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function mapCombinedRowToForm(row: {
  nombre: string;
  fecha_nac: string | null;
  profile_image: string | null;
  theme: ThemeOption;
  language: string;
  timezone: string;
  notify_push: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  profile_visibility: VisibilityOption;
  allow_friend_requests: boolean;
  google_sync_enabled?: boolean | null;
  google_sync_export_plans?: boolean | null;
}): SettingsForm {
  return {
    nombre: row.nombre ?? "",
    fechaNac: row.fecha_nac ?? "",
    profileImage: row.profile_image ?? null,
    theme: normalizeTheme(row.theme),
    language: row.language,
    timezone: row.timezone,
    notifyPush: row.notify_push,
    notifyEmail: row.notify_email,
    notifyInApp: row.notify_in_app,
    profileVisibility: normalizeVisibility(row.profile_visibility),
    allowFriendRequests: row.allow_friend_requests,
    googleSyncEnabled: row.google_sync_enabled ?? false,
    googleSyncExportPlans: row.google_sync_export_plans ?? true,
  };
}

function mergeProfileAndSettings(params: {
  profile: { nombre?: string | null; fecha_nac?: string | null; profile_image?: string | null } | null;
  settings: {
    theme: ThemeOption;
    language: string;
    timezone: string;
    notify_push: boolean;
    notify_email: boolean;
    notify_in_app: boolean;
    profile_visibility: VisibilityOption;
    allow_friend_requests: boolean;
    google_sync_enabled?: boolean | null;
    google_sync_export_plans?: boolean | null;
  } | null;
}): SettingsForm {
  return {
    nombre: params.profile?.nombre ?? "",
    fechaNac: params.profile?.fecha_nac ?? "",
    profileImage: params.profile?.profile_image ?? null,
    theme: normalizeTheme(params.settings?.theme),
    language: params.settings?.language ?? "es",
    timezone: params.settings?.timezone ?? "Europe/Madrid",
    notifyPush: params.settings?.notify_push ?? true,
    notifyEmail: params.settings?.notify_email ?? true,
    notifyInApp: params.settings?.notify_in_app ?? true,
    profileVisibility: normalizeVisibility(params.settings?.profile_visibility),
    allowFriendRequests: params.settings?.allow_friend_requests ?? true,
    googleSyncEnabled: params.settings?.google_sync_enabled ?? false,
    googleSyncExportPlans: params.settings?.google_sync_export_plans ?? true,
  };
}

function applyThemeToDocument(theme: ThemeOption) {
  applyThemePreference(theme);
}

async function syncAuthUserMetadata(params: { nombre: string; profileImage: string | null }) {
  const supabase = createBrowserSupabaseClient();
  const displayName = params.nombre.trim();
  const avatarUrl = params.profileImage ?? null;

  const { error } = await supabase.auth.updateUser({
    data: {
      name: displayName || null,
      full_name: displayName || null,
      display_name: displayName || null,
      avatar_url: avatarUrl,
      picture: avatarUrl,
    },
  });

  if (error) throw error;
}

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, settings, signOut, refreshProfile, setUserSnapshot } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [form, setForm] = useState<SettingsForm>(DEFAULT_SETTINGS);
  const [initialForm, setInitialForm] = useState<SettingsForm>(DEFAULT_SETTINGS);

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const displayName = useMemo(() => {
    const base = form.nombre?.trim() || profile?.nombre?.trim();
    return base && base.length > 0 ? base : "Tu perfil";
  }, [form.nombre, profile?.nombre]);

  const avatarFallback = displayName[0]?.toUpperCase() ?? "U";

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!user?.id) {
        setSettingsLoading(false);
        return;
      }

      setSettingsLoading(true);
      setErrorMsg(null);

      try {
        const latestSettings = await getUserSettings(user.id);
        const mapped = mergeProfileAndSettings({
          profile: profile
            ? {
                nombre: profile.nombre ?? "",
                fecha_nac: profile.fecha_nac ?? "",
                profile_image: profile.profile_image ?? null,
              }
            : null,
          settings: latestSettings ?? settings,
        });
        setForm(mapped);
        setInitialForm(mapped);
        applyThemeToDocument(mapped.theme);
        cacheThemePreference(mapped.theme);
      } catch (error) {
        if (cancelled) return;
        console.warn("[settings] load error:", error);
        setErrorMsg("No se pudieron cargar los ajustes.");
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user?.id, profile, settings]);

  useEffect(() => {
    if (settingsLoading) return;

    applyThemeToDocument(form.theme);

    if (typeof window === "undefined" || form.theme !== "SYSTEM") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemeToDocument("SYSTEM");

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    }

    media.addListener(onChange);
    return () => media.removeListener(onChange);
  }, [form.theme, settingsLoading]);

  const navigate = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/feed");
    }
  };

  const goBack = async () => {
    if (!hasChanges || busyAction !== null) {
      navigate();
      return;
    }
    const ok = await onSaveSettings();
    if (ok) navigate();
  };

  const uploadSelectedImage = async (file: File) => {
    if (!user?.id) return;
    setSaveMsg(null);
    setErrorMsg(null);
    setBusyAction("upload-image");

    try {
      const { publicUrl } = await uploadProfileImage({ userId: user.id, file });
      const cacheBustedUrl = `${publicUrl}${publicUrl.includes("?") ? "&" : "?"}v=${Date.now()}`;
      setForm((prev) => ({ ...prev, profileImage: cacheBustedUrl }));
      setSaveMsg("Imagen actualizada. Pulsa Volver para guardar.");
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "No se pudo subir la imagen de perfil.";
      console.warn("[settings] upload image error:", error);
      setErrorMsg(message);
    } finally {
      setBusyAction(null);
    }
  };

  const onPickImage = async () => {
    if (!user?.id || busyAction !== null) return;

    if (!Capacitor.isNativePlatform()) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const photo = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
      });

      if (!photo.webPath) return;
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      const extension = blob.type.split("/")[1] ?? "jpg";
      const file = new File([blob], `profile-${Date.now()}.${extension}`, {
        type: blob.type || "image/jpeg",
      });
      await uploadSelectedImage(file);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error ? String(error.message) : "";
      const cancelled = /cancel/i.test(message);
      if (!cancelled) {
        console.warn("[settings] pick image native error:", error);
        setErrorMsg("No se pudo abrir camara/galeria.");
      }
    }
  };

  const onFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadSelectedImage(file);
  };

  const onSaveSettings = async (): Promise<boolean> => {
    if (!user?.id || !hasChanges || busyAction !== null) return false;

    setSaveMsg(null);
    setErrorMsg(null);
    setBusyAction("save");

    try {
      const saved = await saveUserProfileAndSettings({
        userId: user.id,
        nombre: form.nombre.trim() || null,
        fechaNac: normalizeDate(form.fechaNac),
        profileImage: form.profileImage,
        theme: normalizeTheme(form.theme),
        language: form.language,
        timezone: form.timezone,
        notifyPush: form.notifyPush,
        notifyEmail: form.notifyEmail,
        notifyInApp: form.notifyInApp,
        profileVisibility: normalizeVisibility(form.profileVisibility),
        allowFriendRequests: form.allowFriendRequests,
        googleSyncEnabled: form.googleSyncEnabled,
        googleSyncExportPlans: form.googleSyncExportPlans,
      });

      const mapped = mapCombinedRowToForm(saved);
      setForm(mapped);
      setInitialForm(mapped);
      cacheThemePreference(mapped.theme);
      setUserSnapshot({
        profile: profile
          ? {
              ...profile,
              nombre: saved.nombre,
              fecha_nac: saved.fecha_nac,
              profile_image: saved.profile_image,
            }
          : null,
        settings: {
          user_id: saved.user_id,
          theme: saved.theme,
          language: saved.language,
          timezone: saved.timezone,
          notify_push: saved.notify_push,
          notify_email: saved.notify_email,
          notify_in_app: saved.notify_in_app,
          profile_visibility: saved.profile_visibility,
          allow_friend_requests: saved.allow_friend_requests,
          google_sync_enabled: saved.google_sync_enabled ?? false,
          google_sync_export_plans: saved.google_sync_export_plans ?? true,
        },
      });
      try {
        await syncAuthUserMetadata({
          nombre: saved.nombre ?? "",
          profileImage: saved.profile_image ?? null,
        });
      } catch (metadataError) {
        console.warn("[settings] auth metadata sync error:", metadataError);
      }
      if (typeof window !== "undefined") {
        window.localStorage.setItem("fremee.profile.updated_at", String(Date.now()));
      }
      await refreshProfile();
      setSaveMsg("Ajustes guardados.");
      return true;
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "No se pudieron guardar los ajustes.";
      console.warn("[settings] save error:", error);
      setErrorMsg(message);
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const onSignOut = async () => {
    setErrorMsg(null);
    setSaveMsg(null);
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

  const disableEditing = settingsLoading || busyAction === "save" || busyAction === "upload-image";

  if (settingsLoading) return <SettingsPageSkeleton />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="container-app pb-[calc(var(--space-12)+env(safe-area-inset-bottom))] pt-[var(--space-4)] lg:pt-[var(--space-8)]">
        <div className="mx-auto max-w-[980px]">
          <div className="flex items-center gap-[var(--space-3)]">
            <button
              type="button"
              onClick={() => void goBack()}
              disabled={busyAction === "save"}
              aria-label="Volver"
              className="flex items-center justify-center text-app transition-opacity hover:opacity-60 disabled:opacity-[var(--disabled-opacity)]"
            >
              <ArrowLeftIcon />
            </button>
          </div>

          <h1 className="mt-[var(--space-4)] mb-[var(--space-6)] text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
            Configuración y privacidad
          </h1>

          <section>
            <SettingsSection
              title="Perfil"
            >
              <div className="mt-[var(--space-2)] border-t border-app">
                <SettingsRow
                  icon={<UserIcon />}
                  label="Nombre"
                  description="Nombre público que se muestra en tu perfil."
                  right={<span className="text-body-sm text-muted">{form.nombre || "Sin nombre"}</span>}
                />
                <SettingsRow
                  icon={<CalendarIcon />}
                  label="Fecha de nacimiento"
                  description="Se usa para personalización y edad mínima."
                  right={
                    <input
                      type="date"
                      value={form.fechaNac}
                      disabled={disableEditing}
                      onChange={(e) => setForm((prev) => ({ ...prev, fechaNac: e.target.value }))}
                      className="w-full rounded-input border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm disabled:opacity-[var(--disabled-opacity)] sm:w-auto"
                    />
                  }
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Preferencias"
                         >
              <div className="mt-[var(--space-2)] border-t border-app">
                <SettingsRow
                  icon={<MoonIcon />}
                  label="Tema"
                  description="Elige entre sistema, claro u oscuro."
                  right={
                    <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                      <ModeButton
                        active={form.theme === "SYSTEM"}
                        label="Sistema"
                        disabled={disableEditing}
                        onClick={() => setForm((prev) => ({ ...prev, theme: "SYSTEM" }))}
                      />
                      <ModeButton
                        active={form.theme === "LIGHT"}
                        label="Claro"
                        disabled={disableEditing}
                        onClick={() => setForm((prev) => ({ ...prev, theme: "LIGHT" }))}
                      />
                      <ModeButton
                        active={form.theme === "DARK"}
                        label="Oscuro"
                        disabled={disableEditing}
                        onClick={() => setForm((prev) => ({ ...prev, theme: "DARK" }))}
                      />
                    </div>
                  }
                />
                <SettingsRow
                  icon={<LanguageIcon />}
                  label="Idioma"
                  description="Idioma de interfaz."
                  right={
                    <FieldSelect
                      value={form.language}
                      disabled={disableEditing}
                      onChange={(value) => setForm((prev) => ({ ...prev, language: value }))}
                      options={LANGUAGE_OPTIONS}
                    />
                  }
                />
                <SettingsRow
                  icon={<ClockIcon />}
                  label="Zona horaria"
                  description="Hora local para tus planes y recordatorios."
                  right={
                    <FieldSelect
                      value={form.timezone}
                      disabled={disableEditing}
                      onChange={(value) => setForm((prev) => ({ ...prev, timezone: value }))}
                      options={TIMEZONE_OPTIONS}
                    />
                  }
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Notificaciones"
                         >
              <div className="mt-[var(--space-2)] border-t border-app">
                <SettingsRow
                  icon={<BellIcon />}
                  label="Push"
                  description="Alertas en el dispositivo."
                  right={
                    <Switch
                      checked={form.notifyPush}
                      disabled={disableEditing}
                      onChange={(next) => setForm((prev) => ({ ...prev, notifyPush: next }))}
                    />
                  }
                />
                <SettingsRow
                  icon={<MailIcon />}
                  label="Email"
                  description="Resúmenes y actividad por correo."
                  right={
                    <Switch
                      checked={form.notifyEmail}
                      disabled={disableEditing}
                      onChange={(next) => setForm((prev) => ({ ...prev, notifyEmail: next }))}
                    />
                  }
                />
                <SettingsRow
                  icon={<ChatIcon />}
                  label="In-app"
                  description="Avisos dentro de la aplicación."
                  right={
                    <Switch
                      checked={form.notifyInApp}
                      disabled={disableEditing}
                      onChange={(next) => setForm((prev) => ({ ...prev, notifyInApp: next }))}
                    />
                  }
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Privacidad"
                         >
              <div className="mt-[var(--space-2)] border-t border-app">
                <SettingsRow
                  icon={<UserIcon />}
                  label="Visibilidad del perfil"
                  description="Decide si tu perfil es público o privado."
                  right={
                    <FieldSelect
                      value={form.profileVisibility}
                      disabled={disableEditing}
                      onChange={(value) =>
                        setForm((prev) => ({ ...prev, profileVisibility: value as VisibilityOption }))
                      }
                      options={VISIBILITY_OPTIONS}
                    />
                  }
                />
                <SettingsRow
                  icon={<ShieldIcon />}
                  label="Solicitudes de amistad"
                  description="Permite que otras personas te agreguen."
                  right={
                    <Switch
                      checked={form.allowFriendRequests}
                      disabled={disableEditing}
                      onChange={(next) => setForm((prev) => ({ ...prev, allowFriendRequests: next }))}
                    />
                  }
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Google Calendar"
                         >
              <div className="mt-[var(--space-2)] border-t border-app">
                <SettingsRow
                  icon={<CalendarIcon />}
                  label="Sincronización habilitada"
                  description="Permite conectar Frimee con Google Calendar."
                  right={
                    <Switch
                      checked={form.googleSyncEnabled}
                      disabled={disableEditing}
                      onChange={(next) => setForm((prev) => ({ ...prev, googleSyncEnabled: next }))}
                    />
                  }
                />
                <SettingsRow
                  icon={<CalendarIcon />}
                  label="Exportar planes"
                  description="Crea y actualiza tus planes en Google Calendar."
                  right={
                    <Switch
                      checked={form.googleSyncExportPlans}
                      disabled={disableEditing || !form.googleSyncEnabled}
                      onChange={(next) => setForm((prev) => ({ ...prev, googleSyncExportPlans: next }))}
                    />
                  }
                />
              </div>
            </SettingsSection>

            <SettingsSection
              title="Cuenta"
                         >
              <div className="mt-[var(--space-3)] flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  {saveMsg && <p className="text-body-sm text-success-token">{saveMsg}</p>}
                  {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}
                </div>
                <div className="flex flex-col gap-[var(--space-2)] sm:flex-row">
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
                </div>
              </div>
            </SettingsSection>
          </section>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={onFileChange}
            className="hidden"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}

function SettingsPageSkeleton() {
  return (
    <div className="min-h-dvh bg-app text-app" role="status" aria-label="Cargando ajustes">
      <div className="container-app pb-[calc(var(--space-12)+env(safe-area-inset-bottom))] pt-[var(--space-4)] lg:pt-[var(--space-8)]">
        <div className="mx-auto max-w-[980px]">
          <div className="flex items-center gap-[var(--space-3)]">
            <div className="skeleton-shimmer h-8 w-8 rounded-full" />
          </div>

          <div className="mt-[var(--space-4)] mb-[var(--space-6)] skeleton-shimmer h-9 w-64 rounded-full" />

          <section>
            {Array.from({ length: 6 }).map((_, index) => (
              <section key={index} className={index === 0 ? "" : "border-t border-strong"}>
                <div className="px-[var(--space-4)] py-[var(--space-5)] lg:px-[var(--space-7)]">
                  <div className="skeleton-shimmer h-5 w-28 rounded-full" />
                  <div className="mt-[var(--space-2)] skeleton-shimmer h-4 w-64 rounded-full" />
                  <div className="mt-[var(--space-4)] border-t border-app">
                    {Array.from({ length: index === 0 || index >= 4 ? 2 : 3 }).map((__, rowIndex) => (
                      <div
                        key={rowIndex}
                        className="flex flex-col gap-[var(--space-3)] border-b border-app py-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-[var(--space-3)]">
                          <div className="skeleton-shimmer mt-[var(--space-1)] h-5 w-5 rounded-full" />
                          <div className="min-w-0 flex-1">
                            <div className="skeleton-shimmer h-4 w-28 rounded-full" />
                            <div className="mt-[var(--space-1)] skeleton-shimmer h-3 w-44 rounded-full" />
                          </div>
                        </div>
                        <div className="skeleton-shimmer h-10 w-28 rounded-input" />
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="px-[var(--space-4)] py-[var(--space-5)] lg:px-[var(--space-7)] lg:py-[var(--space-6)]">
        <h2 className="[font-family:var(--font-display-face)] text-[var(--font-h5)] font-normal leading-[var(--lh-h5)]">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  icon,
  label,
  description,
  right,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-[var(--space-3)] border-b border-app py-[var(--space-4)] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-[var(--space-3)]">
        <span className="mt-[var(--space-1)] text-app">{icon}</span>
        <div className="min-w-0">
          <p className="text-body font-[var(--fw-medium)]">{label}</p>
          <p className="mt-[var(--space-1)] text-body-sm text-muted">{description}</p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-[var(--space-2)] sm:w-auto sm:justify-end">
        {right ?? <ChevronRightIcon className="shrink-0 text-tertiary" />}
      </div>
    </div>
  );
}

function FieldSelect({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-[190px] rounded-input border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm disabled:opacity-[var(--disabled-opacity)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function PrimaryButton({
  label,
  onClick,
  disabled = false,
  className = "",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-btn-primary rounded-input border border-primary-token bg-primary-token px-[var(--space-4)] text-body font-[var(--fw-semibold)] text-contrast-token transition-opacity disabled:opacity-[var(--disabled-opacity)] ${className}`}
    >
      {label}
    </button>
  );
}

function SettingsButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
  className = "",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-[var(--space-3)] rounded-input border px-[var(--space-4)] py-[var(--space-3)] text-body font-[var(--fw-medium)] text-left transition-colors disabled:opacity-[var(--disabled-opacity)] ${className} ${
        danger
          ? "border-error-token bg-surface text-error-token hover:bg-surface-2"
          : "border-app bg-surface text-app hover:bg-surface-2"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ModeButton({
  active,
  label,
  onClick,
  disabled = false,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-chip border px-[var(--space-3)] py-[var(--space-2)] text-body-sm transition-colors disabled:opacity-[var(--disabled-opacity)] ${
        active
          ? "border-primary-token bg-primary-token text-contrast-token"
          : "border-app bg-surface text-app hover:bg-surface-2"
      }`}
    >
      {label}
    </button>
  );
}

function Switch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={checked ? "Desactivar" : "Activar"}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[var(--space-7)] w-[var(--space-12)] overflow-hidden rounded-chip transition-colors disabled:opacity-[var(--disabled-opacity)] ${
        checked ? "bg-primary-token" : "bg-surface-2"
      }`}
    >
      <span
        className={`absolute left-[var(--space-1)] top-[var(--space-1)] h-[var(--space-5)] w-[var(--space-5)] rounded-full bg-surface shadow-elev-1 transition-transform duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] ${
          checked ? "translate-x-[var(--space-5)]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Avatar({ profileImage, fallback }: { profileImage: string | null; fallback: string }) {
  return (
    <div className="flex h-[var(--space-16)] w-[var(--space-16)] items-center justify-center overflow-hidden rounded-avatar border border-strong bg-surface-2 shadow-elev-2">
      {profileImage ? (
        <Image
          src={profileImage}
          alt="Foto de perfil"
          width={64}
          height={64}
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          unoptimized
        />
      ) : (
        <span className="text-[var(--font-h2)] font-[var(--fw-semibold)] text-app">{fallback}</span>
      )}
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M14.5 5L7.5 12L14.5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true" className={className}>
      <path d="M4 20H8L18.6 9.4L14.6 5.4L4 16V20Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12.8 7.2L16.8 11.2" stroke="currentColor" strokeWidth="1.7" />
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
      <path
        d="M12 3L19 6V11.5C19 15.3 16.2 18.8 12 20.5C7.8 18.8 5 15.3 5 11.5V6L12 3Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path d="M9.5 11.8L11.1 13.4L14.6 9.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3V7M16 3V7M3 10.5H21" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path
        d="M6.5 16H17.5L16.8 14.8V10.8C16.8 8.1 14.7 6 12 6C9.3 6 7.2 8.1 7.2 10.8V14.8L6.5 16Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M10.1 18.2C10.4 19.1 11.1 19.7 12 19.7C12.9 19.7 13.6 19.1 13.9 18.2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path
        d="M14.8 4.7C10.8 5.2 7.8 8.6 7.8 12.7C7.8 16.9 11.2 20.3 15.4 20.3C17 20.3 18.4 19.8 19.6 18.9C18.8 19.1 18 19.2 17.2 19.2C12.9 19.2 9.5 15.8 9.5 11.5C9.5 8.9 10.8 6.6 12.8 5.2C13.4 4.8 14.1 4.6 14.8 4.7Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LanguageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path d="M4 6H12M8 4V6M6 6C6.3 9 7.8 12 10 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M14 18L17.8 9.5L21.6 18M15.2 15.2H20.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 7.8V12.4L15.2 14.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5.2 7.2L12 12.3L18.8 7.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path
        d="M4 6.5A1.5 1.5 0 0 1 5.5 5H18.5A1.5 1.5 0 0 1 20 6.5V13.5A1.5 1.5 0 0 1 18.5 15H8.5L4 18.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="21" height="21" fill="none" aria-hidden="true">
      <path
        d="M9 5.5H6.8C5.8 5.5 5 6.3 5 7.3V16.7C5 17.7 5.8 18.5 6.8 18.5H9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
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
      <path
        d="M8 7L8.6 18.1C8.6 18.9 9.2 19.5 10 19.5H14C14.8 19.5 15.4 18.9 15.4 18.1L16 7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M10.2 10.3V16.1M13.8 10.3V16.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}
