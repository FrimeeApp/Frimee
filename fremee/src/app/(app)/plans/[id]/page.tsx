"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";

/* ───────────── mock data ───────────── */

const MOCK_TRIP = {
  id: 1,
  title: "Escapada a Santorini",
  coverImage: "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&q=80",
  startDate: "2024-09-14",
  endDate: "2024-09-21",
  location: "Greece",
};

const MOCK_DAYS = [
  {
    day: 1,
    label: "Arrival",
    date: "SEPT 14, 2024",
    activities: [
      {
        time: "08:30 AM",
        title: "Vuelo a Santorini",
        subtitle: "MAD (T4) → JTR Airport",
        badge: { text: "CONFIRMED", color: "green" as const },
        icon: "plane",
      },
      {
        time: "02:00 PM",
        title: "Check-in Hotel",
        subtitle: "Katikies Garden Santorini, Fira",
        badge: { text: "RESERVATION #9301", color: "gray" as const },
        icon: "hotel",
      },
      {
        time: "08:00 PM",
        title: "Cena Atardecer",
        subtitle: "Ammoudi Fish Tavern, Oia",
        icon: "food",
      },
    ],
  },
  {
    day: 2,
    label: "Exploring Oia",
    date: "SEPT 15, 2024",
    activities: [
      {
        time: "09:00 AM",
        title: "Desayuno en el hotel",
        subtitle: "Katikies Garden Santorini",
        icon: "food",
      },
      {
        time: "11:00 AM",
        title: "Paseo por Oia",
        subtitle: "Calles y cúpulas azules",
        icon: "walk",
      },
      {
        time: "01:30 PM",
        title: "Almuerzo en Ammoudi Bay",
        subtitle: "Sunset Tavern",
        icon: "food",
      },
      {
        time: "05:00 PM",
        title: "Catamaran Tour",
        subtitle: "Sailing Santorini, puerto de Fira",
        badge: { text: "BOOKED", color: "green" as const },
        icon: "boat",
      },
    ],
  },
];

const MOCK_EXPENSES = {
  total: 1250.0,
  categories: [
    { name: "Vuelos", detail: "Lufthansa Airlines", amount: 420.0, status: "PAID" as const, icon: "plane" },
    { name: "Hotel", detail: "Katikies Garden", amount: 680.0, status: "PENDING" as const, icon: "hotel" },
    { name: "Excursiones", detail: "Catamaran Tour", amount: 150.0, status: "PAID" as const, icon: "boat" },
  ],
};

type Tab = "itinerario" | "mapa" | "gastos";

/* ───────────── icons ───────────── */

function BackIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 19L8 12L15 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M4 12V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 6L12 2L8 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2V15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M16.474 5.408L18.592 7.526M17.836 3.186L12.109 8.913C11.81 9.212 11.601 9.589 11.506 10.002L11 12L12.998 11.494C13.411 11.399 13.788 11.19 14.087 10.891L19.814 5.164C20.395 4.583 20.395 3.767 19.814 3.186C19.233 2.605 18.417 2.605 17.836 3.186Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 15V19C19 20.1046 18.1046 21 17 21H5C3.89543 21 3 20.1046 3 19V7C3 5.89543 3.89543 5 5 5H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlaneIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 16L22 2M22 2L17 22L13 13L22 2ZM22 2L2 7L11 11" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function HotelIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M3 21V7L12 3L21 7V21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 21V15H15V21" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 11H10M14 11H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FoodIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M18 8C18 4.69 15.31 2 12 2C8.69 2 6 4.69 6 8C6 10.22 7.21 12.16 9 13.2V22H15V13.2C16.79 12.16 18 10.22 18 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 8V2" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BoatIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M2 20C4 18 6 17 8 17C10 17 12 19 14 19C16 19 18 18 22 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 4V15M12 4L8 8M12 4L16 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 15L12 15L18 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WalkIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 22L11 16L9 14V10L12 7L15 10V14L13 16L14 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MapPinIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function ExpandIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 3H21V9M9 21H3V15M21 3L14 10M3 21L10 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarSmallIcon({ className = "size-icon" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 3V7M16 3V7M3 10H21" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const ACTIVITY_ICONS: Record<string, React.FC<{ className?: string }>> = {
  plane: PlaneIcon,
  hotel: HotelIcon,
  food: FoodIcon,
  boat: BoatIcon,
  walk: WalkIcon,
};

/* ───────────── page ───────────── */

