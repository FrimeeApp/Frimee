"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, ChevronLeft, UserPlus, Share2, Pencil, MapPin, Calendar, Plus, ExternalLink, Upload, Check, FileText } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useCallContext } from "@/providers/CallProvider";
import { ChatConversation, PhoneCallIcon, VideoCallIcon } from "@/components/chat/ChatConversation";
import { fetchPlanChatItem, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { resolveChatName, resolveChatAvatar } from "@/services/api/repositories/chat.repository";
import { fetchPlansByIds, fetchPlanUserRol, updatePlanEndpoint, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import CreatePlanModal, { type EditPlanInitialValues } from "@/components/plans/modals/CreatePlanModal";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { fetchSubplanes, updateSubplanTransporte, updateSubplanViaje, type SubplanRow, type TipoSubplan, TIPOS_TRANSPORTE, isTipoSubplan } from "@/services/api/endpoints/subplanes.endpoint";
import { getBalancesForPlanEndpoint, deshacerPagoEndpoint, fetchTopesEndpoint, listGastosForPlanEndpoint, type BalanceRow, type GastoRow, type Topes } from "@/services/api/endpoints/gastos.endpoint";
import DayRouteMap from "@/components/plans/DayRouteMap";
import { findMissingLegs, useComputeMissingLegs } from "@/hooks/useComputeMissingLegs";
import AddGastoSheet from "@/components/plans/modals/AddGastoSheet";
import { syncPlanWidget } from "@/services/widget/planWidget";
import AppSidebar from "@/components/common/AppSidebar";
import InviteSheet from "@/components/plans/modals/InviteSheet";
import type { CreateMenuPlanContext } from "@/components/common/CreateMenu";
import PublishPlanModal from "@/components/plans/modals/PublishPlanModal";
import PlanFotosTab from "@/components/plans/PlanFotosTab";
import { PlanGastoDetailModal } from "@/components/plans/modals/PlanGastoDetailModal";
import { uploadPlanCoverFile } from "@/services/firebase/upload";
import { formatMoney, formatDateRange } from "@/lib/formatters";
import { createRealtimeTopic } from "@/lib/realtime";
import { FIELD_LINE_CLS } from "@/lib/styles";
import { buildGoogleMapsDirectionsUrl, buildWazeDirectionsUrl } from "@/config/external";
import { FEED_ENABLED } from "@/config/app";
import { PlanDetailSkeleton } from "./_components/PlanDetailSkeleton";
import { ExpenseSummaryCard } from "./_components/ExpenseSummaryCard";
import { GastosTab } from "./_components/GastosTab";
import { BudgetSheet } from "./_components/BudgetBits";
import { GastosPdfModal } from "./_components/GastosPdfModal";
import type { PdfInput } from "@/lib/gastos-pdf";
import { AddSubplanSheet, TRANSPORT_MAP, type AddSheetProps } from "./_components/AddSubplanSheet";
import { isoDateOnly, groupByDay, normalizeDateKey, summarizeRecipients, getOccupiedIntervals, timeToMin, mergeIntervals, type Interval } from "./_components/plan-utils";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toaster";
import { estadoNoFui, volverASellar } from "@/services/api/endpoints/pasaporte.endpoint";
import { shareOf } from "@/lib/gastos-shares";
import { PayDebtSheet, type PaidResult } from "@/components/plans/modals/PayDebtSheet";
import { Tabs } from "@/components/ui/Tabs";
import { isPlanFinished, isoToPlanWhen, planWhenToIso } from "@/lib/plan-dates";
import { PLACE_TBD } from "@/hooks/useCreatePlan";
import { Itinerary, itineraryDayId } from "@/components/plans/itinerary/Itinerary";
import { buildItinerary, localDayKey, tripProgressText } from "@/components/plans/itinerary/itineraryModel";
import { MapPlaceholder, WhenVisible } from "@/components/plans/itinerary/parts";
import TripOverviewMap from "@/components/plans/TripOverviewMap";

const PLAN_ROUTE_TRANSITION_MS = 260;
const PLAN_SWIPE_EDGE_PX = 32;
const PLAN_SWIPE_TRIGGER_PX = 88;

// ── local icon aliases (used throughout this file) ──────────────────────────

type Tab = "itinerario" | "gastos" | "chat" | "fotos";

type PlanDetailCacheEntry = {
  userId: string;
  planId: number;
  plan: PlanByIdRow | null;
  isAdmin: boolean;
  membershipChecked: boolean;
  planChat: ChatListItem | null;
  subplanes: SubplanRow[];
  gastos: GastoRow[];
  balances: BalanceRow[];
  cachedAt: number;
};

const PLAN_DETAIL_CACHE_LIMIT = 8;
const planDetailCache = new Map<string, PlanDetailCacheEntry>();

function getPlanDetailCache(userId: string | undefined, planId: number) {
  if (!userId || !planId) return null;
  return planDetailCache.get(`${userId}:${planId}`) ?? null;
}

function updatePlanDetailCache(
  userId: string | undefined,
  planId: number,
  patch: Partial<Omit<PlanDetailCacheEntry, "userId" | "planId" | "cachedAt">>,
) {
  if (!userId || !planId) return;

  const key = `${userId}:${planId}`;
  const previous = planDetailCache.get(key);
  const next: PlanDetailCacheEntry = {
    userId,
    planId,
    plan: previous?.plan ?? null,
    isAdmin: previous?.isAdmin ?? false,
    membershipChecked: previous?.membershipChecked ?? false,
    planChat: previous?.planChat ?? null,
    subplanes: previous?.subplanes ?? [],
    gastos: previous?.gastos ?? [],
    balances: previous?.balances ?? [],
    ...patch,
    cachedAt: Date.now(),
  };

  planDetailCache.delete(key);
  planDetailCache.set(key, next);

  while (planDetailCache.size > PLAN_DETAIL_CACHE_LIMIT) {
    const oldestKey = planDetailCache.keys().next().value;
    if (!oldestKey) break;
    planDetailCache.delete(oldestKey);
  }
}

const BackIcon = ({ className = "size-icon" }: { className?: string }) => <ChevronLeft className={className} aria-hidden />;
const InviteIcon = ({ className = "size-icon" }: { className?: string }) => <UserPlus className={className} aria-hidden />;
const ShareIcon = ({ className = "size-icon" }: { className?: string }) => <Share2 className={className} aria-hidden />;
const EditIcon = ({ className = "size-icon" }: { className?: string }) => <Pencil className={className} aria-hidden />;
const MapPinIcon = ({ className = "size-icon" }: { className?: string }) => <MapPin className={className} aria-hidden />;
const CalendarSmallIcon = ({ className = "size-icon" }: { className?: string }) => <Calendar className={className} aria-hidden />;
const PlusIcon = ({ className = "size-icon" }: { className?: string }) => <Plus className={className} aria-hidden />;
const ExternalLinkIcon = ({ className = "size-icon" }: { className?: string }) => <ExternalLink className={className} aria-hidden />;

/* ───────────── page ───────────── */

/* ───────────── page ───────────── */

export default function PlanDetailPage({ presentation = "page" }: { presentation?: "page" | "overlay" } = {}) {
  const { loading, user, profile } = useAuth();
  const { toast, toastError } = useToast();
  const { startCall, joinCall, callState } = useCallContext();
  const reloadCallMessagesRef = useRef<(() => void) | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { id: paramId } = useParams<{ id: string }>();
  const isOverlayPresentation = presentation === "overlay";
  const initialPlanId = Number(paramId);
  const initialCache = getPlanDetailCache(user?.id, initialPlanId);
  // In Capacitor static export we navigate to /plans/static?id=18.
  // Read the real id from query params and store it in state so effects re-run.
  const [id, setId] = useState<string>(paramId);
  useEffect(() => {
    if (paramId === "static") {
      const queryId = new URLSearchParams(window.location.search).get("id");
      setId(queryId ?? paramId);
    } else {
      setId(paramId);
    }
  }, [paramId]);
  const [activeTab, setActiveTab] = useState<Tab>("itinerario");
  const [plan, setPlan] = useState<PlanByIdRow | null>(initialCache?.plan ?? null);
  const isPast = plan ? isPlanFinished(plan.fin_at) : false;

  // «No fui a este viaje» (pasaporte): si lo marcaste, aquí puedes deshacerlo y volver a recibir los sellos.
  const [noFui, setNoFui] = useState(false);
  const [sellando, setSellando] = useState(false);
  const planIdForPassport = plan?.id;
  useEffect(() => {
    if (!planIdForPassport || !isPast) return;
    let cancelled = false;
    estadoNoFui(planIdForPassport)
      .then((v) => {
        if (!cancelled) setNoFui(v);
      })
      .catch(() => {
        // Sin esto no hay botón; no merece un aviso.
      });
    return () => {
      cancelled = true;
    };
  }, [planIdForPassport, isPast]);
  const handleVolverASellar = async () => {
    if (!planIdForPassport || sellando) return;
    setSellando(true);
    try {
      await volverASellar(planIdForPassport);
      setNoFui(false);
      toast("Listo. Los sellos de este viaje volverán a tu pasaporte.", "success");
    } catch (err) {
      console.error("[pasaporte] No se pudo volver a sellar el viaje:", (err as { message?: string } | null)?.message ?? err);
      toastError("No se pudo volver a sellar el viaje. Inténtalo de nuevo.");
    } finally {
      setSellando(false);
    }
  };
  const [isAdmin, setIsAdmin] = useState(initialCache?.isAdmin ?? false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(initialCache?.membershipChecked ?? false);
  // Any member adds activities and expenses; editing the plan and inviting stay with the admins.
  const canAdd = isAdmin || membershipChecked;
  const [planChat, setPlanChat] = useState<ChatListItem | null>(initialCache?.planChat ?? null);
  const [planLoading, setPlanLoading] = useState(!initialCache?.plan);
  const [subplanes, setSubplanes] = useState<SubplanRow[]>(initialCache?.subplanes ?? []);
  const [selectedMapDay, setSelectedMapDay] = useState<string | null>(null);
  const [showMapFullscreen, setShowMapFullscreen] = useState(false);
  // While a map is still being built its buttons (Google Maps, Waze, full screen) stay hidden.
  const [mapLoading, setMapLoading] = useState(false);
  const [fullscreenMapLoading, setFullscreenMapLoading] = useState(false);
  // Fade of the floating map buttons (canvas "Carga del mapa de ruta"): they show up 80 ms after the map.
  const mapFabClassName = (loading: boolean) =>
    loading
      ? "invisible translate-y-[4px] opacity-0 motion-reduce:translate-y-0"
      : "visible translate-y-0 opacity-100 delay-[80ms] motion-reduce:delay-0";
  const MAP_FAB_TRANSITION = "flex transition-[opacity,transform,visibility] duration-[160ms] ease-[cubic-bezier(.2,0,0,1)] motion-reduce:duration-150";
  // Itinerary days the user has open. The first load opens one (it-sistema «Qué día va abierto»);
  // days that appear later start folded.
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set());
  // Plan whose itinerary already opened its first day.
  const openDaysPlanRef = useRef<number | null>(null);
  const [subplanesReady, setSubplanesReady] = useState(!!initialCache?.subplanes?.length);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSheetInitialTitulo, setAddSheetInitialTitulo] = useState<string | undefined>();
  // ?tab=chat&m=<mensaje> («Te toca» → a poll): the chat opens at that message.
  const [chatInitialMessageId, setChatInitialMessageId] = useState<number | undefined>();
  const [addSheetInitialDate, setAddSheetInitialDate] = useState<string | undefined>();
  const [addSheetInitialHora, setAddSheetInitialHora] = useState<string | undefined>();
  const [addSheetInitialTipo, setAddSheetInitialTipo] = useState<TipoSubplan | undefined>();
  const [addSheetInitialUbicacion, setAddSheetInitialUbicacion] = useState<{ nombre: string; lat?: number; lng?: number; buscar?: string } | undefined>();
  const [editingSubplan, setEditingSubplan] = useState<SubplanRow | null>(null);
  const [showAddGastoSheet, setShowAddGastoSheet] = useState(false);
  const [editingGasto, setEditingGasto] = useState<GastoRow | null>(null);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [photoAlbumRefreshKey, setPhotoAlbumRefreshKey] = useState(0);
  const [fabFiles, setFabFiles] = useState<File[] | null>(null);
  const fabPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [gastos, setGastos] = useState<GastoRow[]>(initialCache?.gastos ?? []);
  const [selectedGastoId, setSelectedGastoId] = useState<number | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>(initialCache?.balances ?? []);
  const [pagarDeuda, setPagarDeuda] = useState<BalanceRow | null>(null);
  const [topes, setTopes] = useState<Topes>({ grupo: null, mio: null });
  const [budgetSheet, setBudgetSheet] = useState<"grupo" | "mio" | null>(null);
  const [editingTransporteId, setEditingTransporteId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { isClosing: invoiceClosing, requestClose: closeInvoiceModal } = useModalCloseAnimation(() => setShowInvoiceModal(false), showInvoiceModal);
  const [routeEntered, setRouteEntered] = useState(false);
  const [routeClosing, setRouteClosing] = useState(false);
  const [routeDragOffset, setRouteDragOffset] = useState(0);
  const [routeDragging, setRouteDragging] = useState(false);
  const routeCloseTimeoutRef = useRef<number | null>(null);
  const routeDragStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => setRouteEntered(true));
    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!isOverlayPresentation) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.setAttribute("data-plan-detail-open", "true");
    document.body.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";

    return () => {
      document.body.removeAttribute("data-plan-detail-open");
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    };
  }, [isOverlayPresentation]);

  useEffect(() => {
    const planId = Number(id);
    const cached = getPlanDetailCache(user?.id, planId);
    if (!cached) {
      if (planId && plan?.id !== planId) {
        setPlan(null);
        setIsAdmin(false);
        setMembershipChecked(false);
        setPlanChat(null);
        setPlanLoading(true);
        setSubplanes([]);
        setGastos([]);
        setBalances([]);
        setSubplanesReady(false);
      }
      return;
    }

    setPlan(cached.plan);
    setIsAdmin(cached.isAdmin);
    setMembershipChecked(cached.membershipChecked);
    setPlanChat(cached.planChat);
    setPlanLoading(false);
    setSubplanesReady(true);
    setSubplanes(cached.subplanes);
    setGastos(cached.gastos);
    setBalances(cached.balances);
  }, [id, plan?.id, user?.id]);

  useEffect(() => {
    return () => {
      if (routeCloseTimeoutRef.current !== null) {
        window.clearTimeout(routeCloseTimeoutRef.current);
      }
    };
  }, []);

  const closePlanRoute = (mode: "back" | "calendar" = "back") => {
    if (routeClosing) return;
    setRouteClosing(true);
    setRouteDragging(false);
    setRouteDragOffset(0);

    if (routeCloseTimeoutRef.current !== null) {
      window.clearTimeout(routeCloseTimeoutRef.current);
    }

    routeCloseTimeoutRef.current = window.setTimeout(() => {
      if (mode === "calendar") router.push("/calendar");
      else router.back();
    }, PLAN_ROUTE_TRANSITION_MS);
  };

  // nav-05: Escape closes the plan shown as an overlay, unless a sheet, dialog or menu on top
  // takes it first (they call preventDefault or are still in the DOM).
  const closePlanRouteRef = useRef(closePlanRoute);
  closePlanRouteRef.current = closePlanRoute;
  useEffect(() => {
    if (!isOverlayPresentation) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      // Only what is on screen counts: some dialogs (e.g. «Buscar usuarios») stay in the DOM hidden.
      const onTop = [...document.querySelectorAll<HTMLElement>("[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-vaul-drawer]")]
        .some((el) => !el.closest("[aria-hidden=true], [inert]")
          && (typeof el.checkVisibility === "function" ? el.checkVisibility() : el.offsetParent !== null));
      if (onTop) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable=true]")) return;
      closePlanRouteRef.current("back");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOverlayPresentation]);

  const handleRoutePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return;
    if (typeof window === "undefined" || window.innerWidth >= 768) return;
    if (event.clientX > PLAN_SWIPE_EDGE_PX) return;
    routeDragStartRef.current = { x: event.clientX, y: event.clientY, active: true };
    setRouteDragging(true);
  };

  const handleRoutePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = routeDragStartRef.current;
    if (!start?.active) return;

    const deltaX = Math.max(0, event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX < 8 && deltaY > 12) {
      routeDragStartRef.current = null;
      setRouteDragging(false);
      setRouteDragOffset(0);
      return;
    }

    event.preventDefault();
    setRouteDragOffset(Math.min(deltaX, window.innerWidth));
  };

  const handleRoutePointerEnd = () => {
    const shouldClose = routeDragOffset >= PLAN_SWIPE_TRIGGER_PX;
    routeDragStartRef.current = null;
    setRouteDragging(false);

    if (shouldClose) {
      closePlanRoute("back");
      return;
    }

    setRouteDragOffset(0);
  };

  const routeTransform = routeClosing
    ? "translate3d(100%,0,0)"
    : routeDragging && routeDragOffset > 0
      ? `translate3d(${routeDragOffset}px,0,0)`
      : routeEntered
        ? "none"
        : "translate3d(100%,0,0)";
  const routeTransition = routeDragging
    ? "none"
    : `transform ${PLAN_ROUTE_TRANSITION_MS}ms var(--ease-standard)`;
  const routeIsMoving = !routeEntered || routeClosing || routeDragging;

  const openPhotoUpload = () => {
    setMobileCreateOpen(false);
    setActiveTab("fotos");
    fabPhotoInputRef.current?.click();
  };

  const handleFabPhotoFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!plan?.id || !user?.id || files.length === 0) return;
    // The album tab uploads them (progress, notices and review), as with its own button.
    setActiveTab("fotos");
    setFabFiles(files);
  };
  const [showPublishModal, setShowPublishModal] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const createGasto = searchParams.get("createGasto");
    const nuevaActividad = searchParams.get("nuevaActividad");
    const mensaje = Number(searchParams.get("m"));
    if (tab === "chat" && Number.isFinite(mensaje) && mensaje > 0) setChatInitialMessageId(mensaje);
    const nuevaFecha = searchParams.get("fecha");
    const nuevaHora = searchParams.get("hora");
    const nuevoTipo = searchParams.get("tipo");
    const nuevoLugar = searchParams.get("lugar");
    const nuevaLat = searchParams.get("lat");
    const nuevaLng = searchParams.get("lng");

    if (tab === "itinerario" || tab === "gastos" || tab === "fotos" || tab === "chat") {
      setActiveTab(tab);
    }

    if (createGasto === "1") {
      setActiveTab("gastos");
      if (plan && !isPast) {
        setShowAddGastoSheet(true);
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.delete("createGasto");
        const nextQuery = nextParams.toString();
        router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
      }
    }

    // From a chat message («Añadir al plan»): the add sheet with its title already written.
    // Members add activities (the database checks it too).
    if (nuevaActividad !== null && plan && !isPast && canAdd) {
      setActiveTab("itinerario");
      setEditingSubplan(null);
      setAddSheetInitialTitulo(nuevaActividad || undefined);
      setAddSheetInitialDate(nuevaFecha || undefined);
      setAddSheetInitialHora(nuevaHora || undefined);
      setAddSheetInitialTipo(isTipoSubplan(nuevoTipo) ? nuevoTipo : undefined);
      setAddSheetInitialUbicacion(nuevoLugar ? {
        nombre: nuevoLugar,
        ...(nuevaLat && nuevaLng ? { lat: Number(nuevaLat), lng: Number(nuevaLng) } : { buscar: plan.ubicacion_nombre ? `${nuevoLugar}, ${plan.ubicacion_nombre}` : nuevoLugar }),
      } : undefined);
      setShowAddSheet(true);
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete("nuevaActividad");
      for (const k of ["fecha", "hora", "tipo", "lugar", "lat", "lng"]) nextParams.delete(k);
      const nextQuery = nextParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [searchParams, plan, isPast, canAdd, pathname, router]);

  useEffect(() => {
    if (!user?.id) return;
    void syncPlanWidget(user.id);
  }, [user?.id, plan?.id]);

  const expenseSummary = useMemo(() => {
    const confirmedExpenses = gastos.filter((gasto) => gasto.estado === "CONFIRMADO");
    const currency = confirmedExpenses[0]?.moneda ?? "EUR";
    const total = confirmedExpenses.reduce((sum, gasto) => sum + gasto.total, 0);
    const paidByYou = user?.id
      ? confirmedExpenses
          .filter((gasto) => gasto.pagado_por_user_id === user.id)
          .reduce((sum, gasto) => sum + gasto.total, 0)
      : 0;
    const yourShare = user?.id
      ? confirmedExpenses.reduce((sum, gasto) => sum + shareOf(gasto, user.id), 0)
      : 0;
    const net = paidByYou - yourShare;

    const participantIds = new Set<string>();
    confirmedExpenses.forEach((gasto) => {
      participantIds.add(gasto.pagado_por_user_id);
      gasto.partes?.forEach((parte) => participantIds.add(parte.user_id));
    });

    const categoriesMap = new Map<
      string,
      { label: string; amount: number; count: number; icon: string | null }
    >();

    confirmedExpenses.forEach((gasto) => {
      const key = gasto.categoria_nombre ?? gasto.subplan_titulo ?? "Otros";
      const prev = categoriesMap.get(key);
      categoriesMap.set(key, {
        label: key,
        amount: (prev?.amount ?? 0) + gasto.total,
        count: (prev?.count ?? 0) + 1,
        icon: prev?.icon ?? gasto.categoria_icono ?? null,
      });
    });

    const topCategories = [...categoriesMap.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3);

    return {
      hasExpenses: confirmedExpenses.length > 0,
      currency,
      total,
      count: confirmedExpenses.length,
      paidByYou,
      yourShare,
      net,
      participantCount: participantIds.size,
      topCategories,
    };
  }, [gastos, user?.id]);

  const dayExpenseTotals = useMemo(() => {
    const totals = new Map<string, { total: number; currency: string }>();
    gastos
      .filter((gasto) => gasto.estado === "CONFIRMADO")
      .forEach((gasto) => {
        const key = normalizeDateKey(gasto.fecha_gasto);
        const prev = totals.get(key);
        totals.set(key, {
          total: (prev?.total ?? 0) + gasto.total,
          currency: prev?.currency ?? gasto.moneda,
        });
      });
    return totals;
  }, [gastos]);

  const itinerary = useMemo(
    () => buildItinerary({
      planStartIso: plan?.inicio_at ?? new Date().toISOString(),
      planEndIso: plan?.fin_at ?? new Date().toISOString(),
      rows: subplanes,
      finished: isPast,
    }),
    [plan?.inicio_at, plan?.fin_at, subplanes, isPast],
  );
  // First load of a plan's itinerary: open today during the trip, else the first day with something.
  useEffect(() => {
    if (!plan || !subplanesReady || openDaysPlanRef.current === plan.id) return;
    openDaysPlanRef.current = plan.id;
    setOpenDays(new Set(itinerary.defaultOpen ? [itinerary.defaultOpen] : []));
  }, [plan, subplanesReady, itinerary.defaultOpen]);

  const routeDayGroups = useMemo(() => groupByDay(subplanes), [subplanes]);
  const activeRouteDay = selectedMapDay ?? routeDayGroups[0]?.[0] ?? isoDateOnly(plan?.inicio_at ?? "");
  const routeDayItems = useMemo(
    () =>
      subplanes
        .filter((s) => isoDateOnly(s.inicio_at) === activeRouteDay && s.ubicacion_nombre)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at)),
    [activeRouteDay, subplanes],
  );
  const routeStops = useMemo(() => {
    const stops: string[] = [];
    routeDayItems.forEach((s) => {
      if (s.ubicacion_nombre) stops.push(s.ubicacion_nombre);
      if (TIPOS_TRANSPORTE.includes(s.tipo) && s.ubicacion_fin_nombre) stops.push(s.ubicacion_fin_nombre);
    });
    return stops;
  }, [routeDayItems]);
  const routeHasRoute = routeStops.length >= 2;
  const routeShouldShowMap = !(isPast && !routeHasRoute && !plan?.ubicacion_nombre);
  const routeMapsUrl = useMemo(() => {
    if (!routeHasRoute) return null;
    const modes = routeDayItems
      .slice(1)
      .map((s) => TRANSPORT_MAP[s.transporte_llegada ?? ""]?.googleMode ?? "driving");
    const travelmode =
      modes.sort((a, b) => modes.filter((m) => m === b).length - modes.filter((m) => m === a).length)[0] ?? "driving";
    return buildGoogleMapsDirectionsUrl({
      origin: routeStops[0],
      destination: routeStops[routeStops.length - 1],
      waypoints: routeStops.slice(1, -1),
      travelMode: travelmode,
    });
  }, [routeDayItems, routeHasRoute, routeStops]);
  const routeWazeUrl = useMemo(() => {
    if (!routeHasRoute) return null;
    return buildWazeDirectionsUrl(routeStops[routeStops.length - 1]);
  }, [routeHasRoute, routeStops]);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    if (!showMapFullscreen) {
      if (!document.body.hasAttribute("data-modal-open")) {
        document.body.style.overflow = "";
        document.documentElement.style.overflow = "";
      }
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [showMapFullscreen]);

  const visibleBalances = useMemo(() => {
    return [...balances].sort((a, b) => b.importe - a.importe);
  }, [balances]);

  const sortedPlanGastos = useMemo(() => {
    return [...gastos].sort((a, b) => {
      const dateDiff = new Date(b.fecha_gasto).getTime() - new Date(a.fecha_gasto).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [gastos]);

  const pdfInput = useMemo<Omit<PdfInput, "generatedAt"> | null>(
    () =>
      plan
        ? {
            planTitulo: plan.titulo,
            ubicacion: plan.ubicacion_nombre ?? null,
            inicioAt: plan.inicio_at,
            finAt: plan.fin_at,
            isPast,
            gastos: sortedPlanGastos,
            balances: visibleBalances,
            currency: expenseSummary.currency,
          }
        : null,
    [plan, isPast, sortedPlanGastos, visibleBalances, expenseSummary.currency],
  );

  const selectedGasto = useMemo(
    () => gastos.find((gasto) => gasto.id === selectedGastoId) ?? null,
    [gastos, selectedGastoId],
  );

  const openInviteModal = async () => {
    setShowInviteModal(true);
  };

  // From a chat's information («Invitar al plan», board gi-d-plan): the invite sheet, once.
  const invitarHandledRef = useRef(false);
  useEffect(() => {
    if (invitarHandledRef.current || searchParams.get("invitar") !== "1" || !plan) return;
    invitarHandledRef.current = true;
    if (!isPast && isAdmin) void openInviteModal();
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("invitar");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  });

  const handleSubplanCreated = (s: SubplanRow) => {
    setSubplanes((prev) => {
      const sorted = [...prev, s].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newIdx = sorted.findIndex(x => x.id === s.id);
      const next = sorted[newIdx + 1];
      let nextSubplanes = sorted;
      // The subplan immediately after (same day) has a stale polyline — its origin changed.
      if (next && isoDateOnly(next.inicio_at) === isoDateOnly(s.inicio_at) && next.ruta_polyline) {
        // Clear in DB (fire-and-forget, outside render cycle)
        void updateSubplanViaje(next.id, "", "", "");
        nextSubplanes = sorted.map(x =>
          x.id === next.id ? { ...x, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null } : x
        );
      }
      updatePlanDetailCache(user?.id, Number(id), { subplanes: nextSubplanes });
      return nextSubplanes;
    });
  };

  const clearRouteCache = (subplanIds: number[]) => {
    [...new Set(subplanIds)].forEach((subplanId) => {
      if (!subplanId) return;
      void updateSubplanViaje(subplanId, "", "", "").catch(() => {});
    });
  };

  const handleSubplanSaved = (saved: SubplanRow, original?: SubplanRow | null) => {
    revealItineraryDay(localDayKey(saved.inicio_at));
    if (!original) {
      handleSubplanCreated(saved);
      return;
    }

    setSubplanes((prev) => {
      const oldDateKey = isoDateOnly(original.inicio_at);
      const oldDayItems = prev
        .filter((item) => isoDateOnly(item.inicio_at) === oldDateKey)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const oldIndex = oldDayItems.findIndex((item) => item.id === original.id);
      const oldSuccessor = oldIndex >= 0 ? oldDayItems[oldIndex + 1] : undefined;

      const updated = prev.map((item) => item.id === saved.id ? saved : item);
      const sorted = [...updated].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newDateKey = isoDateOnly(saved.inicio_at);
      const newDayItems = sorted
        .filter((item) => isoDateOnly(item.inicio_at) === newDateKey)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newIndex = newDayItems.findIndex((item) => item.id === saved.id);
      const newSuccessor = newIndex >= 0 ? newDayItems[newIndex + 1] : undefined;
      const affectedIds = [saved.id, oldSuccessor?.id ?? 0, newSuccessor?.id ?? 0];

      clearRouteCache(affectedIds);

      const nextSubplanes = sorted.map((item) =>
        affectedIds.includes(item.id)
          ? { ...item, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
          : item
      );
      updatePlanDetailCache(user?.id, Number(id), { subplanes: nextSubplanes });
      return nextSubplanes;
    });
  };

  const handleSubplanDeleted = (deleted: SubplanRow) => {
    setSubplanes((prev) => {
      const dateKey = isoDateOnly(deleted.inicio_at);
      const dayItems = prev
        .filter((item) => isoDateOnly(item.inicio_at) === dateKey)
        .sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      // The next activity of the day was routed from the deleted one: its route is stale.
      const index = dayItems.findIndex((item) => item.id === deleted.id);
      const successor = index >= 0 ? dayItems[index + 1] : undefined;
      if (successor) clearRouteCache([successor.id]);

      const nextSubplanes = prev
        .filter((item) => item.id !== deleted.id)
        .map((item) =>
          item.id === successor?.id
            ? { ...item, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
            : item
        );
      updatePlanDetailCache(user?.id, Number(id), { subplanes: nextSubplanes });
      return nextSubplanes;
    });
    // Its expenses were unlinked or voided server-side.
    loadGastos();
    loadBalances();
  };

  const toggleOpenDay = (dateKey: string) => {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };
  const openItineraryDays = (keys: string[]) => setOpenDays((prev) => new Set([...prev, ...keys]));

  // Opens the day of an activity just saved and scrolls to it (it-sistema «Crear»).
  const revealItineraryDay = (dateKey: string) => {
    openItineraryDays([dateKey]);
    window.setTimeout(() => {
      document.getElementById(itineraryDayId(dateKey))?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const applyLoadedSubplanes = useCallback((rows: SubplanRow[]) => {
    updatePlanDetailCache(user?.id, Number(id), { subplanes: rows });
    setSubplanesReady(true);
    setSubplanes(rows);
  }, [id, user?.id]);

  // Auto-select today if within plan range, else first day with subplanes
  useEffect(() => {
    const days = groupByDay(subplanes);
    if (days.length === 0) return;
    const todayKey = isoDateOnly(new Date().toISOString());
    const todayExists = days.some(([k]) => k === todayKey);
    setSelectedMapDay((prev) => {
      // Keep manual selection if already set and still valid
      if (prev && days.some(([k]) => k === prev)) return prev;
      return todayExists ? todayKey : days[0][0];
    });
  }, [subplanes]);

  const handleViajeComputed = (subplanId: number, duracion: string, distancia: string, polyline: string) => {
    setSubplanes((prev) => {
      const nextSubplanes = prev.map((s) =>
        s.id === subplanId ? { ...s, duracion_viaje: duracion, distancia_viaje: distancia, ruta_polyline: polyline } : s
      );
      updatePlanDetailCache(user?.id, Number(id), { subplanes: nextSubplanes });
      return nextSubplanes;
    });
    updateSubplanViaje(subplanId, duracion, distancia, polyline).catch(() => {});
  };

  // Itinerary legs used to be computed only by the map, for its selected day, so an open
  // day the map had not shown listed "Coche"/"A pie" without time or distance. Compute the
  // missing legs of every open day here (shared cache first, then Google).
  const missingLegs = useMemo(() => {
    if (!subplanesReady) return [];
    const openDayItems = [...openDays].map((key) => itinerary.days.get(key)?.starts ?? []).filter((items) => items.length > 0);
    return findMissingLegs(openDayItems.map((items) => items.map((s) => ({
      id: s.id,
      isTransport: TIPOS_TRANSPORTE.includes(s.tipo),
      transporte: s.transporte_llegada,
      hasLeg: Boolean(s.duracion_viaje || s.distancia_viaje),
      at: s.ubicacion_lat != null && s.ubicacion_lng != null ? { lat: s.ubicacion_lat, lng: s.ubicacion_lng } : null,
      end: s.ubicacion_fin_lat != null && s.ubicacion_fin_lng != null ? { lat: s.ubicacion_fin_lat, lng: s.ubicacion_fin_lng } : null,
    }))));
  }, [itinerary, openDays, subplanesReady]);
  useComputeMissingLegs(missingLegs, handleViajeComputed);

  const handleTransporteChange = async (subplanId: number, transporte: string | null) => {
    // Clear cached route so DayRouteMap recalculates with the new travel mode
    setSubplanes((prev) => {
      const nextSubplanes = prev.map((s) =>
        s.id === subplanId
          ? { ...s, transporte_llegada: transporte, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
          : s
      );
      updatePlanDetailCache(user?.id, Number(id), { subplanes: nextSubplanes });
      return nextSubplanes;
    });
    setEditingTransporteId(null);
    try { await updateSubplanTransporte(subplanId, transporte); }
    catch {
      setSubplanes((prev) => {
        const nextSubplanes = prev.map((s) => s.id === subplanId ? { ...s, transporte_llegada: null } : s);
        updatePlanDetailCache(user?.id, Number(id), { subplanes: nextSubplanes });
        return nextSubplanes;
      });
    }
  };

  useEffect(() => {
    if (id === "static") return; // still resolving real id from query params
    const planId = Number(id);
    if (!planId) { setPlanLoading(false); return; }
    if (!getPlanDetailCache(user?.id, planId)?.plan) {
      setPlanLoading(true);
    }
    fetchPlansByIds({ planIds: [planId] })
      .then((rows) => {
        const nextPlan = rows[0] ?? null;
        setPlan(nextPlan);
        updatePlanDetailCache(user?.id, planId, { plan: nextPlan });
      })
      .catch(console.error)
      .finally(() => setPlanLoading(false));
  }, [id, user?.id]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId) return;
    fetchSubplanes(planId).then(applyLoadedSubplanes).catch(console.error);

    // Saving several legs fires one change each: reload once when they stop arriving.
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(createRealtimeTopic("subplan-changes", planId))
      .on("postgres_changes", { event: "*", schema: "public", table: "subplan", filter: `plan_id=eq.${planId}` }, () => {
        clearTimeout(reloadTimer);
        reloadTimer = setTimeout(() => {
          fetchSubplanes(planId).then(applyLoadedSubplanes).catch(console.error);
        }, 300);
      })
      .subscribe();
    return () => {
      clearTimeout(reloadTimer);
      void supabase.removeChannel(channel);
    };
  }, [id, applyLoadedSubplanes]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId || !user?.id) return;
    fetchPlanUserRol(planId, user.id).then((rol) => {
      if (rol === null) { router.push("/calendar"); return; }
      setIsAdmin(rol === "ADMIN");
      setMembershipChecked(true);
      updatePlanDetailCache(user.id, planId, { isAdmin: rol === "ADMIN", membershipChecked: true });
    }).catch(() => router.push("/calendar"));

  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recargar lista de miembros cuando alguien entra o sale del chat del plan
  useEffect(() => {
    if (!planChat?.chat_id || !user?.id) return;
    const planId = Number(id);
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(createRealtimeTopic("chat-members", planChat.chat_id))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_miembro", filter: `chat_id=eq.${planChat.chat_id}` }, () => {
        void fetchPlanChatItem(planId).then((chat) => {
          setPlanChat(chat);
          updatePlanDetailCache(user.id, planId, { planChat: chat });
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_miembro", filter: `chat_id=eq.${planChat.chat_id}` }, () => {
        void fetchPlanUserRol(planId, user.id).then((rol) => {
          if (rol === null) { router.push("/calendar"); return; }
          void fetchPlanChatItem(planId).then((chat) => {
            setPlanChat(chat);
            updatePlanDetailCache(user.id, planId, { planChat: chat });
          });
        });
      })
      // Cambio de rol (promover/degradar admin) leído de la base de datos. No usa el canal
      // msg:<chat> del chat: supabase.channel() devuelve el canal existente con el mismo nombre
      // y ChatConversation no podría añadirle sus listeners ni quitarlo sin romper este.
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "plan_usuarios", filter: `plan_id=eq.${planId}` }, ({ new: row }) => {
        const { user_id, rol } = row as { user_id: string; rol: string };
        if (user_id === user.id) setIsAdmin(rol === "ADMIN");
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [planChat?.chat_id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const planId = Number(id);
    if (!planId || !user?.id) return;
    fetchPlanChatItem(planId).then((chat) => {
      setPlanChat(chat);
      updatePlanDetailCache(user.id, planId, { planChat: chat });
    }).catch(console.error);
  }, [id, user?.id]);

  const loadGastos = () => {
    const planId = Number(id);
    if (!planId) return;
    listGastosForPlanEndpoint(planId).then((rows) => {
      setGastos(rows);
      updatePlanDetailCache(user?.id, planId, { gastos: rows });
    }).catch(console.error);
  };

  const loadBalances = () => {
    const planId = Number(id);
    if (!planId) return;
    getBalancesForPlanEndpoint(planId).then((rows) => {
      setBalances(rows);
      updatePlanDetailCache(user?.id, planId, { balances: rows });
    }).catch(console.error);
  };

  // Presupuesto del grupo y tope personal. Solo se cargan para la pestaña Gastos y se ven al recargar.
  const loadTopes = () => {
    const planId = Number(id);
    if (!planId) return;
    fetchTopesEndpoint(planId).then(setTopes).catch(console.error);
  };

  const handlePaid = (result: PaidResult) => {
    loadBalances();
    toast(`Pago a ${result.toName} marcado`, "success", {
      label: "Deshacer",
      onClick: () => {
        deshacerPagoEndpoint(result.pagoId)
          .then(loadBalances)
          .catch(() => toastError("No se ha podido deshacer el pago."));
      },
    });
  };

  useEffect(() => { loadGastos(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  // Gastos y pagos en vivo: si otra persona añade un gasto, marca un pago o lo confirma, se refresca solo.
  // Un gasto nuevo dispara varios cambios seguidos (el gasto, sus partes, el recálculo): se recarga una vez.
  useEffect(() => {
    const planId = Number(id);
    if (!planId) return;
    let reloadTimer: ReturnType<typeof setTimeout> | undefined;
    const reload = () => {
      clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        loadGastos();
        loadBalances();
      }, 400);
    };
    // Presupuesto del grupo (lo cambia un admin) y tope personal (otro dispositivo tuyo): solo se recargan ellos.
    let topesTimer: ReturnType<typeof setTimeout> | undefined;
    const reloadTopesSoon = () => {
      clearTimeout(topesTimer);
      topesTimer = setTimeout(loadTopes, 300);
    };
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(createRealtimeTopic("gastos-changes", planId))
      .on("postgres_changes", { event: "*", schema: "public", table: "gastos", filter: `plan_id=eq.${planId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "liquidaciones", filter: `plan_id=eq.${planId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_presupuestos", filter: `plan_id=eq.${planId}` }, reloadTopesSoon)
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_topes", filter: `plan_id=eq.${planId}` }, reloadTopesSoon)
      .subscribe();
    return () => {
      clearTimeout(reloadTimer);
      clearTimeout(topesTimer);
      void supabase.removeChannel(channel);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadBalances(); loadTopes(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleGastoCreated = (event: Event) => {
      const detail = (event as CustomEvent<{ planId?: number }>).detail;
      if (detail?.planId !== Number(id)) return;
      loadGastos();
      loadBalances();
    };

    window.addEventListener("frimee:gasto-created", handleGastoCreated);
    return () => window.removeEventListener("frimee:gasto-created", handleGastoCreated);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setMobileCreateOpen(false);
  }, [activeTab, showAddSheet, showAddGastoSheet]);
  useEffect(() => {
    if (selectedGastoId && !gastos.some((gasto) => gasto.id === selectedGastoId)) {
      setSelectedGastoId(null);
    }
  }, [gastos, selectedGastoId]);

  const openCreateSubplan = () => {
    setMobileCreateOpen(false);
    setEditingSubplan(null);
    setAddSheetInitialTitulo(undefined);
    setAddSheetInitialDate(undefined);
    setShowAddSheet(true);
  };

  const openCreateGasto = () => {
    setMobileCreateOpen(false);
    setShowAddGastoSheet(true);
  };

  const routeMotionProps = {
    style: { transform: routeTransform, transition: routeTransition, touchAction: "pan-y" },
    onPointerDown: handleRoutePointerDown,
    onPointerMove: handleRoutePointerMove,
    onPointerUp: handleRoutePointerEnd,
    onPointerCancel: handleRoutePointerEnd,
  };
  const routeContainerClass = isOverlayPresentation
    ? activeTab === "chat"
      ? "fixed inset-0 z-[1200] h-dvh overflow-hidden"
      : "fixed inset-0 z-[1200] overflow-y-auto overscroll-contain scrollbar-overlay-subtle"
    : activeTab === "chat"
      ? "relative z-[1] h-dvh overflow-hidden"
      : "relative z-[1] min-h-dvh";
  const routeLoadingClass = isOverlayPresentation
    ? "fixed inset-0 z-[1200] overflow-y-auto overscroll-contain scrollbar-overlay-subtle"
    : "relative z-[1]";

  // nav-04: as an overlay the sidebar stays outside the sliding layer and above it, so it never
  // slides along nor gets covered (the skeleton has none). As a page it scrolls with the page as before.
  // «Crear» in the sidebar starts with this plan («En este plan»).
  const sidebarPlanContext: CreateMenuPlanContext | undefined = plan ? {
    planId: plan.id,
    title: plan.titulo,
    canEdit: !isPast && canAdd,
    canInvite: !isPast && isAdmin,
    onActividad: () => { setActiveTab("itinerario"); openCreateSubplan(); },
    onGasto: () => { setActiveTab("gastos"); setShowAddGastoSheet(true); },
    onInvitar: () => { void openInviteModal(); },
  } : undefined;
  const fixedSidebar = isOverlayPresentation ? (
    <div className="relative z-[1201]"><AppSidebar hideMobileNav={true} planContext={sidebarPlanContext} /></div>
  ) : null;

  if (loading || planLoading || !membershipChecked) return (
    <>
      {fixedSidebar}
      <div className={`${routeLoadingClass} will-change-transform`} {...routeMotionProps}>
        <PlanDetailSkeleton />
      </div>
    </>
  );
  if (!plan) return (
    <>
      {fixedSidebar}
      <div className={`${routeLoadingClass} flex min-h-dvh items-center justify-center bg-app text-muted will-change-transform`} {...routeMotionProps}>
        Plan no encontrado.
      </div>
    </>
  );

  return (
    <>
    {fixedSidebar}
    <div className={`${routeContainerClass} bg-app text-app ${routeIsMoving ? "will-change-transform" : ""}`} {...routeMotionProps}>
      <div className={`relative w-full ${activeTab === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
        {!isOverlayPresentation && <AppSidebar hideMobileNav={true} planContext={sidebarPlanContext} />}
        <main className={`${activeTab === "chat" ? "h-dvh overflow-hidden" : "pb-[max(var(--space-6),env(safe-area-inset-bottom))]"} md:py-0 md:pl-[102px]`}>
          <div className={`${activeTab === "chat" ? "h-full" : ""} md:grid md:grid-cols-[minmax(88px,1fr)_minmax(0,1536px)_minmax(88px,1fr)] xl:grid-cols-[minmax(180px,1fr)_minmax(0,1280px)_minmax(180px,1fr)] 2xl:grid-cols-[minmax(240px,1fr)_minmax(0,1240px)_minmax(240px,1fr)]`}>
            <div className={`${activeTab === "chat" ? "flex h-full min-h-0 flex-col" : ""} md:col-start-2`}>

          {/* ─── Hero ─── */}
          <div
            className={`relative w-full overflow-hidden transition-[height] duration-300 md:ml-0 md:[border-bottom-left-radius:var(--radius-card)] md:[border-bottom-right-radius:var(--radius-card)] ${
              activeTab === "chat"
                ? "h-[clamp(165px,21vh,195px)] md:h-[clamp(260px,40vh,380px)]"
                : "h-[clamp(190px,29vh,270px)] md:h-[clamp(260px,40vh,380px)]"
            }`}
          >
            {plan.foto_portada ? (
              <Image
                src={plan.foto_portada}
                alt={plan.titulo}
                fill
                sizes="100vw"
                priority
                className="absolute inset-0 h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a2a4a] to-[#0d1a2e] flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" className="size-16 text-white/15" aria-hidden>
                  <path d="M22 16.5H2M5 19.5h14M12 3L4.5 13.5h15L12 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            )}
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            {/* Back button */}
            <button
              onClick={() => closePlanRoute("back")}
              className="mobile-safe-action-top absolute left-[var(--page-margin-x)] z-20 flex size-11 items-center justify-center rounded-full border border-transparent bg-transparent text-white shadow-none transition-colors hover:bg-white/10 md:top-[var(--space-6)] md:size-9 md:border-app md:bg-surface md:text-app md:shadow-elev-3 md:hover:bg-surface-2"
            >
              <BackIcon className="size-[22px] md:size-[20px]" />
            </button>

            {!isPast && isAdmin && (
              <button
                type="button"
                aria-label="Editar plan"
                onClick={() => setShowEditModal(true)}
                className="mobile-safe-action-top absolute right-[var(--page-margin-x)] flex size-11 items-center justify-center rounded-full border border-transparent bg-transparent text-white shadow-none transition-colors hover:bg-white/10 md:top-[var(--space-6)] md:size-9 md:border-app md:bg-surface md:text-app md:shadow-elev-3 md:hover:bg-surface-2"
              >
                <EditIcon className="size-[21px] md:size-[18px]" />
              </button>
            )}
            {isPast && (
              <div className="mobile-safe-action-top absolute right-[var(--page-margin-x)] flex flex-col items-end gap-2 md:top-[var(--space-6)]">
                <span className="rounded-full border border-white/30 bg-black/30 px-3 py-[6px] text-[13px] font-[600] text-white/90 backdrop-blur-sm">
                  Finalizado
                </span>
                {noFui && (
                  <button
                    type="button"
                    disabled={sellando}
                    onClick={() => void handleVolverASellar()}
                    className="min-h-11 rounded-full border border-white/30 bg-black/40 px-3 py-[6px] text-[13px] font-[600] text-white backdrop-blur-sm transition-colors hover:bg-black/55 disabled:opacity-60"
                  >
                    Volver a sellar este viaje
                  </button>
                )}
              </div>
            )}

            {/* Title & meta */}
            <div className="absolute bottom-0 left-0 right-0 z-10 px-[var(--page-margin-x)] pb-[var(--space-4)]">
              <h1 className="[font-family:var(--font-display-face)] text-[clamp(24px,5vw,36px)] font-[var(--fw-medium)] leading-[1.1] tracking-[-0.01em] text-white md:max-w-[70%]">
                {plan.titulo}
              </h1>
              {plan.descripcion && (
                <p className="mt-[var(--space-1)] max-w-[min(100%,560px)] truncate text-body-sm text-white/75 md:max-w-[70%] md:whitespace-normal md:line-clamp-2">
                  {plan.descripcion}
                </p>
              )}
              <div className="mt-[var(--space-2)] flex min-w-0 items-center gap-[var(--space-3)] pr-[132px] text-white/85 md:pr-[220px]">
                <span className="flex shrink-0 items-center gap-[5px] text-body-sm">
                  <CalendarSmallIcon className="size-[14px] shrink-0" />
                  {formatDateRange(plan.inicio_at, plan.fin_at)} · {tripProgressText(itinerary)}
                </span>
                <span className="flex min-w-0 items-center gap-[5px] text-body-sm">
                  <MapPinIcon className="size-[14px] shrink-0" />
                  <span className="min-w-0 truncate">{plan.ubicacion_nombre}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-[var(--space-4)] right-[var(--page-margin-x)] flex gap-[var(--space-2)]">
                {FEED_ENABLED && isAdmin && (
                  <button
                    onClick={() => setShowPublishModal(true)}
                    className="flex h-9 items-center gap-1.5 rounded-full border border-app bg-surface px-3.5 text-[14px] font-[600] text-app shadow-elev-3 transition-colors hover:bg-surface-2"
                  >
                    <Upload className="size-[15px]" aria-hidden />
                    <span className="hidden min-[390px]:inline">Publicar</span>
                  </button>
                )}
                {!isPast && isAdmin && (
                  <button
                    type="button"
                    aria-label="Agregar amigos"
                    onClick={() => void openInviteModal()}
                    className="flex size-11 items-center justify-center rounded-full border border-transparent bg-transparent text-white shadow-none transition-colors hover:bg-white/10 md:size-9 md:border-app md:bg-surface md:text-app md:shadow-elev-3 md:hover:bg-surface-2"
                  >
                    <InviteIcon className="size-[21px] md:size-[18px]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="px-[var(--page-margin-x)]">
            <div className="flex items-center justify-between">
              <Tabs
                tabs={[
                  { value: "itinerario", label: "Itinerario" },
                  { value: "gastos", label: "Gastos" },
                  { value: "fotos", label: "Álbum" },
                  { value: "chat", label: "Chat" },
                ]}
                value={activeTab}
                onChange={(value) => setActiveTab(value as Tab)}
                className="flex-1 pb-[var(--space-3)] pt-[var(--space-3)] text-body-sm"
                fontWeight="var(--fw-semibold)"
              />
              {activeTab === "chat" && planChat && (
                <div className="hidden items-center gap-[var(--space-1)] pb-[2px] pl-[var(--space-4)] md:flex">
                  <button
                    type="button"
                    onClick={() => {
                      const nombre = resolveChatName(planChat, user!.id);
                      const foto = resolveChatAvatar(planChat, user!.id) ?? undefined;
                      const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                      void startCall(String(planChat.chat_id), "audio", nombre, foto, miembros);
                    }}
                    className="flex size-[32px] items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-app"
                    aria-label="Llamada de voz"
                  >
                    <PhoneCallIcon className="size-[18px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nombre = resolveChatName(planChat, user!.id);
                      const foto = resolveChatAvatar(planChat, user!.id) ?? undefined;
                      const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                      void startCall(String(planChat.chat_id), "video", nombre, foto, miembros);
                    }}
                    className="flex size-[32px] items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-app"
                    aria-label="Videollamada"
                  >
                    <VideoCallIcon className="size-[18px]" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Chat tab ─── */}
          {activeTab === "chat" && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden pt-4 md:pt-0">
              {planChat && user ? (
                <ChatConversation
                  chat={planChat}
                  currentUserId={user.id}
                  onBack={() => setActiveTab("itinerario")}
                  onNewMessage={() => {}}
                  onStartCall={(tipo) => {
                    const nombre = resolveChatName(planChat, user.id);
                    const foto = resolveChatAvatar(planChat, user.id) ?? undefined;
                    const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                    void startCall(String(planChat.chat_id), tipo, nombre, foto, miembros);
                  }}
                  onJoinCall={(llamadaId, roomName, tipo) => {
                    const nombre = resolveChatName(planChat, user.id);
                    const foto = resolveChatAvatar(planChat, user.id) ?? undefined;
                    const miembros = planChat.miembros.map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? undefined }));
                    void joinCall(llamadaId, roomName, String(planChat.chat_id), tipo, nombre, foto, miembros);
                  }}
                  inCall={callState.status !== "idle"}
                  registerCallReload={(fn) => { reloadCallMessagesRef.current = fn; }}
                  containerClassName="flex min-h-0 flex-1 flex-col"
                  embedded
                  initialMessageId={chatInitialMessageId}
                  planInfo={plan ? { titulo: plan.titulo, inicio_at: plan.inicio_at, fin_at: plan.fin_at, ubicacion_nombre: plan.ubicacion_nombre } : undefined}
                  planId={plan?.id}
                  isAdmin={isAdmin}
                  onAbrirActividad={(titulo, extra) => {
                    if (isPast || !canAdd) return;
                    setEditingSubplan(null);
                    setAddSheetInitialTitulo(titulo);
                    setAddSheetInitialDate(extra?.fecha || undefined);
                    setAddSheetInitialHora(extra?.hora || undefined);
                    setAddSheetInitialTipo(isTipoSubplan(extra?.tipo) ? extra.tipo : undefined);
                    setAddSheetInitialUbicacion(extra?.lugar ? {
                      nombre: extra.lugar,
                      ...(extra.lat != null && extra.lng != null
                        ? { lat: extra.lat, lng: extra.lng }
                        : { buscar: plan?.ubicacion_nombre ? `${extra.lugar}, ${plan.ubicacion_nombre}` : extra.lugar }),
                    } : undefined);
                    setShowAddSheet(true);
                    setActiveTab("itinerario");
                  }}
                  onLeave={() => closePlanRoute("calendar")}
                  onMembersChanged={() => {
                    const planId = Number(id);
                    if (planId) {
                      void fetchPlanChatItem(planId).then((chat) => {
                        setPlanChat(chat);
                        updatePlanDetailCache(user?.id, planId, { planChat: chat });
                      });
                    }
                  }}
                />
              ) : (
                <div className="flex h-[50vh] items-center justify-center text-body-sm text-muted">
                  Cargando chat...
                </div>
              )}
            </div>
          )}

          {/* ─── Fotos tab ─── */}
          {activeTab === "fotos" && plan && user && (
            <PlanFotosTab
              planId={plan.id}
              currentUserId={user.id}
              isMember={membershipChecked}
              isAdmin={isAdmin}
              refreshKey={photoAlbumRefreshKey}
              incomingFiles={fabFiles}
              onIncomingConsumed={() => setFabFiles(null)}
            />
          )}

          {/* ─── Content ─── */}
          {activeTab !== "chat" && activeTab !== "fotos" && <div className="px-[var(--page-margin-x)] pt-[var(--space-6)] pb-[var(--space-3)] md:pb-[var(--space-16)]">

            {activeTab === "itinerario" && (
              <div
                className="flex flex-col gap-[var(--space-5)] sm:gap-[var(--space-6)] lg:flex-row lg:gap-[var(--space-12)]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >

                {/* Left column — itinerary */}
                <div className="flex-1 min-w-0">
                  <Itinerary
                    model={itinerary}
                    finished={isPast}
                    canEdit={canAdd}
                    openDays={openDays}
                    onToggleDay={toggleOpenDay}
                    onOpenDays={openItineraryDays}
                    dayExpenses={dayExpenseTotals}
                    expenseTotal={{ total: expenseSummary.total, currency: expenseSummary.currency, count: expenseSummary.count }}
                    editingTransporteId={editingTransporteId}
                    onEditTransporte={setEditingTransporteId}
                    onTransporteChange={handleTransporteChange}
                    onEdit={(s) => {
                      setEditingSubplan(s);
                      setAddSheetInitialTitulo(undefined);
                      setAddSheetInitialDate(undefined);
                      setShowAddSheet(true);
                    }}
                    onAdd={(dateKey) => {
                      setEditingSubplan(null);
                      setAddSheetInitialTitulo(undefined);
                      setAddSheetInitialDate(dateKey);
                      setShowAddSheet(true);
                    }}
                    onOpenAlbum={() => setActiveTab("fotos")}
                  />
                </div>

                {/* Right column — route map + expenses */}
                <div className="lg:w-[340px] lg:shrink-0">

                  {/* Finished trip: every stop on one map, built only when it scrolls into view. */}
                  {isPast && subplanes.some((s) => s.ubicacion_nombre) && (
                    <div className="mb-[var(--space-8)]">
                      <h3 className="mb-[var(--space-3)] text-body font-[var(--fw-semibold)]">Recorrido del viaje</h3>
                      <WhenVisible placeholderClassName="h-[320px] rounded-card border border-app bg-surface-inset">
                        <TripOverviewMap subplanes={subplanes} heightClassName="h-[320px]" />
                      </WhenVisible>
                    </div>
                  )}

                  {/* No activities yet: the map is not loaded (it-sistema «Mapa»). */}
                  {!isPast && subplanes.length === 0 && (
                    <div className="mb-[var(--space-8)]">
                      <h3 className="mb-[var(--space-3)] text-body font-[var(--fw-semibold)]">Ruta del día</h3>
                      <MapPlaceholder />
                    </div>
                  )}

                  {/* Route map card */}
                  {!isPast && subplanes.length > 0 && routeShouldShowMap && (
                    <div className="mb-[var(--space-8)]">
                      <div className="mb-[var(--space-3)] flex items-center justify-between">
                        <h3 className="text-body font-[var(--fw-semibold)]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Ruta del día</h3>
                      </div>
                      {routeDayGroups.length > 1 && (
                        <div className="mb-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
                          {routeDayGroups.map(([dateKey]) => {
                            const d = new Date(dateKey);
                            const label = `${d.getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]}`;
                            const isActive = activeRouteDay === dateKey;
                            return (
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => setSelectedMapDay(dateKey)}
                                className={`rounded-chip border px-[var(--space-3)] py-[4px] text-caption transition-colors ${isActive ? "border-primary-token bg-primary-token/10 text-primary-token" : "border-app text-muted hover:text-app"}`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="relative">
                        <DayRouteMap
                          subplanes={subplanes}
                          selectedDate={activeRouteDay}
                          ubicacionNombre={plan.ubicacion_nombre ?? undefined}
                          onViajeComputed={handleViajeComputed}
                          onLoadingChange={setMapLoading}
                        />
                        <div inert={mapLoading} className={`absolute left-[var(--space-3)] top-[var(--space-3)] z-10 ${MAP_FAB_TRANSITION} ${mapFabClassName(mapLoading)} items-center gap-[var(--space-2)]`}>
                          {routeHasRoute && routeMapsUrl && (
                            <a
                              href={routeMapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                              title="Abrir ruta en Google Maps"
                            >
                              <Image src="/brands/google-maps.svg" alt="Google Maps" width={18} height={18} className="size-[18px]" />
                              <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                                <ExternalLinkIcon className="size-[8px]" />
                              </span>
                            </a>
                          )}
                          {routeHasRoute && routeWazeUrl && (
                            <a
                              href={routeWazeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="relative flex h-[34px] w-[34px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                              title="Abrir ruta en Waze"
                            >
                              <Image src="/brands/waze-icon.svg" alt="Waze" width={18} height={18} className="size-[18px]" />
                              <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                                <ExternalLinkIcon className="size-[8px]" />
                              </span>
                            </a>
                          )}
                        </div>
                        <div inert={mapLoading} className={`absolute right-[var(--space-3)] top-[var(--space-3)] z-10 ${MAP_FAB_TRANSITION} ${mapFabClassName(mapLoading)} items-center gap-[var(--space-2)]`}>
                          <button
                            type="button"
                            onClick={() => setShowMapFullscreen(true)}
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/12 bg-black/58 text-white shadow-[0_8px_20px_rgba(0,0,0,0.34)] backdrop-blur-sm transition-transform hover:scale-[1.04] hover:bg-black/66"
                            title="Ver mapa en pantalla completa"
                            aria-label="Ver mapa en pantalla completa"
                          >
                            <Maximize2 className="size-[16px]" strokeWidth={1.9} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Expenses summary */}
                  <ExpenseSummaryCard
                    summary={expenseSummary}
                    balances={visibleBalances}
                    userId={user?.id}
                    onOpen={() => setActiveTab("gastos")}
                  />
                </div>
              </div>
            )}

            {activeTab === "gastos" && (
              <GastosTab
                gastos={sortedPlanGastos}
                balances={visibleBalances}
                userId={user?.id}
                summary={expenseSummary}
                planStart={plan?.inicio_at ?? null}
                isPast={isPast}
                canAdd={canAdd}
                onOpenGasto={setSelectedGastoId}
                onPagar={setPagarDeuda}
                onAdd={() => setShowAddGastoSheet(true)}
                onPdf={() => setShowInvoiceModal(true)}
                topes={topes}
                isAdmin={isAdmin}
                onEditTope={setBudgetSheet}
              />
            )}

          </div>}

            </div>
          </div>

        </main>
      </div>

      {showMapFullscreen && routeShouldShowMap && plan && (
        <div className="fixed inset-0 z-[85] bg-app overscroll-none">
          <div className="relative h-full w-full">
            <DayRouteMap
              subplanes={subplanes}
              selectedDate={activeRouteDay}
              ubicacionNombre={plan.ubicacion_nombre ?? undefined}
              onViajeComputed={handleViajeComputed}
              onLoadingChange={setFullscreenMapLoading}
              loaderVariant="fullscreen"
              heightClassName="h-full"
              containerClassName="h-full"
            />
            {/* The close button and the day chips stay usable while it loads. */}
            <div inert={fullscreenMapLoading} className={`absolute left-[max(var(--space-3),env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top)+var(--space-3))] z-10 ${MAP_FAB_TRANSITION} ${mapFabClassName(fullscreenMapLoading)} items-center gap-[var(--space-2)]`}>
              {routeHasRoute && routeMapsUrl && (
                <a
                  href={routeMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                  title="Abrir ruta en Google Maps"
                >
                  <Image src="/brands/google-maps.svg" alt="Google Maps" width={20} height={20} className="size-[20px]" />
                  <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                    <ExternalLinkIcon className="size-[8px]" />
                  </span>
                </a>
              )}
              {routeHasRoute && routeWazeUrl && (
                <a
                  href={routeWazeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full border border-app bg-app/88 shadow-elev-2 backdrop-blur-sm transition-transform hover:scale-[1.04]"
                  title="Abrir ruta en Waze"
                >
                  <Image src="/brands/waze-icon.svg" alt="Waze" width={20} height={20} className="size-[20px]" />
                  <span className="absolute right-[-3px] top-[-3px] flex h-[15px] w-[15px] items-center justify-center rounded-full border border-app bg-app text-app shadow-[0_2px_8px_rgba(0,0,0,0.18)]">
                    <ExternalLinkIcon className="size-[8px]" />
                  </span>
                </a>
              )}
            </div>
            <div className="absolute right-[max(var(--space-3),env(safe-area-inset-right))] top-[calc(env(safe-area-inset-top)+var(--space-3))] z-10 flex items-center gap-[var(--space-2)]">
              <CloseButton
                onClick={() => setShowMapFullscreen(false)}
                label="Cerrar mapa"
                tone="light"
                className="border border-white/12 bg-black/58 shadow-[0_8px_20px_rgba(0,0,0,0.34)] backdrop-blur-sm hover:bg-black/66"
              />
            </div>
            {routeDayGroups.length > 1 && (
              <div className="absolute inset-x-[var(--page-margin-x)] bottom-[calc(env(safe-area-inset-bottom)+var(--space-4))] z-10 flex flex-wrap justify-center gap-[var(--space-2)]">
                {routeDayGroups.map(([dateKey]) => {
                  const d = new Date(dateKey);
                  const label = `${d.getDate()} ${["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][d.getMonth()]}`;
                  const isActive = activeRouteDay === dateKey;
                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedMapDay(dateKey)}
                      className={`rounded-full px-[var(--space-3)] py-[5px] text-caption font-[var(--fw-medium)] shadow-[0_2px_8px_rgba(0,0,0,0.25)] backdrop-blur-md transition-colors ${isActive ? "bg-primary-token text-contrast-token" : "bg-app/82 text-app hover:bg-app"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "gastos" && !isPast && canAdd && !showAddSheet && !showAddGastoSheet && !editingGasto && (
        <button
          type="button"
          onClick={openCreateGasto}
          aria-label="Añadir gasto"
          className="fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-[calc(env(safe-area-inset-right)+16px)] z-[65] flex h-14 items-center gap-2 rounded-full bg-primary-token pl-4 pr-5 text-[15px] font-[var(--fw-semibold)] text-contrast-token shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.14)] md:hidden"
        >
          <PlusIcon className="size-[22px]" />
          Gasto
        </button>
      )}

      {!showAddSheet && !showAddGastoSheet && !editingGasto && (
        activeTab === "itinerario" || activeTab === "fotos"
      ) && (!isPast || membershipChecked || isAdmin) && (membershipChecked || isAdmin) && (
        <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+16px)] right-[calc(env(safe-area-inset-right)+16px)] z-[65] md:hidden">
          <div className={`absolute bottom-[calc(100%+12px)] right-0 flex flex-col items-end gap-2 transition-all duration-200 ease-out ${mobileCreateOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            {!isPast && canAdd && (
              <button
                type="button"
                onClick={openCreateSubplan}
                aria-label="Crear subplan"
                className="pointer-events-auto flex min-h-12 min-w-[150px] max-w-[calc(100vw-32px)] items-center justify-between gap-2.5 rounded-full border border-app bg-app py-[7px] pl-5 pr-4 text-app shadow-[0_0_0_1px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.12)]"
              >
                <span className="whitespace-nowrap text-caption font-[var(--fw-semibold)]">
                  Crear subplan
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <CalendarSmallIcon className="size-6" />
                </span>
              </button>
            )}
            {!isPast && (
              <button
                type="button"
                onClick={openCreateGasto}
                aria-label="Crear gasto"
                className="pointer-events-auto flex min-h-12 min-w-[150px] max-w-[calc(100vw-32px)] items-center justify-between gap-2.5 rounded-full border border-app bg-app py-[7px] pl-5 pr-4 text-app shadow-[0_0_0_1px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.12)]"
              >
                <span className="whitespace-nowrap text-caption font-[var(--fw-semibold)]">
                  Crear gasto
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <FileText className="size-6" aria-hidden />
                </span>
              </button>
            )}
            {membershipChecked && (
              <button
                type="button"
                onClick={openPhotoUpload}
                aria-label="Subir fotos o vídeos"
                className="pointer-events-auto flex min-h-12 min-w-[150px] max-w-[calc(100vw-32px)] items-center justify-between gap-2.5 rounded-full border border-app bg-app py-[7px] pl-5 pr-4 text-app shadow-[0_0_0_1px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.12)] disabled:opacity-60"
              >
                <span className="whitespace-nowrap text-caption font-[var(--fw-semibold)]">
                  Subir foto
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <Upload className="size-6" aria-hidden />
                </span>
              </button>
            )}
          </div>
          <input
            ref={fabPhotoInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={handleFabPhotoFilesSelected}
          />
          <button
            type="button"
            aria-label={mobileCreateOpen ? "Cerrar crear" : "Crear"}
            aria-expanded={mobileCreateOpen}
            onClick={() => setMobileCreateOpen((open) => !open)}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary-token text-contrast-token shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.14)] transition-transform duration-200 active:scale-95"
          >
            <PlusIcon className={`size-7 transition-transform duration-200 ${mobileCreateOpen ? "rotate-45" : "rotate-0"}`} />
          </button>
        </div>
      )}

      {showAddSheet && plan && !isPast && canAdd && (
        <AddSubplanSheet
          planId={plan.id}
          planStartDate={plan.inicio_at}
          planEndDate={plan.fin_at}
          planTitle={plan.titulo}
          subplanes={subplanes}
          onClose={() => {
            setShowAddSheet(false);
            setEditingSubplan(null);
            setAddSheetInitialTitulo(undefined);
            setAddSheetInitialDate(undefined);
            setAddSheetInitialHora(undefined);
            setAddSheetInitialTipo(undefined);
            setAddSheetInitialUbicacion(undefined);
          }}
          onSaved={handleSubplanSaved}
          onDeleted={handleSubplanDeleted}
          gastosCount={editingSubplan ? gastos.filter((g) => g.subplan_id === editingSubplan.id).length : 0}
          initialTitulo={addSheetInitialTitulo}
          initialDate={addSheetInitialDate}
          initialHora={addSheetInitialHora}
          initialTipo={addSheetInitialTipo}
          initialUbicacion={addSheetInitialUbicacion}
          initialSubplan={editingSubplan}
        />
      )}

      {showAddGastoSheet && plan && user && (
        <AddGastoSheet
          planId={plan.id}
          userId={user.id}
          planName={plan.titulo}
          onClose={() => setShowAddGastoSheet(false)}
          onCreated={() => {
            loadGastos();
            loadBalances();
          }}
        />
      )}

      {budgetSheet && plan && user && (
        <BudgetSheet
          planId={plan.id}
          initialMode={budgetSheet}
          isAdmin={isAdmin}
          topes={topes}
          currency={expenseSummary.currency}
          spent={expenseSummary.total}
          yourShare={expenseSummary.yourShare}
          people={expenseSummary.participantCount}
          onClose={() => setBudgetSheet(null)}
          onSaved={loadTopes}
        />
      )}

      {editingGasto && plan && user && (
        <AddGastoSheet
          key={editingGasto.id}
          planId={plan.id}
          userId={user.id}
          planName={plan.titulo}
          gasto={editingGasto}
          onClose={() => setEditingGasto(null)}
          onCreated={() => {
            loadGastos();
            loadBalances();
          }}
        />
      )}

      <PlanGastoDetailModal
        key={selectedGasto?.id ?? "none"}
        gasto={selectedGasto}
        currentUserId={user?.id ?? null}
        members={(planChat?.miembros ?? []).map((m) => ({ id: m.id, nombre: m.nombre, foto: m.profile_image ?? null }))}
        isAdmin={isAdmin}
        onEdit={(g) => {
          setSelectedGastoId(null);
          setEditingGasto(g);
        }}
        onOpenActivity={() => setActiveTab("itinerario")}
        onClose={() => setSelectedGastoId(null)}
        onDeleted={() => {
          // The detail modal closes itself once the voided expense leaves the list.
          loadGastos();
          loadBalances();
        }}
      />

      {/* Invite modal */}
      {showPublishModal && plan && (
        <PublishPlanModal
          plan={plan}
          onClose={() => setShowPublishModal(false)}
        />
      )}

      {showInviteModal && plan && user?.id && (
        <InviteSheet
          planId={plan.id}
          planTitle={plan.titulo}
          planDates={formatDateRange(plan.inicio_at, plan.fin_at)}
          members={(planChat?.miembros ?? []).map((m) => ({ id: m.id, nombre: m.nombre, profile_image: m.profile_image ?? null }))}
          currentUserId={user.id}
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showInvoiceModal && pdfInput && (
        <GastosPdfModal input={pdfInput} closing={invoiceClosing} onClose={closeInvoiceModal} />
      )}

      {showEditModal && plan && (() => {
        const initialValues: EditPlanInitialValues = {
          title: plan.titulo,
          description: plan.descripcion ?? "",
          location: plan.ubicacion_nombre && plan.ubicacion_nombre !== PLACE_TBD ? plan.ubicacion_nombre : "",
          when: isoToPlanWhen(plan.inicio_at, plan.fin_at, plan.all_day),
          coverImageUrl: plan.foto_portada ?? null,
          visibility: (plan.visibilidad === "PÚBLICO" || plan.visibilidad === "SOLO_GRUPO") ? plan.visibilidad : "SOLO_GRUPO",
        };
        return (
          <CreatePlanModal
            open={showEditModal}
            onClose={() => setShowEditModal(false)}
            mode="edit"
            initialValues={initialValues}
            onCreate={async (payload) => {
              if (!user) return;
              const planId = Number(id);
              let coverUrl = payload.coverImageUrl;

              if (payload.coverFile) {
                const { downloadUrl } = await uploadPlanCoverFile({ file: payload.coverFile, userId: user.id });
                coverUrl = downloadUrl;
              }

              const { inicioAt, finAt } = planWhenToIso(payload.when);
              await updatePlanEndpoint({
                planId,
                titulo: payload.title,
                descripcion: payload.description,
                inicioAt,
                finAt,
                ubicacionNombre: payload.location || PLACE_TBD,
                allDay: payload.when.allDay,
                visibilidad: payload.visibility,
                fotoPortada: coverUrl,
              });
              const updated = await fetchPlansByIds({ planIds: [planId] });
              if (updated[0]) {
                setPlan(updated[0]);
                updatePlanDetailCache(user.id, planId, { plan: updated[0] });
              }
              setShowEditModal(false);
            }}
          />
        );
      })()}

      {pagarDeuda && user?.id && (
        <PayDebtSheet
          debt={{
            liquidacionId: pagarDeuda.liquidacion_id,
            amount: pagarDeuda.importe,
            toName: pagarDeuda.to_nombre ?? "Usuario",
            toImage: pagarDeuda.to_profile_image || null,
            planTitle: plan?.titulo ?? null,
            currency: expenseSummary.currency,
          }}
          me={{ id: user.id, name: profile?.nombre ?? "Tú", image: profile?.profile_image ?? null }}
          onClose={() => setPagarDeuda(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
    </>
  );
}
