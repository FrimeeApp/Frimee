"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPostByPlanId, type PostDoc } from "@/services/api/posts/get-post";
import type { ItinerarySnapshotItem } from "@/services/api/dtos/plan.dto";
import { ArrowLeft, MapPin, Calendar, Users } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDateRange(startsAt: string, endsAt: string, allDay: boolean): string {
  if (!startsAt) return "";
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { day: "numeric", month: "long", year: "numeric" }
    : { day: "numeric", month: "long", year: "numeric" };
  const s = new Date(startsAt).toLocaleDateString("es-ES", opts);
  const e = new Date(endsAt).toLocaleDateString("es-ES", opts);
  return s === e ? s : `${s} — ${e}`;
}

function formatShortDate(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (allDay) return d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
  return d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function countNights(startsAt: string, endsAt: string): number {
  const diff = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(1, Math.round(diff / 86400000));
}

function groupByDay(items: ItinerarySnapshotItem[]): { day: string; items: ItinerarySnapshotItem[] }[] {
  const map = new Map<string, ItinerarySnapshotItem[]>();
  for (const item of [...items].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at))) {
    const day = new Date(item.inicio_at).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return Array.from(map.entries()).map(([day, items]) => ({ day, items }));
}

function getActivityEmoji(tipo: string): string {
  const map: Record<string, string> = {
    VUELO: "✈️", BARCO: "🚢", TREN: "🚆", BUS: "🚌", COCHE: "🚗",
    HOTEL: "🏨", RESTAURANTE: "🍽️", ACTIVIDAD: "🎯", OTRO: "📌",
  };
  return map[tipo] ?? "📌";
}