export default function PlanDetailPage() {
  const { loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("itinerario");

  if (loading) return <LoadingScreen />;

  const trip = MOCK_TRIP;
  const formatDateRange = () => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    return `${start.getDate()} – ${end.getDate()} Sept`;
  };

  return (
    <div className="min-h-dvh bg-app text-app">
      <div className="relative mx-auto min-h-dvh max-w-[1440px]">
        <AppSidebar />

        <main className="pb-[calc(var(--space-20)+env(safe-area-inset-bottom))] transition-[padding] duration-[var(--duration-slow)] [transition-timing-function:var(--ease-standard)] md:py-0 md:pr-[var(--space-14)] md:pl-[102px]">

          {/* ─── Hero ─── */}
          <div className="relative w-full overflow-hidden md:ml-0 md:rounded-b-[20px]" style={{ height: "clamp(260px, 40vh, 380px)" }}>
            <img
              src={trip.coverImage}
              alt={trip.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            {/* Back button */}
            <button
              onClick={() => router.back()}
              className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] md:top-[var(--space-6)] flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <BackIcon className="size-[20px]" />
            </button>

            {/* Badge */}
            <div className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-16))] md:top-[var(--space-20)]">
              <span className="rounded-chip bg-primary-token px-[var(--space-3)] py-[3px] text-caption font-[var(--fw-semibold)] uppercase tracking-wide text-contrast-token">
                Upcoming Trip
              </span>
            </div>

            {/* Title & meta */}
            <div className="absolute bottom-0 left-0 right-0 px-[var(--page-margin-x)] pb-[var(--space-6)]">
              <h1 className="text-[clamp(24px,5vw,36px)] font-[var(--fw-bold)] leading-[1.1] tracking-[-0.02em] text-white">
                {trip.title}
              </h1>
              <div className="mt-[var(--space-2)] flex flex-wrap items-center gap-[var(--space-3)] text-white/85">
                <span className="flex items-center gap-[5px] text-body-sm">
                  <CalendarSmallIcon className="size-[14px]" />
                  {formatDateRange()}
                </span>
                <span className="flex items-center gap-[5px] text-body-sm">
                  <MapPinIcon className="size-[14px]" />
                  {trip.location}
                </span>
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-[var(--space-6)] right-[var(--page-margin-x)] flex gap-[var(--space-2)]">
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <ShareIcon className="size-[18px]" />
                </button>
                <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                  <EditIcon className="size-[18px]" />
                </button>
              </div>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="border-b border-app px-[var(--page-margin-x)]">
            <div className="flex gap-[var(--space-8)]">
              {(["itinerario", "mapa", "gastos"] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative py-[var(--space-4)] text-body-sm font-[var(--fw-medium)] capitalize transition-colors ${
                    activeTab === tab
                      ? "text-app"
                      : "text-muted hover:text-app"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {activeTab === tab && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary-token" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Content ─── */}
          <div className="px-[var(--page-margin-x)] pt-[var(--space-8)]">

            {activeTab === "itinerario" && (
              <div className="flex flex-col gap-[var(--space-8)] lg:flex-row lg:gap-[var(--space-12)]">

                {/* Left column — itinerary */}
                <div className="flex-1 min-w-0">
                  {MOCK_DAYS.map((day) => (
                    <div key={day.day} className="mb-[var(--space-10)]">
                      {/* Day header */}
                      <div className="flex items-baseline justify-between mb-[var(--space-6)]">
                        <h2 className="text-[var(--font-h3)] font-[var(--fw-bold)] leading-[var(--lh-h3)]">
                          Day {day.day}: {day.label}
                        </h2>
                        <span className="text-caption font-[var(--fw-medium)] uppercase tracking-wider text-muted">
                          {day.date}
                        </span>
                      </div>

                      {/* Activities timeline */}
                      <div className="relative">
                        {day.activities.map((activity, idx) => {
                          const Icon = ACTIVITY_ICONS[activity.icon] || MapPinIcon;
                          const isLast = idx === day.activities.length - 1;
                          return (
                            <div key={idx} className="relative flex gap-[var(--space-4)] pb-[var(--space-8)]">
                              {/* Timeline line */}
                              {!isLast && (
                                <div className="absolute left-[11px] top-[28px] bottom-0 w-[1.5px] bg-[var(--border)]" />
                              )}

                              {/* Timeline dot */}
                              <div className="relative z-10 flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-full border-[2px] border-[var(--primary)] bg-app">
                                <div className="h-[8px] w-[8px] rounded-full bg-primary-token" />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0 -mt-[2px]">
                                <div className="flex flex-wrap items-center gap-[var(--space-2)]">
                                  <span className="text-body-sm font-[var(--fw-semibold)] text-primary-token">
                                    {activity.time}
                                  </span>
                                  {activity.badge && (
                                    <span
                                      className={`rounded-chip px-[var(--space-2)] py-[1px] text-[10px] font-[var(--fw-semibold)] uppercase tracking-wider ${
                                        activity.badge.color === "green"
                                          ? "bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-success-token"
                                          : "bg-[var(--surface-2)] text-muted"
                                      }`}
                                    >
                                      {activity.badge.text}
                                    </span>
                                  )}
                                </div>
                                <h4 className="mt-[2px] text-body font-[var(--fw-semibold)]">
                                  {activity.title}
                                </h4>
                                <p className="mt-[1px] flex items-center gap-[4px] text-body-sm text-muted">
                                  <MapPinIcon className="size-[13px] shrink-0" />
                                  {activity.subtitle}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Right column — route map + expenses (hidden on mobile where bottom nav is) */}
                <div className="hidden lg:block lg:w-[340px] lg:shrink-0">

                  {/* Route map card */}
                  <div className="mb-[var(--space-8)]">
                    <div className="flex items-center justify-between mb-[var(--space-3)]">
                      <h3 className="text-body font-[var(--fw-semibold)]">Ruta del Día</h3>
                      <button className="flex items-center gap-[4px] text-caption font-[var(--fw-medium)] text-muted hover:text-app transition-colors">
                        EXPAND
                        <ExpandIcon className="size-[14px]" />
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-card border border-app bg-surface">
                      {/* Placeholder map */}
                      <div className="relative h-[200px] bg-[var(--surface-2)]">
                        <div className="absolute inset-0 flex items-center justify-center text-muted">
                          <div className="flex flex-col items-center gap-[var(--space-2)]">
                            <MapPinIcon className="size-[32px] opacity-30" />
                            <span className="text-caption">Mapa interactivo</span>
                          </div>
                        </div>
                        {/* Mock map points */}
                        <div className="absolute top-[30%] left-[25%] flex flex-col items-center">
                          <div className="h-[10px] w-[10px] rounded-full bg-primary-token shadow-elev-2" />
                          <span className="mt-1 text-[9px] font-[var(--fw-medium)] text-muted">Airport</span>
                        </div>
                        <div className="absolute top-[60%] right-[25%] flex flex-col items-center">
                          <div className="h-[10px] w-[10px] rounded-full bg-primary-token shadow-elev-2" />
                          <span className="mt-1 text-[9px] font-[var(--fw-medium)] text-muted">Hotel</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expenses summary */}
                  <div>
                    <div className="flex items-baseline justify-between mb-[2px]">
                      <h3 className="text-body font-[var(--fw-semibold)]">Resumen Gastos</h3>
                      <span className="text-[var(--font-h2)] font-[var(--fw-bold)] leading-[var(--lh-h2)]">
                        €{MOCK_EXPENSES.total.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-caption uppercase tracking-wider text-muted mb-[var(--space-5)]">
                      Estimación Total
                    </p>

                    <div className="flex flex-col gap-[var(--space-5)]">
                      {MOCK_EXPENSES.categories.map((cat) => {
                        const Icon = ACTIVITY_ICONS[cat.icon] || MapPinIcon;
                        return (
                          <div key={cat.name} className="flex items-center gap-[var(--space-3)]">
                            <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center rounded-card bg-[var(--surface-2)]">
                              <Icon className="size-[18px] text-muted" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-body-sm font-[var(--fw-medium)]">{cat.name}</p>
                              <p className="text-caption text-muted">{cat.detail}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-body-sm font-[var(--fw-semibold)]">€{cat.amount.toFixed(2)}</p>
                              <p className={`text-[10px] font-[var(--fw-semibold)] uppercase tracking-wider ${
                                cat.status === "PAID" ? "text-success-token" : "text-warning-token"
                              }`}>
                                {cat.status === "PAID" ? "Paid" : "Pending"}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button className="mt-[var(--space-6)] w-full border-t border-app pt-[var(--space-4)] text-center text-caption font-[var(--fw-semibold)] uppercase tracking-wider text-muted hover:text-app transition-colors">
                      View Detailed Finances
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "mapa" && (
              <div className="flex flex-col items-center justify-center py-[var(--space-24)] text-muted">
                <MapPinIcon className="size-[48px] mb-[var(--space-4)] opacity-30" />
                <p className="text-body font-[var(--fw-medium)]">Mapa del viaje</p>
                <p className="text-body-sm mt-[var(--space-1)]">Próximamente</p>
              </div>
            )}

            {activeTab === "gastos" && (
              <div className="mx-auto max-w-[500px]">
                <div className="flex items-baseline justify-between mb-[2px]">
                  <h3 className="text-[var(--font-h3)] font-[var(--fw-bold)]">Resumen Gastos</h3>
                  <span className="text-[var(--font-h2)] font-[var(--fw-bold)] leading-[var(--lh-h2)]">
                    €{MOCK_EXPENSES.total.toFixed(2)}
                  </span>
                </div>
                <p className="text-caption uppercase tracking-wider text-muted mb-[var(--space-6)]">
                  Estimación Total
                </p>

                <div className="flex flex-col gap-[var(--space-5)]">
                  {MOCK_EXPENSES.categories.map((cat) => {
                    const Icon = ACTIVITY_ICONS[cat.icon] || MapPinIcon;
                    return (
                      <div key={cat.name} className="flex items-center gap-[var(--space-3)]">
                        <div className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-card bg-[var(--surface-2)]">
                          <Icon className="size-[20px] text-muted" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-body font-[var(--fw-medium)]">{cat.name}</p>
                          <p className="text-body-sm text-muted">{cat.detail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-body font-[var(--fw-semibold)]">€{cat.amount.toFixed(2)}</p>
                          <p className={`text-caption font-[var(--fw-semibold)] uppercase tracking-wider ${
                            cat.status === "PAID" ? "text-success-token" : "text-warning-token"
                          }`}>
                            {cat.status === "PAID" ? "Paid" : "Pending"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
