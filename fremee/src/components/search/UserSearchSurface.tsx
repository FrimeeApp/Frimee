"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { Clock, Link2, MessageCircle, Route, Search, UserCheck, UserPlus, Users, WifiOff, X } from "lucide-react";
import { getPublicUserProfile } from "@/services/api/repositories/users.repository";
import { searchPeopleWithContext, sendFriendRequest } from "@/services/api/endpoints/users.endpoint";
import { getOrCreateDirectoChat } from "@/services/api/repositories/chat.repository";
import { addRecent, clearRecents, readRecents, removeRecent, type RecentUser } from "@/lib/recentSearches";
import {
  agruparResultados,
  cabeceraSeccion,
  contexto,
  iniciales,
  partirCoincidencia,
  seccionViajan,
  tinte,
  type PersonaBusqueda,
  type Relacion,
  type Seccion,
  type TipoContexto,
} from "@/lib/people-search";
import { CopyInviteLink } from "@/components/chat/nuevo/people";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/components/ui/Toaster";

type UserSearchSurfaceProps = {
  excludeUserId?: string;
  limit?: number;
  autoFocus?: boolean;
  inputRef?: RefObject<HTMLInputElement | null>;
  inputClassName?: string;
  resultsClassName?: string;
  emptyAction?: ReactNode;
  onResultClick?: () => void;
  /** Título grande sobre el campo (el panel de escritorio). */
  title?: string;
  /** Pista de teclado al pie (solo escritorio). */
  showShortcuts?: boolean;
};

type Consulta = { q: string; ok: boolean; data: PersonaBusqueda[] };

