"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { publishPlanAsPost } from "@/services/api/repositories/post.repository";
import type { PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import { fetchSubplanes } from "@/services/api/endpoints/subplanes.endpoint";
import { getPlanFotos, type PlanFotoDto } from "@/services/api/repositories/plan-fotos.repository";
import { listGastosForPlanEndpoint, fetchPlanMiembrosEndpoint, type GastoRow, type PlanMiembro } from "@/services/api/endpoints/gastos.endpoint";
import type { SubplanRow } from "@/services/api/endpoints/subplanes.endpoint";
import type { PublicationConfig, ItinerarySnapshotItem, ExpensesSnapshot, ParticipantsSnapshot } from "@/services/api/dtos/plan.dto";
import { CheckCircle, Loader2, Check, MapPin, Calendar, ChevronRight as ChevronRightLucide, ChevronLeft as ChevronLeftLucide } from "lucide-react";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseX } from "@/components/ui/CloseX";
import { ModalFeedback } from "@/components/ui/ModalFeedback";

type Props = {
  plan: PlanByIdRow;
  onClose: () => void;
};

const MAX_CAPTION = 280;

function formatDateRange(startsAt: string, endsAt: string, allDay: boolean): string {
  if (!startsAt) return "";
  const fmt = (d: string) => new Date(d).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  const s = fmt(startsAt);
  const e = fmt(endsAt);
  return s === e ? s : `${s} – ${e}`;
}

function buildExpensesSnapshot(gastos: GastoRow[]): ExpensesSnapshot {
  const confirmed = gastos.filter((g) => g.estado === "CONFIRMADO");
  const currency = confirmed[0]?.moneda ?? "EUR";
  const total = confirmed.reduce((sum, g) => sum + g.total, 0);
  const catMap = new Map<string, { name: string; icon: string; color: string; total: number }>();
  for (const g of confirmed) {
    const key = g.categoria_nombre ?? "Otros";
    const existing = catMap.get(key);
    if (existing) {
      existing.total += g.total;
    } else {
      catMap.set(key, { name: key, icon: g.categoria_icono ?? "💰", color: g.categoria_color ?? "#6b7280", total: g.total });
    }
  }
  return { total, currency, byCategory: Array.from(catMap.values()) };
}

// ── Icons ──────────────────────────────────────────────────────────────────────

const CloseIcon = () => <CloseX />;
const CheckIcon = () => <CheckCircle className="size-[52px]" aria-hidden />;
const CheckSmall = () => <Check className="size-4" aria-hidden />;
const MapPinSmall = () => <MapPin className="size-3.5 shrink-0" aria-hidden />;
const CalSmall = () => <Calendar className="size-3.5 shrink-0" aria-hidden />;
const ChevronRight = () => <ChevronRightLucide className="size-4" aria-hidden />;
const SpinnerIcon = () => <Loader2 className="size-5 animate-spin" aria-hidden />;

// ── Toggle Row ─────────────────────────────────────────────────────────────────

function ToggleRow({
  icon,
  label,
  sublabel,
  enabled,
  onToggle,
  children,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 py-2.5 text-left"
      >
        <span className="text-[18px] leading-none">{icon}</span>
        <div className="flex-1 min-w-0">
          <span className="text-[14px] font-[600] text-app">{label}</span>
          {sublabel && <span className="ml-2 text-[13px] text-muted">{sublabel}</span>}
        </div>
        <div
          className="relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0"
          style={{ background: enabled ? "var(--primary)" : "var(--border-strong, var(--border))" }}
        >
          <div
            className="absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{ transform: enabled ? "translateX(16px)" : "translateX(2px)" }}
          />
        </div>
      </button>
      {enabled && children && (
        <div className="ml-[42px]">{children}</div>
      )}
    </div>
  );
}