function initials(name: string): string {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="size-1.5 rounded-full bg-[var(--primary)] shrink-0" />
      <span className="text-[11px] font-[700] tracking-[0.12em] uppercase text-muted">{children}</span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

// ── Itinerary ──────────────────────────────────────────────────────────────────

function ItinerarySection({ items }: { items: ItinerarySnapshotItem[] }) {
  const days = groupByDay(items);
  return (
    <div>
      <SectionLabel>Itinerario</SectionLabel>
      <div className="space-y-6">
        {days.map(({ day, items: dayItems }) => (
          <div key={day}>
            <p className="text-[11px] font-[700] text-muted uppercase tracking-[0.1em] mb-3 capitalize">{day}</p>
            <div className="relative pl-5">
              <div className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--border)]" />
              <div className="space-y-2.5">
                {dayItems.map((item) => (
                  <div key={item.id} className="relative">
                    <div
                      className="absolute -left-5 top-[9px] size-2.5 rounded-full border-2 border-[var(--primary)]/40 bg-[var(--bg)] flex items-center justify-center"
                    />
                    <div className="rounded-[12px] border border-[var(--border)] px-3.5 py-2.5 bg-[var(--surface)]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] shrink-0">{getActivityEmoji(item.tipo)}</span>
                          <p className="text-[13px] font-[600] text-app leading-snug truncate">{item.titulo}</p>
                        </div>
                        {!item.all_day && (
                          <span className="text-[11px] text-muted shrink-0 mt-0.5 tabular-nums">
                            {formatShortDate(item.inicio_at, item.all_day)}
                          </span>
                        )}
                      </div>
                      {item.ubicacion_nombre && (
                        <p className="mt-1.5 text-[11px] text-muted flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">
                            {item.ubicacion_fin_nombre
                              ? `${item.ubicacion_nombre} → ${item.ubicacion_fin_nombre}`
                              : item.ubicacion_nombre}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Photos ─────────────────────────────────────────────────────────────────────

function PhotosSection({ photos }: { photos: { url: string }[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const sizes = photos.map((_, i) => {
    if (photos.length === 1) return "full";
    if (photos.length === 2) return "half";
    const pattern = [2, 1, 1, 2, 1, 1];
    return pattern[i % pattern.length] === 2 ? "big" : "small";
  });

  return (
    <div>
      <SectionLabel>Fotos</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5 rounded-[14px] overflow-hidden">
        {photos.map((photo, i) => {
          const size = sizes[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(photo.url)}
              className={`relative overflow-hidden rounded-[8px] ${
                size === "full" ? "col-span-3 aspect-video" :
                size === "half" ? "col-span-3 sm:col-span-1 aspect-video" :
                size === "big" ? "col-span-2 aspect-[4/3]" :
                "col-span-1 aspect-square"
              }`}
            >
              <Image
                src={photo.url}
                alt=""
                fill
                className="object-cover hover:scale-105 transition-transform duration-500"
                sizes={
                  size === "full"  ? "(max-width: 720px) calc(100vw - 2rem), 688px" :
                  size === "big"   ? "(max-width: 720px) calc((100vw - 2rem) * 0.66), 450px" :
                  size === "half"  ? "(max-width: 640px) calc(100vw - 2rem), 220px" :
                                     "(max-width: 720px) calc((100vw - 2rem) * 0.33), 220px"
                }
              />
            </button>
          );
        })}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-full max-h-full w-full aspect-square sm:w-auto sm:aspect-auto sm:max-w-2xl">
            <Image src={lightbox} alt="" fill className="object-contain" sizes="100vw" />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Expenses ───────────────────────────────────────────────────────────────────

function ExpensesSection({ snapshot, mode }: {
  snapshot: { total: number; currency: string; byCategory: { name: string; icon: string; color: string; total: number }[] };
  mode: "total" | "breakdown";
}) {
  const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div>
      <SectionLabel>Gastos del viaje</SectionLabel>
      <div className="rounded-[14px] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3.5 flex items-center justify-between bg-[var(--surface)]">
          <span className="text-[13px] text-muted font-[500]">Total del viaje</span>
          <span className="text-[20px] font-[800] text-app tracking-tight">
            {snapshot.currency} {fmt(snapshot.total)}
          </span>
        </div>
        {mode === "breakdown" && snapshot.byCategory.length > 0 && (
          <div className="divide-y divide-[var(--border)]">
            {snapshot.byCategory.map((cat) => (
              <div key={cat.name} className="px-4 py-2.5 flex items-center gap-3">
                <span className="text-[15px]">{cat.icon}</span>
                <span className="flex-1 text-[13px] text-app">{cat.name}</span>
                <span className="text-[13px] font-[600] text-app tabular-nums">
                  {snapshot.currency} {fmt(cat.total)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Participants ───────────────────────────────────────────────────────────────

function ParticipantsSection({ snapshot, mode }: {
  snapshot: { count: number; avatars: { name: string; image: string | null }[] };
  mode: "count" | "avatars";
}) {
  return (
    <div>
      <SectionLabel>Quiénes van</SectionLabel>
      {mode === "count" ? (
        <div className="flex items-center gap-2 text-[15px] text-app">
          <Users className="size-4 shrink-0" />
          <span className="font-[600]">{snapshot.count} {snapshot.count === 1 ? "persona" : "personas"}</span>
        </div>
      ) : (
        <div className="flex items-center flex-wrap gap-3">
          {snapshot.avatars.map((av, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <div
                className="size-10 rounded-full overflow-hidden flex items-center justify-center text-[13px] font-[700] text-white ring-2 ring-[var(--border)]"
                style={{ background: `hsl(${(i * 47 + 180) % 360} 50% 45%)` }}
              >
                {av.image ? (
                  <Image src={av.image} alt={av.name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  initials(av.name)
                )}
              </div>
              <span className="text-[11px] text-muted max-w-[48px] truncate text-center">{av.name?.split(" ")[0]}</span>
            </div>
          ))}
          {snapshot.count > snapshot.avatars.length && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="size-10 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[12px] font-[700] text-muted ring-2 ring-[var(--border)]">
                +{snapshot.count - snapshot.avatars.length}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className ?? ""}`} />;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function PlanPostClient() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;
  const [planId, setPlanId] = useState<number>(() => {
    if (rawId === "static") {
      const q = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("id") : null;
      return Number(q ?? 0);
    }
    return Number(rawId);
  });

  useEffect(() => {
    if (rawId === "static") {
      const q = new URLSearchParams(window.location.search).get("id");
      setPlanId(Number(q ?? 0));
    } else {
      setPlanId(Number(rawId));
    }
  }, [rawId]);

  const [post, setPost] = useState<PostDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!planId) return;
    getPostByPlanId(planId)
      .then((p) => { if (!p) setNotFound(true); else setPost(p); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [planId]);

  if (!loading && notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center bg-[var(--bg)]">
        <p className="text-[40px]">🗺️</p>
        <p className="text-[18px] font-[700] text-app">Plan no encontrado</p>
        <p className="text-[14px] text-muted">Este plan no está disponible o no se ha publicado.</p>
        <button onClick={() => router.back()} className="mt-2 h-10 px-5 rounded-full text-[14px] font-[600] border border-[var(--border)] text-app hover:bg-[var(--surface-2)] transition-colors">
          Volver
        </button>
      </div>
    );
  }

  const config = post?.publicationConfig ?? null;
  const nights = post ? countNights(post.startsAt, post.endsAt) : 0;
  const dateLabel = post ? formatDateRange(post.startsAt, post.endsAt, post.allDay) : "";

  return (
    <div className="min-h-screen bg-[var(--bg)] pb-[max(2.5rem,env(safe-area-inset-bottom))]">

      {/* ── Top bar ────────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[var(--bg)]/80 backdrop-blur-md">
        <div className="max-w-[720px] mx-auto flex items-center gap-3 px-4 md:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button
            onClick={() => router.back()}
            className="size-9 rounded-full border border-[var(--border)] bg-[var(--surface)] flex items-center justify-center text-app hover:bg-[var(--surface-2)] transition-colors shrink-0"
          >
            <ArrowLeft className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Centered column ─────────────────────────────────────────────────────── */}
      <div className="max-w-[720px] mx-auto px-4 md:px-8">

      {/* ── Cover image ────────────────────────────────────────────────────────── */}
      <div>
        <div className="relative w-full aspect-[4/3] rounded-[20px] overflow-hidden bg-[var(--surface-2)] shadow-elev-2">
          {loading ? (
            <div className="absolute inset-0 skeleton-shimmer" />
          ) : post?.coverImage ? (
            <>
              <Image
                src={post.coverImage}
                alt={post.title ?? ""}
                fill
                className="object-cover"
                sizes="(max-width: 720px) calc(100vw - 2rem), 688px"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            </>
          ) : (
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a2d2b 0%, #0d1f1d 100%)" }} />
          )}

          {/* Nights badge */}
          {!loading && post && nights > 0 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-[12px] font-[600]">
              {nights} {nights === 1 ? "noche" : "noches"}
            </div>
          )}
        </div>
      </div>

      {/* ── Meta block ─────────────────────────────────────────────────────────── */}
      <div className="pt-4">

        {/* Creator */}
        {loading ? (
          <Shimmer className="h-5 w-32 mb-3" />
        ) : post?.creator ? (
          <Link href={`/profile/${post.creator.id}`} className="inline-flex items-center gap-2 mb-3 group">
            <div
              className="size-6 rounded-full overflow-hidden border border-[var(--border)] flex items-center justify-center text-[9px] font-[700] text-white shrink-0"
              style={{ background: "var(--surface-2)" }}
            >
              {post.creator.profileImage ? (
                <Image src={post.creator.profileImage} alt={post.creator.name} width={24} height={24} className="object-cover w-full h-full" />
              ) : (
                initials(post.creator.name)
              )}
            </div>
            <span className="text-[13px] text-muted group-hover:text-app transition-colors">{post.creator.name}</span>
          </Link>
        ) : null}

        {/* Title */}
        {loading ? (
          <div className="space-y-2 mb-4">
            <Shimmer className="h-7 w-3/4" />
            <Shimmer className="h-5 w-1/2" />
          </div>
        ) : post ? (
          <h1 className="text-[26px] font-[800] text-app leading-[1.15] tracking-[-0.02em] mb-4">
            {post.title}
          </h1>
        ) : null}

        {/* Meta chips */}
        {!loading && post && (
          <div className="flex flex-wrap gap-2 mb-5">
            {post.locationName && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[12px] text-app font-[500]">
                <MapPin className="size-3 text-muted shrink-0" />
                {post.locationName}
              </div>
            )}
            {dateLabel && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[12px] text-app font-[500]">
                <Calendar className="size-3 text-muted shrink-0" />
                {dateLabel}
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        {!loading && post && <div className="h-px bg-[var(--border)] mb-6" />}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────────── */}
      <div className="space-y-8">

        {/* Caption */}
        {loading ? (
          <div className="space-y-2">
            <Shimmer className="h-4 w-full" />
            <Shimmer className="h-4 w-4/5" />
          </div>
        ) : post?.caption ? (
          <p className="text-[15px] text-app leading-relaxed">{post.caption}</p>
        ) : null}

        {/* Description */}
        {!loading && post && config?.showDescription && post.description && (
          <div>
            <SectionLabel>Descripción</SectionLabel>
            <p className="text-[14px] text-app leading-relaxed whitespace-pre-line">{post.description}</p>
          </div>
        )}

        {/* Itinerary */}
        {!loading && post && (config?.showItinerary ?? true) && post.itinerarySnapshot && post.itinerarySnapshot.length > 0 && (
          <ItinerarySection items={post.itinerarySnapshot} />
        )}

        {/* Photos */}
        {!loading && post?.photosSnapshot && post.photosSnapshot.length > 0 && (
          <PhotosSection photos={post.photosSnapshot} />
        )}

        {/* Expenses */}
        {!loading && post && post.expensesSnapshot && config?.showExpenses && (
          <ExpensesSection snapshot={post.expensesSnapshot} mode={config.showExpenses} />
        )}

        {/* Participants */}
        {!loading && post && post.participantsSnapshot && config?.showParticipants && (
          <ParticipantsSection snapshot={post.participantsSnapshot} mode={config.showParticipants} />
        )}

        {/* Published date */}
        {!loading && post?.publishedAt && (
          <p className="text-[12px] text-muted text-center pt-2">
            Publicado el {new Date(post.publishedAt.seconds * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
      </div>

      </div>{/* end centered column */}
    </div>
  );
}
