"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/providers/AuthProvider";
import CreatePlanModal, { type CreatePlanPayload } from "@/components/plans/modals/CreatePlanModal";
import { useCreatePlan } from "@/hooks/useCreatePlan";
import AddGastoSheet from "@/components/plans/modals/AddGastoSheet";
import { listUserRelatedPlans } from "@/services/api/repositories/plans.repository";
import { listChats } from "@/services/api/repositories/chat.repository";
import type { FeedPlanItemDto } from "@/services/api/dtos/plan.dto";
import { countNotificacionesNoLeidas } from "@/services/api/repositories/notifications.repository";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import NotificationsPanel from "@/components/notifications/NotificationsPanel";
import UserSearchSurface from "@/components/search/UserSearchSurface";
import { Map, CreditCard, Send, Plus, Search, Bell, UserPlus, ChevronsUpDown } from "lucide-react";
import { ActiveExpensesIcon, ActiveMessagesIcon, ActivePlansIcon, ActiveSearchIcon } from "@/components/common/active-nav-icons";
import { CloseButton } from "@/components/ui/IconButton";
import { DraggableBottomSheet } from "@/components/ui/DraggableBottomSheet";
import { useModalCloseAnimation } from "@/hooks/useModalCloseAnimation";
import { DEFAULT_PLAN_COVER_IMAGE } from "@/config/app";
import { formatDateRange } from "@/lib/formatters";
import { createRealtimeTopic } from "@/lib/realtime";
import { getOpenChat } from "@/lib/open-chat";
import { useToast } from "@/components/ui/Toaster";
import { isPlanFinished } from "@/lib/plan-dates";
import CreateMenu, { type CreateMenuPlanContext } from "@/components/common/CreateMenu";
import ProfileMenu from "@/components/common/ProfileMenu";

// Plans for the «Crear» menu, shared by every page's sidebar for a minute.
let createPlansCache: { userId: string; at: number; plans: FeedPlanItemDto[] } | null = null;
const LAST_PLAN_KEY = "frimee:ultimo-plan";

type IconProps = {
  className?: string;
  strokeWidth?: number;
  active?: boolean;
};

const PlansIcon = ({ className, strokeWidth, active }: IconProps = {}) =>
  active ? <ActivePlansIcon className={className} /> : <Map className={className} strokeWidth={strokeWidth} aria-hidden />;
const CardIcon = ({ className, strokeWidth, active }: IconProps = {}) =>
  active ? <ActiveExpensesIcon className={className} /> : <CreditCard className={className} strokeWidth={strokeWidth} aria-hidden />;
const SendIcon = ({ className, strokeWidth, active }: IconProps = {}) =>
  active ? <ActiveMessagesIcon className={className} /> : <Send className={className} strokeWidth={strokeWidth} aria-hidden />;
const PlusIcon = ({ className, strokeWidth }: IconProps = {}) => <Plus className={className} strokeWidth={strokeWidth} aria-hidden />;
const SearchIcon = ({ className, strokeWidth, active }: IconProps = {}) =>
  active ? <ActiveSearchIcon className={className} /> : <Search className={className} strokeWidth={strokeWidth} aria-hidden />;
const BellIcon = ({ className, strokeWidth, active }: IconProps = {}) => (
  <Bell className={className} strokeWidth={strokeWidth} fill={active ? "currentColor" : "none"} aria-hidden />
);

const items = [
  { key: "calendar", label: "Mis planes", icon: PlansIcon, href: "/calendar" },
  { key: "cards", label: "Mis gastos", icon: CardIcon, href: "/mis-gastos" },
  { key: "send", label: "Mensajes", icon: SendIcon, href: "/messages" },
];
const mobileItems = items;
const NAV_ICON_STROKE = 2;

type AppSidebarProps = {
  onCreatePlan?: () => void;
  /** Messages: the FAB's «Nuevo grupo» (1 a 1 chats start from the Messages search). */
  onCreateGroup?: () => void;
  hideMobileNav?: boolean;
  /** Plan page: the «Crear» menu starts with «En este plan». */
  planContext?: CreateMenuPlanContext;
};
type MobileNavStyle = CSSProperties & { "--mobile-nav-base-height": string };