export default function UserSearchSurface({
  excludeUserId,
  limit = 20,
  autoFocus = false,
  inputRef,
  inputClassName = "",
  resultsClassName = "mt-[var(--space-4)]",
  emptyAction,
  onResultClick,
  title,
  showShortcuts = false,
}: UserSearchSurfaceProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const isGuest = Boolean(user?.is_anonymous);

  const [query, setQuery] = useState("");
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [viajan, setViajan] = useState<PersonaBusqueda[]>([]);
  const [recents, setRecents] = useState<RecentUser[]>([]);
  const [relOverride, setRelOverride] = useState<Record<string, Relacion>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activoId, setActivoId] = useState<string | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = inputRef ?? fallbackInputRef;

  const texto = query.trim();
  const activa = texto.length >= 2;
  const cargando = activa && consulta?.q !== texto;
  const conError = activa && consulta?.q === texto && !consulta.ok;
  const resultados = activa && consulta?.q === texto && consulta.ok ? consulta.data : [];

  useEffect(() => {
    if (!autoFocus) return;
    const frame = window.requestAnimationFrame(() => resolvedInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus, resolvedInputRef]);

  // Recientes: solo en este dispositivo. Al mostrarlos se descartan los perfiles que ya no existen.
  useEffect(() => {
    if (!excludeUserId) return;
    const stored = readRecents(excludeUserId);
    setRecents(stored);
    if (stored.length === 0) return;

    let cancelled = false;
    void Promise.all(
      stored.map(async (item) => {
        try {
          return (await getPublicUserProfile(item.id)) ? null : item.id;
        } catch {
          return null; // error de red: se conserva
        }
      }),
    ).then((gone) => {
      if (cancelled) return;
      const missing = gone.filter((id): id is string => id !== null);
      if (missing.length === 0) return;
      let next = stored;
      for (const id of missing) next = removeRecent(excludeUserId, id);
      setRecents(next);
    });
    return () => {
      cancelled = true;
    };
  }, [excludeUserId]);

  // «Viajan contigo»: quien comparte un plan tuyo y aún no es amigo. Si falla, simplemente no sale.
  useEffect(() => {
    let cancelled = false;
    searchPeopleWithContext({ limit: 5 })
      .then((data) => {
        if (!cancelled) setViajan(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activa) return;
    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      try {
        const data = await searchPeopleWithContext({ query: texto, limit });
        if (!cancelled) setConsulta({ q: texto, ok: true, data });
      } catch {
        if (!cancelled) setConsulta({ q: texto, ok: false, data: [] });
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [activa, texto, limit, retryKey]);

  const relacionDe = (p: PersonaBusqueda): Relacion => relOverride[p.id] ?? p.relacion;
  const conRelacion = (p: PersonaBusqueda): PersonaBusqueda => ({ ...p, relacion: relacionDe(p) });

  const secciones: Seccion[] = activa
    ? agruparResultados(resultados.map(conRelacion))
    : [seccionViajan(viajan.map(conRelacion))].filter((s): s is Seccion => s !== null);

  // Filas navegables con el teclado, en el orden en que se ven.
  const navegables: string[] = [
    ...(activa ? [] : recents.map((r) => r.id)),
    ...secciones.flatMap((s) => s.personas.map((p) => p.id)),
  ];
  const activo = activoId && navegables.includes(activoId) ? activoId : null;

  function abrirPerfil(persona: RecentUser) {
    if (excludeUserId) setRecents(addRecent(excludeUserId, persona));
    setQuery("");
    onResultClick?.();
  }

  async function anadir(p: PersonaBusqueda) {
    if (isGuest) {
      toast("Regístrate para hacerlo", "info");
      return;
    }
    setBusyId(p.id);
    setRelOverride((prev) => ({ ...prev, [p.id]: "pendiente" }));
    try {
      await sendFriendRequest(p.id);
    } catch (e) {
      setRelOverride((prev) => ({ ...prev, [p.id]: "ninguna" }));
      const msg = (e as { message?: string } | null)?.message ?? "";
      toast(msg.startsWith("Regístrate") ? "Regístrate para hacerlo" : "No se pudo enviar la solicitud", msg.startsWith("Regístrate") ? "info" : "error");
    } finally {
      setBusyId(null);
    }
  }

  async function escribir(p: PersonaBusqueda) {
    if (isGuest) {
      toast("Regístrate para hacerlo", "info");
      return;
    }
    setBusyId(p.id);
    try {
      const chatId = await getOrCreateDirectoChat(p.id);
      abrirPerfil(p);
      router.push(`/messages?chat=${encodeURIComponent(chatId)}`);
    } catch (e) {
      const msg = (e as { message?: string } | null)?.message ?? "";
      toast(msg.startsWith("Regístrate") ? "Regístrate para hacerlo" : "No se pudo abrir el chat", msg.startsWith("Regístrate") ? "info" : "error");
    } finally {
      setBusyId(null);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape" && query) {
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      return;
    }
    if (navegables.length === 0) return;
    const i = activo ? navegables.indexOf(activo) : -1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActivoId(navegables[Math.min(i + 1, navegables.length - 1)]);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivoId(navegables[Math.max(i - 1, 0)]);
    } else if (e.key === "Enter" && activo) {
      e.preventDefault();
      const persona = [...recents, ...secciones.flatMap((s) => s.personas)].find((p) => p.id === activo);
      if (persona) {
        abrirPerfil(persona);
        router.push(`/profile/${persona.id}`);
      }
    }
  }

  let estado = "Busca por nombre o por @usuario";
  if (texto.length === 1) estado = "Escribe al menos 2 letras";
  else if (cargando) estado = "Buscando personas…";
  else if (conError) estado = "No se pudo buscar";
  else if (activa) estado = resultados.length === 0 ? "Sin resultados" : `${resultados.length} ${resultados.length === 1 ? "persona" : "personas"} para «${texto}»`;

  const sinResultados = activa && !cargando && !conError && resultados.length === 0;
  const mostrarRecientes = !activa && recents.length > 0;

  return (
    <>
      {title && <h1 className="mb-4 text-[var(--font-h2)] font-[var(--fw-regular)] leading-[1.15] text-app">{title}</h1>}

      <div
        className={`flex h-[46px] items-center rounded-lg border border-[var(--border-strong,var(--border))] bg-[var(--surface-2)] pl-3 focus-within:border-[var(--primary)] focus-within:shadow-[0_0_0_1px_var(--primary)] ${inputClassName}`}
      >
        <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
        <label htmlFor="buscador-personas" className="sr-only">Buscar personas</label>
        <input
          id="buscador-personas"
          ref={resolvedInputRef}
          type="text"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nombre o @usuario"
          className="h-[44px] min-w-0 flex-1 border-0 bg-transparent px-2 text-[16px] text-app shadow-none outline-none ring-0 placeholder:text-muted focus:border-0 focus:shadow-none focus:outline-none focus:ring-0"
        />
        {query ? (
          <button
            type="button"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setQuery("");
              resolvedInputRef.current?.focus();
            }}
            className="flex size-11 shrink-0 items-center justify-center text-muted"
          >
            <X className="size-5" aria-hidden />
          </button>
        ) : emptyAction}
      </div>

      <p role="status" className="px-1 pt-1 text-[14px] leading-[1.5] text-muted">{estado}</p>

      <div aria-busy={cargando} className={`${resultsClassName} pb-4`}>
        {conError ? (
          <Aviso
            alerta
            icono={<WifiOff className="size-7" aria-hidden />}
            titulo="No se pudo buscar"
            texto="Comprueba la conexión y vuelve a intentarlo. Tu búsqueda sigue aquí."
          >
            <button
              type="button"
              onClick={() => {
                setConsulta(null);
                setRetryKey((k) => k + 1);
              }}
              className="mt-4 inline-flex h-[46px] items-center gap-2 rounded-lg border border-app bg-[var(--surface-2)] px-5 text-[16px] font-[600] text-app"
            >
              Reintentar
            </button>
          </Aviso>
        ) : cargando ? (
          <Esqueleto />
        ) : sinResultados ? (
          <Aviso
            icono={<Search className="size-7" aria-hidden />}
            titulo={`Nadie coincide con «${texto}»`}
            texto="Revisa cómo se escribe o búscale por su @usuario. Si aún no está en Frimee, invítale."
          >
            <div className="mt-2"><CopyInviteLink /></div>
          </Aviso>
        ) : (
          <>
            {mostrarRecientes && (
              <section aria-label="Recientes">
                <div className="flex items-center justify-between px-5 pb-1 pt-5">
                  <h2 className="text-[12px] font-[600] uppercase leading-[1.4] tracking-[0.02em] text-muted">Recientes</h2>
                  <button
                    type="button"
                    onClick={() => {
                      if (excludeUserId) clearRecents(excludeUserId);
                      setRecents([]);
                    }}
                    className="text-[12px] text-muted transition-colors hover:text-app"
                  >
                    Borrar todo
                  </button>
                </div>
                <ul className="m-0 list-none p-0">
                  {recents.map((item) => (
                    <li key={item.id} className={claseFila(activo === item.id)}>
                      <FilaEnlace id={item.id} activa={activo === item.id} onClick={() => abrirPerfil(item)}>
                        <Avatar id={item.id} nombre={item.nombre} src={item.profile_image} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[16px] font-[500] leading-[1.3] text-app">{item.nombre}</span>
                          {item.username && <span className="truncate text-[14px] leading-[1.35] text-muted">@{item.username}</span>}
                        </span>
                      </FilaEnlace>
                      <button
                        type="button"
                        aria-label={`Quitar a ${item.nombre} de recientes`}
                        onClick={() => excludeUserId && setRecents(removeRecent(excludeUserId, item.id))}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-app"
                      >
                        <X className="size-[18px]" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {secciones.map((s) => (
              <section key={s.clave} aria-label={s.titulo}>
                <h2 className="px-5 pb-1.5 pt-5 text-[12px] font-[600] uppercase leading-[1.4] tracking-[0.02em] text-muted">{cabeceraSeccion(s)}</h2>
                <ul className="m-0 list-none p-0">
                  {s.personas.map((p) => (
                    <li key={p.id} className={claseFila(activo === p.id)}>
                      <FilaEnlace id={p.id} activa={activo === p.id} onClick={() => abrirPerfil(p)}>
                        <Avatar id={p.id} nombre={p.nombre} src={p.profile_image} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <Resaltado texto={p.nombre} consulta={activa ? texto : ""} className="text-[16px] font-[500] leading-[1.3] text-app" />
                          {p.username && <Resaltado texto={`@${p.username}`} consulta={activa ? texto : ""} className="text-[14px] leading-[1.35] text-muted" />}
                          <Contexto persona={p} />
                        </span>
                      </FilaEnlace>
                      <Accion persona={p} ocupado={busyId === p.id} onAnadir={() => void anadir(p)} onEscribir={() => void escribir(p)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {!activa && (
              <div className="mx-4 mt-6 flex items-start gap-3 rounded-lg border border-app bg-[var(--surface)] p-4">
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-app">
                  <Link2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-[600] leading-[1.35] text-app">¿Aún no está en Frimee?</p>
                  <p className="mt-0.5 text-[14px] leading-[1.5] text-muted">Mándale tu enlace y os conectáis en cuanto entre.</p>
                  <div className="mt-1"><CopyInviteLink /></div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showShortcuts && (
        <p className="flex flex-wrap items-center gap-1.5 border-t border-app px-6 py-3 text-[12px] leading-[1.4] text-muted">
          <Tecla>↑</Tecla><Tecla>↓</Tecla> para moverte · <Tecla>Intro</Tecla> para abrir · <Tecla>Esc</Tecla> para borrar
        </p>
      )}
    </>
  );
}

function Tecla({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-app px-1.5 py-[3px] text-[12px] font-[600] leading-none text-app">{children}</kbd>;
}

const TINTES = [
  { l: ["#dce9f7", "#1e4f80"], d: ["#1e3550", "#a9cdf2"] },
  { l: ["#dff2ee", "#1c6a5d"], d: ["#15302b", "#8fe3d3"] },
  { l: ["#f7ecd2", "#7a5410"], d: ["#3a2e15", "#f0cf86"] },
  { l: ["#ebe5f8", "#4f3a8c"], d: ["#2e2547", "#cbbcf2"] },
  { l: ["#f7e1ea", "#8a2f5a"], d: ["#3d2230", "#f2b8d0"] },
  { l: ["#e8efd9", "#4b5f22"], d: ["#2b3320", "#c4d89c"] },
] as const;

function Avatar({ id, nombre, src }: { id: string; nombre: string; src: string | null }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-11 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
    );
  }
  const t = TINTES[tinte(id)];
  return (
    <span
      aria-hidden
      style={{ "--tl-bg": t.l[0], "--tl-fg": t.l[1], "--td-bg": t.d[0], "--td-fg": t.d[1] } as CSSProperties}
      className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--tl-bg)] text-[15px] font-[600] tracking-[0.02em] text-[var(--tl-fg)] dark:bg-[var(--td-bg)] dark:text-[var(--td-fg)]"
    >
      {iniciales(nombre)}
    </span>
  );
}

/** La fila entera (enlace y botón) es lo que se sombrea, con el mismo margen lateral que el resto. */
function claseFila(activa: boolean): string {
  return `mx-3 flex items-center gap-1 rounded-lg pr-2 transition-colors duration-100 ${
    activa
      ? "bg-[color-mix(in_srgb,var(--primary)_14%,transparent)] ring-1 ring-inset ring-[color-mix(in_srgb,var(--primary)_35%,transparent)]"
      : "hover:bg-[var(--surface)] active:bg-[var(--surface-2)]"
  }`;
}

function FilaEnlace({ id, activa, onClick, children }: { id: string; activa: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Link
      href={`/profile/${id}`}
      onClick={onClick}
      aria-current={activa ? "true" : undefined}
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2.5 pl-2 pr-2"
    >
      {children}
    </Link>
  );
}

function Resaltado({ texto, consulta, className }: { texto: string; consulta: string; className: string }) {
  const { pre, hit, post } = partirCoincidencia(texto, consulta);
  return (
    <span className={`truncate ${className}`}>
      {pre}
      {hit && <b className="font-[700] text-app underline decoration-[var(--primary)] decoration-2 underline-offset-[3px]">{hit}</b>}
      {post}
    </span>
  );
}

const ICONOS_CONTEXTO: Record<TipoContexto, ReactNode> = {
  amigos: <UserCheck className="size-3.5 shrink-0" aria-hidden />,
  comun: <Users className="size-3.5 shrink-0" aria-hidden />,
  plan: <Route className="size-3.5 shrink-0" aria-hidden />,
  pendiente: <Clock className="size-3.5 shrink-0" aria-hidden />,
  desde: null,
};

function Contexto({ persona }: { persona: PersonaBusqueda }) {
  const c = contexto(persona);
  return (
    <span className={`flex min-w-0 items-center gap-1 text-[14px] leading-[1.35] ${c.tipo === "amigos" ? "text-primary-token" : "text-muted"}`}>
      {ICONOS_CONTEXTO[c.tipo]}
      <span className="truncate">{c.texto}</span>
    </span>
  );
}

/** El botón de cada fila según la relación. Solicitud pendiente: solo informa, como en el perfil. */
function Accion({ persona, ocupado, onAnadir, onEscribir }: { persona: PersonaBusqueda; ocupado: boolean; onAnadir: () => void; onEscribir: () => void }) {
  if (persona.relacion === "amigos") {
    return (
      <button
        type="button"
        aria-label={`Escribir a ${persona.nombre}`}
        disabled={ocupado}
        onClick={onEscribir}
        className="flex size-11 shrink-0 items-center justify-center rounded-full border border-app text-app transition-opacity disabled:opacity-50"
      >
        <MessageCircle className="size-5" aria-hidden />
      </button>
    );
  }
  if (persona.relacion === "pendiente") {
    return (
      <span className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-app px-3 text-[14px] font-[600] text-muted">
        <Clock className="size-[18px]" aria-hidden />
        Pendiente
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={`Añadir a ${persona.nombre}`}
      disabled={ocupado}
      onClick={onAnadir}
      className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-app bg-[var(--surface-2)] pl-3 pr-3.5 text-[14px] font-[600] text-app transition-opacity disabled:opacity-50"
    >
      <UserPlus className="size-[18px]" aria-hidden />
      Añadir
    </button>
  );
}

function Aviso({ icono, titulo, texto, alerta, children }: { icono: ReactNode; titulo: string; texto: string; alerta?: boolean; children?: ReactNode }) {
  return (
    <div role={alerta ? "alert" : undefined} className="flex flex-col items-center gap-2 px-8 pt-16 text-center">
      <span aria-hidden className="flex size-16 items-center justify-center rounded-full bg-[var(--surface-2)] text-muted">{icono}</span>
      <h2 className="mt-3 text-[18px] font-[600] leading-[1.3] text-app">{titulo}</h2>
      <p className="max-w-[290px] text-[14px] leading-[1.5] text-muted">{texto}</p>
      {children}
    </div>
  );
}

const ESQUELETO = [[132, 96, 170], [118, 84, 150], [140, 104, 120], [110, 90, 160], [126, 80, 140]] as const;

function Esqueleto() {
  return (
    <ul aria-hidden className="m-0 list-none p-0 pt-4">
      {ESQUELETO.map(([a, b, c], i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-2.5">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-[var(--surface-2)]" />
          <span className="flex flex-1 flex-col gap-2">
            <span style={{ width: a }} className="h-3 animate-pulse rounded-md bg-[var(--surface-2)]" />
            <span style={{ width: b }} className="h-2.5 animate-pulse rounded-md bg-[var(--surface-2)]" />
            <span style={{ width: c }} className="h-2.5 animate-pulse rounded-md bg-[var(--surface-2)]" />
          </span>
        </li>
      ))}
    </ul>
  );
}
