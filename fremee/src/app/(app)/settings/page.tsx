"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { ArrowLeftIcon, ChevronRightIcon } from "@/components/icons";
import {
  Pencil, User, Shield, Calendar, Bell, Moon, Sun, Globe, Clock,
  Mail, MessageSquare, LogOut, Trash2, KeyRound, Eye, EyeOff, ChevronLeft,
} from "lucide-react";
import { App } from "@capacitor/app";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { useAuth } from "@/providers/AuthProvider";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { applyThemePreference, cacheThemePreference } from "@/services/theme/preferences";
import { buildInternalApiUrl } from "@/config/external";
import {
  getUserSettings,
  saveUserProfileAndSettings,
  uploadProfileImage,
  type UserSettingsTheme,
  type UserSettingsVisibility,
} from "@/services/api/repositories/settings.repository";
import { STORAGE_KEYS } from "@/config/storage";

type BusyAction = "save" | "signout" | "delete" | "upload-image" | "change-password" | null;
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
  const hasLoadedRef = useRef(false);

  const [settingsLoading, setSettingsLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [form, setForm] = useState<SettingsForm>(DEFAULT_SETTINGS);
  const [initialForm, setInitialForm] = useState<SettingsForm>(DEFAULT_SETTINGS);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdConfirm, setPwdConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const hasChanges = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm],
  );

  const displayName = useMemo(() => {
    const base = form.nombre?.trim() || profile?.nombre?.trim();
    return base && base.length > 0 ? base : "Tu perfil";
  }, [form.nombre, profile?.nombre]);

  const avatarFallback = displayName[0]?.toUpperCase() ?? "U";

  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setSettingsLoading(false);
      return;
    }

    const CACHE_KEY = `settings_form_${userId}`;

    // Show cached data immediately to avoid skeleton flash on re-navigation
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SettingsForm;
        setForm(parsed);
        setInitialForm(parsed);
        applyThemeToDocument(parsed.theme);
        setSettingsLoading(false);
        hasLoadedRef.current = true;
      } catch {
        // ignore corrupt cache
      }
    }

    let cancelled = false;

    const loadSettings = async () => {
      if (!hasLoadedRef.current) setSettingsLoading(true);
      setErrorMsg(null);

      try {
        const latestSettings = await getUserSettings(userId);
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
        if (!cancelled) {
          setForm(mapped);
          setInitialForm(mapped);
          applyThemeToDocument(mapped.theme);
          cacheThemePreference(mapped.theme);
          sessionStorage.setItem(CACHE_KEY, JSON.stringify(mapped));
          hasLoadedRef.current = true;
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("[settings] load error:", error);
        if (!hasLoadedRef.current) setErrorMsg("No se pudieron cargar los ajustes.");
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
    if (Capacitor.isNativePlatform()) {
      const profileHref = user?.id ? `/profile/static?id=${user.id}` : "/feed";
      router.push(profileHref);
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(user?.id ? `/profile/${user.id}` : "/feed");
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const listenerPromise = App.addListener("backButton", () => { void goBack(); });
    return () => { void listenerPromise.then((h) => h.remove()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges, busyAction]);

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
        window.localStorage.setItem(STORAGE_KEYS.profileUpdatedAt, String(Date.now()));
        sessionStorage.setItem(`settings_form_${user.id}`, JSON.stringify(mapped));
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

  const onChangePassword = async () => {
    if (!user?.email || busyAction !== null) return;
    setPwdMsg(null);

    if (!pwdCurrent || !pwdNew || !pwdConfirm) {
      setPwdMsg({ type: "error", text: "Rellena todos los campos." });
      return;
    }
    if (pwdNew.length < 8) {
      setPwdMsg({ type: "error", text: "La nueva contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdMsg({ type: "error", text: "Las contraseñas no coinciden." });
      return;
    }

    const supabase = createBrowserSupabaseClient();
    setBusyAction("change-password");

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwdCurrent,
      });
      if (signInError) {
        setPwdMsg({ type: "error", text: "La contraseña actual no es correcta." });
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: pwdNew });
      if (updateError) throw updateError;

      setPwdMsg({ type: "ok", text: "Contraseña actualizada correctamente." });
      setPwdCurrent("");
      setPwdNew("");
      setPwdConfirm("");
      setShowPasswordSection(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cambiar la contraseña.";
      setPwdMsg({ type: "error", text: message });
    } finally {
      setBusyAction(null);
    }
  };

  const onDeleteAccount = async () => {
    if (busyAction !== null) return;
    setBusyAction("delete");
    setErrorMsg(null);

    try {
      const { data: { session } } = await createBrowserSupabaseClient().auth.getSession();
      const res = await fetch(buildInternalApiUrl("/api/account/delete"), {
        method: "DELETE",
        headers: session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {},
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "Error al eliminar la cuenta.");
      }
      await signOut();
      router.replace("/login");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
      setBusyAction(null);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };

  const disableEditing = settingsLoading || busyAction === "save" || busyAction === "upload-image";

  if (settingsLoading) return <SettingsPageSkeleton />;

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="container-app pb-[calc(var(--space-12)+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+var(--space-4))] lg:pt-[var(--space-8)]">
        <div className="mx-auto max-w-[980px]">
          <div className="flex items-center gap-[var(--space-3)]">
            <button
              type="button"
              onClick={() => void goBack()}
              disabled={busyAction === "save"}
              aria-label="Volver"
              className="flex size-[32px] items-center justify-center rounded-full transition-colors hover:bg-surface disabled:opacity-[var(--disabled-opacity)]"
            >
              <ChevronLeft className="size-[18px]" aria-hidden />
            </button>
          </div>

          <h1 className="mt-[var(--space-4)] mb-[var(--space-6)] text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">
            Configuración y privacidad
          </h1>

          <div>
            <SettingsSection title="Perfil">
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
                    className="rounded-input border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm disabled:opacity-[var(--disabled-opacity)]"
                  />
                }
              />
            </SettingsSection>

            <SettingsSection title="Preferencias">
              <SettingsRow
                icon={<MoonIcon />}
                label="Tema"
                description="Elige el tema de la aplicación."
                right={
                  <div className="flex items-center gap-2">
                    <IconModeButton
                      active={form.theme === "LIGHT"}
                      icon={<Sun className="size-[18px]" />}
                      label="Claro"
                      disabled={disableEditing}
                      onClick={() => setForm((prev) => ({ ...prev, theme: "LIGHT" }))}
                    />
                    <IconModeButton
                      active={form.theme === "DARK"}
                      icon={<Moon className="size-[18px]" />}
                      label="Oscuro"
                      disabled={disableEditing}
                      onClick={() => setForm((prev) => ({ ...prev, theme: "DARK" }))}
                    />
                  </div>
                }
              />
            </SettingsSection>

            <SettingsSection title="Notificaciones">
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
            </SettingsSection>

            <SettingsSection title="Privacidad">
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
            </SettingsSection>

            <SettingsSection title="Google Calendar">
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
            </SettingsSection>

            <SettingsSection title="Seguridad">
              <SettingsRow
                icon={<KeyRoundIcon />}
                label="Contraseña"
                description="Cambia la contraseña de tu cuenta."
                right={
                  <button
                    type="button"
                    onClick={() => { setShowPasswordSection((v) => !v); setPwdMsg(null); }}
                    className="rounded-chip border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm transition-colors hover:bg-surface-2"
                  >
                    {showPasswordSection ? "Cancelar" : "Cambiar"}
                  </button>
                }
              />
              {showPasswordSection && (
                <div className="pb-[var(--space-4)]">
                  <div className="flex flex-col gap-[var(--space-3)]">
                    {(["current", "new", "confirm"] as const).map((field) => {
                      const value = field === "current" ? pwdCurrent : field === "new" ? pwdNew : pwdConfirm;
                      const setter = field === "current" ? setPwdCurrent : field === "new" ? setPwdNew : setPwdConfirm;
                      const label = field === "current" ? "Contraseña actual" : field === "new" ? "Nueva contraseña" : "Confirmar nueva contraseña";
                      return (
                        <div key={field} className="relative">
                          <input
                            type={showPwd ? "text" : "password"}
                            value={value}
                            onChange={(e) => setter(e.target.value)}
                            placeholder={label}
                            autoComplete={field === "current" ? "current-password" : "new-password"}
                            className="w-full rounded-input border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] pr-10 text-body-sm outline-none focus:border-primary-token"
                          />
                          {field === "confirm" && (
                            <button
                              type="button"
                              onClick={() => setShowPwd((v) => !v)}
                              className="absolute right-[var(--space-3)] top-1/2 -translate-y-1/2 text-muted"
                              aria-label={showPwd ? "Ocultar contraseñas" : "Mostrar contraseñas"}
                            >
                              {showPwd ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {pwdMsg && (
                      <p className={`text-body-sm ${pwdMsg.type === "ok" ? "text-success-token" : "text-error-token"}`}>
                        {pwdMsg.text}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <PrimaryButton
                        label={busyAction === "change-password" ? "Guardando..." : "Guardar contraseña"}
                        onClick={() => void onChangePassword()}
                        disabled={busyAction !== null}
                      />
                    </div>
                  </div>
                </div>
              )}
            </SettingsSection>

            <SettingsSection title="Cuenta">
              {(saveMsg || errorMsg) && (
                <div className="mb-3">
                  {saveMsg && <p className="text-body-sm text-success-token">{saveMsg}</p>}
                  {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}
                </div>
              )}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  disabled={busyAction !== null}
                  className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left text-body-sm font-[var(--fw-medium)] text-app transition-opacity hover:opacity-60 disabled:opacity-[var(--disabled-opacity)]"
                >
                  <LogOut className="size-[24px] shrink-0 text-muted" aria-hidden />
                  <span>{busyAction === "signout" ? "Cerrando sesión..." : "Cerrar sesión"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(""); }}
                  disabled={busyAction !== null}
                  className="flex min-h-[52px] w-full items-center gap-3 py-3 text-left text-body-sm font-[var(--fw-medium)] text-error-token transition-opacity hover:opacity-60 disabled:opacity-[var(--disabled-opacity)]"
                >
                  <Trash2 className="size-[24px] shrink-0" aria-hidden />
                  <span>Eliminar cuenta</span>
                </button>
              </div>
              {showDeleteConfirm && (
                <div className="mt-[var(--space-4)] rounded-[var(--radius-card)] border border-error-token bg-surface p-[var(--space-4)]">
                  <p className="text-body font-[var(--fw-semibold)] text-error-token">¿Seguro que quieres eliminar tu cuenta?</p>
                  <p className="mt-[var(--space-1)] text-body-sm text-muted">
                    Esta acción es permanente e irreversible. Se borrarán todos tus datos.
                    Escribe <strong>ELIMINAR</strong> para confirmar.
                  </p>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="ELIMINAR"
                    className="mt-[var(--space-3)] w-full rounded-input border border-app bg-surface px-[var(--space-3)] py-[var(--space-2)] text-body-sm outline-none focus:border-error-token"
                  />
                  <div className="mt-[var(--space-3)] flex gap-[var(--space-2)]">
                    <button
                      type="button"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                      className="rounded-input border border-app bg-surface px-[var(--space-4)] py-[var(--space-2)] text-body-sm transition-colors hover:bg-surface-2"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={deleteConfirmText !== "ELIMINAR" || busyAction !== null}
                      onClick={() => void onDeleteAccount()}
                      className="rounded-input border border-error-token bg-error-token px-[var(--space-4)] py-[var(--space-2)] text-body-sm font-[var(--fw-semibold)] text-white transition-opacity disabled:opacity-[var(--disabled-opacity)]"
                    >
                      {busyAction === "delete" ? "Eliminando..." : "Sí, eliminar cuenta"}
                    </button>
                  </div>
                </div>
              )}
            </SettingsSection>
          </div>
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
      <div className="container-app pb-[calc(var(--space-12)+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+var(--space-4))] lg:pt-[var(--space-8)]">
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
    <section className="mb-[var(--space-7)]">
      <p className="mb-1 text-[14px] font-[600] uppercase tracking-[0.06em] text-muted">
        {title}
      </p>
      {children}
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
  description?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-muted">{icon}</span>
        <div className="min-w-0">
          <p className="text-body-sm font-[var(--fw-medium)] text-app">{label}</p>
          {description && <p className="text-[14px] leading-snug text-muted">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right ?? <ChevronRightIcon className="size-4 shrink-0 text-muted" />}
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

function IconModeButton({
  active,
  icon,
  label,
  onClick,
  disabled = false,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex size-9 items-center justify-center rounded-full border transition-colors disabled:opacity-[var(--disabled-opacity)] ${
        active
          ? "border-primary-token bg-primary-token text-contrast-token"
          : "border-app bg-surface text-muted hover:bg-surface-2"
      }`}
    >
      {icon}
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
          unoptimized
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="text-[var(--font-h2)] font-[var(--fw-semibold)] text-app">{fallback}</span>
      )}
    </div>
  );
}


function PencilIcon({ className = "" }: { className?: string }) {
  return <Pencil width="17" height="17" aria-hidden className={className} />;
}
const UserIcon = User;
const ShieldIcon = Shield;
const CalendarIcon = Calendar;
const BellIcon = Bell;
const MoonIcon = Moon;
const LanguageIcon = Globe;
const ClockIcon = Clock;
const MailIcon = Mail;
const ChatIcon = MessageSquare;
const LogOutIcon = LogOut;
const TrashIcon = Trash2;
const KeyRoundIcon = KeyRound;