export default function AppSidebar({ onCreatePlan, onCreateGroup, hideMobileNav, planContext }: AppSidebarProps) {
  const router = useRouter();
  const { toast } = useToast();
  const pathname = usePathname();
  const [modalOpen, setModalOpen] = useState(false);

  // Hide bottom nav whenever any shared app modal is open.
  useEffect(() => {
    const syncModalState = () => {
      const hasModalOverlay = document.querySelector(".app-modal-overlay") !== null;
      if (document.body.hasAttribute("data-modal-open") && !hasModalOverlay) {
        document.body.removeAttribute("data-modal-open");
        document.body.style.overflow = "";
        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.width = "";
        document.body.style.paddingRight = "";
        document.documentElement.style.overscrollBehavior = "";
      }

      setModalOpen(
        document.body.hasAttribute("data-modal-open") ||
        document.body.hasAttribute("data-create-plan-open") ||
        document.body.hasAttribute("data-call-overlay-open")
      );
    };

    syncModalState();
    const observer = new MutationObserver(() => {
      syncModalState();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-modal-open", "data-create-plan-open", "data-call-overlay-open"] });
    return () => observer.disconnect();
  }, []);
  const [hovered, setHovered] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mobileFabOpen, setMobileFabOpen] = useState(false);
  const [mobileFabVisible, setMobileFabVisible] = useState(false);
  const [mobileFabAnimatingIn, setMobileFabAnimatingIn] = useState(false);
  const [desktopCreateMenuOpen, setDesktopCreateMenuOpen] = useState(false);
  const [expensePickerOpen, setExpensePickerOpen] = useState(false);
  const [selectedExpensePlanId, setSelectedExpensePlanId] = useState<number | null>(null);
  const [expensePickerDragState, setExpensePickerDragState] = useState({ progress: 0, dragging: false });
  const { isClosing: expensePickerClosing, requestClose: closeExpensePicker } = useModalCloseAnimation(
    () => setExpensePickerOpen(false),
    expensePickerOpen,
    { closeAnimationMs: 240, lockScroll: false }
  );
  const [expensePlans, setExpensePlans] = useState<FeedPlanItemDto[]>([]);
  const [expensePlansLoading, setExpensePlansLoading] = useState(false);
  const [notifPanelOpen, setNotifPanelOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const mobileFabRef = useRef<HTMLDivElement>(null);
  const desktopCreateRef = useRef<HTMLButtonElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const asideRef = useRef<HTMLElement>(null);
  const expenseCreatedRef = useRef(false);
  const [createPlans, setCreatePlans] = useState<FeedPlanItemDto[] | null>(null);
  const [lastPlanId, setLastPlanId] = useState<number | null>(null);

  const { user, profile, signOut } = useAuth();
  const isGuest = Boolean(user?.is_anonymous);

  // Plans for the «Crear» menu: loaded when the sidebar is first hovered (or the menu opens).
  const loadCreatePlans = () => {
    if (!user?.id) return;
    const cached = createPlansCache;
    if (cached && cached.userId === user.id && Date.now() - cached.at < 60_000) {
      setCreatePlans(cached.plans);
      return;
    }
    void listUserRelatedPlans({ userId: user.id, limit: 100 })
      .then((plans) => {
        createPlansCache = { userId: user.id, at: Date.now(), plans };
        setCreatePlans(plans);
      })
      .catch(() => setCreatePlans((prev) => prev ?? []));
  };

  // The last plan opened breaks the tie between two plans in progress.
  useEffect(() => {
    const m = /^\/plans\/(\d+)/.exec(pathname);
    try {
      if (m) window.localStorage.setItem(LAST_PLAN_KEY, m[1]);
      const saved = Number(window.localStorage.getItem(LAST_PLAN_KEY));
      setLastPlanId(Number.isFinite(saved) && saved > 0 ? saved : null);
    } catch { /* storage blocked: no tie-break */ }
  }, [pathname]);

  useEffect(() => {
    if (!expensePickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expensePickerOpen]);

  useEffect(() => {
    if (expensePickerOpen) return;
    setExpensePickerDragState({ progress: 0, dragging: false });
  }, [expensePickerOpen]);

  // The menu lives outside the sidebar (portal): keep the sidebar open while it is.
  const expanded = hovered || desktopCreateMenuOpen || profileMenuOpen;
  const loggedUserProfileImage = profile?.profile_image ?? null;
  const loggedUserInitial = (profile?.nombre?.trim()[0] || user?.email?.trim()[0] || "U").toUpperCase();

  useEffect(() => {
    void countNotificacionesNoLeidas().then(setUnreadNotifs).catch(() => setUnreadNotifs(0));
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;
    let refreshVersion = 0;
    let realtimeRefreshTimeout: number | undefined;
    const refreshUnreadMessages = async () => {
      const version = ++refreshVersion;
      try {
        const chats = await listChats();
        const total = chats.reduce((sum, chat) => sum + Math.max(0, Number(chat.unread_count) || 0), 0);
        if (!cancelled && version === refreshVersion) setUnreadMessages(total);
      } catch {
        // Keep the last known count if a temporary network error occurs.
      }
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshUnreadMessages();
    };
    const supabase = createBrowserSupabaseClient();
    const messagesChannel = supabase
      .channel(createRealtimeTopic("chat-unread-sidebar", user.id))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, () => {
        if (document.visibilityState !== "visible") return;
        if (realtimeRefreshTimeout !== undefined) window.clearTimeout(realtimeRefreshTimeout);
        realtimeRefreshTimeout = window.setTimeout(() => void refreshUnreadMessages(), 120);
      })
      .subscribe();

    void refreshUnreadMessages();
    const interval = window.setInterval(() => void refreshUnreadMessages(), 45_000);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("frimee:chat-unread-changed", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      if (realtimeRefreshTimeout !== undefined) window.clearTimeout(realtimeRefreshTimeout);
      void supabase.removeChannel(messagesChannel);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("frimee:chat-unread-changed", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user?.id, pathname]);

  useEffect(() => {
    const handleNotificationsRead = () => setUnreadNotifs(0);
    window.addEventListener("frimee:notifications-read", handleNotificationsRead);
    return () => window.removeEventListener("frimee:notifications-read", handleNotificationsRead);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createBrowserSupabaseClient();
    const channel = supabase
      .channel(createRealtimeTopic("notif-sidebar", user.id))
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setUnreadNotifs((prev) => prev + 1);
          // A poll draw in a chat that is not on screen: a short notice instead of the board.
          const row = payload.new as { tipo?: string; entity_id?: string | null };
          if (row.tipo !== "poll_draw") return;
          try {
            const meta = JSON.parse(row.entity_id ?? "") as { chat_id?: string; mensaje_id?: string; actor_nombre?: string };
            if (!meta.chat_id || meta.chat_id === getOpenChat()) return;
            const href = `/messages?chat=${encodeURIComponent(meta.chat_id)}${meta.mensaje_id ? `&m=${encodeURIComponent(meta.mensaje_id)}` : ""}`;
            toast(`${meta.actor_nombre?.split(" ")[0] ?? "Alguien"} ha lanzado un sorteo`, "info", { label: "Ver", onClick: () => router.push(href) });
          } catch { /* malformed entity: the bell count is enough */ }
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, router, toast]);

  useEffect(() => {
    setSearchPopoverOpen(false);
    setNotifPanelOpen(false);
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileFabOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileFabRef.current && !mobileFabRef.current.contains(e.target as Node)) {
        setMobileFabOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileFabOpen]);

  useEffect(() => {
    if (mobileFabOpen) {
      setMobileFabVisible(true);
      setMobileFabAnimatingIn(false);
      const frameId = window.requestAnimationFrame(() => {
        setMobileFabAnimatingIn(true);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    setMobileFabAnimatingIn(false);
    if (!mobileFabVisible) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMobileFabVisible(false);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [mobileFabOpen, mobileFabVisible]);

  // «C» opens the «Crear» menu on desktop, unless the user is typing or a modal is open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "c" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || e.repeat) return;
      if (!window.matchMedia("(min-width: 768px)").matches || modalOpen || desktopCreateMenuOpen) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector("[role=dialog][aria-modal=true], [role=menu]")) return;
      e.preventDefault();
      loadCreatePlans();
      setDesktopCreateMenuOpen(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  });

  useEffect(() => {
    if (!searchPopoverOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchPopoverOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [searchPopoverOpen]);

  useEffect(() => {
    if (!searchPopoverOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchPanelRef.current && !searchPanelRef.current.contains(e.target as Node)) {
        setSearchPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [searchPopoverOpen]);

  const openProfile = () => {
    if (!user?.id) {
      router.push("/settings");
      return;
    }

    const isCapacitor = Capacitor.isNativePlatform();
    router.push(isCapacitor ? `/profile/static?id=${user.id}` : `/profile/${user.id}`);
  };
  const openCreatePlan = () => {
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
    setExpensePickerOpen(false);
    if (onCreatePlan) {
      onCreatePlan();
      return;
    }
    setCreateModalOpen(true);
  };

  const openCreateExpense = async () => {
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
    setExpensePickerOpen(true);

    if (!user?.id) {
      setExpensePlans([]);
      return;
    }

    setExpensePlansLoading(true);
    try {
      const plans = await listUserRelatedPlans({ userId: user.id, limit: 100 });
      setExpensePlans(
        plans
          .filter((plan) => !isPlanFinished(plan.endsAt))
          .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
      );
    } catch {
      setExpensePlans([]);
    } finally {
      setExpensePlansLoading(false);
    }
  };

  const openCreateGroup = () => {
    setMobileFabOpen(false);
    setDesktopCreateMenuOpen(false);
    if (onCreateGroup) {
      onCreateGroup();
      return;
    }
    router.push("/messages?nuevoGrupo=1");
  };

  const openActividadEnPlan = (planId: number) => {
    const q = "tab=itinerario&nuevaActividad=";
    router.push(Capacitor.isNativePlatform() ? `/plans/static?id=${planId}&${q}` : `/plans/${planId}?${q}`);
  };

  const joinWithCode = (code: string) => {
    const c = encodeURIComponent(code);
    router.push(Capacitor.isNativePlatform() ? `/join/static?code=${c}` : `/join/${c}`);
  };

  const openExpenseForPlan = (planId: number) => {
    expenseCreatedRef.current = false;
    setSelectedExpensePlanId(planId);
  };

  const handleExpenseCreated = () => {
    expenseCreatedRef.current = true;
    const planId = selectedExpensePlanId;
    if (planId != null) {
      window.dispatchEvent(new CustomEvent("frimee:gasto-created", { detail: { planId } }));
    }
    router.refresh();
  };

  const createPlanFromForm = useCreatePlan();
  const handleCreatePlan = async (payload: CreatePlanPayload) => {
    await createPlanFromForm(payload);
    setCreateModalOpen(false);
  };

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  const renderSidebarRow = ({
    key,
    label,
    icon,
    href,
    onClick,
    active = false,
    badge = null,
  }: {
    key: string;
    label: string;
    icon: (props?: IconProps) => ReactNode;
    href?: string;
    onClick?: () => void;
    active?: boolean;
    badge?: string | number | null;
  }) => {
    const cls = "flex h-[24px] items-center text-app transition-opacity duration-150 hover:opacity-70";
    const content = (
      <>
        <div className="relative flex w-[102px] shrink-0 items-center justify-center">
          {icon({ className: "size-[26px]", strokeWidth: NAV_ICON_STROKE, active })}
          {badge ? (
            <span className="absolute top-[-4px] right-[30px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-[3px] text-[9px] font-[var(--fw-semibold)] leading-none text-[var(--contrast)]">
              {badge}
            </span>
          ) : null}
        </div>
        {expanded && <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">{label}</span>}
      </>
    );

    return href ? (
      <Link key={key} href={href} aria-label={label} className={cls}>
        {content}
      </Link>
    ) : (
      <button key={key} type="button" aria-label={label} onClick={onClick} className={cls}>
        {content}
      </button>
    );
  };

  const searchActive = searchPopoverOpen || isActive("/search");
  const notificationsActive = notifPanelOpen || isActive("/notifications");
  const profileActive = pathname.startsWith("/profile");
  const notificationBadge = unreadNotifs > 0 ? (unreadNotifs > 9 ? "9+" : unreadNotifs) : null;
  const unreadMessageBadge = unreadMessages > 0 ? (unreadMessages > 9 ? "9+" : unreadMessages) : null;
  const showMobileNotificationsButton = !hideMobileNav && !modalOpen && !searchActive && !profileActive && !notificationsActive;
  const mobileNavStyle: MobileNavStyle = { "--mobile-nav-base-height": "clamp(56px, 8dvh, 64px)" };

  return (
    <>
      {/* Mobile bottom nav */}
      {!hideMobileNav && (
        <nav
          style={mobileNavStyle}
          className={`fixed inset-x-0 bottom-0 z-sticky flex h-[calc(var(--mobile-nav-base-height)+env(safe-area-inset-bottom))] items-center justify-around border-t border-strong bg-app px-[clamp(var(--space-4),5vw,var(--space-5))] pb-safe transition-transform duration-[var(--duration-slow)] [transition-timing-function:var(--ease-decelerate)] md:hidden ${
            modalOpen ? "translate-y-full" : "translate-y-0"
          }`}
        >
          {mobileItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              aria-label={item.key === "send" && unreadMessages > 0 ? `Mensajes, ${unreadMessages} sin leer` : item.label}
              className="relative text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
            >
              <item.icon className="size-[clamp(25px,6.4vw,28px)]" strokeWidth={NAV_ICON_STROKE} active={isActive(item.href)} />
              {item.key === "send" && unreadMessageBadge ? (
                <span aria-hidden className="absolute -right-[7px] -top-[4px] flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--primary)] px-[3px] text-[9px] font-[var(--fw-semibold)] leading-none text-[var(--contrast)]">
                  {unreadMessageBadge}
                </span>
              ) : null}
            </Link>
          ))}
          <Link
            href="/search"
            aria-label="Buscar"
            className="flex size-[clamp(34px,8vw,38px)] items-center justify-center text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
          >
            <SearchIcon className="size-[clamp(25px,6.4vw,28px)]" strokeWidth={NAV_ICON_STROKE} active={searchActive} />
          </Link>
          <button
            type="button"
            aria-label="Perfil"
            onClick={openProfile}
            className="flex size-[clamp(34px,8vw,38px)] items-center justify-center text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)]"
          >
            {loggedUserProfileImage ? (
              <span className={`block size-[clamp(31px,7.4vw,34px)] overflow-hidden rounded-full ${profileActive ? "border-2 border-current" : "border border-strong"}`}>
                <Image src={loggedUserProfileImage} alt="Foto de perfil" width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
              </span>
            ) : (
              <span className={`flex size-[clamp(31px,7.4vw,34px)] items-center justify-center rounded-full bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app ${profileActive ? "border-2 border-current" : "border border-strong"}`}>
                {loggedUserInitial}
              </span>
            )}
          </button>

        </nav>
      )}

      {showMobileNotificationsButton && (
        <Link
          href="/notifications"
          aria-label="Notificaciones"
          className="mobile-title-action-top fixed right-[max(var(--page-margin-x),env(safe-area-inset-right))] z-[85] flex size-11 items-center justify-center text-app transition-opacity duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] active:opacity-[var(--disabled-opacity)] md:hidden"
        >
          <BellIcon className="size-[clamp(25px,6.4vw,28px)]" strokeWidth={NAV_ICON_STROKE} active={notificationsActive} />
          {notificationBadge ? (
            <span className="absolute right-[2px] top-[2px] flex size-[16px] items-center justify-center rounded-full bg-blue-500 text-[9px] font-[var(--fw-semibold)] leading-none text-white">
              {notificationBadge}
            </span>
          ) : null}
        </Link>
      )}

      {!hideMobileNav && !modalOpen && (
        <div
          ref={mobileFabRef}
          data-mobile-fab
          className="pointer-events-none fixed right-[max(16px,env(safe-area-inset-right))] bottom-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom)+16px)] z-[70] md:hidden"
        >
          {mobileFabVisible && (
            <div className={`absolute bottom-[calc(100%+12px)] right-0 flex flex-col items-end gap-2 transition-all duration-200 ease-out ${(mobileFabOpen && mobileFabAnimatingIn) ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            <button
              type="button"
              onClick={openCreatePlan}
              aria-label="Crear plan"
              className="pointer-events-auto flex min-h-12 min-w-[150px] max-w-[calc(100vw-32px)] items-center justify-between gap-2.5 rounded-full border border-app bg-app py-[7px] pl-5 pr-4 text-app shadow-[0_0_0_1px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.12)]"
            >
              <span className="whitespace-nowrap text-caption font-[var(--fw-semibold)] leading-none">
                Crear plan
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center">
                <PlansIcon className="size-5" />
              </span>
            </button>
            <button
              type="button"
              onClick={() => void openCreateExpense()}
              aria-label="Crear gasto"
              className="pointer-events-auto flex min-h-12 min-w-[150px] max-w-[calc(100vw-32px)] items-center justify-between gap-2.5 rounded-full border border-app bg-app py-[7px] pl-5 pr-4 text-app shadow-[0_0_0_1px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.12)]"
            >
              <span className="whitespace-nowrap text-caption font-[var(--fw-semibold)] leading-none">
                Crear gasto
              </span>
              <span className="flex size-7 shrink-0 items-center justify-center">
                <CardIcon className="size-5" />
              </span>
            </button>
            {onCreateGroup && (
              <button
                type="button"
                onClick={openCreateGroup}
                aria-label="Nuevo grupo"
                className="pointer-events-auto flex min-h-12 min-w-[150px] max-w-[calc(100vw-32px)] items-center justify-between gap-2.5 rounded-full border border-app bg-app py-[7px] pl-5 pr-4 text-app shadow-[0_0_0_1px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.12)]"
              >
                <span className="whitespace-nowrap text-caption font-[var(--fw-semibold)] leading-none">
                  Nuevo grupo
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <UserPlus className="size-5" aria-hidden />
                </span>
              </button>
            )}
            </div>
          )}
          <button
            type="button"
            aria-label={mobileFabOpen ? "Cerrar crear" : "Crear"}
            aria-expanded={mobileFabOpen}
            onClick={() => setMobileFabOpen((open) => !open)}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary-token text-[var(--contrast)] shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.14)] transition-transform duration-200 active:scale-95"
          >
            <PlusIcon className={`size-7 transition-transform duration-200 ${mobileFabOpen ? "rotate-45" : "rotate-0"}`} />
          </button>
        </div>
      )}

      {expensePickerOpen && (
        <div
          data-closing={expensePickerClosing ? "true" : "false"}
          className="app-modal-overlay app-mobile-sheet-overlay fixed inset-0 z-[1200] flex items-end justify-center px-0 md:items-center md:p-4"
          style={{
            animation: "none",
            backgroundColor: "transparent",
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) closeExpensePicker();
          }}
          role="presentation"
        >
          <div
            className="absolute inset-0 bg-black"
            style={{
              opacity: (expensePickerClosing ? 0 : Math.max(0.12, 1 - expensePickerDragState.progress * 1.25)) * 0.55,
              transition: expensePickerDragState.dragging ? "none" : "opacity 240ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeExpensePicker();
            }}
            aria-hidden="true"
          />
          <DraggableBottomSheet
            isClosing={expensePickerClosing}
            onDismiss={closeExpensePicker}
            handleLabel="Arrastrar selector de plan"
            handleClassName="md:hidden"
            onDragProgress={(progress, dragging) => {
              setExpensePickerDragState({ progress, dragging });
            }}
            className="app-expense-detail-panel app-mobile-sheet-panel relative z-10 flex h-[70dvh] w-full flex-col overflow-hidden rounded-t-[28px] bg-[var(--bg)] shadow-elev-4 md:h-auto md:max-h-[min(620px,82dvh)] md:max-w-[540px] md:rounded-[24px]"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Seleccionar plan para crear gasto"
          >
            <div className="shrink-0 px-[var(--space-6)] pb-[var(--space-5)] pt-[var(--space-2)]">
              <h2 className="text-[20px] font-[var(--fw-semibold)] leading-tight text-app">Crear gasto</h2>
              <p className="mt-[var(--space-1)] text-body-sm text-muted">Elige el plan al que pertenece.</p>
            </div>

            {expensePlansLoading ? (
              <p className="px-[var(--space-6)] py-8 text-center text-body-sm text-muted">Cargando planes...</p>
            ) : expensePlans.length > 0 ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-[var(--space-6)] pb-[calc(var(--space-8)+env(safe-area-inset-bottom))] md:max-h-[420px]">
                {expensePlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => openExpenseForPlan(plan.id)}
                    className="flex w-full items-stretch gap-3 text-left transition-colors hover:bg-surface-inset/50"
                  >
                    <span
                      className="my-[var(--space-2)] size-[68px] shrink-0 self-start rounded-[8px] bg-cover bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${plan.coverImage ?? DEFAULT_PLAN_COVER_IMAGE.mobile})` }}
                      role="img"
                      aria-label={plan.title}
                    />
                    <span className="flex min-w-0 flex-1 items-start gap-2 py-[var(--space-2)]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-sm font-[var(--fw-semibold)] text-app">{plan.title}</span>
                        <span className="mt-[2px] block text-caption text-muted">{formatDateRange(plan.startsAt, plan.endsAt)}</span>
                        {plan.locationName && (
                          <span className="mt-[2px] block truncate text-caption text-tertiary">{plan.locationName}</span>
                        )}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" className="size-[15px] shrink-0 self-center text-muted" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 18l6-6-6-6" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="px-[var(--space-6)] pb-[calc(var(--space-8)+env(safe-area-inset-bottom))]">
                <p className="py-6 text-center text-body-sm text-muted">No tienes planes activos para añadir un gasto.</p>
                <button type="button" onClick={openCreatePlan} className="flex h-11 w-full items-center justify-center rounded-[14px] bg-primary-token text-body-sm font-[var(--fw-semibold)] text-[var(--contrast)]">
                  Crear plan
                </button>
              </div>
            )}
          </DraggableBottomSheet>
        </div>
      )}

      {selectedExpensePlanId != null && user?.id && (
        <AddGastoSheet
          planId={selectedExpensePlanId}
          userId={user.id}
          planName={(expensePlans.find((plan) => plan.id === selectedExpensePlanId) ?? createPlans?.find((plan) => plan.id === selectedExpensePlanId))?.title}
          onClose={() => {
            setSelectedExpensePlanId(null);
            if (expenseCreatedRef.current) {
              expenseCreatedRef.current = false;
              setExpensePickerOpen(false);
              return;
            }
          }}
          onCreated={handleExpenseCreated}
        />
      )}

      {/* Desktop sidebar: logo, «Crear», sections, and the account at the foot */}
      <aside
        ref={asideRef}
        onMouseEnter={() => { setHovered(true); loadCreatePlans(); }}
        onMouseLeave={() => setHovered(false)}
        className={`fixed left-0 top-0 z-30 hidden h-dvh border-r border-app bg-app transition-[width] duration-200 ease-out md:flex md:flex-col md:pt-[var(--space-6)] ${
          expanded ? "w-[240px]" : "w-[102px]"
        }`}
      >
        <div className="flex w-full flex-1 flex-col overflow-hidden">
          {/* Logo — icon always centered in the 102px zone */}
          <div className="flex h-[40px] w-[102px] shrink-0 items-center justify-center">
            <Image src="/logo-frimee-black.png" alt="Frimee" width={28} height={36} className="h-9 w-auto [.dark_&]:hidden" priority unoptimized />
            <Image src="/logo-frimee.png" alt="Frimee" width={28} height={36} className="hidden h-9 w-auto [.dark_&]:block" priority unoptimized />
          </div>

          {/* «Crear» and the sections, centred in the height left between logo and account */}
          <div className="flex min-h-0 flex-1 flex-col justify-center">
          {/* «Crear»: the main action, a real button above the sections */}
          <button
            ref={desktopCreateRef}
            type="button"
            aria-haspopup="menu"
            aria-expanded={desktopCreateMenuOpen}
            aria-label="Crear"
            aria-keyshortcuts="C"
            title={desktopCreateMenuOpen ? undefined : "Crear · C"}
            onClick={() => {
              if (!desktopCreateMenuOpen) loadCreatePlans();
              setProfileMenuOpen(false);
              setDesktopCreateMenuOpen((open) => !open);
            }}
            className={`mx-[28px] flex h-[46px] shrink-0 items-center overflow-hidden rounded-[8px] border transition-colors duration-[var(--duration-base)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring-color)] focus-visible:ring-offset-2 ${
              desktopCreateMenuOpen
                ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg)]"
                : "border-[var(--border-strong)] text-app hover:bg-[var(--surface-2)]"
            }`}
          >
            <span className="flex w-[44px] shrink-0 items-center justify-center">
              <PlusIcon
                className={`size-[22px] transition-transform duration-[var(--duration-base)] motion-reduce:transition-none ${desktopCreateMenuOpen ? "rotate-45 motion-reduce:rotate-0" : ""}`}
                strokeWidth={NAV_ICON_STROKE}
              />
            </span>
            {expanded && <span className="whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-semibold)]">Crear</span>}
          </button>

          {/* Sections */}
          <nav aria-label="Principal" className="mt-[var(--space-10)] flex w-full flex-col gap-[var(--space-8)]">
            {items.slice(0, 1).map((item) =>
              renderSidebarRow({
                key: item.key,
                label: item.label,
                icon: item.icon,
                href: item.href,
                active: isActive(item.href),
              })
            )}
            <button
              type="button"
              aria-label="Buscar"
              onClick={() => {
                setNotifPanelOpen(false);
                setSearchPopoverOpen(true);
              }}
              className="flex h-[24px] items-center text-app transition-opacity duration-150 hover:opacity-70"
            >
              <div className="relative flex w-[102px] shrink-0 items-center justify-center">
                <SearchIcon className="size-[26px]" strokeWidth={NAV_ICON_STROKE} active={searchActive} />
              </div>
              {expanded && (
                <span className="-ml-[14px] whitespace-nowrap pr-[var(--space-4)] text-body font-[var(--fw-medium)]">
                  Buscar
                </span>
              )}
            </button>
            {items.slice(1).map((item) =>
              renderSidebarRow({
                key: item.key,
                label: item.label,
                icon: item.icon,
                href: item.href,
                active: isActive(item.href),
                badge: item.key === "send" ? unreadMessageBadge : null,
              })
            )}
            {renderSidebarRow({
              key: "notifications",
              label: "Notificaciones",
              icon: BellIcon,
              onClick: () => {
                setSearchPopoverOpen(false);
                setNotifPanelOpen(true);
              },
              active: notifPanelOpen,
              badge: notificationBadge,
            })}
          </nav>
          </div>

          {/* Account at the foot, apart from the daily sections */}
          <div className="shrink-0 border-t border-app py-[var(--space-4)]">
            <button
              type="button"
              ref={profileButtonRef}
              aria-label={isGuest ? "Invitado. Menú de la cuenta" : `${profile?.nombre?.trim() || "Tu perfil"}. Menú de la cuenta`}
              aria-haspopup="menu"
              aria-expanded={profileMenuOpen}
              onClick={() => {
                setDesktopCreateMenuOpen(false);
                setProfileMenuOpen((open) => !open);
              }}
              className={`flex h-[52px] w-full items-center text-app transition-colors duration-150 hover:bg-surface ${profileMenuOpen ? "bg-surface" : ""}`}
            >
              <div className="flex w-[102px] shrink-0 items-center justify-center">
                {isGuest ? (
                  <span className="flex size-[34px] items-center justify-center rounded-full border border-strong bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app">?</span>
                ) : loggedUserProfileImage ? (
                  <span className={`block size-[34px] overflow-hidden rounded-full ${profileActive ? "border-2 border-current" : "border border-strong"}`}>
                    <Image src={loggedUserProfileImage} alt="" width={34} height={34} className="h-full w-full object-cover" unoptimized referrerPolicy="no-referrer" />
                  </span>
                ) : (
                  <span className={`flex size-[34px] items-center justify-center rounded-full bg-surface-inset text-body-sm font-[var(--fw-semibold)] text-app ${profileActive ? "border-2 border-current" : "border border-strong"}`}>
                    {loggedUserInitial}
                  </span>
                )}
              </div>
              {expanded && (
                <>
                  <span className="-ml-[14px] min-w-0 flex-1 truncate text-left text-body font-[var(--fw-medium)]">
                    {isGuest ? "Invitado" : profile?.nombre?.trim() || "Tu perfil"}
                  </span>
                  <ChevronsUpDown className="mr-[var(--space-4)] size-[16px] shrink-0 text-muted" aria-hidden />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      <CreateMenu
        open={desktopCreateMenuOpen}
        onClose={(returnFocus) => {
          setDesktopCreateMenuOpen(false);
          if (returnFocus) desktopCreateRef.current?.focus();
        }}
        anchorRef={desktopCreateRef}
        sidebarRef={asideRef}
        plans={createPlans}
        lastPlanId={lastPlanId}
        planContext={planContext}
        onActividadEnPlan={openActividadEnPlan}
        onGastoEnPlan={openExpenseForPlan}
        onPlanNuevo={openCreatePlan}
        onGrupoNuevo={openCreateGroup}
        onUnirme={joinWithCode}
      />
      <ProfileMenu
        open={profileMenuOpen}
        onClose={(returnFocus) => {
          setProfileMenuOpen(false);
          if (returnFocus) profileButtonRef.current?.focus();
        }}
        anchorRef={profileButtonRef}
        sidebarRef={asideRef}
        userId={user?.id ?? null}
        isGuest={isGuest}
        name={profile?.nombre?.trim() || "Tu perfil"}
        handle={profile?.username ? `@${profile.username}` : (user?.email ?? null)}
        image={loggedUserProfileImage}
        initial={loggedUserInitial}
        onOpenProfile={openProfile}
        onOpenSettings={() => router.push("/settings")}
        onSaveAccount={() => window.dispatchEvent(new Event("frimee:save-account"))}
        onSignOut={async () => {
          await signOut();
          router.replace("/login");
        }}
        onLogin={async () => {
          await signOut();
          router.replace("/login");
        }}
      />

      <CreatePlanModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreatePlan}
        currentUserId={user?.id}
      />
      <NotificationsPanel
        open={notifPanelOpen}
        onClose={() => setNotifPanelOpen(false)}
        onRead={() => setUnreadNotifs(0)}
        desktopPosition="left"
      />
      <div
        ref={searchPanelRef}
        role="dialog"
        aria-label="Buscar usuarios"
        aria-hidden={!searchPopoverOpen}
        inert={!searchPopoverOpen}
        className={`fixed left-0 top-0 z-50 hidden h-dvh w-full max-w-[360px] flex-col bg-[var(--bg)] shadow-elev-3 transition-transform duration-300 [transition-timing-function:var(--ease-standard)] md:flex ${
          searchPopoverOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-5">
          <UserSearchSurface
            excludeUserId={user?.id}
            limit={6}
            autoFocus={searchPopoverOpen}
            resultsClassName="mt-3 -mx-5 flex-1 overflow-y-auto overscroll-contain"
            onResultClick={() => setSearchPopoverOpen(false)}
            emptyAction={(
              <CloseButton
                onClick={() => setSearchPopoverOpen(false)}
                iconClassName="size-[16px]"
                className="-mr-2"
              />
            )}
          />
        </div>
      </div>
    </>
  );
}
