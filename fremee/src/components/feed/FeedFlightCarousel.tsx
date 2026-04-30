"use client";

import Link from "next/link";
import NextImage from "next/image";
import { Plane } from "lucide-react";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import type { PlanTicket } from "@/services/api/endpoints/wallet.endpoint";

function flightProgress(ticket: PlanTicket): number | null {
  if (!ticket.ends_at) return null;
  const now = Date.now();
  const start = new Date(ticket.starts_at).getTime();
  const end = new Date(ticket.ends_at).getTime();
  if (now < start || now > end) return null;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

type FriendProfile = { id: string; profile_image: string | null };

export default function FeedFlightCarousel({ flights }: { flights: PlanTicket[] }) {
  const [profiles, setProfiles] = useState<Record<string, FriendProfile>>({});

  const activeFlights = flights.filter(
    (t) => t.type === "flight" && flightProgress(t) !== null
  );

  useEffect(() => {
    const ids = [
      ...new Set(
        activeFlights
          .map((t) => t.shared_by_user_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    if (!ids.length) return;
    const supabase = createBrowserSupabaseClient();
    supabase
      .from("usuarios_public")
      .select("id, profile_image")
      .in("id", ids)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, FriendProfile> = {};
        for (const p of data) map[p.id] = p;
        setProfiles(map);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flights]);

  if (!activeFlights.length) return null;

  return (
    <>
      <style>{`
        @keyframes flight-badge-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.18); opacity: 0.75; }
        }
        .flight-badge-pulse { animation: flight-badge-pulse 2.4s ease-in-out infinite; }
      `}</style>

      <div className="mb-4">
        <p className="mb-2.5 px-1 flex items-center gap-1.5 text-[11px] font-[var(--fw-semibold)] uppercase tracking-[0.09em] text-muted">
          <Plane className="size-[11px]" aria-hidden />
          En ruta
        </p>

        <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-1">
          {activeFlights.map((ticket) => {
            const profileImage = ticket.shared_by_user_id
              ? (profiles[ticket.shared_by_user_id]?.profile_image ?? null)
              : null;
            const name = ticket.shared_by_nombre ?? "?";
            const initial = name[0].toUpperCase();
            const route =
              ticket.from_label && ticket.to_label
                ? `${ticket.from_label} → ${ticket.to_label}`
                : null;

            return (
              <Link
                key={ticket.id}
                href="/flights"
                className="flex shrink-0 flex-col items-center gap-[5px] w-[62px] group"
              >
                <div className="relative">
                  {profileImage ? (
                    <NextImage
                      src={profileImage}
                      alt={name}
                      width={62}
                      height={62}
                      className="size-[62px] rounded-full object-cover ring-2 ring-[var(--color-app,#6366f1)]/50 group-hover:ring-[var(--color-app,#6366f1)]/80 transition-[box-shadow]"
                      unoptimized
                    />
                  ) : (
                    <div className="size-[62px] rounded-full bg-gradient-to-br from-[#1d4ed8] to-[#7c3aed] flex items-center justify-center text-white text-[22px] font-[var(--fw-bold)] ring-2 ring-[var(--color-app,#6366f1)]/50 group-hover:ring-[var(--color-app,#6366f1)]/80 transition-[box-shadow]">
                      {initial}
                    </div>
                  )}

                  {/* Animated plane badge */}
                  <span className="flight-badge-pulse absolute -bottom-[3px] -right-[3px] flex size-[20px] items-center justify-center rounded-full bg-[var(--bg-surface,#fff)] shadow-[0_1px_4px_rgba(0,0,0,0.18)] ring-[1.5px] ring-[var(--color-app,#6366f1)]/25">
                    <Plane className="size-[10px] text-[var(--color-app,#6366f1)]" aria-hidden />
                  </span>
                </div>

                <span className="w-full truncate text-center text-[11px] font-[var(--fw-semibold)] text-app leading-tight">
                  {name.split(" ")[0]}
                </span>

                {route ? (
                  <span className="w-full truncate text-center text-[10px] text-muted leading-tight -mt-[3px]">
                    {route}
                  </span>
                ) : (
                  <span className="w-full truncate text-center text-[10px] text-muted leading-tight -mt-[3px]">
                    En ruta
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
