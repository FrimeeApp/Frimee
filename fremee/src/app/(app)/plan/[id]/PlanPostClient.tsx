"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { getPostByPlanId, type PostDoc } from "@/services/api/posts/get-post";
import type { ItinerarySnapshotItem } from "@/services/api/dtos/plan.dto";

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

// ── Icons ──────────────────────────────────────────────────────────────────────

function ArrowLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-5">
      <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
      <path d="M10 2C7.24 2 5 4.24 5 7C5 11 10 18 10 18C10 18 15 11 15 7C15 4.24 12.76 2 10 2Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="7" r="2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
      <rect x="3" y="4" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 3V5M13 3V5M3 9H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="size-4 shrink-0">
      <circle cx="8" cy="7" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 17C2 14.24 4.69 12 8 12C11.31 12 14 14.24 14 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14 7C15.66 7 17 8.12 17 9.5C17 10.88 15.66 12 14 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 17C16 15.34 15.1 13.88 13.7 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ── Section components ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className="text-[11px] font-[700] tracking-[0.12em] uppercase text-muted">{children}</span>
      <div className="flex-1 h-px bg-[var(--border)]" />
    </div>
  );
}

function ItinerarySection({ items }: { items: ItinerarySnapshotItem[] }) {
  const days = groupByDay(items);
  return (
    <div>
      <SectionLabel>Itinerario</SectionLabel>
      <div className="space-y-5">
        {days.map(({ day, items: dayItems }) => (
          <div key={day}>
            <p className="text-[12px] font-[700] text-muted uppercase tracking-[0.08em] mb-3 capitalize">{day}</p>
            <div className="relative pl-6">
              {/* timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--border)]" />
              <div className="space-y-3">
                {dayItems.map((item) => (
                  <div key={item.id} className="relative">
                    {/* dot */}
                    <div
                      className="absolute -left-6 top-1 size-3.5 rounded-full border-2 border-[var(--border)] flex items-center justify-center text-[8px]"
                      style={{ background: "var(--bg)" }}
                    >
                      {getActivityEmoji(item.tipo)}
                    </div>
                    <div className="rounded-[10px] border border-[var(--border)] px-3 py-2.5 bg-[var(--surface)]">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-[600] text-app leading-snug">{item.titulo}</p>
                        {!item.all_day && (
                          <span className="text-[12px] text-muted shrink-0 mt-0.5 tabular-nums">
                            {formatShortDate(item.inicio_at, item.all_day)}
                          </span>
                        )}
                      </div>
                      {item.ubicacion_nombre && (
                        <p className="mt-1 text-[12px] text-muted flex items-center gap-1">
                          <MapPinIcon />
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

function PhotosSection({ photos }: { photos: { url: string }[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Build a masonry-ish layout: alternate big/small
  const sizes = photos.map((_, i) => {
    if (photos.length === 1) return "full";
    if (photos.length === 2) return "half";
    const pattern = [2, 1, 1, 2, 1, 1]; // 2-wide, 1-wide alternating
    return pattern[i % pattern.length] === 2 ? "big" : "small";
  });

  return (
    <div>
      <SectionLabel>Fotos</SectionLabel>
      <div className="grid grid-cols-3 gap-1.5 rounded-[12px] overflow-hidden">
        {photos.map((photo, i) => {
          const size = sizes[i];
          return (
            <button
              key={i}
              type="button"
              onClick={() => setLightbox(photo.url)}
              className={`relative overflow-hidden rounded-[6px] ${
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
                sizes="(max-width: 460px) 50vw, 200px"
              />
            </button>
          );
        })}
      </div>

      {/* Lightbox */}
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

function ExpensesSection({ snapshot, mode }: { snapshot: { total: number; currency: string; byCategory: { name: string; icon: string; color: string; total: number }[] }; mode: "total" | "breakdown" }) {
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
                <span className="text-[16px]">{cat.icon}</span>
                <span className="flex-1 text-[13px] text-app">{cat.name}</span>
                <span className="text-[14px] font-[600] text-app tabular-nums">
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

function ParticipantsSection({ snapshot, mode }: { snapshot: { count: number; avatars: { name: string; image: string | null }[] }; mode: "count" | "avatars" }) {
  return (
    <div>
      <SectionLabel>Quiénes van</SectionLabel>
      {mode === "count" ? (
        <div className="flex items-center gap-2 text-[15px] text-app">
          <UsersIcon />
          <span className="font-[600]">{snapshot.count} {snapshot.count === 1 ? "persona" : "personas"}</span>
        </div>
      ) : (
        <div className="flex items-center flex-wrap gap-2">
          {snapshot.avatars.map((av, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="size-10 rounded-full overflow-hidden flex items-center justify-center text-[14px] font-[700] text-white"
                style={{ background: `hsl(${(i * 47 + 180) % 360} 50% 45%)` }}
              >
                {av.image ? (
                  <Image src={av.image} alt={av.name} width={40} height={40} className="object-cover w-full h-full" />
                ) : (
                  initials(av.name)
                )}
              </div>
              <span className="text-[11px] text-muted max-w-[48px] truncate text-center">{av.name.split(" ")[0]}</span>
            </div>
          ))}
          {snapshot.count > snapshot.avatars.length && (
            <div className="flex flex-col items-center gap-1">
              <div className="size-10 rounded-full bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center text-[12px] font-[700] text-muted">
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

function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className ?? ""}`} style={style} />;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function PlanPostClient() {
  const params = useParams();
  const router = useRouter();
  const planId = Number(params.id);

  const [post, setPost] = useState<PostDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!planId) return;
    getPostByPlanId(planId)
      .then((p) => {
        if (!p) setNotFound(true);
        else setPost(p);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [planId]);

  if (!loading && notFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "var(--bg)" }}>
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
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative h-[70svh] min-h-[400px] overflow-hidden bg-[#0d0d0d]">
        {/* Cover image */}
        {loading ? (
          <div className="absolute inset-0 bg-white/5 animate-pulse" />
        ) : post?.coverImage ? (
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover opacity-80"
            sizes="100vw"
            priority
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(135deg, #1a2d2b 0%, #0d1f1d 50%, #091715 100%)" }}
          />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent" />

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            onClick={() => router.back()}
            className="size-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <ArrowLeft />
          </button>
        </div>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-16">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : post ? (
            <>
              {/* Creator */}
              {post.creator && (
                <div className="flex items-center gap-2 mb-3">
                  <Link href={`/profile/${post.creator.id}`} className="flex items-center gap-2 group">
                    <div
                      className="size-7 rounded-full overflow-hidden border border-white/20 flex items-center justify-center text-[10px] font-[700] text-white shrink-0"
                      style={{ background: "rgba(255,255,255,0.15)" }}
                    >
                      {post.creator.profileImage ? (
                        <Image src={post.creator.profileImage} alt={post.creator.name} width={28} height={28} className="object-cover w-full h-full" />
                      ) : (
                        initials(post.creator.name)
                      )}
                    </div>
                    <span className="text-[13px] font-[600] text-white/90 group-hover:text-white transition-colors">
                      {post.creator.name}
                    </span>
                  </Link>
                </div>
              )}

              {/* Title */}
              <h1
                className="text-[28px] sm:text-[34px] font-[800] text-white leading-[1.1] tracking-[-0.02em] mb-3"
                style={{ fontFamily: "var(--font-display, Georgia, serif)", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}
              >
                {post.title}
              </h1>

              {/* Meta pills */}
              <div className="flex flex-wrap gap-2">
                {post.locationName && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-[13px] text-white/90">
                    <MapPinIcon />
                    {post.locationName}
                  </div>
                )}
                {dateLabel && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/10 text-[13px] text-white/90">
                    <CalendarIcon />
                    {nights > 0 ? `${nights}n · ${dateLabel}` : dateLabel}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-8 max-w-[560px] mx-auto">

        {/* Caption */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full rounded" style={{ background: "var(--border)" }} />
            <Skeleton className="h-4 w-4/5 rounded" style={{ background: "var(--border)" }} />
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

        {/* Footer: published date */}
        {!loading && post?.publishedAt && (
          <p className="text-[12px] text-muted text-center pt-2">
            Publicado el {new Date(post.publishedAt.seconds * 1000).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
          </p>
        )}
      </div>
    </div>
  );
}
