"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GlobeMethods } from "react-globe.gl";
import AppSidebar from "@/components/common/AppSidebar";
import LoadingScreen from "@/components/common/LoadingScreen";
import { useAuth } from "@/providers/AuthProvider";
import { searchUsers, type PublicUserProfileDto } from "@/services/api/repositories/users.repository";

const Globe = dynamic(() => import("react-globe.gl"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[320px] w-full items-center justify-center">
      <span className="text-body-sm text-muted">Cargando mapa...</span>
    </div>
  ),
});

export default function SearchPage() {
  const { user, loading } = useAuth();
  const currentUserId = user?.id ?? null;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<PublicUserProfileDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const trimmedQuery = searchValue.trim();

    if (trimmedQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchUsers({
          query: trimmedQuery,
          limit: 8,
          excludeUserId: currentUserId ?? undefined,
        });

        if (!cancelled) {
          setSearchResults(results);
        }
      } catch (error) {
        console.error("[search] Error searching users:", error);
        if (!cancelled) {
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [currentUserId, searchValue]);

  if (loading) return <LoadingScreen />;

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
            <div className="border-b border-app pb-[var(--space-2)]">
              <h1 className="text-[var(--font-h4)] font-[var(--fw-semibold)] leading-[var(--lh-h4)]">Buscar</h1>
            </div>

            <div className="mt-[var(--space-5)]">
              <input
                id="app-user-search"
                type="search"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Buscar usuarios"
                className="w-full rounded-card border border-app bg-app px-4 py-3 text-body text-app outline-none"
              />
            </div>

            <div className="mt-[var(--space-5)] rounded-modal border border-app bg-surface p-[var(--space-4)] shadow-elev-1">
              <RecentActivityGlobe />
            </div>

            <div className="mt-[var(--space-5)]">
              {searchValue.trim().length < 2 ? (
                <div className="rounded-modal border border-app bg-surface p-[var(--space-5)] text-body text-muted shadow-elev-1">
                  Escribe al menos 2 caracteres para buscar usuarios.
                </div>
              ) : searchLoading ? (
                <div className="rounded-modal border border-app bg-surface p-[var(--space-5)] text-body text-muted shadow-elev-1">
                  Buscando usuarios...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-modal border border-app bg-surface p-[var(--space-5)] text-body text-muted shadow-elev-1">
                  No se han encontrado usuarios.
                </div>
              ) : (
                <div className="space-y-[var(--space-4)]">
                  {searchResults.map((result) => {
                    const avatarLabel = (result.nombre.trim()[0] || "U").toUpperCase();

                    return (
                      <article
                        key={result.id}
                        className="flex items-center gap-3 rounded-modal border border-app bg-surface p-[var(--space-4)] shadow-elev-1"
                      >
                        <Avatar label={avatarLabel} image={result.profile_image} />
                        <div className="min-w-0">
                          <p className="truncate text-body font-[var(--fw-semibold)] text-app">{result.nombre}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

type FlightData = {
  callsign: string;
  lat: number;
  lng: number;
  altitudeM: number | null;
  velocityMs: number | null;
  heading: number | null;
  onGround: boolean;
  originCountry: string;
};

type FlightArc = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  originName: string;
  destName: string;
};

function RecentActivityGlobe() {
  type GlobeMarker = {
    id: string;
    locationName: string;
    lat: number;
    lng: number;
    altitude: number;
    image: string | null;
    label: string;
    isFlight?: boolean;
  };

  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const globeContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const autoRotateFrameRef = useRef<number | null>(null);
  const selectedMarkerIdRef = useRef<string | null>(null);
  const [globeReady, setGlobeReady] = useState(false);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [flightInput, setFlightInput] = useState("");
  const [flightData, setFlightData] = useState<FlightData | null>(null);
  const [flightArc, setFlightArc] = useState<FlightArc | null>(null);
  const [flightLoading, setFlightLoading] = useState(false);
  const [flightError, setFlightError] = useState<string | null>(null);
  const globeViewportWidth = 320;
  const globeViewportHeight = 340;
  const globeRenderWidth = 420;
  const globeRenderHeight = 420;
  const lockedAltitude = 1.92;
  const viewRef = useRef({ lat: 12, lng: 18, altitude: lockedAltitude });

  const allMarkers: GlobeMarker[] = flightData
    ? [{ id: "flight-marker", locationName: flightData.callsign, lat: flightData.lat, lng: flightData.lng, altitude: 0.06, image: null, label: "✈", isFlight: true }]
    : [];

  const searchFlight = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const callsign = flightInput.trim().toUpperCase();
    if (!callsign) return;

    setFlightLoading(true);
    setFlightError(null);
    setFlightData(null);
    setFlightArc(null);

    try {
      const res = await fetch(
        `https://opensky-network.org/api/states/all?callsign=${encodeURIComponent(callsign)}`
      );
      if (!res.ok) throw new Error("Error en la API");

      const data = await res.json();
      const state = data.states?.[0];

      if (!state || !state[5] || !state[6]) {
        setFlightError("Vuelo no encontrado. Usa el callsign ICAO (ej: IBE3456, VLG1234).");
        return;
      }

      const flight: FlightData = {
        callsign: state[1]?.trim() || callsign,
        lat: state[6],
        lng: state[5],
        altitudeM: state[7],
        velocityMs: state[9],
        heading: state[10],
        onGround: state[8],
        originCountry: state[2],
      };

      setFlightData(flight);
      setSelectedMarkerId(null);
      selectedMarkerIdRef.current = null;

      const nextView = { lat: flight.lat, lng: flight.lng, altitude: lockedAltitude };
      viewRef.current = nextView;
      globeRef.current?.pointOfView(nextView, 1200);

      // Fetch route and airport coordinates in background (non-blocking)
      try {
        const routeRes = await fetch(`https://opensky-network.org/api/routes?callsign=${encodeURIComponent(callsign)}`);
        if (routeRes.ok) {
          const routeData = await routeRes.json();
          const [originIcao, destIcao] = routeData.route ?? [];
          if (originIcao && destIcao) {
            const [originRes, destRes] = await Promise.all([
              fetch(`https://opensky-network.org/api/airports/?icao=${originIcao}`),
              fetch(`https://opensky-network.org/api/airports/?icao=${destIcao}`),
            ]);
            if (originRes.ok && destRes.ok) {
              const originAp = await originRes.json();
              const destAp = await destRes.json();
              if (originAp.position?.latitude && destAp.position?.latitude) {
                setFlightArc({
                  originLat: originAp.position.latitude,
                  originLng: originAp.position.longitude,
                  destLat: destAp.position.latitude,
                  destLng: destAp.position.longitude,
                  originName: originAp.name || originIcao,
                  destName: destAp.name || destIcao,
                });
              }
            }
          }
        }
      } catch {
        // Arc is optional, silently ignore route fetch errors
      }
    } catch {
      setFlightError("Error al conectar con la API. Inténtalo de nuevo.");
    } finally {
      setFlightLoading(false);
    }
  };

  useEffect(() => {
    selectedMarkerIdRef.current = selectedMarkerId;
  }, [selectedMarkerId]);

  const centerMarker = (marker: GlobeMarker) => {
    const nextView = {
      lat: marker.lat,
      lng: marker.lng,
      altitude: lockedAltitude,
    };

    viewRef.current = nextView;
    selectedMarkerIdRef.current = marker.id;
    setSelectedMarkerId(marker.id);
    globeRef.current?.pointOfView(nextView, 900);
  };

  useEffect(() => {
    if (!globeReady) return;
    let cancelled = false;
    let retryFrameId: number | null = null;
    let detach: (() => void) | null = null;

    const tryAttachInteractions = () => {
      if (cancelled) return;

      const interactionLayer = globeContainerRef.current;
      const controls = globeRef.current?.controls?.();
      const renderer = globeRef.current?.renderer?.();
      const canvas = renderer?.domElement;

      if (!interactionLayer || !controls || !canvas) {
        retryFrameId = window.requestAnimationFrame(tryAttachInteractions);
        return;
      }

      viewRef.current = { lat: 12, lng: 18, altitude: lockedAltitude };
      globeRef.current?.pointOfView(viewRef.current, 0);

      controls.autoRotate = false;
      controls.enableZoom = false;
      controls.enablePan = false;
      controls.enableRotate = false;
      controls.zoomSpeed = 0;
      controls.update();

      const applyView = () => {
        globeRef.current?.pointOfView(viewRef.current, 0);
      };

      const tickAutoRotate = () => {
        if (!isDraggingRef.current && !selectedMarkerIdRef.current) {
          viewRef.current = {
            ...viewRef.current,
            lng: ((((viewRef.current.lng + 0.025) + 180) % 360) + 360) % 360 - 180,
          };
          applyView();
        }

        autoRotateFrameRef.current = window.requestAnimationFrame(tickAutoRotate);
      };

      const preventZoom = (event: WheelEvent | TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
        applyView();
      };

      const clearSelection = () => {
        setSelectedMarkerId(null);
      };

      const onPointerDown = (event: PointerEvent) => {
        const eventTarget = event.target;
        if (eventTarget instanceof Element && eventTarget.closest("[data-globe-marker='true']")) {
          return;
        }

        event.preventDefault();
        clearSelection();
        isDraggingRef.current = true;
        dragPointerIdRef.current = event.pointerId;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        interactionLayer.setPointerCapture(event.pointerId);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (
          !isDraggingRef.current ||
          dragPointerIdRef.current !== event.pointerId ||
          !lastPointerRef.current
        ) {
          return;
        }

        event.preventDefault();

        const deltaX = event.clientX - lastPointerRef.current.x;
        const deltaY = event.clientY - lastPointerRef.current.y;

        lastPointerRef.current = { x: event.clientX, y: event.clientY };

        viewRef.current = {
          lat: Math.max(-85, Math.min(85, viewRef.current.lat + deltaY * 0.24)),
          lng: ((((viewRef.current.lng - deltaX * 0.32) + 180) % 360) + 360) % 360 - 180,
          altitude: lockedAltitude,
        };

        applyView();
      };

      const onPointerUp = (event: PointerEvent) => {
        if (dragPointerIdRef.current !== event.pointerId) return;

        isDraggingRef.current = false;
        dragPointerIdRef.current = null;
        lastPointerRef.current = null;

        if (interactionLayer.hasPointerCapture(event.pointerId)) {
          interactionLayer.releasePointerCapture(event.pointerId);
        }
      };

      canvas.style.touchAction = "none";
      canvas.style.pointerEvents = "none";
      interactionLayer.style.touchAction = "none";

      interactionLayer.addEventListener("wheel", preventZoom, { passive: false });
      interactionLayer.addEventListener("touchmove", preventZoom, { passive: false });
      interactionLayer.addEventListener("pointerdown", onPointerDown);
      interactionLayer.addEventListener("pointermove", onPointerMove);
      interactionLayer.addEventListener("pointerup", onPointerUp);
      interactionLayer.addEventListener("pointercancel", onPointerUp);
      autoRotateFrameRef.current = window.requestAnimationFrame(tickAutoRotate);

      detach = () => {
        if (autoRotateFrameRef.current !== null) {
          window.cancelAnimationFrame(autoRotateFrameRef.current);
          autoRotateFrameRef.current = null;
        }
        interactionLayer.removeEventListener("wheel", preventZoom);
        interactionLayer.removeEventListener("touchmove", preventZoom);
        interactionLayer.removeEventListener("pointerdown", onPointerDown);
        interactionLayer.removeEventListener("pointermove", onPointerMove);
        interactionLayer.removeEventListener("pointerup", onPointerUp);
        interactionLayer.removeEventListener("pointercancel", onPointerUp);
      };
    };

    tryAttachInteractions();

    return () => {
      cancelled = true;
      if (retryFrameId !== null) {
        window.cancelAnimationFrame(retryFrameId);
      }
      detach?.();
    };
  }, [globeReady]);

  return (
    <div>
      <form onSubmit={searchFlight} className="mb-[var(--space-3)] flex gap-2">
        <input
          type="text"
          value={flightInput}
          onChange={(e) => setFlightInput(e.target.value)}
          placeholder="Callsign ICAO (ej: IBE3456)"
          className="min-w-0 flex-1 rounded-card border border-app bg-app px-3 py-2 text-body-sm text-app outline-none"
        />
        <button
          type="submit"
          disabled={flightLoading || !flightInput.trim()}
          className="rounded-card bg-[#ff6a3d] px-4 py-2 text-body-sm font-[var(--fw-semibold)] text-white disabled:opacity-50"
        >
          {flightLoading ? "..." : "Buscar"}
        </button>
      </form>

      {flightError && (
        <p className="mb-[var(--space-3)] text-body-sm text-[#ff6a3d]">{flightError}</p>
      )}

      {flightData && (
        <div className="mb-[var(--space-3)] flex flex-wrap gap-3 rounded-card border border-app bg-surface-inset px-3 py-2">
          <span className="text-body-sm font-[var(--fw-semibold)] text-app">{flightData.callsign}</span>
          {flightData.altitudeM !== null && (
            <span className="text-body-sm text-muted">{Math.round(flightData.altitudeM)} m</span>
          )}
          {flightData.velocityMs !== null && (
            <span className="text-body-sm text-muted">{Math.round(flightData.velocityMs * 3.6)} km/h</span>
          )}
          <span className="text-body-sm text-muted">{flightData.originCountry}</span>
          {flightData.onGround && <span className="text-body-sm text-muted">En tierra</span>}
        </div>
      )}

      <div className="flex justify-center">
        <div
          ref={globeContainerRef}
          className="relative"
          style={{ width: `${globeViewportWidth}px`, height: `${globeViewportHeight}px` }}
        >
          <div
            className="absolute"
            style={{
              width: `${globeRenderWidth}px`,
              height: `${globeRenderHeight}px`,
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <Globe
              ref={globeRef}
              width={globeRenderWidth}
              height={globeRenderHeight}
              backgroundColor="rgba(0,0,0,0)"
              rendererConfig={{ alpha: true, antialias: true }}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-day.jpg"
              bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
              showAtmosphere={false}
              pointsData={flightArc ? [
                { lat: flightArc.originLat, lng: flightArc.originLng, name: flightArc.originName, color: "#facc15" },
                { lat: flightArc.destLat, lng: flightArc.destLng, name: flightArc.destName, color: "#ff6a3d" },
              ] : []}
              pointLat="lat"
              pointLng="lng"
              pointColor="color"
              pointRadius={0.35}
              pointAltitude={0.005}
              arcsData={flightArc ? [flightArc] : []}
              arcStartLat="originLat"
              arcStartLng="originLng"
              arcEndLat="destLat"
              arcEndLng="destLng"
              arcColor={() => ["rgba(250,204,21,0.9)", "rgba(255,106,61,0.9)"]}
              arcDashLength={0.4}
              arcDashGap={0.2}
              arcDashAnimateTime={2000}
              arcStroke={1.2}
              arcAltitudeAutoScale={0.35}
              htmlElementsData={allMarkers}
              htmlLat="lat"
              htmlLng="lng"
              htmlAltitude="altitude"
              htmlElement={(marker) => {
                const data = marker as GlobeMarker;
                const el = document.createElement("div");
                el.dataset.globeMarker = "true";
                el.style.position = "relative";
                el.style.zIndex = "20";
                el.style.width = "40px";
                el.style.height = "40px";
                el.style.cursor = "pointer";
                el.style.pointerEvents = "auto";
                el.onclick = (event) => {
                  event.stopPropagation();
                  centerMarker(data);
                };

                const bubble = document.createElement("div");
                bubble.dataset.globeMarker = "true";
                bubble.style.width = "40px";
                bubble.style.height = "40px";
                bubble.style.borderRadius = "999px";
                bubble.style.overflow = "hidden";
                bubble.style.border = data.isFlight ? "2px solid #facc15" : "2px solid white";
                bubble.style.background = data.isFlight ? "#1a1a2e" : "#ff6a3d";
                bubble.style.display = "grid";
                bubble.style.placeItems = "center";
                bubble.style.fontSize = data.isFlight ? "20px" : "16px";
                bubble.style.fontWeight = "700";
                bubble.style.color = "#ffffff";

                if (data.image) {
                  const img = document.createElement("img");
                  img.src = data.image;
                  img.alt = `Avatar de ${data.label}`;
                  img.style.width = "100%";
                  img.style.height = "100%";
                  img.style.objectFit = "cover";
                  img.referrerPolicy = "no-referrer";
                  bubble.appendChild(img);
                } else {
                  bubble.textContent = data.label;
                }

                el.appendChild(bubble);

                if (selectedMarkerId === data.id) {
                  const tooltip = document.createElement("div");
                  tooltip.dataset.globeMarker = "true";
                  tooltip.textContent = data.locationName;
                  tooltip.style.position = "absolute";
                  tooltip.style.left = "50%";
                  tooltip.style.bottom = "calc(100% + 10px)";
                  tooltip.style.transform = "translateX(-50%)";
                  tooltip.style.padding = "6px 10px";
                  tooltip.style.borderRadius = "999px";
                  tooltip.style.background = "rgba(15, 23, 20, 0.92)";
                  tooltip.style.color = "#ffffff";
                  tooltip.style.fontSize = "12px";
                  tooltip.style.fontWeight = "600";
                  tooltip.style.lineHeight = "1";
                  tooltip.style.whiteSpace = "nowrap";
                  tooltip.style.pointerEvents = "none";
                  el.appendChild(tooltip);
                }

                return el;
              }}
              onGlobeReady={() => setGlobeReady(true)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ label, image }: { label: string; image?: string | null }) {
  if (image) {
    return (
      <img
        src={image}
        alt={`Avatar de ${label}`}
        className="avatar-lg rounded-full border border-app object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="flex avatar-lg items-center justify-center border border-app bg-surface-inset text-body font-[var(--fw-semibold)] text-app">
      {label}
    </div>
  );
}
