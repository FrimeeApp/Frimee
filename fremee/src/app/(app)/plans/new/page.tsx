"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import { useAuth } from "@/providers/AuthProvider";
import { resolveGoogleProviderToken } from "@/services/auth/googleProviderToken";
import { createPlan, listPlansByIdsInOrder } from "@/services/api/repositories/plans.repository";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import { syncGoogleCalendarBidirectional } from "@/services/api/repositories/events.repository";
import { uploadPlanCoverFile } from "@/services/firebase/upload";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

type VisibilityOption = "PUBLICO" | "SOLO_GRUPO" | "SOLO_AMIGOS" | "SOLO_FOLLOW";

type PlanForm = {
  titulo: string;
  descripcion: string;
  inicioDate: string;
  finDate: string;
  inicioTime: string;
  finTime: string;
  ubicacionNombre: string;
  ubicacionDireccion: string;
  allDay: boolean;
  visibilidad: VisibilityOption;
};

const DEFAULT_FORM: PlanForm = {
  titulo: "",
  descripcion: "",
  inicioDate: "",
  finDate: "",
  inicioTime: "10:00",
  finTime: "12:00",
  ubicacionNombre: "",
  ubicacionDireccion: "",
  allDay: false,
  visibilidad: "SOLO_GRUPO",
};

function buildPlanDateTime(params: {
  date: string;
  time: string;
  allDay: boolean;
  isEnd: boolean;
}) {
  if (params.allDay) {
    const suffix = params.isEnd ? "T23:59:59" : "T00:00:00";
    return new Date(`${params.date}${suffix}`).toISOString();
  }

  return new Date(`${params.date}T${params.time}`).toISOString();
}

