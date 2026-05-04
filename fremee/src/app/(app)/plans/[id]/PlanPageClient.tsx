"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { Maximize2, X, ChevronLeft, ChevronDown, UserPlus, Share2, Pencil, MapPin, Calendar, ArrowRight, Plus, ExternalLink, Upload, Check, FileText, Download, QrCode } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useCallContext } from "@/providers/CallProvider";
import { ChatConversation, PhoneCallIcon, VideoCallIcon } from "@/components/chat/ChatConversation";
import { fetchPlanChatItem, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { resolveChatName, resolveChatAvatar } from "@/services/api/repositories/chat.repository";
import { fetchPlansByIds, fetchPlanMemberIds, fetchPlanUserRol, updatePlanEndpoint, type PlanByIdRow } from "@/services/api/endpoints/plans.endpoint";
import CreatePlanModal, { type EditPlanInitialValues } from "@/components/plans/modals/CreatePlanModal";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { fetchSubplanes, updateSubplanTransporte, updateSubplanViaje, type SubplanRow, TIPOS_TRANSPORTE } from "@/services/api/endpoints/subplanes.endpoint";
import { getBalancesForPlanEndpoint, listGastosForPlanEndpoint, pagarLiquidacionEndpoint, uploadComprobanteEndpoint, type BalanceRow, type GastoRow } from "@/services/api/endpoints/gastos.endpoint";
import DayRouteMap from "@/components/plans/DayRouteMap";
import AddGastoSheet from "@/components/plans/modals/AddGastoSheet";
import { fetchActiveFriends, type PublicUserProfileRow } from "@/services/api/endpoints/users.endpoint";
import { insertNotificacion, fetchPendingPlanInviteUserIds } from "@/services/api/repositories/notifications.repository";
import { syncPlanWidget } from "@/services/widget/planWidget";
import { QRCodeSVG } from "qrcode.react";
import AppSidebar from "@/components/common/AppSidebar";
import PublishPlanModal from "@/components/plans/modals/PublishPlanModal";
import PlanFotosTab from "@/components/plans/PlanFotosTab";
import { PlanGastoDetailModal } from "@/components/plans/modals/PlanGastoDetailModal";
import { uploadPlanAlbumFile } from "@/services/firebase/upload";
import { addPlanFoto } from "@/services/api/repositories/plan-fotos.repository";
import { formatMoney, formatExpenseDateTime, getInitial, formatDateRange, fmtTime, fmtDayHeader } from "@/lib/formatters";
import { FIELD_LINE_CLS } from "@/lib/styles";
import { buildGoogleMapsDirectionsUrl, buildWazeDirectionsUrl } from "@/config/external";
import { PlanDetailSkeleton } from "./_components/PlanDetailSkeleton";
import { AddSubplanSheet, TRANSPORT_MAP, TRANSPORT_LLEGADA, type AddSheetProps } from "./_components/AddSubplanSheet";
import { isoDateOnly, groupByDay, normalizeDateKey, summarizeRecipients, getOccupiedIntervals, timeToMin, mergeIntervals, type Interval } from "./_components/plan-utils";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { CloseX } from "@/components/ui/CloseX";
const ChevronDownIcon = ChevronDown;

// ── local icon aliases (used throughout this file) ──────────────────────────

type Tab = "itinerario" | "gastos" | "chat" | "fotos";

const BackIcon = ({ className = "size-icon" }: { className?: string }) => <ChevronLeft className={className} aria-hidden />;
const InviteIcon = ({ className = "size-icon" }: { className?: string }) => <UserPlus className={className} aria-hidden />;
const ShareIcon = ({ className = "size-icon" }: { className?: string }) => <Share2 className={className} aria-hidden />;
const EditIcon = ({ className = "size-icon" }: { className?: string }) => <Pencil className={className} aria-hidden />;
const MapPinIcon = ({ className = "size-icon" }: { className?: string }) => <MapPin className={className} aria-hidden />;
const CalendarSmallIcon = ({ className = "size-icon" }: { className?: string }) => <Calendar className={className} aria-hidden />;
const ArrowRightIcon = ({ className = "size-icon" }: { className?: string }) => <ArrowRight className={className} aria-hidden />;
const PlusIcon = ({ className = "size-icon" }: { className?: string }) => <Plus className={className} aria-hidden />;
const ExternalLinkIcon = ({ className = "size-icon" }: { className?: string }) => <ExternalLink className={className} aria-hidden />;

/* ───────────── page ───────────── */

function PlanExpenseAvatar({ name, image }: { name: string; image: string | null }) {
  if (image) {
    return (
      <div className="relative size-11 shrink-0 overflow-hidden rounded-full border border-app">
        <Image src={image} alt={name} fill sizes="44px" className="object-cover" unoptimized referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-body-sm font-[var(--fw-semibold)] text-muted">
      {getInitial(name)}
    </div>
  );
}

/* ───────────── invoice debtor list ───────────── */

type InvoiceDebtor = { uid: string; nombre: string | null; foto: string | null; total: number; deudas: { to_nombre: string | null; importe: number }[] };

function InvoiceDebtorList({ debtors, currency, formatMoney }: { debtors: InvoiceDebtor[]; currency: string; formatMoney: (n: number, c: string) => string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  return (
    <div className="mt-2 divide-y divide-app">
      {debtors.map(d => {
        const isOpen = expanded.has(d.uid);
        const single = d.deudas.length === 1;
        return (
          <div key={d.uid}>
            <button
              type="button"
              onClick={() => { if (single) return; setExpanded(prev => { const next = new Set(prev); if (next.has(d.uid)) next.delete(d.uid); else next.add(d.uid); return next; }); }}
              className={`flex w-full items-center gap-3 py-[10px] text-left ${!single ? "cursor-pointer hover:bg-surface transition-colors rounded-lg px-1 -mx-1" : ""}`}
            >
              <span className="min-w-0 flex-1 text-body-sm text-app">
                <span className="font-[var(--fw-semibold)]">{d.nombre ?? "Usuario"}</span>
                {single ? (
                  <><span className="text-muted"> debe a </span><span className="font-[var(--fw-semibold)]">{d.deudas[0].to_nombre ?? "Usuario"}</span></>
                ) : (
                  <span className="text-muted"> · {d.deudas.length} deudas</span>
                )}
              </span>
              <span className="shrink-0 text-body-sm font-[var(--fw-semibold)] text-[var(--warning,#b45309)]">{formatMoney(d.total, currency)}</span>
              {!single && (
                <ChevronDown className={`size-[14px] shrink-0 text-muted transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} aria-hidden />
              )}
            </button>
            {!single && isOpen && (
              <div className="mb-1 divide-y divide-app pl-4">
                {d.deudas.map((debt, i) => (
                  <div key={i} className="flex items-center justify-between py-[8px]">
                    <span className="text-body-sm text-muted">→ <span className="text-app">{debt.to_nombre ?? "Usuario"}</span></span>
                    <span className="text-body-sm font-[var(--fw-medium)] text-[var(--warning,#b45309)]">{formatMoney(debt.importe, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ───────────── page ───────────── */

export default function PlanDetailPage() {
  const { loading, user } = useAuth();
  const { startCall, joinCall, callState } = useCallContext();
  const reloadCallMessagesRef = useRef<(() => void) | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { id: paramId } = useParams<{ id: string }>();
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
  const [plan, setPlan] = useState<PlanByIdRow | null>(null);
  const isPast = plan ? new Date(plan.fin_at) < new Date() : false;
  const [isAdmin, setIsAdmin] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [planChat, setPlanChat] = useState<ChatListItem | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [subplanes, setSubplanes] = useState<SubplanRow[]>([]);
  const [selectedMapDay, setSelectedMapDay] = useState<string | null>(null);
  const [showMapFullscreen, setShowMapFullscreen] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());
  const collapsedDaysInitializedRef = useRef(false);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSheetInitialTitulo, setAddSheetInitialTitulo] = useState<string | undefined>();
  const [addSheetInitialDate, setAddSheetInitialDate] = useState<string | undefined>();
  const [editingSubplan, setEditingSubplan] = useState<SubplanRow | null>(null);
  const [showAddGastoSheet, setShowAddGastoSheet] = useState(false);
  const [mobileCreateOpen, setMobileCreateOpen] = useState(false);
  const [photoAlbumRefreshKey, setPhotoAlbumRefreshKey] = useState(0);
  const [fabPhotoUploading, setFabPhotoUploading] = useState(false);
  const fabPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [gastos, setGastos] = useState<GastoRow[]>([]);
  const [selectedGastoId, setSelectedGastoId] = useState<number | null>(null);
  const [gastosLimit, setGastosLimit] = useState(5);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [expandedDebtors, setExpandedDebtors] = useState<Set<string>>(new Set());
  const [pagarDeuda, setPagarDeuda] = useState<BalanceRow | null>(null);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState<string | null>(null);
  const [pagandoId, setPagandoId] = useState<number | null>(null);
  const [editingTransporteId, setEditingTransporteId] = useState<number | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const { isClosing: inviteClosing, requestClose: closeInviteModal } = useModalCloseAnimation(() => setShowInviteModal(false), showInviteModal);
  const { isClosing: invoiceClosing, requestClose: closeInvoiceModal } = useModalCloseAnimation(() => setShowInvoiceModal(false), showInvoiceModal);
  const { isClosing: paymentClosing, requestClose: closePaymentModal } = useModalCloseAnimation(() => {
    setPagarDeuda(null);
    setComprobanteFile(null);
    setComprobantePreview(null);
  }, !!pagarDeuda);

  const openPhotoUpload = () => {
    setMobileCreateOpen(false);
    setActiveTab("fotos");
    fabPhotoInputRef.current?.click();
  };

  const handleFabPhotoFilesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!plan?.id || !user?.id || files.length === 0) return;

    setActiveTab("fotos");
    setFabPhotoUploading(true);
    try {
      await Promise.all(
        files.map(async (file) => {
          const { filePath, downloadUrl } = await uploadPlanAlbumFile({ file, planId: plan.id });
          return addPlanFoto({
            planId: plan.id,
            userId: user.id,
            url: downloadUrl,
            storagePath: filePath,
          });
        })
      );
      setPhotoAlbumRefreshKey((value) => value + 1);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setFabPhotoUploading(false);
    }
  };
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [inviteFriends, setInviteFriends] = useState<PublicUserProfileRow[]>([]);
  const [inviteFriendsLoading, setInviteFriendsLoading] = useState(false);
  const [inviteSentIds, setInviteSentIds] = useState<Set<string>>(new Set());
  const [inviteSendingIds, setInviteSendingIds] = useState<Set<string>>(new Set());
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    const tab = searchParams.get("tab");
    const createGasto = searchParams.get("createGasto");

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
  }, [searchParams, plan, isPast, pathname, router]);

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
      ? confirmedExpenses.reduce((sum, gasto) => {
          const part = gasto.partes?.find((parte) => parte.user_id === user.id)?.importe ?? 0;
          return sum + part;
        }, 0)
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

  const visiblePlanGastos = useMemo(() => sortedPlanGastos.slice(0, gastosLimit), [sortedPlanGastos, gastosLimit]);

  const planMemberIds = useMemo(() => {
    const ids = new Set<string>();
    sortedPlanGastos.forEach(g => { ids.add(g.pagado_por_user_id); g.partes?.forEach(p => ids.add(p.user_id)); });
    return ids;
  }, [sortedPlanGastos]);

  const selectedGasto = useMemo(
    () => gastos.find((gasto) => gasto.id === selectedGastoId) ?? null,
    [gastos, selectedGastoId],
  );

  const openInviteModal = async () => {
    setShowInviteModal(true);
    setInviteSentIds(new Set());
    setInviteSendingIds(new Set());
    setInviteLinkCopied(false);
    setShowQr(false);
    setInviteFriendsLoading(true);
    try {
      const [friends, memberIds, pendingIds] = await Promise.all([
        fetchActiveFriends(),
        fetchPlanMemberIds(Number(id)),
        fetchPendingPlanInviteUserIds(Number(id)),
      ]);
      const memberSet = new Set(memberIds);
      setInviteFriends(friends.filter((f) => !memberSet.has(f.id)));
      setInviteSentIds(new Set(pendingIds));
    } catch (e) {
      console.error(e);
    } finally {
      setInviteFriendsLoading(false);
    }
  };

  const handleInviteFriend = async (friendId: string) => {
    if (!user?.id) return;
    setInviteSendingIds((prev) => new Set(prev).add(friendId));
    try {
      await insertNotificacion({
        userId: friendId,
        tipo: "plan_invite",
        actorId: user.id,
        entityId: String(Number(id)),
        entityType: "plan",
      });
      setInviteSentIds((prev) => new Set(prev).add(friendId));
    } catch (e) {
      console.error(e);
    } finally {
      setInviteSendingIds((prev) => { const n = new Set(prev); n.delete(friendId); return n; });
    }
  };

  const inviteLink = plan?.join_code ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${plan.join_code}` : null;

  const handleCopyInviteLink = () => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => {
      setInviteLinkCopied(true);
      setTimeout(() => setInviteLinkCopied(false), 2000);
    });
  };

  const handleSubplanCreated = (s: SubplanRow) => {
    setSubplanes((prev) => {
      const sorted = [...prev, s].sort((a, b) => a.inicio_at.localeCompare(b.inicio_at));
      const newIdx = sorted.findIndex(x => x.id === s.id);
      const next = sorted[newIdx + 1];
      // The subplan immediately after (same day) has a stale polyline — its origin changed.
      if (next && isoDateOnly(next.inicio_at) === isoDateOnly(s.inicio_at) && next.ruta_polyline) {
        // Clear in DB (fire-and-forget, outside render cycle)
        void updateSubplanViaje(next.id, "", "", "");
        return sorted.map(x =>
          x.id === next.id ? { ...x, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null } : x
        );
      }
      return sorted;
    });
  };

  const clearRouteCache = (subplanIds: number[]) => {
    [...new Set(subplanIds)].forEach((subplanId) => {
      if (!subplanId) return;
      void updateSubplanViaje(subplanId, "", "", "").catch(() => {});
    });
  };

  const handleSubplanSaved = (saved: SubplanRow, original?: SubplanRow | null) => {
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

      return sorted.map((item) =>
        affectedIds.includes(item.id)
          ? { ...item, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
          : item
      );
    });
  };

  const toggleCollapsedDay = (dateKey: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  useEffect(() => {
    if (collapsedDaysInitializedRef.current || routeDayGroups.length === 0) return;
    setCollapsedDays(new Set(routeDayGroups.map(([dateKey]) => dateKey)));
    collapsedDaysInitializedRef.current = true;
  }, [routeDayGroups]);

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
    setSubplanes((prev) => prev.map((s) =>
      s.id === subplanId ? { ...s, duracion_viaje: duracion, distancia_viaje: distancia, ruta_polyline: polyline } : s
    ));
    updateSubplanViaje(subplanId, duracion, distancia, polyline).catch(() => {});
  };

  const handleTransporteChange = async (subplanId: number, transporte: string | null) => {
    // Clear cached route so DayRouteMap recalculates with the new travel mode
    setSubplanes((prev) => prev.map((s) =>
      s.id === subplanId
        ? { ...s, transporte_llegada: transporte, ruta_polyline: null, duracion_viaje: null, distancia_viaje: null }
        : s
    ));
    setEditingTransporteId(null);
    try { await updateSubplanTransporte(subplanId, transporte); }
    catch { setSubplanes((prev) => prev.map((s) => s.id === subplanId ? { ...s, transporte_llegada: null } : s)); }
  };

  useEffect(() => {
    if (id === "static") return; // still resolving real id from query params
    const planId = Number(id);
    if (!planId) { setPlanLoading(false); return; }
    setPlanLoading(true);
    fetchPlansByIds({ planIds: [planId] })
      .then((rows) => setPlan(rows[0] ?? null))
      .catch(console.error)
      .finally(() => setPlanLoading(false));
  }, [id]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId) return;
    fetchSubplanes(planId).then(setSubplanes).catch(console.error);

    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`subplan-changes-${planId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subplan", filter: `plan_id=eq.${planId}` }, () => {
        fetchSubplanes(planId).then(setSubplanes).catch(console.error);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    const planId = Number(id);
    if (!planId || !user?.id) return;
    fetchPlanUserRol(planId, user.id).then((rol) => {
      if (rol === null) { router.push("/calendar"); return; }
      setIsAdmin(rol === "ADMIN");
      setMembershipChecked(true);
    }).catch(() => router.push("/calendar"));

  }, [id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recargar lista de miembros cuando alguien entra o sale del chat del plan
  useEffect(() => {
    if (!planChat?.chat_id || !user?.id) return;
    const planId = Number(id);
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(`chat-members-${planChat.chat_id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_miembro", filter: `chat_id=eq.${planChat.chat_id}` }, () => {
        void fetchPlanChatItem(planId).then(setPlanChat);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_miembro", filter: `chat_id=eq.${planChat.chat_id}` }, () => {
        void fetchPlanUserRol(planId, user.id).then((rol) => {
          if (rol === null) { router.push("/calendar"); return; }
          void fetchPlanChatItem(planId).then(setPlanChat);
        });
      })
      .subscribe();

    // Escuchar broadcast de cambio de rol emitido desde el chat
    const rolChannel = supabase
      .channel(`msg:${planChat.chat_id}`)
      .on("broadcast", { event: "rol_change" }, ({ payload }) => {
        const { user_id, rol } = payload as { user_id: string; rol: string };
        if (user_id === user.id) setIsAdmin(rol === "ADMIN");
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(rolChannel);
    };
  }, [planChat?.chat_id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps


  useEffect(() => {
    const planId = Number(id);
    if (!planId || !user?.id) return;
    fetchPlanChatItem(planId).then(setPlanChat).catch(console.error);
  }, [id, user?.id]);

  const loadGastos = () => {
    const planId = Number(id);
    if (!planId) return;
    listGastosForPlanEndpoint(planId).then(setGastos).catch(console.error);
  };

  const loadBalances = () => {
    const planId = Number(id);
    if (!planId) return;
    getBalancesForPlanEndpoint(planId).then(setBalances).catch(console.error);
  };

  useEffect(() => { loadGastos(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadBalances(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    collapsedDaysInitializedRef.current = false;
    setCollapsedDays(new Set());
  }, [id]);
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

  if (loading || planLoading || !membershipChecked) return <PlanDetailSkeleton />;
  if (!plan) return (
    <div className="flex min-h-dvh items-center justify-center text-muted">
      Plan no encontrado.
    </div>
  );

  return (
    <div className={`${activeTab === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh"} bg-app text-app`}>
      <div className={`relative w-full ${activeTab === "chat" ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>
        <AppSidebar hideMobileNav={true} />
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
              onClick={() => router.back()}
              className="absolute left-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] z-20 flex h-9 w-9 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3 transition-colors hover:bg-surface-2 md:top-[var(--space-6)]"
            >
              <BackIcon className="size-[20px]" />
            </button>

            {!isPast && isAdmin && (
              <button
                type="button"
                aria-label="Editar plan"
                onClick={() => setShowEditModal(true)}
                className="absolute right-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] flex h-9 w-9 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3 transition-colors hover:bg-surface-2 md:top-[var(--space-6)]"
              >
                <EditIcon className="size-[18px]" />
              </button>
            )}
            {isPast && (
              <span className="absolute right-[var(--page-margin-x)] top-[calc(env(safe-area-inset-top)+var(--space-4))] rounded-full border border-white/30 bg-black/30 px-3 py-[6px] text-[13px] font-[600] text-white/90 backdrop-blur-sm md:top-[var(--space-6)]">
                Finalizado
              </span>
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
                  {formatDateRange(plan.inicio_at, plan.fin_at)}
                </span>
                <span className="flex min-w-0 items-center gap-[5px] text-body-sm">
                  <MapPinIcon className="size-[14px] shrink-0" />
                  <span className="min-w-0 truncate">{plan.ubicacion_nombre}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="absolute bottom-[var(--space-4)] right-[var(--page-margin-x)] flex gap-[var(--space-2)]">
                {isAdmin && (
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
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3 transition-colors hover:bg-surface-2"
                  >
                    <InviteIcon className="size-[18px]" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="border-b border-app px-[var(--page-margin-x)]">
            <div className="flex items-center justify-between">
              <div className="flex gap-[var(--space-8)]">
                {(["itinerario", "gastos", "fotos", "chat"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`relative py-[var(--space-3)] text-body-sm font-[var(--fw-medium)] capitalize transition-colors ${
                      activeTab === tab
                        ? "text-app"
                        : "text-muted hover:text-app"
                    }`}
                  >
                    {tab === "fotos" ? "Álbum" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    {activeTab === tab && (
                      <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-primary-token" />
                    )}
                  </button>
                ))}
              </div>
              {activeTab === "chat" && planChat && (
                <div className="hidden items-center gap-[var(--space-1)] pb-[2px] md:flex">
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
                  planInfo={plan ? { titulo: plan.titulo, inicio_at: plan.inicio_at, fin_at: plan.fin_at, ubicacion_nombre: plan.ubicacion_nombre } : undefined}
                  planId={plan?.id}
                  isAdmin={isAdmin}
                  onAbrirActividad={(titulo) => {
                    if (isPast || !isAdmin) return;
                    setEditingSubplan(null);
                    setAddSheetInitialTitulo(titulo);
                    setAddSheetInitialDate(undefined);
                    setShowAddSheet(true);
                    setActiveTab("itinerario");
                  }}
                  onLeave={() => router.push("/calendar")}
                  onMembersChanged={() => {
                    const planId = Number(id);
                    if (planId) void fetchPlanChatItem(planId).then(setPlanChat);
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
              refreshKey={photoAlbumRefreshKey}
            />
          )}

          {/* ─── Content ─── */}
          {activeTab !== "chat" && activeTab !== "fotos" && <div className="px-[var(--page-margin-x)] pt-[var(--space-6)] pb-[var(--space-3)] md:pb-[var(--space-16)]">

            {activeTab === "itinerario" && (
              <div
                className="flex flex-col gap-[var(--space-8)] lg:flex-row lg:gap-[var(--space-12)]"
                style={{ fontFamily: "var(--font-inter), sans-serif" }}
              >

                {/* Left column — itinerary */}
                <div className="flex-1 min-w-0">
                  {subplanes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-[var(--space-16)] text-muted">
                      <CalendarSmallIcon className="size-[40px] mb-[var(--space-3)] opacity-30" />
                      <p className="text-body font-[var(--fw-medium)]">Sin actividades</p>
                      <p className="text-body-sm mt-[var(--space-1)]">{isPast ? "Este plan ya ha finalizado" : "Añade la primera actividad del plan"}</p>
                      {!isPast && isAdmin && (
                      <button
                        onClick={() => {
                          setEditingSubplan(null);
                          setAddSheetInitialTitulo(undefined);
                          setAddSheetInitialDate(undefined);
                          setShowAddSheet(true);
                        }}
                        className="mt-[var(--space-5)] hidden items-center gap-[var(--space-2)] rounded-chip border border-primary-token px-[var(--space-4)] py-[var(--space-2)] text-body-sm font-[var(--fw-medium)] text-primary-token transition-colors hover:bg-primary-token/10 md:flex"
                      >
                        <span className="text-lg leading-none">+</span> Añadir actividad
                      </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {groupByDay(subplanes).map(([dateKey, items]) => (
                        <div key={dateKey} className={collapsedDays.has(dateKey) ? "mb-[var(--space-4)]" : "mb-[var(--space-6)]"}>
                          {/* Day header */}
                          <div className={`-mx-[var(--page-margin-x)] border-b border-app px-[var(--page-margin-x)] md:mx-0 md:px-0 ${collapsedDays.has(dateKey) ? "pb-[var(--space-4)]" : "mb-[var(--space-5)] pb-[var(--space-4)]"}`}>
                            {(() => {
                              const dayHeader = fmtDayHeader(items[0].inicio_at).toLocaleLowerCase("es-ES");
                              const dayExpense = dayExpenseTotals.get(dateKey);
                              const daySummary = [
                                `${items.length} actividad${items.length === 1 ? "" : "es"}`,
                                dayExpense ? formatMoney(dayExpense.total, dayExpense.currency) : "Sin gastos",
                              ].join(" · ");
                              return (
                                <button
                                  type="button"
                                  onClick={() => toggleCollapsedDay(dateKey)}
                                  className="flex w-full min-w-0 items-start gap-[6px] text-left transition-colors hover:text-primary-token"
                                  aria-expanded={!collapsedDays.has(dateKey)}
                                  aria-label={collapsedDays.has(dateKey) ? `Desplegar ${dayHeader}` : `Plegar ${dayHeader}`}
                                >
                                  <span className="mt-[2px] inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center text-muted">
                                    <ChevronDownIcon className={`size-[15px] transition-transform ${collapsedDays.has(dateKey) ? "-rotate-90" : "rotate-0"}`} />
                                  </span>
                                  <span className="min-w-0">
                                    <span
                                      className="block font-[var(--fw-semibold)] text-app"
                                      style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-h4)", lineHeight: "1.15" }}
                                    >
                                      {dayHeader}
                                    </span>
                                    <span
                                      className="mt-[6px] block font-[var(--fw-medium)] leading-[1.15] text-muted"
                                      style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-body-sm)" }}
                                    >
                                      {daySummary}
                                    </span>
                                  </span>
                                </button>
                              );
                            })()}
                          </div>

                          {/* Timeline */}
                          <div
                            className={`grid overflow-hidden transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                              collapsedDays.has(dateKey)
                                ? "mt-0 grid-rows-[0fr] opacity-0"
                                : "mt-[var(--space-1)] grid-rows-[1fr] opacity-100"
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="relative pl-0">
                                {items.map((s, idx) => {
                                  const isLast = idx === items.length - 1;
                                  const nextTransporte = !isLast ? TRANSPORT_MAP[items[idx + 1]?.transporte_llegada ?? ""] : null;
                                  const nextItem = !isLast ? items[idx + 1] : null;
                                  const routeOrigin = s.ubicacion_fin_nombre ?? s.ubicacion_nombre ?? "";
                                  const routeDestination = nextItem?.ubicacion_nombre ?? "";
                                  const connectorMapsUrl = nextTransporte && routeDestination
                                    ? buildGoogleMapsDirectionsUrl({
                                        origin: routeOrigin,
                                        destination: routeDestination,
                                        travelMode: nextTransporte.googleMode ?? "driving",
                                      })
                                    : "";
                                  const connectorWazeUrl = routeDestination ? buildWazeDirectionsUrl(routeDestination) : "";
                                  const hasTravelMeta = !!(nextItem?.duracion_viaje || nextItem?.distancia_viaje);
                                  const startTimeLabel = fmtTime(s.inicio_at);
                                  const endTimeLabel = fmtTime(s.fin_at);
                                  return (
                                    <div key={s.id}>
                                    <div className="relative flex gap-0 pb-[var(--space-2)]">
                                      <div className="w-[54px] sm:w-[82px] shrink-0 pr-[var(--space-2)] pt-[2px] text-right">
                                        {s.all_day ? (
                                          <span className="block text-[14px] font-[var(--fw-medium)] leading-[1.1] tracking-[0.01em] text-muted">
                                            Todo el día
                                          </span>
                                        ) : (
                                          <div className="ml-auto flex w-fit flex-col items-start text-left leading-[1.05] text-muted">
                                            <span className="block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em]">
                                              {startTimeLabel} -
                                            </span>
                                            <span className="mt-[2px] block tabular-nums text-caption font-[var(--fw-medium)] tracking-[0.01em]">
                                              {endTimeLabel}
                                            </span>
                                          </div>
                                        )}
                                      </div>

                                      <div className="relative flex w-[28px] shrink-0 justify-center">
                                        {idx > 0 && (
                                          <div className="absolute left-1/2 top-0 h-[14px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                        )}
                                        {(!isLast || (isAdmin && !isPast)) && (
                                          <div className="absolute left-1/2 top-[14px] bottom-[-8px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                        )}
                                        <div className="relative z-10 mt-[2px] flex h-[24px] w-[24px] items-center justify-center rounded-full border-[2px] border-primary-token bg-app">
                                          <div className="h-[8px] w-[8px] rounded-full bg-primary-token" />
                                        </div>
                                      </div>

                                      <div className="min-w-0 flex-1 pl-[var(--space-3)]">
                                        <div className="flex items-start gap-[6px]">
                                          <h4
                                            className="min-w-0 shrink text-body font-[var(--fw-semibold)]"
                                            style={{ fontFamily: "var(--font-inter), sans-serif" }}
                                          >
                                            {s.titulo}
                                          </h4>
                                          {!isPast && isAdmin && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingSubplan(s);
                                                setAddSheetInitialTitulo(undefined);
                                                setAddSheetInitialDate(undefined);
                                                setShowAddSheet(true);
                                              }}
                                              className="mt-[1px] inline-flex h-[20px] w-[20px] shrink-0 items-center justify-center text-muted transition-colors hover:text-primary-token"
                                              aria-label={`Editar ${s.titulo}`}
                                            >
                                              <EditIcon className="size-[14px]" />
                                            </button>
                                          )}
                                        </div>
                                        {s.descripcion && (
                                          <p className="mt-[2px] text-body-sm text-muted line-clamp-2">{s.descripcion}</p>
                                        )}
                                        {s.ubicacion_nombre && !s.ubicacion_fin_nombre && (
                                          <p className="mt-[4px] flex items-center gap-[4px] text-body-sm text-muted">
                                            <MapPinIcon className="size-[13px] shrink-0" />
                                            {s.ubicacion_nombre}
                                          </p>
                                        )}
                                        {s.ubicacion_nombre && s.ubicacion_fin_nombre && (
                                          <div className="mt-[4px] flex flex-col gap-[2px] text-body-sm text-muted">
                                            <p className="flex items-center gap-[4px]">
                                              <MapPinIcon className="size-[13px] shrink-0" />
                                              {s.ubicacion_nombre}
                                            </p>
                                            <div className="pl-[18px] text-[14px] leading-none text-primary-token">↓</div>
                                            <p className="flex items-center gap-[4px]">
                                              <MapPinIcon className="size-[13px] shrink-0" />
                                              {s.ubicacion_fin_nombre}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {/* Transport connector between activities */}
                                    {!isLast && (
                                      <div className="relative flex gap-0 pb-[var(--space-4)]">
                                        <div className="w-[54px] sm:w-[82px] shrink-0 pr-[var(--space-2)]" />
                                        <div className="relative flex w-[28px] shrink-0 items-center justify-center">
                                          <div className="absolute left-1/2 top-0 bottom-[-16px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                          {nextTransporte ? (
                                            <div className="relative z-10 flex h-[24px] w-[24px] items-center justify-center rounded-full border border-app bg-app text-muted">
                                              <nextTransporte.Icon className="size-[14px]" />
                                            </div>
                                          ) : null}
                                        </div>
                                        <div className="min-w-0 flex-1 self-center pl-[var(--space-3)]">
                                        {!isPast && nextItem && editingTransporteId === nextItem.id ? (
                                          <div className="flex flex-wrap gap-[var(--space-2)]">
                                            {TRANSPORT_LLEGADA.map((t) => (
                                              <button
                                                key={t.value}
                                                onClick={() => handleTransporteChange(nextItem.id, t.value)}
                                                className={`flex items-center gap-[6px] rounded-chip border px-[var(--space-2)] py-[4px] text-caption transition-colors ${
                                                  nextItem.transporte_llegada === t.value
                                                    ? "border-primary-token bg-primary-token/10 text-primary-token"
                                                    : "border-app bg-surface-inset text-muted"
                                                }`}
                                              >
                                                <t.Icon className="size-[14px] shrink-0" />
                                                <span>{t.label}</span>
                                              </button>
                                            ))}
                                            <button onClick={() => setEditingTransporteId(null)} className="text-caption text-muted px-[var(--space-2)]">✕</button>
                                          </div>
                                        ) : nextTransporte ? (
                                          <div className="flex max-w-full items-center gap-[var(--space-2)]">
                                            {isPast ? (
                                              <span className={`${hasTravelMeta ? "flex" : "hidden md:flex"} min-w-0 items-center gap-[6px] rounded-full border border-app bg-surface px-[var(--space-3)] py-[7px] text-caption text-muted md:border-0 md:bg-transparent md:px-0 md:py-0`}>
                                                <span className="hidden md:inline">{nextTransporte.label}</span>
                                                {hasTravelMeta && (
                                                  <>
                                                    <span className="hidden text-muted opacity-40 md:inline">·</span>
                                                    {nextItem?.duracion_viaje && <span>{nextItem.duracion_viaje}</span>}
                                                    {nextItem.distancia_viaje && (
                                                      <span className="text-caption text-muted">{nextItem.distancia_viaje}</span>
                                                    )}
                                                  </>
                                                )}
                                              </span>
                                            ) : (
                                              <button
                                                onClick={() => nextItem && setEditingTransporteId(nextItem.id)}
                                                className={`${hasTravelMeta ? "flex" : "hidden md:flex"} min-w-0 items-center gap-[6px] rounded-full border border-app bg-surface px-[var(--space-3)] py-[7px] text-caption text-muted transition-colors hover:text-primary-token md:border-0 md:bg-transparent md:px-0 md:py-0`}
                                              >
                                                <span className="hidden md:inline">{nextTransporte.label}</span>
                                                {hasTravelMeta && (
                                                  <>
                                                    <span className="hidden text-muted opacity-40 md:inline">·</span>
                                                    {nextItem?.duracion_viaje && <span>{nextItem.duracion_viaje}</span>}
                                                    {nextItem.distancia_viaje && (
                                                      <span className="text-caption text-muted">{nextItem.distancia_viaje}</span>
                                                    )}
                                                  </>
                                                )}
                                              </button>
                                            )}
                                            {connectorMapsUrl && (
                                              <a
                                                href={connectorMapsUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-app bg-surface text-muted transition-colors active:bg-surface-inset md:size-auto md:border-0 md:bg-transparent md:active:bg-transparent"
                                                title="Abrir en Google Maps"
                                              >
                                                <Image src="/brands/google-maps.svg" alt="Google Maps" width={18} height={18} className="size-[18px] md:size-[14px]" />
                                              </a>
                                            )}
                                            {connectorWazeUrl && (
                                              <a
                                                href={connectorWazeUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-app bg-surface text-muted transition-colors active:bg-surface-inset md:size-auto md:border-0 md:bg-transparent md:active:bg-transparent"
                                                title="Abrir en Waze"
                                              >
                                                <Image src="/brands/waze-icon.svg" alt="Waze" width={18} height={18} className="size-[18px] md:size-[14px]" />
                                              </a>
                                            )}
                                          </div>
                                        ) : !isPast ? (
                                          <button
                                            onClick={() => setEditingTransporteId(items[idx + 1].id)}
                                            className="text-caption text-muted hover:text-primary-token transition-colors"
                                          >
                                            + ¿Cómo llegas?
                                          </button>
                                        ) : null}
                                        </div>
                                      </div>
                                    )}
                                    </div>
                                  );
                                })}

                                {!isPast && isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSubplan(null);
                                      setAddSheetInitialTitulo(undefined);
                                      setAddSheetInitialDate(dateKey);
                                      setShowAddSheet(true);
                                    }}
                                    className="group relative flex w-full gap-0 bg-app pb-[var(--space-2)] pt-[var(--space-2)] text-left"
                                    aria-label={`Añadir actividad en ${fmtDayHeader(items[0].inicio_at)}`}
                                  >
                                    <div className="w-[54px] sm:w-[82px] shrink-0 pr-[var(--space-2)]" />
                                    <div className="relative flex w-[28px] shrink-0 justify-center">
                                      <div className="absolute left-1/2 top-[-8px] h-[10px] w-[1.5px] -translate-x-1/2 bg-[var(--border)]" />
                                      <div className="relative z-10 mt-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-primary-token/35 bg-primary-token/10 text-primary-token transition-colors group-hover:border-primary-token/55 group-hover:bg-primary-token/16">
                                        <PlusIcon className="size-[12px]" />
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1 self-center pl-[var(--space-3)]">
                                      <span className="text-body-sm font-[var(--fw-regular)] text-primary-token transition-colors group-hover:text-primary-token">
                                        Añadir actividad
                                      </span>
                                    </div>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                    </>
                  )}
                </div>

                {/* Right column — route map + expenses */}
                <div className="lg:w-[340px] lg:shrink-0">

                  {/* Route map card */}
                  {routeShouldShowMap && (
                    <div className="mb-[var(--space-8)]">
                      <div className="mb-[var(--space-3)] flex items-center justify-between">
                        <h3 className="text-body font-[var(--fw-semibold)]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Ruta del Día</h3>
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
                        />
                        <div className="absolute left-[var(--space-3)] top-[var(--space-3)] z-10 flex items-center gap-[var(--space-2)]">
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
                        <div className="absolute right-[var(--space-3)] top-[var(--space-3)] z-10 flex items-center gap-[var(--space-2)]">
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
                  <div className="hidden rounded-[16px] border border-app bg-surface px-[var(--space-4)] py-[var(--space-4)] md:block">
                    <div className="flex items-center justify-between gap-[var(--space-3)]">
                      <div className="flex min-w-0 items-center gap-[var(--space-2)]">
                        <h3 className="text-body font-[var(--fw-semibold)]" style={{ fontFamily: "var(--font-inter), sans-serif" }}>Resumen gastos</h3>
                        <button
                          type="button"
                          onClick={() => setActiveTab("gastos")}
                          className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-inset hover:text-app"
                          aria-label="Ir a la sección de gastos"
                        >
                          <ArrowRightIcon className="size-[16px]" />
                        </button>
                      </div>
                      {expenseSummary.hasExpenses ? (
                        <span
                          className="font-[var(--fw-bold)] leading-[1.1] text-app"
                          style={{ fontFamily: "var(--font-inter), sans-serif", fontSize: "var(--font-h3)" }}
                        >
                          {formatMoney(expenseSummary.total, expenseSummary.currency)}
                        </span>
                      ) : null}
                    </div>

                    {expenseSummary.hasExpenses ? (
                      <>
                        <p className="mt-[4px] text-caption text-muted">
                          {expenseSummary.count} gasto{expenseSummary.count === 1 ? "" : "s"} confirmados
                          {expenseSummary.participantCount > 0
                            ? ` · ${expenseSummary.participantCount} participante${expenseSummary.participantCount === 1 ? "" : "s"}`
                            : ""}
                        </p>

                        <div className="mt-[var(--space-4)] grid grid-cols-2 gap-[var(--space-3)]">
                          <div className="rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                            <p className="text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              Pagado por ti
                            </p>
                            <p className="mt-[6px] text-body font-[var(--fw-semibold)] text-app">
                              {formatMoney(expenseSummary.paidByYou, expenseSummary.currency)}
                            </p>
                          </div>
                          <div className="rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                            <p className="text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              Tu parte
                            </p>
                            <p className="mt-[6px] text-body font-[var(--fw-semibold)] text-app">
                              {formatMoney(expenseSummary.yourShare, expenseSummary.currency)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-[var(--space-3)] rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                          <div className="flex items-center justify-between gap-[var(--space-3)]">
                            <div>
                              <p className="text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                                Balance del plan
                              </p>
                              <p className={`mt-[6px] text-body font-[var(--fw-semibold)] ${
                                expenseSummary.net > 0
                                  ? "text-[var(--success)]"
                                  : expenseSummary.net < 0
                                    ? "text-[var(--warning)]"
                                    : "text-app"
                              }`}>
                                {expenseSummary.net > 0 ? "+" : ""}
                                {formatMoney(expenseSummary.net, expenseSummary.currency)}
                              </p>
                            </div>
                            <span className={`rounded-full px-[var(--space-3)] py-[6px] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] ${
                              expenseSummary.net > 0
                                ? "bg-[var(--success)]/12 text-[var(--success)]"
                                : expenseSummary.net < 0
                                  ? "bg-[var(--warning)]/12 text-[var(--warning)]"
                                  : "bg-surface-inset text-muted"
                            }`}>
                              {expenseSummary.net > 0
                                ? "Te deben"
                                : expenseSummary.net < 0
                                  ? "Debes"
                                  : "En equilibrio"}
                            </span>
                          </div>
                        </div>

                        {expenseSummary.topCategories.length > 0 ? (
                          <div className="mt-[var(--space-4)]">
                            <p className="mb-[var(--space-3)] text-[14px] font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">
                              Categorías principales
                            </p>
                            <div className="space-y-[var(--space-2)]">
                              {expenseSummary.topCategories.map((category) => (
                                <div key={category.label} className="flex items-center gap-[var(--space-3)] rounded-[12px] border border-app bg-app px-[var(--space-3)] py-[var(--space-3)]">
                                  <div className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-surface-inset text-[16px]">
                                    {category.icon || "•"}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-body-sm font-[var(--fw-medium)] text-app">
                                      {category.label}
                                    </p>
                                    <p className="text-caption text-muted">
                                      {category.count} gasto{category.count === 1 ? "" : "s"}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-body-sm font-[var(--fw-semibold)] text-app">
                                    {formatMoney(category.amount, expenseSummary.currency)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p className="mt-[var(--space-2)] text-body-sm text-muted">
                          Aún no hay gastos confirmados en este plan.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "gastos" && (
              <div className="mx-auto max-w-[760px]">
                {/* Stats + acciones */}
                <div className="relative mb-[var(--space-7)] flex flex-col items-center gap-[var(--space-3)] pt-[var(--space-2)]">
                  <p className="text-[28px] font-[var(--fw-bold)] leading-none text-app">
                    {formatMoney(expenseSummary.total, expenseSummary.currency)}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <span className="rounded-full bg-surface px-3 py-[5px] text-caption text-muted">
                      {sortedPlanGastos.length} {sortedPlanGastos.length === 1 ? "gasto" : "gastos"}
                    </span>
                    {planMemberIds.size > 0 && (
                      <span className="rounded-full bg-surface px-3 py-[5px] text-caption text-muted">
                        {planMemberIds.size} {planMemberIds.size === 1 ? "persona" : "personas"}
                      </span>
                    )}
                    {planMemberIds.size > 0 && expenseSummary.total > 0 && (
                      <span className="rounded-full bg-surface px-3 py-[5px] text-caption text-muted">
                        {formatMoney(expenseSummary.total / planMemberIds.size, expenseSummary.currency)}/persona
                      </span>
                    )}
                  </div>
                  <div className="absolute right-0 top-0 hidden items-center gap-2 md:flex">
                    {sortedPlanGastos.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowInvoiceModal(true)}
                        title={isPast ? "Generar factura final" : "Generar resumen parcial"}
                        className="flex size-9 items-center justify-center rounded-full bg-surface text-muted transition-colors hover:bg-surface-2 hover:text-app"
                      >
                        <FileText className="size-[15px]" aria-hidden />
                      </button>
                    )}
                    {!isPast && (
                      <button
                        onClick={() => setShowAddGastoSheet(true)}
                        aria-label="Añadir gasto"
                        className="flex size-9 items-center justify-center rounded-full bg-primary-token text-contrast-token transition-opacity hover:opacity-80"
                      >
                        <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-[var(--space-6)]">
                  <section>
                    <div className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-3)]">
                      <p className="text-body-sm font-[var(--fw-medium)] text-muted">Deudas pendientes</p>
                      <span className="text-caption text-muted">
                        {new Set(visibleBalances.map(b => b.from_user_id)).size} deudor{new Set(visibleBalances.map(b => b.from_user_id)).size === 1 ? "" : "es"}
                      </span>
                    </div>

                    {visibleBalances.length === 0 ? (
                      <p className="px-[var(--space-4)] py-[var(--space-2)] text-body-sm text-muted">
                        No hay deudas pendientes en este plan.
                      </p>
                    ) : (() => {
                      // Agrupar por deudor (from_user_id)
                      const groups = new Map<string, { debtor: { id: string; nombre: string | null; foto: string | null }; debts: BalanceRow[] }>();
                      for (const b of visibleBalances) {
                        if (!groups.has(b.from_user_id)) {
                          groups.set(b.from_user_id, { debtor: { id: b.from_user_id, nombre: b.from_nombre, foto: b.from_profile_image }, debts: [] });
                        }
                        groups.get(b.from_user_id)!.debts.push(b);
                      }
                      const sortedGroups = [...groups.values()].sort((a, b) => {
                        const sumA = a.debts.reduce((s, d) => s + d.importe, 0);
                        const sumB = b.debts.reduce((s, d) => s + d.importe, 0);
                        return sumB - sumA;
                      });

                      return (
                        <div className="divide-y divide-app">
                          {sortedGroups.map(({ debtor, debts }) => {
                            const isMe = debtor.id === user?.id;
                            const debtorLabel = isMe ? "Tú" : (debtor.nombre ?? "Usuario");
                            const totalGeneral = debts.reduce((s, d) => s + d.importe, 0);
                            const isExpanded = expandedDebtors.has(debtor.id);
                            const hasMultiple = debts.length > 1;

                            return (
                              <div key={debtor.id}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!hasMultiple && isMe) { setPagarDeuda(debts[0]); return; }
                                    if (!hasMultiple) return;
                                    setExpandedDebtors(prev => {
                                      const next = new Set(prev);
                                      if (next.has(debtor.id)) next.delete(debtor.id);
                                      else next.add(debtor.id);
                                      return next;
                                    });
                                  }}
                                  className={`flex w-full items-center gap-3 py-[var(--space-3)] text-left ${(hasMultiple || isMe) ? "cursor-pointer hover:bg-surface-inset/50" : "cursor-default"}`}
                                >
                                  <PlanExpenseAvatar
                                    name={debtorLabel}
                                    image={debtor.foto ?? null}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-body-sm text-app">
                                      {isMe ? (
                                        <>
                                          <span className="font-bold">Tú</span>
                                          <span className="font-light"> debes a </span>
                                          <span className="font-bold">{!hasMultiple ? (debts[0].to_user_id === user?.id ? "Tú" : (debts[0].to_nombre ?? "Usuario")) : `${debts.length} personas`}</span>
                                        </>
                                      ) : (
                                        <>
                                          <span className="font-bold">{debtorLabel}</span>
                                          <span className="font-light"> debe a </span>
                                          <span className="font-bold">{!hasMultiple ? (debts[0].to_user_id === user?.id ? "Tú" : (debts[0].to_nombre ?? "Usuario")) : `${debts.length} personas`}</span>
                                        </>
                                      )}
                                    </p>
                                    <p className="truncate text-caption text-muted">
                                      {hasMultiple ? `${debts.length} deudas` : "Deuda pendiente"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className="text-right">
                                      <p className={`text-body-sm font-[var(--fw-semibold)] ${isMe ? "text-[var(--warning,#b45309)]" : "text-app"}`}>
                                        {formatMoney(totalGeneral, expenseSummary.currency)}
                                      </p>
                                    </div>
                                    {hasMultiple && (
                                      <span className={`text-muted transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                                        <ChevronDown className="size-[16px]" aria-hidden />
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="border-t border-app bg-[var(--surface-subtle,rgba(255,255,255,0.02))]">
                                    {debts.map((d) => {
                                      const isMineIncoming = d.to_user_id === user?.id;
                                      const creditorName = isMineIncoming ? "Tú" : (d.to_nombre ?? "Usuario");
                                      return (
                                        <button
                                          type="button"
                                          key={`${d.from_user_id}-${d.to_user_id}`}
                                          onClick={() => isMe ? setPagarDeuda(d) : undefined}
                                          className={`flex w-full items-center gap-3 py-[var(--space-2)] pl-10 ${isMe ? "cursor-pointer hover:bg-surface-inset/50" : "cursor-default"}`}
                                        >
                                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-app bg-surface-2 text-[11px] font-[var(--fw-semibold)] text-muted overflow-hidden">
                                            {!isMineIncoming && d.to_profile_image
                                              ? <img src={d.to_profile_image} alt={creditorName} className="size-full object-cover" />
                                              : creditorName.charAt(0).toUpperCase()}
                                          </div>
                                          <p className="min-w-0 flex-1 truncate text-left text-body-sm text-app">
                                            <span className="font-light">a </span>
                                            <span className="font-[var(--fw-semibold)]">{creditorName}</span>
                                          </p>
                                          <div className="text-right">
                                            <p className={`text-body-sm font-[var(--fw-semibold)] ${isMe ? "text-[var(--warning,#b45309)]" : "text-app"}`}>
                                              {formatMoney(d.importe, expenseSummary.currency)}
                                            </p>
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </section>

                  <section>
                    <div className="mb-[var(--space-3)] flex items-center justify-between gap-[var(--space-3)]">
                      <p className="text-body-sm font-[var(--fw-medium)] text-muted">Historial de gastos</p>
                      <span className="text-caption text-muted">
                        {sortedPlanGastos.length} gasto{sortedPlanGastos.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    {visiblePlanGastos.length === 0 ? (
                      <p className="px-[var(--space-4)] py-[var(--space-2)] text-body-sm text-muted">
                        Aún no hay gastos registrados en este plan.
                      </p>
                    ) : (
                      <div className="flex flex-col">
                        {visiblePlanGastos.map((gasto) => {
                          const payerName = gasto.pagado_por_nombre ?? "Usuario";
                          const isPaidByYou = gasto.pagado_por_user_id === user?.id;

                          return (
                            <article
                              key={gasto.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedGastoId(gasto.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  setSelectedGastoId(gasto.id);
                                }
                              }}
                              className="flex cursor-pointer items-center gap-3 transition-colors hover:bg-surface-inset/50 focus:outline-none"
                            >
                              <PlanExpenseAvatar name={payerName} image={gasto.pagado_por_foto ?? null} />

                              <div className="flex min-w-0 flex-1 items-center gap-2 py-[var(--space-4)]">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-body-sm text-app">
                                    {isPaidByYou ? (
                                      <>
                                        <span className="font-[var(--fw-semibold)]">Tú</span>
                                        <span className="font-light"> pagaste </span>
                                        <span className="font-[var(--fw-semibold)]">{gasto.titulo}</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="font-[var(--fw-semibold)]">{payerName}</span>
                                        <span className="font-light"> pagó </span>
                                        <span className="font-[var(--fw-semibold)]">{gasto.titulo}</span>
                                      </>
                                    )}
                                  </p>
                                  {gasto.subplan_titulo && (
                                    <p className="truncate text-caption text-muted">{gasto.subplan_titulo}</p>
                                  )}
                                </div>

                                <div className="flex shrink-0 items-center gap-[var(--space-3)]">
                                  <p className="text-body-sm font-[var(--fw-semibold)] text-app">
                                    {formatMoney(gasto.total, gasto.moneda)}
                                  </p>
                                  <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0 text-muted" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M9 18l6-6-6-6" />
                                  </svg>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                    {sortedPlanGastos.length > gastosLimit && (
                      <button
                        type="button"
                        onClick={() => setGastosLimit(l => l + 5)}
                        className="mt-[var(--space-2)] w-full py-[10px] text-body-sm font-[var(--fw-medium)] text-primary-token transition-colors hover:opacity-75"
                      >
                        Ver más ({sortedPlanGastos.length - gastosLimit} restantes)
                      </button>
                    )}
                  </section>

                </div>
              </div>
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
              heightClassName="h-full"
              containerClassName="h-full"
            />
            <div className="absolute left-[max(var(--space-3),env(safe-area-inset-left))] top-[calc(env(safe-area-inset-top)+var(--space-3))] z-10 flex items-center gap-[var(--space-2)]">
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
              <button
                type="button"
                onClick={() => setShowMapFullscreen(false)}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-full border border-white/12 bg-black/58 text-white shadow-[0_8px_20px_rgba(0,0,0,0.34)] backdrop-blur-sm transition-colors hover:bg-black/66"
                aria-label="Cerrar mapa"
              >
                <CloseX />
              </button>
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

      {activeTab !== "chat" && !showAddSheet && !showAddGastoSheet && (
        activeTab === "itinerario" || activeTab === "gastos" || activeTab === "fotos"
      ) && (!isPast || membershipChecked || isAdmin) && (membershipChecked || isAdmin || activeTab === "gastos") && (
        <div className="fixed bottom-[calc(var(--space-6)+env(safe-area-inset-bottom))] right-[var(--page-margin-x)] z-[65] flex flex-col items-end gap-3 md:hidden">
          <div className={`flex flex-col items-end gap-2 transition-all duration-200 ease-out ${mobileCreateOpen ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            {!isPast && isAdmin && (
              <button
                type="button"
                onClick={openCreateSubplan}
                aria-label="Crear subplan"
                className="flex items-center gap-[var(--space-2)]"
              >
                <span className="rounded-full border border-app bg-app px-[var(--space-3)] py-[7px] text-caption font-[var(--fw-semibold)] text-app shadow-elev-2">
                  Crear subplan
                </span>
                <span className="flex size-14 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3">
                  <CalendarSmallIcon className="size-6" />
                </span>
              </button>
            )}
            {!isPast && (
              <button
                type="button"
                onClick={openCreateGasto}
                aria-label="Crear gasto"
                className="flex items-center gap-[var(--space-2)]"
              >
                <span className="rounded-full border border-app bg-app px-[var(--space-3)] py-[7px] text-caption font-[var(--fw-semibold)] text-app shadow-elev-2">
                  Crear gasto
                </span>
                <span className="flex size-14 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3">
                  <FileText className="size-6" aria-hidden />
                </span>
              </button>
            )}
            {membershipChecked && (
              <button
                type="button"
                onClick={openPhotoUpload}
                aria-label="Subir foto"
                disabled={fabPhotoUploading}
                className="flex items-center gap-[var(--space-2)]"
              >
                <span className="rounded-full border border-app bg-app px-[var(--space-3)] py-[7px] text-caption font-[var(--fw-semibold)] text-app shadow-elev-2">
                  {fabPhotoUploading ? "Subiendo..." : "Subir foto"}
                </span>
                <span className="flex size-14 items-center justify-center rounded-full border border-app bg-surface text-app shadow-elev-3">
                  {fabPhotoUploading ? <span className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-60" /> : <Upload className="size-6" aria-hidden />}
                </span>
              </button>
            )}
          </div>
          <input
            ref={fabPhotoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => void handleFabPhotoFilesSelected(event)}
          />
          <button
            type="button"
            aria-label={mobileCreateOpen ? "Cerrar crear" : "Crear"}
            aria-expanded={mobileCreateOpen}
            onClick={() => setMobileCreateOpen((open) => !open)}
            className="flex size-14 items-center justify-center rounded-full bg-primary-token text-contrast-token shadow-[0_16px_32px_rgba(0,0,0,0.24)] transition-transform duration-200 active:scale-95"
          >
            <PlusIcon className={`size-7 transition-transform duration-200 ${mobileCreateOpen ? "rotate-45" : "rotate-0"}`} />
          </button>
        </div>
      )}

      {showAddSheet && plan && !isPast && isAdmin && (
        <AddSubplanSheet
          planId={plan.id}
          planStartDate={plan.inicio_at}
          planEndDate={plan.fin_at}
          subplanes={subplanes}
          onClose={() => {
            setShowAddSheet(false);
            setEditingSubplan(null);
            setAddSheetInitialTitulo(undefined);
            setAddSheetInitialDate(undefined);
          }}
          onSaved={handleSubplanSaved}
          initialTitulo={addSheetInitialTitulo}
          initialDate={addSheetInitialDate}
          initialSubplan={editingSubplan}
        />
      )}

      {showAddGastoSheet && plan && user && (
        <AddGastoSheet
          planId={plan.id}
          userId={user.id}
          onClose={() => setShowAddGastoSheet(false)}
          onCreated={() => {
            loadGastos();
            loadBalances();
          }}
        />
      )}

      <PlanGastoDetailModal
        gasto={selectedGasto}
        planName={plan.titulo}
        currentUserId={user?.id ?? null}
        onClose={() => setSelectedGastoId(null)}
      />

      {/* Invite modal */}
      {showPublishModal && plan && (
        <PublishPlanModal
          plan={plan}
          onClose={() => setShowPublishModal(false)}
        />
      )}

      {showInviteModal && (
        <div data-closing={inviteClosing ? "true" : "false"} className="app-modal-overlay fixed inset-0 z-[80] flex items-end justify-center px-4 pb-[max(var(--space-4),env(safe-area-inset-bottom))] sm:items-center" onClick={closeInviteModal}>
          <div className="app-modal-panel w-full max-w-[440px] rounded-modal bg-[var(--bg)] shadow-elev-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-app">
              <p className="text-body font-[var(--fw-semibold)]">Invitar al plan</p>
              <button type="button" onClick={closeInviteModal} className="text-muted transition-opacity hover:opacity-70">
                <CloseX />
              </button>
            </div>

            {/* Friends list */}
            <div className="px-2 pt-2 pb-1">
              <p className="px-3 pb-1.5 text-[14px] font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Amigos</p>
              {inviteFriendsLoading ? (
                <div className="flex justify-center py-6">
                  <div className="size-[20px] animate-spin rounded-full border-2 border-[var(--text-primary)] border-t-transparent" />
                </div>
              ) : inviteFriends.length === 0 ? (
                <p className="py-4 text-center text-body-sm text-muted">No hay amigos para invitar.</p>
              ) : (
                <div className="max-h-[calc(4*52px)] overflow-y-auto">
                  {inviteFriends.map((friend) => {
                    const sent = inviteSentIds.has(friend.id);
                    const sending = inviteSendingIds.has(friend.id);
                    const avatarLabel = (friend.nombre.trim()[0] || "?").toUpperCase();
                    return (
                      <div key={friend.id} className="flex h-[52px] w-full items-center gap-3 rounded-[8px] px-3">
                        {friend.profile_image ? (
                          <Image src={friend.profile_image} alt={friend.nombre} width={32} height={32} className="size-[32px] rounded-full object-cover" unoptimized referrerPolicy="no-referrer" />
                        ) : (
                          <div className="flex size-[32px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[14px] font-[var(--fw-semibold)] text-contrast-token">{avatarLabel}</div>
                        )}
                        <span className="flex-1 text-body-sm font-[var(--fw-medium)]">{friend.nombre}</span>
                        <button
                          type="button"
                          disabled={sent || sending}
                          onClick={() => void handleInviteFriend(friend.id)}
                          className={`rounded-full px-4 py-1.5 text-[14px] font-[var(--fw-semibold)] transition-all ${sent ? "bg-surface text-muted cursor-default" : "bg-[var(--text-primary)] text-contrast-token hover:opacity-80 disabled:opacity-50"}`}
                        >
                          {sending ? "..." : sent ? "Pendiente" : "Invitar"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Invite link */}
            {inviteLink && (
              <div className="px-5 py-3 border-t border-app">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[14px] font-[var(--fw-semibold)] uppercase tracking-wider text-muted">Enlace de invitación</p>
                  <button
                    type="button"
                    onClick={() => setShowQr((v) => !v)}
                    className="flex items-center gap-1 text-[14px] text-muted hover:text-[var(--text-primary)] transition-colors"
                  >
                    <QrCode className="size-[14px]" aria-hidden />
                    QR
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-[8px] bg-surface px-3 py-2">
                  <span className="flex-1 truncate text-[14px] text-muted">{inviteLink}</span>
                  <button
                    type="button"
                    onClick={handleCopyInviteLink}
                    className="shrink-0 rounded-full bg-[var(--text-primary)] px-3 py-1 text-[14px] font-[var(--fw-semibold)] text-contrast-token transition-all hover:opacity-80"
                  >
                    {inviteLinkCopied ? "¡Copiado!" : "Copiar"}
                  </button>
                </div>
                {/* QR code */}
                {showQr && (
                  <div className="mt-3 flex justify-center">
                    <div className="rounded-[12px] bg-white p-3 shadow-sm">
                      <QRCodeSVG value={inviteLink} size={160} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="px-5 pb-4 pt-2">
              <button
                type="button"
                onClick={closeInviteModal}
                className="w-full rounded-full border border-app py-[10px] text-body-sm font-[var(--fw-semibold)] transition-opacity hover:opacity-70"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showInvoiceModal && plan && (
        <div
          className="app-modal-overlay fixed inset-0 z-[80] flex items-end justify-center md:items-center"
          data-closing={invoiceClosing ? "true" : "false"}
          onClick={closeInvoiceModal}
        >
          <div
            className="app-modal-panel relative flex h-[90dvh] w-full flex-col overflow-hidden bg-[var(--bg)] md:h-[min(780px,90dvh)] md:max-w-[620px] md:rounded-[20px] md:shadow-elev-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-app px-5 py-4">
              <div>
                <p className="text-body font-[var(--fw-semibold)] text-app">{isPast ? "Factura final" : "Resumen parcial"}</p>
                <p className="text-caption text-muted">{plan.titulo}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const { jsPDF } = await import("jspdf");
                    const doc = new jsPDF({ unit: "pt", format: "a4" });
                    const pageW = doc.internal.pageSize.getWidth();
                    const pageH = doc.internal.pageSize.getHeight();
                    const ml = 48; const mr = pageW - 48; const contentW = mr - ml;

                    // ── Paleta ──
                    const INK:          [number,number,number] = [28,  28,  34 ];
                    const MUTED:        [number,number,number] = [110, 110, 120];
                    const ACCENT:       [number,number,number] = [41,  142, 125];
                    const ACCENT_DARK:  [number,number,number] = [28,  106, 93 ];
                    const ACCENT_LIGHT: [number,number,number] = [224, 245, 242];
                    const DIVIDER:      [number,number,number] = [226, 232, 230];
                    const WARN:         [number,number,number] = [180, 100, 0  ];
                    const SUCCESS:      [number,number,number] = [41,  142, 125];
                    const WHITE:        [number,number,number] = [255, 255, 255];
                    const ROW_ALT:      [number,number,number] = [245, 250, 249];
                    const PIE_COLORS: [number,number,number][] = [
                      [41,142,125],[91,175,162],[140,210,200],[28,106,93],[180,230,220],
                      [60,120,110],[100,190,175],[200,235,230],[50,160,145],[120,200,190],
                    ];

                    let y = 0;
                    const totalPages = () => (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();

                    const drawFooter = () => {
                      const pg = totalPages();
                      const fy = pageH - 28;
                      doc.setDrawColor(...DIVIDER); doc.setLineWidth(0.5);
                      doc.line(ml, fy - 8, mr, fy - 8);
                      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                      doc.text("Generado con Frimee", ml, fy);
                      doc.text(new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }), pageW / 2, fy, { align: "center" });
                      doc.text(`Página ${pg}`, mr, fy, { align: "right" });
                    };

                    const checkPage = (needed = 40) => {
                      if (y + needed > pageH - 60) { drawFooter(); doc.addPage(); y = 48; }
                    };

                    const sectionTitle = (title: string) => {
                      checkPage(30);
                      doc.setFillColor(...ACCENT); doc.roundedRect(ml, y, 3, 16, 2, 2, "F");
                      doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
                      doc.text(title, ml + 10, y + 12);
                      y += 24;
                    };

                    // ──────────────────────────────────────────────────────────
                    // 1. PORTADA
                    // ──────────────────────────────────────────────────────────
                    const headerH = 130;
                    doc.setFillColor(...ACCENT);
                    doc.roundedRect(0, 0, pageW, headerH, 0, 0, "F");
                    // círculos decorativos (dentro del header)
                    doc.setFillColor(55, 155, 138);
                    doc.circle(pageW - 30, 30, 55, "F");
                    doc.circle(pageW - 70, headerH - 10, 30, "F");
                    // badge tipo documento
                    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
                    doc.setCharSpace(1.8);
                    doc.text(isPast ? "FACTURA FINAL" : "RESUMEN PARCIAL", ml, 26);
                    doc.setCharSpace(0);
                    // nombre plan
                    doc.setFontSize(24); doc.setFont("helvetica", "bold");
                    const titleLines = doc.splitTextToSize(plan.titulo, contentW - 60) as string[];
                    titleLines.slice(0, 2).forEach((l, i) => doc.text(l, ml, 54 + i * 28));
                    // ubicación + fechas
                    const startFmt = new Date(plan.inicio_at).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
                    const endFmt   = new Date(plan.fin_at  ).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
                    doc.setFontSize(9.5); doc.setFont("helvetica", "normal"); doc.setTextColor(210, 240, 235);
                    doc.text(`${plan.ubicacion_nombre ?? ""}   ·   ${startFmt} – ${endFmt}`, ml, headerH - 16);
                    y = headerH + 24;

                    // aviso parcial
                    if (!isPast) {
                      doc.setFillColor(255, 248, 225);
                      doc.roundedRect(ml, y, contentW, 26, 4, 4, "F");
                      doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WARN);
                      doc.text("Resumen parcial — el plan aún no ha finalizado", ml + 10, y + 17);
                      y += 36;
                    }

                    // ──────────────────────────────────────────────────────────
                    // 2. RESUMEN EJECUTIVO (4 tarjetas)
                    // ──────────────────────────────────────────────────────────
                    const planMemberIds = new Set<string>();
                    sortedPlanGastos.forEach(g => { planMemberIds.add(g.pagado_por_user_id); g.partes?.forEach(p => planMemberIds.add(p.user_id)); });
                    const mediaPersona = planMemberIds.size > 0 ? expenseSummary.total / planMemberIds.size : 0;
                    const execStats = [
                      { label: "Total gastado",     value: formatMoney(expenseSummary.total, expenseSummary.currency) },
                      { label: "Gastos",            value: String(sortedPlanGastos.length) },
                      { label: "Participantes",     value: String(planMemberIds.size) },
                      { label: "Media por persona", value: formatMoney(mediaPersona, expenseSummary.currency) },
                    ];
                    const cardW = (contentW - 12) / 4;
                    execStats.forEach((s, i) => {
                      const cx = ml + i * (cardW + 4);
                      doc.setFillColor(...ACCENT_LIGHT); doc.roundedRect(cx, y, cardW, 52, 6, 6, "F");
                      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                      doc.text(s.label, cx + cardW / 2, y + 16, { align: "center" });
                      doc.setFontSize(i === 0 ? 11 : 13); doc.setFont("helvetica", "bold"); doc.setTextColor(...ACCENT);
                      doc.text(s.value, cx + cardW / 2, y + 36, { align: "center" });
                    });
                    y += 64;

                    // ──────────────────────────────────────────────────────────
                    // 3. GASTO POR CATEGORÍA (gráfico de queso en canvas)
                    // ──────────────────────────────────────────────────────────
                    const catMap = new Map<string, number>();
                    sortedPlanGastos.forEach(g => {
                      const cat = g.categoria_nombre ?? "Otros";
                      catMap.set(cat, (catMap.get(cat) ?? 0) + g.total);
                    });
                    const hasRealCategories = Array.from(catMap.keys()).some(k => k !== "Otros");
                    if (hasRealCategories) {
                      const catEntries = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
                      const legRowH = 22;
                      const needed = 30 + Math.max(100, catEntries.length * legRowH) + 16;
                      checkPage(needed);
                      sectionTitle("Gasto por categoría");

                      const pieR = 46;
                      const pieCx = ml + pieR + 4;
                      const pieCy = y + pieR + 4;

                      // dibujar sectores con triángulos
                      const drawSlice = (cx: number, cy: number, r: number, a1: number, a2: number, col: [number,number,number]) => {
                        const N = Math.max(4, Math.ceil(Math.abs(a2 - a1) / (Math.PI / 24)));
                        doc.setFillColor(...col);
                        for (let i = 0; i < N; i++) {
                          const sa = a1 + (a2 - a1) * i / N;
                          const ea = a1 + (a2 - a1) * (i + 1) / N;
                          doc.triangle(cx, cy, cx + r * Math.cos(sa), cy + r * Math.sin(sa), cx + r * Math.cos(ea), cy + r * Math.sin(ea), "F");
                        }
                        // separador blanco
                        doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.8);
                        doc.line(cx, cy, cx + r * Math.cos(a1), cy + r * Math.sin(a1));
                      };

                      let angle = -Math.PI / 2;
                      catEntries.forEach(([, val], idx) => {
                        const slice = (val / expenseSummary.total) * 2 * Math.PI;
                        drawSlice(pieCx, pieCy, pieR, angle, angle + slice, PIE_COLORS[idx % PIE_COLORS.length]);
                        angle += slice;
                      });

                      // leyenda
                      const legX = ml + pieR * 2 + 20;
                      let legY = y + 4;
                      catEntries.forEach(([name, val], idx) => {
                        const [pr, pg2, pb] = PIE_COLORS[idx % PIE_COLORS.length];
                        doc.setFillColor(pr, pg2, pb); doc.roundedRect(legX, legY, 8, 8, 2, 2, "F");
                        doc.setFontSize(8.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
                        const pct = ((val / expenseSummary.total) * 100).toFixed(1);
                        doc.text(`${name}  ${pct}%`, legX + 12, legY + 7);
                        doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                        doc.text(formatMoney(val, expenseSummary.currency), legX + 12, legY + 16);
                        legY += legRowH;
                      });

                      y += Math.max(pieR * 2 + 16, legY - y + 8);
                    }

                    // ──────────────────────────────────────────────────────────
                    // 4. SUBPLANES
                    // ──────────────────────────────────────────────────────────
                    const subplanMap = new Map<string, { titulo: string; total: number; count: number }>();
                    sortedPlanGastos.forEach(g => {
                      if (!g.subplan_id) return;
                      const key = String(g.subplan_id);
                      const titulo = g.subplan_titulo ?? `Subplan ${key}`;
                      if (!subplanMap.has(key)) subplanMap.set(key, { titulo, total: 0, count: 0 });
                      const entry = subplanMap.get(key)!;
                      entry.total += g.total; entry.count += 1;
                    });
                    const subplanEntries = Array.from(subplanMap.entries()).sort((a, b) => b[1].total - a[1].total);
                    if (subplanEntries.length > 0) {
                      checkPage(40 + subplanEntries.length * 28);
                      sectionTitle("Coste por subplan");
                      // cabecera
                      doc.setFillColor(240, 240, 248); doc.roundedRect(ml, y, contentW, 20, 4, 4, "F");
                      doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTED); doc.setCharSpace(0.6);
                      doc.text("SUBPLAN", ml + 10, y + 14);
                      doc.text("GASTOS", ml + contentW * 0.62, y + 14, { align: "center" });
                      doc.text("IMPORTE", mr - 4, y + 14, { align: "right" });
                      doc.setCharSpace(0); y += 20;
                      subplanEntries.forEach(([, s], i) => {
                        checkPage(28);
                        if (i % 2 === 1) { doc.setFillColor(...ROW_ALT); doc.rect(ml, y, contentW, 28, "F"); }
                        // barra de proporción
                        const barW = (s.total / expenseSummary.total) * (contentW * 0.45);
                        doc.setFillColor(...ACCENT_LIGHT); doc.roundedRect(ml + 10, y + 16, contentW * 0.45, 5, 2, 2, "F");
                        doc.setFillColor(...ACCENT); doc.roundedRect(ml + 10, y + 16, Math.max(barW, 2), 5, 2, 2, "F");
                        doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
                        doc.text(s.titulo, ml + 10, y + 12);
                        doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                        doc.text(String(s.count) + " gastos", ml + contentW * 0.62, y + 12, { align: "center" });
                        doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...ACCENT);
                        doc.text(formatMoney(s.total, expenseSummary.currency), mr - 4, y + 12, { align: "right" });
                        doc.setDrawColor(...DIVIDER); doc.setLineWidth(0.3); doc.line(ml, y + 28, mr, y + 28);
                        y += 28;
                      });
                      y += 8;
                    }

                    // ──────────────────────────────────────────────────────────
                    // 5. HISTORIAL DE GASTOS
                    // ──────────────────────────────────────────────────────────
                    checkPage(50);
                    sectionTitle("Historial de gastos");
                    doc.setFillColor(240, 240, 248); doc.roundedRect(ml, y, contentW, 20, 4, 4, "F");
                    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTED); doc.setCharSpace(0.6);
                    doc.text("CONCEPTO", ml + 10, y + 14);
                    doc.text("PAGADOR", ml + contentW * 0.5, y + 14);
                    doc.text("IMPORTE", mr - 4, y + 14, { align: "right" });
                    doc.setCharSpace(0); y += 20;

                    sortedPlanGastos.forEach((g, i) => {
                      checkPage(30);
                      if (i % 2 === 1) { doc.setFillColor(...ROW_ALT); doc.rect(ml, y, contentW, 30, "F"); }
                      doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
                      doc.text(doc.splitTextToSize(g.titulo, contentW * 0.44)[0] as string, ml + 10, y + 12);
                      doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                      const catLabel = g.categoria_nombre ?? (g.subplan_titulo ?? "");
                      doc.text([formatExpenseDateTime(g.fecha_gasto), catLabel].filter(Boolean).join("  ·  "), ml + 10, y + 22);
                      doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...INK);
                      doc.text(doc.splitTextToSize(g.pagado_por_nombre ?? "Usuario", contentW * 0.3)[0] as string, ml + contentW * 0.5, y + 12);
                      doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...ACCENT);
                      doc.text(formatMoney(g.total, g.moneda), mr - 4, y + 12, { align: "right" });
                      doc.setDrawColor(...DIVIDER); doc.setLineWidth(0.3); doc.line(ml, y + 30, mr, y + 30);
                      y += 30;
                    });
                    y += 4;
                    doc.setFillColor(...ACCENT); doc.roundedRect(ml, y, contentW, 30, 6, 6, "F");
                    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(...WHITE);
                    doc.text("TOTAL", ml + 14, y + 20);
                    doc.text(formatMoney(expenseSummary.total, expenseSummary.currency), mr - 14, y + 20, { align: "right" });
                    y += 42;

                    // ──────────────────────────────────────────────────────────
                    // 6. BALANCE POR PARTICIPANTE
                    // ──────────────────────────────────────────────────────────
                    checkPage(50);
                    sectionTitle("Balance por participante");
                    doc.setFillColor(240, 240, 248); doc.roundedRect(ml, y, contentW, 20, 4, 4, "F");
                    doc.setFontSize(7.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...MUTED); doc.setCharSpace(0.6);
                    doc.text("PARTICIPANTE", ml + 10, y + 14);
                    doc.text("PAGÓ", ml + contentW * 0.44, y + 14, { align: "right" });
                    doc.text("LE TOCA", ml + contentW * 0.64, y + 14, { align: "right" });
                    doc.text("NETO", mr - 4, y + 14, { align: "right" });
                    doc.setCharSpace(0); y += 20;

                    const participantBalance = new Map<string, { nombre: string | null; paid: number; share: number }>();
                    sortedPlanGastos.forEach(g => {
                      if (!participantBalance.has(g.pagado_por_user_id)) participantBalance.set(g.pagado_por_user_id, { nombre: g.pagado_por_nombre, paid: 0, share: 0 });
                      participantBalance.get(g.pagado_por_user_id)!.paid += g.total;
                      g.partes?.forEach(p => {
                        if (!participantBalance.has(p.user_id)) participantBalance.set(p.user_id, { nombre: p.nombre, paid: 0, share: 0 });
                        participantBalance.get(p.user_id)!.share += p.importe;
                      });
                    });
                    const balanceRows = Array.from(participantBalance.entries())
                      .map(([uid, v]) => ({ uid, ...v, net: v.paid - v.share }))
                      .sort((a, b) => b.net - a.net);
                    balanceRows.forEach((row, i) => {
                      checkPage(28);
                      if (i % 2 === 1) { doc.setFillColor(...ROW_ALT); doc.rect(ml, y, contentW, 28, "F"); }
                      doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
                      doc.text(row.nombre ?? "Usuario", ml + 10, y + 18);
                      doc.setFontSize(8.5); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                      doc.text(formatMoney(row.paid, expenseSummary.currency), ml + contentW * 0.44, y + 18, { align: "right" });
                      doc.text(formatMoney(row.share, expenseSummary.currency), ml + contentW * 0.64, y + 18, { align: "right" });
                      const netStr = (row.net >= 0 ? "+" : "") + formatMoney(row.net, expenseSummary.currency);
                      doc.setFontSize(9.5); doc.setFont("helvetica", "bold");
                      doc.setTextColor(...(row.net >= 0 ? SUCCESS : WARN));
                      doc.text(netStr, mr - 4, y + 18, { align: "right" });
                      doc.setDrawColor(...DIVIDER); doc.setLineWidth(0.3); doc.line(ml, y + 28, mr, y + 28);
                      y += 28;
                    });
                    y += 8;

                    // ──────────────────────────────────────────────────────────
                    // 7. LIQUIDACIONES PENDIENTES
                    // ──────────────────────────────────────────────────────────
                    checkPage(50);
                    sectionTitle("Liquidaciones pendientes");
                    if (visibleBalances.length === 0) {
                      doc.setFillColor(230, 247, 237); doc.roundedRect(ml, y, contentW, 26, 6, 6, "F");
                      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(...SUCCESS);
                      doc.text("Sin deudas pendientes — las cuentas están al día", ml + 14, y + 18);
                      y += 38;
                    } else {
                      // Agrupado por deudor
                      const debtorPdf = new Map<string, { nombre: string | null; deudas: { to: string | null; importe: number }[] }>();
                      visibleBalances.forEach(b => {
                        if (!debtorPdf.has(b.from_user_id)) debtorPdf.set(b.from_user_id, { nombre: b.from_nombre, deudas: [] });
                        debtorPdf.get(b.from_user_id)!.deudas.push({ to: b.to_nombre, importe: b.importe });
                      });
                      Array.from(debtorPdf.values()).sort((a, b) => b.deudas.reduce((s,d)=>s+d.importe,0) - a.deudas.reduce((s,d)=>s+d.importe,0)).forEach((debtor, i) => {
                        const total = debtor.deudas.reduce((s, d) => s + d.importe, 0);
                        const rowH = 28 + debtor.deudas.length * 18;
                        checkPage(rowH + 4);
                        if (i % 2 === 1) { doc.setFillColor(...ROW_ALT); doc.rect(ml, y, contentW, rowH, "F"); }
                        doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...INK);
                        doc.text(debtor.nombre ?? "Usuario", ml + 10, y + 14);
                        doc.setFontSize(9.5); doc.setFont("helvetica", "bold"); doc.setTextColor(...WARN);
                        doc.text(formatMoney(total, expenseSummary.currency), mr - 4, y + 14, { align: "right" });
                        debtor.deudas.forEach((d, j) => {
                          const dy = y + 28 + j * 18;
                          doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...MUTED);
                          doc.text(`→  debe a ${d.to ?? "Usuario"}`, ml + 20, dy);
                          doc.setTextColor(...WARN);
                          doc.text(formatMoney(d.importe, expenseSummary.currency), mr - 4, dy, { align: "right" });
                        });
                        doc.setDrawColor(...DIVIDER); doc.setLineWidth(0.3); doc.line(ml, y + rowH, mr, y + rowH);
                        y += rowH + 4;
                      });
                    }

                    drawFooter();
                    const filename = `gastos-${plan.titulo.toLowerCase().replace(/\s+/g, "-")}.pdf`;
                    doc.save(filename);
                  }}
                  className="flex items-center gap-1.5 rounded-full border border-app px-3 py-1.5 text-body-sm font-[var(--fw-semibold)] transition-colors hover:bg-surface"
                >
                  <Download className="size-[15px]" aria-hidden />
                  Descargar PDF
                </button>
                <button type="button" onClick={closeInvoiceModal} className="text-muted transition-opacity hover:opacity-70">
                  <CloseX />
                </button>
              </div>
            </div>

            {/* Printable content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div id="invoice-print-area">
                <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "2px" }}>{plan.titulo}</h1>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "6px" }}>
                  {plan.ubicacion_nombre} · {new Date(plan.inicio_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })} – {new Date(plan.fin_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                {!isPast && (
                  <p style={{ fontSize: "12px", color: "var(--warning, #b45309)", marginBottom: "16px" }}>⚠ Resumen parcial — el plan aún no ha finalizado</p>
                )}

                {/* Gastos */}
                <p className="mt-4 text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Historial de gastos</p>
                <div className="mt-2 divide-y divide-app">
                  {visiblePlanGastos.map((g) => (
                    <div key={g.id} className="flex items-center justify-between py-[10px]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-body-sm font-[var(--fw-semibold)] text-app">{g.titulo}</p>
                        <p className="text-caption text-muted">{g.pagado_por_nombre ?? "Usuario"} · {formatExpenseDateTime(g.fecha_gasto)}</p>
                      </div>
                      <p className="ml-4 shrink-0 text-body-sm font-[var(--fw-semibold)] text-app">{formatMoney(g.total, g.moneda)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between border-t-2 border-[var(--text-primary)] pt-3">
                  <p className="text-body-sm font-[var(--fw-bold)] text-app">Total</p>
                  <p className="text-body font-[var(--fw-bold)] text-app">{formatMoney(expenseSummary.total, expenseSummary.currency)}</p>
                </div>

                {/* Deudas agrupadas por deudor */}
                {visibleBalances.length > 0 ? (() => {
                  const debtorMap = new Map<string, { nombre: string | null; foto: string | null; deudas: typeof visibleBalances }>();
                  visibleBalances.forEach(b => {
                    if (!debtorMap.has(b.from_user_id)) debtorMap.set(b.from_user_id, { nombre: b.from_nombre, foto: b.from_profile_image, deudas: [] });
                    debtorMap.get(b.from_user_id)!.deudas.push(b);
                  });
                  const debtors = Array.from(debtorMap.entries()).map(([uid, v]) => ({ uid, ...v, total: v.deudas.reduce((s, d) => s + d.importe, 0) })).sort((a, b) => b.total - a.total);
                  return (
                    <>
                      <p className="mt-6 text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Liquidaciones pendientes</p>
                      <InvoiceDebtorList debtors={debtors} currency={expenseSummary.currency} formatMoney={formatMoney} />
                    </>
                  );
                })() : (
                  <p className="mt-6 text-body-sm text-muted">✓ No hay deudas pendientes entre los participantes.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditModal && plan && (() => {
        const initialValues: EditPlanInitialValues = {
          title: plan.titulo,
          description: plan.descripcion ?? "",
          location: plan.ubicacion_nombre ?? "",
          startDate: plan.inicio_at.slice(0, 10),
          endDate: plan.fin_at.slice(0, 10),
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
              const planId = Number(id);
              await updatePlanEndpoint({
                planId,
                titulo: payload.title,
                descripcion: "",
                inicioAt: payload.startDate,
                finAt: payload.endDate,
                ubicacionNombre: payload.location,
                allDay: true,
                visibilidad: payload.visibility,
                fotoPortada: payload.coverImageUrl,
              });
              const updated = await fetchPlansByIds({ planIds: [planId] });
              if (updated[0]) setPlan(updated[0]);
              setShowEditModal(false);
            }}
          />
        );
      })()}

      {pagarDeuda && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={closePaymentModal}>
          <div data-closing={paymentClosing ? "true" : "false"} className="app-modal-overlay absolute inset-0" />
          <div
            data-closing={paymentClosing ? "true" : "false"}
            className="app-modal-panel relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-surface-1 border border-app p-6 flex flex-col gap-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-body-sm text-muted">Confirmar pago</p>
                <p className="mt-1 text-heading-sm font-[var(--fw-bold)] text-app">
                  {formatMoney(pagarDeuda.importe, expenseSummary.currency)}
                </p>
                <p className="mt-1 text-body-sm text-muted">
                  a <span className="font-[var(--fw-semibold)] text-app">{pagarDeuda.to_nombre ?? "Usuario"}</span>
                </p>
              </div>
              <button type="button" onClick={closePaymentModal} className="text-muted hover:text-app">
                <CloseX />
              </button>
            </div>

            <div>
              <p className="mb-2 text-caption font-[var(--fw-semibold)] uppercase tracking-[0.08em] text-muted">Comprobante <span className="normal-case font-normal">(opcional)</span></p>
              {comprobantePreview ? (
                <div className="relative rounded-xl overflow-hidden border border-app">
                  <img src={comprobantePreview} alt="Comprobante" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setComprobanteFile(null); setComprobantePreview(null); }}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  >
                    <X className="size-[14px]" aria-hidden />
                  </button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-app bg-surface-2 px-4 py-5 text-center hover:bg-surface-3 transition-colors">
                  <Upload className="size-6" aria-hidden />
                  <span className="text-body-sm text-muted">Sube una captura del pago</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      setComprobanteFile(f);
                      setComprobantePreview(URL.createObjectURL(f));
                    }}
                  />
                </label>
              )}
            </div>

            <button
              type="button"
              disabled={pagandoId === pagarDeuda.liquidacion_id}
              onClick={async () => {
                if (!user?.id) return;
                setPagandoId(pagarDeuda.liquidacion_id);
                try {
                  let url: string | null = null;
                  if (comprobanteFile) url = await uploadComprobanteEndpoint(comprobanteFile, user.id);
                  await pagarLiquidacionEndpoint(pagarDeuda.liquidacion_id, url);
                  setPagarDeuda(null);
                  setComprobanteFile(null);
                  setComprobantePreview(null);
                  loadBalances();
                } catch (err) {
                  console.error(err);
                } finally {
                  setPagandoId(null);
                }
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary,#298e7d)] px-4 py-3 text-body-sm font-[var(--fw-semibold)] text-white hover:bg-[var(--primary-active,#1c6a5d)] disabled:opacity-50 transition-colors"
            >
              {pagandoId === pagarDeuda.liquidacion_id ? "Confirmando…" : "Confirmar pago"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