// ── Sub-option Pills ───────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className="px-3 py-1 rounded-full text-[13px] font-[600] border transition-colors"
          style={
            value === opt.value
              ? { background: "var(--primary)", color: "white", borderColor: "var(--primary)" }
              : { background: "transparent", color: "var(--text-secondary)", borderColor: "var(--border)" }
          }
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PublishPlanModal({ plan, onClose }: Props) {
  const { isClosing, requestClose } = useModalCloseAnimation(onClose);
  const { user, profile } = useAuth();
  const router = useRouter();

  const [caption, setCaption] = useState("");
  const [step, setStep] = useState<"compose" | "sections" | "success">("compose");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section data
  const [dataLoading, setDataLoading] = useState(false);
  const [subplanes, setSubplanes] = useState<SubplanRow[]>([]);
  const [fotos, setFotos] = useState<PlanFotoDto[]>([]);
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [miembros, setMiembros] = useState<PlanMiembro[]>([]);

  // Section config
  const [showDescription, setShowDescription] = useState(!!plan.descripcion);
  const [showItinerary, setShowItinerary] = useState(true);
  const [showExpenses, setShowExpenses] = useState<false | "total" | "breakdown">(false);
  const [showParticipants, setShowParticipants] = useState<false | "count" | "avatars">("count");
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<number>>(new Set());

  const dateLabel = formatDateRange(plan.inicio_at, plan.fin_at, plan.all_day);
  const infoLine = [plan.ubicacion_nombre, dateLabel].filter(Boolean).join("  ·  ");

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (step === "success") {
      timerRef.current = setTimeout(() => requestClose(), 4000);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [requestClose, step]);

  // Load section data when entering step 2
  useEffect(() => {
    if (step !== "sections") return;
    setDataLoading(true);
    Promise.all([
      fetchSubplanes(plan.id),
      getPlanFotos({ planId: plan.id }),
      listGastosForPlanEndpoint(plan.id),
      fetchPlanMiembrosEndpoint(plan.id),
    ])
      .then(([subs, photos, gsts, mbs]) => {
        setSubplanes(subs);
        setFotos(photos);
        setGastos(gsts);
        setMiembros(mbs);
        // default: select all photos
        setSelectedPhotoIds(new Set(photos.map((f) => f.id)));
      })
      .catch((e) => console.error("[PublishPlanModal] data load error:", e))
      .finally(() => setDataLoading(false));
  }, [step, plan.id]);

  function togglePhoto(id: number) {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllPhotos() {
    if (selectedPhotoIds.size === fotos.length) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(fotos.map((f) => f.id)));
    }
  }

  async function handlePublish() {
    if (!user || !profile) return;
    setPublishing(true);
    setError(null);
    try {
      const config: PublicationConfig = {
        showDescription,
        showItinerary,
        showExpenses,
        showParticipants,
      };

      const itinerarySnapshot: ItinerarySnapshotItem[] | null = showItinerary && subplanes.length > 0
        ? subplanes.map((s) => ({
            id: s.id,
            titulo: s.titulo,
            tipo: s.tipo,
            inicio_at: s.inicio_at,
            fin_at: s.fin_at,
            all_day: s.all_day,
            ubicacion_nombre: s.ubicacion_nombre,
            ubicacion_fin_nombre: s.ubicacion_fin_nombre,
          }))
        : null;

      const selectedFotos = fotos.filter((f) => selectedPhotoIds.has(f.id));
      const photosSnapshot = selectedFotos.length > 0 ? selectedFotos.map((f) => ({ url: f.url })) : null;

      const expensesSnapshot: ExpensesSnapshot | null = showExpenses !== false && gastos.length > 0
        ? buildExpensesSnapshot(gastos)
        : null;

      const participantsSnapshot: ParticipantsSnapshot | null = showParticipants !== false && miembros.length > 0
        ? {
            count: miembros.length,
            avatars: miembros.slice(0, 8).map((m) => ({ name: m.nombre ?? "?", image: m.foto })),
          }
        : null;

      await publishPlanAsPost({
        id: plan.id,
        title: plan.titulo,
        description: plan.descripcion ?? "",
        locationName: plan.ubicacion_nombre ?? "",
        startsAt: plan.inicio_at,
        endsAt: plan.fin_at,
        allDay: plan.all_day,
        visibility: plan.visibilidad,
        coverImage: plan.foto_portada ?? null,
        ownerUserId: plan.owner_user_id,
        caption: caption.trim() || null,
        creator: { id: user.id, name: profile.nombre, profileImage: profile.profile_image },
        publicationConfig: config,
        itinerarySnapshot,
        photosSnapshot,
        expensesSnapshot,
        participantsSnapshot,
      });

      setStep("success");
    } catch (err) {
      console.error("[PublishPlanModal] publish error:", err);
      setError("No se pudo publicar. Inténtalo de nuevo.");
    } finally {
      setPublishing(false);
    }
  }

  const confirmedGastos = gastos.filter((g) => g.estado === "CONFIRMADO");
  const totalGastos = confirmedGastos.reduce((s, g) => s + g.total, 0);
  const currency = confirmedGastos[0]?.moneda ?? "EUR";

  return (
    <div
      data-closing={isClosing ? "true" : "false"}
      className="app-modal-overlay fixed inset-0 z-[90] flex items-end justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center"
      onClick={requestClose}
    >
      <div
        className="app-modal-panel relative w-full max-w-[460px] rounded-[22px] bg-app shadow-elev-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >

        {/* ── Step 1: Compose (caption) ── */}
        {step === "compose" && (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <span className="text-[15px] font-[700] text-app tracking-[-0.01em]">Publicar en el feed</span>
              <button onClick={requestClose} className="flex items-center justify-center size-8 rounded-full text-muted hover:text-app hover:bg-app-hover transition-colors">
                <CloseIcon />
              </button>
            </div>

            {/* Plan preview card */}
            <div className="mx-5 mb-4 rounded-[14px] border border-app overflow-hidden">
              {plan.foto_portada ? (
                <div className="relative w-full h-[160px]">
                  <Image src={plan.foto_portada} alt={plan.titulo} fill className="object-cover" sizes="460px" />
                  <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <p className="text-[14px] font-[700] text-white leading-tight line-clamp-1">{plan.titulo}</p>
                    {infoLine && <p className="mt-0.5 text-[13px] text-white/75 leading-tight">{infoLine}</p>}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3.5 bg-[var(--surface-raised)]">
                  <p className="text-[14px] font-[700] text-app leading-tight line-clamp-2">{plan.titulo}</p>
                  {infoLine && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {plan.ubicacion_nombre && (
                        <span className="flex items-center gap-1 text-[13px] text-muted"><MapPinSmall /> {plan.ubicacion_nombre}</span>
                      )}
                      {dateLabel && (
                        <span className="flex items-center gap-1 text-[13px] text-muted"><CalSmall /> {dateLabel}</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Caption */}
            <div className="relative mx-5 mb-1">
              <textarea
                ref={textareaRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
                placeholder="Escribe algo sobre este plan…"
                rows={3}
                className="w-full resize-none rounded-[12px] bg-[var(--surface-raised)] px-4 py-3 text-[14px] text-app placeholder:text-muted outline-none focus:ring-1 focus:ring-[var(--border-focus,var(--border))] transition-shadow"
              />
              {caption.length > 200 && (
                <span className={`absolute bottom-3 right-3 text-[13px] tabular-nums ${caption.length >= MAX_CAPTION ? "text-red-500" : "text-muted"}`}>
                  {MAX_CAPTION - caption.length}
                </span>
              )}
            </div>

            <div className="px-5 pt-3 pb-5">
              <button
                onClick={() => setStep("sections")}
                className="w-full h-11 rounded-full bg-primary-token text-white text-[14px] font-[700] tracking-[-0.01em] transition-opacity hover:opacity-90 active:opacity-80 flex items-center justify-center gap-1.5"
              >
                Siguiente <ChevronRight />
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Section selector ── */}
        {step === "sections" && (
          <>
            <div className="flex items-center justify-between px-5 pt-5 pb-1">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setStep("compose")}
                  className="flex items-center justify-center size-8 rounded-full text-muted hover:text-app hover:bg-app-hover transition-colors"
                >
                  <ChevronLeftLucide className="size-4" aria-hidden />
                </button>
                <span className="text-[15px] font-[700] text-app tracking-[-0.01em]">¿Qué quieres mostrar?</span>
              </div>
              <button onClick={requestClose} className="flex items-center justify-center size-8 rounded-full text-muted hover:text-app hover:bg-app-hover transition-colors">
                <CloseIcon />
              </button>
            </div>

            <p className="px-5 pb-3 text-[13px] text-muted">Elige qué verán los demás al abrir tu plan publicado.</p>

            {dataLoading ? (
              <div className="flex items-center justify-center py-10 text-muted">
                <SpinnerIcon />
              </div>
            ) : (
              <div className="px-5 pb-2 space-y-1 max-h-[55vh] overflow-y-auto">

                {/* Descripción */}
                {plan.descripcion && (
                  <ToggleRow
                    icon="📝"
                    label="Descripción"
                    enabled={showDescription}
                    onToggle={() => setShowDescription((v) => !v)}
                  />
                )}

                {/* Itinerario */}
                <ToggleRow
                  icon="🗓️"
                  label="Itinerario"
                  sublabel={subplanes.length > 0 ? `${subplanes.length} actividades` : undefined}
                  enabled={showItinerary}
                  onToggle={() => setShowItinerary((v) => !v)}
                />

                {/* Fotos */}
                <ToggleRow
                  icon="📸"
                  label="Fotos del álbum"
                  sublabel={fotos.length > 0 ? `${selectedPhotoIds.size} / ${fotos.length} seleccionadas` : "Sin fotos aún"}
                  enabled={selectedPhotoIds.size > 0}
                  onToggle={toggleAllPhotos}
                >
                  {fotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 pb-1">
                      {fotos.map((foto) => {
                        const selected = selectedPhotoIds.has(foto.id);
                        return (
                          <button
                            key={foto.id}
                            type="button"
                            onClick={() => togglePhoto(foto.id)}
                            className="relative aspect-square rounded-[8px] overflow-hidden border-2 transition-all"
                            style={{ borderColor: selected ? "var(--primary)" : "transparent" }}
                          >
                            <Image src={foto.url} alt="" fill className="object-cover" sizes="80px" />
                            {selected && (
                              <div className="absolute inset-0 bg-black/20 flex items-end justify-end p-1">
                                <div className="size-5 rounded-full flex items-center justify-center text-white" style={{ background: "var(--primary)" }}>
                                  <CheckSmall />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </ToggleRow>

                {/* Gastos */}
                {gastos.filter((g) => g.estado === "CONFIRMADO").length > 0 && (
                  <ToggleRow
                    icon="💸"
                    label="Gastos del viaje"
                    sublabel={showExpenses !== false ? `${currency} ${totalGastos.toFixed(0)} total` : undefined}
                    enabled={showExpenses !== false}
                    onToggle={() => setShowExpenses((v) => (v === false ? "total" : false))}
                  >
                    <PillGroup
                      options={[
                        { value: "total" as const, label: "Solo total" },
                        { value: "breakdown" as const, label: "Con desglose" },
                      ]}
                      value={showExpenses as "total" | "breakdown"}
                      onChange={(v) => setShowExpenses(v)}
                    />
                  </ToggleRow>
                )}

                {/* Participantes */}
                {miembros.length > 0 && (
                  <ToggleRow
                    icon="👥"
                    label="Quiénes van"
                    sublabel={miembros.length === 1 ? "1 persona" : `${miembros.length} personas`}
                    enabled={showParticipants !== false}
                    onToggle={() => setShowParticipants((v) => (v === false ? "count" : false))}
                  >
                    <PillGroup
                      options={[
                        { value: "count" as const, label: "Solo número" },
                        { value: "avatars" as const, label: "Con fotos" },
                      ]}
                      value={showParticipants as "count" | "avatars"}
                      onChange={(v) => setShowParticipants(v)}
                    />
                  </ToggleRow>
                )}
              </div>
            )}

            {error && (
              <ModalFeedback
                state={{ type: "error", message: error }}
                onSuccess={() => {}}
                onDismissError={() => setError(null)}
              />
            )}

            <div className="px-5 pt-3 pb-5">
              <button
                onClick={() => void handlePublish()}
                disabled={publishing || dataLoading}
                className="w-full h-11 rounded-full bg-primary-token text-white text-[14px] font-[700] tracking-[-0.01em] transition-opacity disabled:opacity-60 hover:opacity-90 active:opacity-80 flex items-center justify-center gap-2"
              >
                {publishing ? <><SpinnerIcon /> Publicando…</> : "Publicar"}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Success ── */}
        {step === "success" && (
          <div className="flex flex-col items-center px-8 py-10 gap-4 publish-success">
            <div className="text-[var(--color-success,#22c55e)] animate-publish-check">
              <CheckIcon />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-[800] text-app tracking-[-0.02em]">¡Plan publicado!</p>
              <p className="mt-1 text-[14px] text-muted">Ya aparece en el feed para todos.</p>
            </div>
            <button
              onClick={() => router.push("/feed")}
              className="mt-2 h-10 px-6 rounded-full bg-primary-token text-white text-[14px] font-[700] transition-opacity hover:opacity-90"
            >
              Ver en el feed
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes publish-check-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          60%  { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        .animate-publish-check {
          animation: publish-check-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
      `}</style>
    </div>
  );
}
