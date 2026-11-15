"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";
import { formatChatTime, type ChatListItem } from "@/services/api/repositories/chat.repository";
import { matchesText } from "@/lib/text-search";
import { Composer } from "./DraftDirectChat";
import { AvatarStack, CheckMark, CopyInviteLink, FriendsStatus, PersonAvatar, firstName, type Friend, type FriendsState } from "./people";

export const DEFAULT_GROUP_NAME = "Nuevo grupo";
const MAX_NAME = 80;
/** «Para» layout: gap between items, the search box's minimum width, at most two lines. */
const PARA_GAP = 6;
const PARA_INPUT_MIN = 120;
const PARA_LINES = 2;

/**
 * How many chips fit so that «Para», the chips, «+N más» (when some are left out) and the search
 * box take at most two lines of `width` px: simulates the flex-wrap with the measured widths.
 */
function chipsThatFit(width: number, label: number, chips: number[], more: number): number {
  const lines = (items: number[]) => {
    let n = 1;
    let x = 0;
    for (const w of items) {
      const need = x === 0 ? w : x + PARA_GAP + w;
      if (need > width && x > 0) { n += 1; x = w; } else { x = need; }
    }
    return n;
  };
  for (let k = chips.length; k >= 0; k--) {
    const items = [label, ...chips.slice(0, k), ...(k < chips.length ? [more] : []), PARA_INPUT_MIN];
    if (lines(items) <= PARA_LINES) return k;
  }
  return 0;
}

/** State shared by the picker (left / full screen) and, on desktop, the preview on the right. */
export function useNewGroup() {
  const [selected, setSelected] = useState<Friend[]>([]);
  const [nombre, setNombre] = useState(DEFAULT_GROUP_NAME);
  const [creating, setCreating] = useState(false);
  /** Why creating failed, shown next to the create button (no floating toast). */
  const [error, setError] = useState<string | null>(null);
  const toggle = (f: Friend) => {
    setError(null);
    setSelected((prev) => (prev.some((p) => p.id === f.id) ? prev.filter((p) => p.id !== f.id) : [...prev, f]));
  };
  const remove = (id: string) => { setError(null); setSelected((prev) => prev.filter((p) => p.id !== id)); };
  const reset = () => { setSelected([]); setNombre(DEFAULT_GROUP_NAME); setCreating(false); setError(null); };
  const nameOk = nombre.trim().length > 0;
  const enough = selected.length >= 2;
  return { selected, toggle, remove, nombre, setNombre, creating, setCreating, error, setError, reset, nameOk, enough, valid: nameOk && enough };
}
export type NewGroupState = ReturnType<typeof useNewGroup>;

/** «N personas y tú» / «1 persona y tú». */
export function peopleAndYou(n: number) {
  return `${n} ${n === 1 ? "persona" : "personas"} y tú`;
}

/**
 * The «Nuevo grupo» picker (boards nc-m-grupo1, nc-m-grupo, nc-m-nores, nc-d-grupo, nc-d-grupo20):
 * «Para» with chips, the search, Recientes and A–Z. On phones it also holds the group name and
 * «Crear grupo · N personas y tú» fixed at the bottom; on desktop those live in the preview.
 */