export default function NewPlanPage() {
  const router = useRouter();
  const { user, settings, session, googleProviderToken } = useAuth();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [publishRetryPlanId, setPublishRetryPlanId] = useState<number | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(DEFAULT_FORM);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const inicioDateRef = useRef<HTMLInputElement | null>(null);
  const finDateRef = useRef<HTMLInputElement | null>(null);

  const canSubmit = useMemo(() => {
    if (!user?.id || saving || uploadingCover) return false;
    if (!form.titulo.trim()) return false;
    if (!form.descripcion.trim()) return false;
    if (!form.ubicacionNombre.trim()) return false;
    if (!form.inicioDate || !form.finDate) return false;
    if (form.allDay) return form.finDate >= form.inicioDate;
    if (!form.inicioTime || !form.finTime) return false;
    return `${form.finDate}T${form.finTime}` >= `${form.inicioDate}T${form.inicioTime}`;
  }, [form, saving, uploadingCover, user?.id]);

  const onPickCover = () => {
    if (!user?.id || saving || uploadingCover) return;
    coverInputRef.current?.click();
  };

  const onCoverChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user?.id) return;

    setErrorMsg(null);
    setUploadingCover(true);

    try {
      const { downloadUrl } = await uploadPlanCoverFile({ file, userId: user.id });
      setCoverImageUrl(downloadUrl);
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "No se pudo subir la imagen de portada.";
      setErrorMsg(message);
    } finally {
      setUploadingCover(false);
    }
  };

  const openNativePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    const picker = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof picker.showPicker === "function") {
      try {
        picker.showPicker();
      } catch {
        input.focus();
      }
      return;
    }
    input.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !canSubmit) return;

    setSaving(true);
    setErrorMsg(null);
    setPublishRetryPlanId(null);

    try {
      const created = await createPlan({
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        inicioAt: buildPlanDateTime({
          date: form.inicioDate,
          time: form.inicioTime,
          allDay: form.allDay,
          isEnd: false,
        }),
        finAt: buildPlanDateTime({
          date: form.finDate,
          time: form.finTime,
          allDay: form.allDay,
          isEnd: true,
        }),
        ubicacionNombre: form.ubicacionNombre.trim(),
        ubicacionDireccion: form.ubicacionDireccion.trim() || null,
        fotoPortada: coverImageUrl,
        allDay: form.allDay,
        visibilidad: form.visibilidad,
        ownerUserId: user.id,
        creadoPorUserId: user.id,
      });

      if (settings?.google_sync_enabled && settings.google_sync_export_plans) {
        try {
          const providerToken = await resolveGoogleProviderToken({
            supabase,
            session,
            userId: user.id,
            cachedToken: googleProviderToken,
          });
          if (providerToken) {
            const [createdPlan] = await listPlansByIdsInOrder([created.id]);
            if (createdPlan) {
              const timeMin = startOfMonth(addMonths(new Date(), -12)).toISOString();
              const timeMax = endOfMonth(addMonths(new Date(), 12)).toISOString();
              await syncGoogleCalendarBidirectional({
                userId: user.id,
                accessToken: providerToken,
                timeMin,
                timeMax,
                plans: [createdPlan],
                googleSyncEnabled: settings.google_sync_enabled,
                googleSyncExportPlans: settings.google_sync_export_plans,
              });
            }
          }
        } catch (syncError) {
          console.warn("[plans/new] google sync after create failed:", syncError);
        }
      }

      try {
        await publishPlanAsPost({ id: created.id });
        router.replace("/feed");
      } catch (publishError) {
        console.warn("[plans/new] publish to firebase error:", publishError);
        setPublishRetryPlanId(created.id);
        setErrorMsg("Plan creado, pero no se pudo publicar en el feed. Puedes reintentar o ir al feed.");
      }
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "No se pudo crear el plan.";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  const retryPublish = async () => {
    if (!publishRetryPlanId || saving) return;

    setSaving(true);
    setErrorMsg(null);

    try {
      await publishPlanAsPost({ id: publishRetryPlanId });
      router.replace("/feed");
    } catch (error) {
      const message =
        typeof error === "object" && error && "message" in error
          ? String(error.message)
          : "El plan existe, pero la publicacion en el feed sigue fallando.";
      setErrorMsg(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((prev) => !prev)} />

        <main
          className={`px-safe pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] pt-[var(--space-4)] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] lg:py-[var(--space-8)] lg:pr-[var(--space-14)] ${
            sidebarCollapsed ? "lg:pl-[56px]" : "lg:pl-[136px]"
          }`}
        >
          <div className="mx-auto w-full max-w-[760px]">
            <header className="rounded-modal border border-strong bg-surface p-[var(--space-4)] shadow-elev-2 lg:p-[var(--space-6)]">
              <h1 className="text-[var(--font-h3)] font-[var(--fw-semibold)] leading-[var(--lh-h3)]">Crear plan</h1>
              <p className="mt-[var(--space-1)] text-body-sm text-muted">
                Empieza con lo esencial. Podras completar mas detalles despues.
              </p>
            </header>

            <form
              onSubmit={onSubmit}
              className="mt-[var(--space-5)] space-y-[var(--space-4)] rounded-modal border border-strong bg-surface p-[var(--space-4)] shadow-elev-1 lg:p-[var(--space-6)]"
            >
              <Field label="Titulo" required>
                <input
                  value={form.titulo}
                  onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
                  className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                  placeholder="Ej. Ruta por la sierra"
                />
              </Field>

              <Field label="Descripcion" required>
                <textarea
                  value={form.descripcion}
                  onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                  className="min-h-[120px] w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] py-[var(--space-2)] outline-none"
                  placeholder="Que se va a hacer, plan general, etc."
                />
              </Field>

              <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                <Field label="Fecha inicio" required>
                  <input
                    ref={inicioDateRef}
                    type="date"
                    value={form.inicioDate}
                    onPointerDown={() => openNativePicker(inicioDateRef.current)}
                    onClick={() => openNativePicker(inicioDateRef.current)}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        inicioDate: e.target.value,
                        finDate: prev.finDate || e.target.value,
                      }))
                    }
                    className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                  />
                </Field>
                <Field label="Fecha fin" required>
                  <input
                    ref={finDateRef}
                    type="date"
                    value={form.finDate}
                    onPointerDown={() => openNativePicker(finDateRef.current)}
                    onClick={() => openNativePicker(finDateRef.current)}
                    onChange={(e) => setForm((prev) => ({ ...prev, finDate: e.target.value }))}
                    className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                  />
                </Field>
              </div>

              <Field label="Ubicacion" required>
                <input
                  value={form.ubicacionNombre}
                  onChange={(e) => setForm((prev) => ({ ...prev, ubicacionNombre: e.target.value }))}
                  className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                  placeholder="Ej. Parque del Retiro"
                />
              </Field>

              <Field label="Direccion (opcional)">
                <input
                  value={form.ubicacionDireccion}
                  onChange={(e) => setForm((prev) => ({ ...prev, ubicacionDireccion: e.target.value }))}
                  className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                  placeholder="Calle, numero..."
                />
              </Field>

              <Field label="Foto de portada (opcional)">
                <div className="space-y-[var(--space-2)]">
                  {coverImageUrl ? (
                    <img
                      src={coverImageUrl}
                      alt="Vista previa portada"
                      className="h-[170px] w-full rounded-input border border-app object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                    <button
                      type="button"
                      onClick={onPickCover}
                      disabled={saving || uploadingCover}
                      className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-3)] text-body-sm font-[var(--fw-medium)] disabled:opacity-[var(--disabled-opacity)]"
                    >
                      {uploadingCover ? "Subiendo..." : coverImageUrl ? "Cambiar imagen" : "Subir imagen"}
                    </button>
                    {coverImageUrl ? (
                      <button
                        type="button"
                        onClick={() => setCoverImageUrl(null)}
                        disabled={saving || uploadingCover}
                        className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-3)] text-body-sm font-[var(--fw-medium)] disabled:opacity-[var(--disabled-opacity)]"
                      >
                        Quitar
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    onChange={onCoverChange}
                    className="hidden"
                    aria-hidden="true"
                  />
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                <Field label="Visibilidad">
                  <select
                    value={form.visibilidad}
                    onChange={(e) => setForm((prev) => ({ ...prev, visibilidad: e.target.value as VisibilityOption }))}
                    className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                  >
                    <option value="SOLO_GRUPO">Solo grupo</option>
                    <option value="PUBLICO">Publico</option>
                    <option value="SOLO_AMIGOS">Solo amigos</option>
                    <option value="SOLO_FOLLOW">Solo followers</option>
                  </select>
                </Field>

                <Field label="Todo el dia">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, allDay: !prev.allDay }))}
                    className={`h-input w-full rounded-input border px-[var(--space-3)] text-left ${
                      form.allDay ? "border-primary-token bg-primary-token text-contrast-token" : "border-app bg-surface-inset"
                    }`}
                  >
                    {form.allDay ? "Si" : "No"}
                  </button>
                </Field>
              </div>

              {!form.allDay && (
                <div className="grid grid-cols-1 gap-[var(--space-3)] sm:grid-cols-2">
                  <Field label="Hora inicio" required>
                    <input
                      type="time"
                      value={form.inicioTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, inicioTime: e.target.value }))}
                      className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                    />
                  </Field>
                  <Field label="Hora fin" required>
                    <input
                      type="time"
                      value={form.finTime}
                      onChange={(e) => setForm((prev) => ({ ...prev, finTime: e.target.value }))}
                      className="h-input w-full rounded-input border border-app bg-surface-inset px-[var(--space-3)] outline-none"
                    />
                  </Field>
                </div>
              )}

              {errorMsg && <p className="text-body-sm text-error-token">{errorMsg}</p>}

              <div className="flex items-center gap-[var(--space-3)]">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-4)] text-body-sm font-[var(--fw-medium)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="h-btn-primary rounded-input border border-primary-token bg-primary-token px-[var(--space-4)] text-body-sm font-[var(--fw-semibold)] text-contrast-token disabled:opacity-[var(--disabled-opacity)]"
                >
                  {saving ? "Creando..." : uploadingCover ? "Subiendo imagen..." : "Crear plan"}
                </button>
                {publishRetryPlanId && (
                  <>
                    <button
                      type="button"
                      onClick={retryPublish}
                      disabled={saving}
                      className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-4)] text-body-sm font-[var(--fw-medium)] disabled:opacity-[var(--disabled-opacity)]"
                    >
                      Reintentar publicacion
                    </button>
                    <button
                      type="button"
                      onClick={() => router.replace("/feed")}
                      disabled={saving}
                      className="h-btn-secondary rounded-input border border-app bg-surface-inset px-[var(--space-4)] text-body-sm font-[var(--fw-medium)] disabled:opacity-[var(--disabled-opacity)]"
                    >
                      Ir al feed
                    </button>
                  </>
                )}
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function Field({
  label,
  children,
  required = false,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-[var(--space-2)] block text-body-sm font-[var(--fw-medium)]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