export function NewGroupPicker({
  g, friends, onLoadFriends, chats, userId, onBack, onCreate,
}: {
  g: NewGroupState;
  friends: FriendsState;
  onLoadFriends: (force?: boolean) => void;
  chats: ChatListItem[];
  userId: string;
  onBack: () => void;
  onCreate: () => void;
}) {
  const [query, setQuery] = useState("");
  const [showAllChosen, setShowAllChosen] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const q = query.trim();
  const chosen = new Set(g.selected.map((s) => s.id));

  // Recientes: friends I talked to last (1 a 1), the 3 most recent. The rest, A–Z.
  const recent = useMemo(() => {
    const out: Array<{ id: string; at: string | null }> = [];
    for (const c of chats) {
      if (c.tipo !== "DIRECTO") continue;
      const other = c.miembros.find((m) => m.id !== userId);
      if (other) out.push({ id: other.id, at: c.last_message_at });
    }
    return out;
  }, [chats, userId]);
  const all = friends.status === "ready" ? friends.friends : [];
  const recentFriends = recent
    .map((r) => ({ f: all.find((f) => f.id === r.id), at: r.at }))
    .filter((r): r is { f: Friend; at: string | null } => Boolean(r.f))
    .slice(0, 3);
  const recentIds = new Set(recentFriends.map((r) => r.f.id));
  const rest = all.filter((f) => !recentIds.has(f.id));
  const hits = q ? all.filter((f) => matchesText(f.nombre, q) || (f.username ? matchesText(f.username, q) : false)) : [];

  useEffect(() => { searchRef.current?.focus(); }, []);

  // «Para» never takes more than two lines: as many chips as fit (by real widths), then «+N más».
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<number>(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const field = fieldRef.current;
    const measure = measureRef.current;
    if (!field || !measure) return;
    const run = () => {
      const cs = getComputedStyle(field);
      const width = field.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const label = measure.querySelector<HTMLElement>("[data-m=label]")?.offsetWidth ?? 0;
      const more = measure.querySelector<HTMLElement>("[data-m=more]")?.offsetWidth ?? 0;
      const chipW = [...measure.querySelectorAll<HTMLElement>("[data-m=chip]")].map((el) => el.offsetWidth);
      setFit(chipsThatFit(width, label, chipW, more));
    };
    run();
    const ro = new ResizeObserver(run);
    ro.observe(field);
    return () => ro.disconnect();
  }, [g.selected]);
  const shown = Math.min(fit, g.selected.length);
  const collapsed = shown < g.selected.length;
  const chips = g.selected.slice(0, shown);
  const chip = (p: Friend, measuring = false) => (
    <span
      key={p.id}
      data-m={measuring ? "chip" : undefined}
      className="inline-flex h-[32px] max-w-full shrink-0 items-center gap-[6px] rounded-full border border-[var(--chat-me-border)] bg-[var(--chat-me)] pl-[4px] text-[14px] font-[var(--fw-semibold)] text-app"
    >
      <PersonAvatar name={p.nombre} src={p.profile_image} size={24} />
      <span className="truncate">{firstName(p.nombre)}</span>
      {measuring ? <span className="size-[32px] shrink-0" /> : (
        <button type="button" onClick={() => g.remove(p.id)} aria-label={`Quitar a ${firstName(p.nombre)}`} className="flex size-[32px] shrink-0 items-center justify-center text-muted">
          <X className="size-[14px]" aria-hidden />
        </button>
      )}
    </span>
  );

  const row = (f: Friend, sub?: string) => (
    <li key={f.id}>
      <label className="flex min-h-[56px] cursor-pointer items-center gap-[12px] rounded-[8px] px-[8px] hover:bg-[var(--chat-surface)]">
        <PersonAvatar name={f.nombre} src={f.profile_image} size={40} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-app">{f.nombre}</span>
          {sub && <span className="block truncate text-[13px] text-muted">{sub}</span>}
        </span>
        <input type="checkbox" className="peer sr-only" checked={chosen.has(f.id)} onChange={() => { g.toggle(f); setQuery(""); }} />
        <CheckMark on={chosen.has(f.id)} />
      </label>
    </li>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-[4px] px-[var(--space-3)] pb-[var(--space-2)] pt-mobile-safe-top md:pt-[var(--space-3)]">
        <button type="button" onClick={onBack} aria-label="Volver a Mensajes" className="flex size-[44px] shrink-0 items-center justify-center rounded-[8px] text-app hover:bg-[var(--surface)]">
          <ChevronLeft className="size-[22px]" aria-hidden />
        </button>
        <h1 className="text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app md:text-[var(--font-h1)]">Nuevo grupo</h1>
      </header>

      {/* «Para»: never more than two lines; as many chips as fit, then «+N más». */}
      <div className="relative px-[var(--space-4)]">
        {/* Invisible copy at natural width, only to measure each chip. */}
        <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex w-max gap-[6px]">
          <span data-m="label" className="text-[13px]">Para</span>
          {g.selected.map((p) => chip(p, true))}
          <span data-m="more" className="inline-flex h-[32px] items-center rounded-full border px-[10px] text-[13px] font-[var(--fw-semibold)]">+{g.selected.length} más</span>
        </div>
        <div ref={fieldRef} className="flex flex-wrap items-center gap-[6px] rounded-[8px] border border-[var(--primary)] bg-[var(--surface)] px-[12px] py-[8px] shadow-[0_0_0_1px_var(--primary)]">
          <span className="text-[13px] text-muted">Para</span>
          {chips.map((p) => chip(p))}
          {collapsed && (
            <button
              type="button"
              onClick={() => setShowAllChosen((v) => !v)}
              aria-expanded={showAllChosen}
              aria-label={`Ver las ${g.selected.length} personas elegidas`}
              className="inline-flex h-[32px] items-center rounded-full border border-app px-[10px] text-[13px] font-[var(--fw-semibold)] text-app"
            >+{g.selected.length - shown} más</button>
          )}
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !query && g.selected.length) g.remove(g.selected[g.selected.length - 1].id);
              if (e.key === "Escape") { e.preventDefault(); onBack(); }
            }}
            placeholder={g.selected.length ? "" : "Buscar personas"}
            aria-label="Buscar personas"
            className="h-[32px] min-w-[120px] flex-1 border-none bg-transparent text-[15px] text-app outline-none placeholder:text-muted [&::-webkit-search-cancel-button]:hidden"
          />
        </div>
        {showAllChosen && collapsed && (
          <ul aria-label="Personas elegidas" className="mt-[6px] max-h-[220px] overflow-y-auto rounded-[8px] border border-app">
            {g.selected.map((p) => (
              <li key={p.id} className="flex min-h-[48px] items-center gap-[10px] px-[10px]">
                <PersonAvatar name={p.nombre} src={p.profile_image} size={28} />
                <span className="min-w-0 flex-1 truncate text-[14px] text-app">{p.nombre}</span>
                <button type="button" onClick={() => g.remove(p.id)} className="min-h-[44px] text-[13px] font-[var(--fw-semibold)] text-primary-token">Quitar</button>
              </li>
            ))}
          </ul>
        )}

        {/* Phone: the name here (desktop: in the preview's header). Mandatory, starts as «Nuevo grupo». */}
        {g.enough && (
          <div className="mt-[12px] md:hidden">
            <GroupNameField g={g} id="ng-nombre-m" />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[var(--space-3)] pb-[var(--space-4)]">
        {friends.status !== "ready" || all.length === 0 ? (
          <FriendsStatus state={friends} onRetry={() => onLoadFriends(true)} />
        ) : q ? (
          hits.length ? (
            <ul aria-label="Resultados">{hits.map((f) => row(f))}</ul>
          ) : (
            <div className="px-[8px] py-[16px]">
              <p className="text-[15px] font-[var(--fw-semibold)] text-app">No encontramos a «{q}»</p>
              <p className="mt-[2px] text-[14px] text-muted">Solo puedes escribir a tus amigos en Frimee. Pásale un enlace para que se una.</p>
              <CopyInviteLink />
            </div>
          )
        ) : (
          <>
            {recentFriends.length > 0 && (
              <>
                <p className="px-[8px] pb-[4px] pt-[14px] text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">Recientes</p>
                <ul aria-label="Recientes">{recentFriends.map((r) => row(r.f, r.at ? `Último mensaje: ${formatChatTime(r.at)}` : undefined))}</ul>
              </>
            )}
            {rest.length > 0 && (
              <>
                <p className="px-[8px] pb-[4px] pt-[14px] text-[12px] font-[var(--fw-semibold)] tracking-[0.02em] text-muted">Amigos · A–Z</p>
                <ul aria-label="Amigos de la A a la Z">{rest.map((f) => row(f))}</ul>
              </>
            )}
          </>
        )}
      </div>

      {/* Phone: fixed at the bottom. Desktop: only the hint (creating is on the right). */}
      <div className="border-t border-app px-[var(--space-4)] py-[var(--space-3)] pb-[calc(var(--space-3)+env(safe-area-inset-bottom))] md:pb-[var(--space-3)]">
        {!g.enough ? (
          <p className="text-center text-[14px] text-muted" aria-live="polite">Elige al menos 2 personas</p>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onCreate()}
              disabled={!g.valid || g.creating}
              className="flex min-h-[46px] w-full items-center justify-center gap-[8px] rounded-[8px] bg-[var(--primary)] px-[16px] text-[15px] font-[var(--fw-semibold)] text-[var(--bg)] transition-opacity hover:opacity-90 disabled:bg-[var(--surface-2)] disabled:text-muted md:hidden"
            >
              {g.creating ? "Creando el grupo…" : `Crear grupo · ${peopleAndYou(g.selected.length)}`}
            </button>
            <p className="hidden text-center text-[14px] text-muted md:block" aria-live="polite">{peopleAndYou(g.selected.length)}</p>
            {g.error && <p role="alert" className="mt-[6px] text-center text-[13px] text-[var(--error)] md:hidden">{g.error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** The group's name: mandatory, starts as «Nuevo grupo» (selected on focus so typing replaces it). */
export function GroupNameField({ g, id, inHeader }: { g: NewGroupState; id: string; inHeader?: boolean }) {
  const firstFocus = useRef(true);
  return (
    <div>
      <label htmlFor={id} className={inHeader ? "sr-only" : "mb-[4px] block text-[12px] font-[var(--fw-semibold)] text-muted"}>Nombre del grupo</label>
      <input
        id={id}
        value={g.nombre}
        maxLength={MAX_NAME}
        onChange={(e) => g.setNombre(e.target.value)}
        onFocus={(e) => { if (firstFocus.current) { firstFocus.current = false; e.currentTarget.select(); } }}
        aria-invalid={!g.nameOk}
        aria-describedby={!g.nameOk ? `${id}-err` : undefined}
        className={inHeader
          ? "h-[36px] w-full min-w-0 rounded-[6px] border border-transparent bg-transparent px-[6px] text-[17px] font-[var(--fw-semibold)] text-app outline-none hover:border-app focus:border-[var(--primary)]"
          : "h-[46px] w-full rounded-[8px] border border-[var(--border-strong)] bg-[var(--surface)] px-[12px] text-[16px] font-[var(--fw-semibold)] text-app outline-none focus:border-[var(--primary)] aria-[invalid=true]:border-[var(--error)]"}
      />
      {!g.nameOk && <p id={`${id}-err`} className="mt-[4px] text-[13px] text-[var(--error)]">El grupo necesita un nombre</p>}
    </div>
  );
}

/**
 * Desktop, right panel (boards nc-d-grupo, nc-d-grupo20): the group already as it will be, with
 * its avatars, the editable name and the composer. It is created with the first message or with
 * «Crear el grupo sin escribir».
 */
export function NewGroupPreview({ g, onCreate }: { g: NewGroupState; onCreate: (primerMensaje?: string) => Promise<void> }) {
  const n = g.selected.length;
  return (
    <div className="flex h-full flex-col pt-[var(--space-2)]">
      <header className="flex min-h-[56px] items-center gap-[10px] border-b border-app px-[var(--space-4)]">
        {n > 0 && <AvatarStack people={g.selected} />}
        <div className="min-w-0 flex-1">
          <GroupNameField g={g} id="ng-nombre-d" inHeader />
          <p className="px-[6px] text-[12px] text-muted">{n ? `Grupo nuevo · ${peopleAndYou(n)}` : "Grupo nuevo"}</p>
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-[10px] px-[var(--space-6)] text-center">
        {n > 0 && <AvatarStack people={g.selected} max={4} size={48} />}
        <h2 className="[font-family:var(--font-display-face)] text-[28px] leading-[1.15] text-app">Empieza la conversación</h2>
        <p className="max-w-[360px] text-[14px] text-muted">
          {g.enough
            ? "El grupo se crea cuando envíes el primer mensaje. Puedes seguir añadiendo gente a la izquierda."
            : "Elige al menos 2 personas a la izquierda."}
        </p>
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={!g.valid || g.creating}
          className="inline-flex min-h-[44px] items-center rounded-[8px] border border-app px-[16px] text-[15px] font-[var(--fw-semibold)] text-app hover:bg-[var(--surface)] disabled:opacity-50"
        >
          {g.creating ? "Creando el grupo…" : "Crear el grupo sin escribir"}
        </button>
        {g.error && <p role="alert" className="text-[13px] text-[var(--error)]">{g.error}</p>}
      </div>
      <Composer placeholder="Escribe el primer mensaje al grupo" disabled={!g.valid || g.creating} onSend={(t) => onCreate(t)} />
    </div>
  );
}
