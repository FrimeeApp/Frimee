"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Link2, Plus, User, X } from "lucide-react";
import { createBrowserSupabaseClient } from "@/services/supabase/client";
import { DEFAULT_PLAN_COVER_IMAGE } from "@/config/app";
import { CARD, FILL_BTN, FOCUS, GHOST_BTN, LABEL, SERIF, TEXT_BTN } from "./pieces";

// Invitation links are frimee.es/join/<uuid>; people may paste the whole link or just the code.
const JOIN_CODE_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isNativeApp(): boolean {
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(w.Capacitor?.isNativePlatform?.());
}

/** Paste an invitation link (or code) and go to its join page. */
function JoinForm({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const code = value.match(JOIN_CODE_REGEX)?.[0];
    if (!code) {
      setError("Ese enlace no es una invitación de Frimee. Pega el enlace completo que te han pasado.");
      return;
    }
    router.push(isNativeApp() ? `/join/static?code=${code}` : `/join/${code}`);
  };
  return (
    <form onSubmit={submit} className="mt-3">
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          placeholder="frimee.es/join/…"
          aria-label="Enlace de invitación"
          aria-invalid={Boolean(error)}
          className={`h-[46px] min-w-0 flex-1 rounded-[8px] border border-[var(--border-strong)] bg-[var(--input-bg)] px-3 text-[16px] text-app placeholder:text-muted ${FOCUS}`}
        />
        <button type="submit" className={`${GHOST_BTN} ${FOCUS}`}>
          Unirme
        </button>
      </div>
      {error && <p className="mt-1.5 text-[14px] text-error-token">{error}</p>}
    </form>
  );
}

/** Mobile «+» (only when there are plans) and its sheet: create a plan or join with a link. */
export function CreateJoinFab({ onCreate, startOnJoin = false, open, onOpenChange }: {
  onCreate: () => void;
  startOnJoin?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Crear plan o unirte con un enlace"
        title="Crear plan o unirte con un enlace"
        onClick={() => onOpenChange(true)}
        className={`fixed bottom-[calc(clamp(56px,8dvh,64px)+env(safe-area-inset-bottom)+16px)] right-4 z-[40] flex size-14 items-center justify-center rounded-full bg-[var(--chat-accent-text)] text-contrast-token shadow-elev-2 transition-transform duration-[120ms] active:scale-[.98] md:hidden ${FOCUS}`}
      >
        <Plus size={26} aria-hidden />
      </button>
      {open && <CreateJoinSheet onClose={() => onOpenChange(false)} onCreate={onCreate} startOnJoin={startOnJoin} />}
    </>
  );
}

export function CreateJoinSheet({ onClose, onCreate, startOnJoin }: { onClose: () => void; onCreate: () => void; startOnJoin?: boolean }) {
  const [joining, setJoining] = useState(Boolean(startOnJoin));
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center md:items-center" role="presentation">
      <div aria-hidden className="call-fade absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo plan"
        className="call-enter relative w-full rounded-t-[16px] bg-surface px-4 pb-[calc(16px+env(safe-area-inset-bottom))] pt-2 shadow-elev-2 outline-none md:max-w-[440px] md:rounded-[16px] md:pb-4"
      >
        <div aria-hidden className="mx-auto mb-2 h-1 w-9 rounded-full bg-[var(--border-strong)] md:hidden" />
        <div className="flex items-center">
          <h2 className={`${SERIF} flex-1 text-[24px] leading-7 text-app`}>Nuevo plan</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className={`flex size-11 items-center justify-center rounded-[8px] text-muted ${FOCUS}`}>
            <X size={20} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            onCreate();
          }}
          className={`mt-1 flex min-h-16 w-full items-center gap-3 rounded-[8px] text-left hover:bg-surface-2 ${FOCUS}`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--chat-accent-text)] text-contrast-token">
            <Plus size={20} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-[var(--fw-semibold)] text-app">Crear plan</span>
            <span className="block text-[14px] text-muted">Pon destino y fechas, aunque sean aproximadas</span>
          </span>
        </button>
        <div className="border-t border-app">
          <button
            type="button"
            aria-expanded={joining}
            onClick={() => setJoining(true)}
            className={`flex min-h-16 w-full items-center gap-3 rounded-[8px] text-left hover:bg-surface-2 ${FOCUS}`}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-app">
              <Link2 size={20} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16px] font-[var(--fw-semibold)] text-app">Unirme con un enlace</span>
              <span className="block text-[14px] text-muted">Pega la invitación que te han pasado</span>
            </span>
          </button>
          {joining && <JoinForm autoFocus />}
        </div>
      </div>
    </div>
  );
}

/** «¿Y después de la sierra?»: with a single plan the actions live on the screen instead of the «+». */
export function AfterCard({ planTitle, onCreate, onJoin }: { planTitle: string; onCreate: () => void; onJoin: () => void }) {
  const tail = planTitle.replace(/^(finde|escapada|viaje|semana santa|puente)\s+(en|a)\s+/i, "");
  return (
    <div className="mx-4 mt-4 rounded-[8px] border border-dashed border-[var(--border-strong)] p-4 md:mx-0">
      <p className="text-[16px] font-[var(--fw-semibold)] text-app">¿Y después de {tail.length <= 28 ? tail : "este plan"}?</p>
      <p className="mt-1 text-[14px] leading-normal text-muted">Crea otro plan o únete al de un amigo con su enlace.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onCreate} className={`${FILL_BTN} flex-1 ${FOCUS}`}>
          <Plus size={18} aria-hidden />
          Crear plan
        </button>
        <button type="button" onClick={onJoin} className={`${GHOST_BTN} flex-1 ${FOCUS}`}>
          <Link2 size={18} aria-hidden />
          Unirme
        </button>
      </div>
    </div>
  );
}

const GUEST_HIDE_KEY = "frimee:mis-planes:guest-notice-hidden-until";

/** Guest notice under the title: hideable for 7 days (the profile keeps a dot until the account is saved). */
export function GuestNotice() {
  const [hidden, setHidden] = useState(() => {
    try {
      return Number(localStorage.getItem(GUEST_HIDE_KEY) ?? 0) > Date.now();
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  return (
    <div className="mx-4 flex min-h-[52px] items-center gap-2.5 rounded-[8px] border border-app bg-surface pl-3 pr-1 md:mx-0 md:rounded-full">
      <User size={18} className="shrink-0 text-muted" aria-hidden />
      <span className="flex-1 text-[14px] leading-tight text-app">Estás en modo invitado</span>
      <button type="button" onClick={() => window.dispatchEvent(new Event("frimee:save-account"))} className={`${TEXT_BTN} px-2 ${FOCUS}`}>
        Guardar mi cuenta
      </button>
      <button
        type="button"
        aria-label="Ocultar aviso"
        title="Ocultar aviso"
        onClick={() => {
          try {
            localStorage.setItem(GUEST_HIDE_KEY, String(Date.now() + 7 * 86_400_000));
          } catch {
            /* private mode: hide for this visit only */
          }
          setHidden(true);
        }}
        className={`flex size-11 items-center justify-center rounded-[8px] text-muted ${FOCUS}`}
      >
        <X size={18} aria-hidden />
      </button>
    </div>
  );
}

/** Empty state: headline, create / join, and the Lisbon example plan. */
export function EmptyHome({ onCreate, onJoin, onOpenPlan, desktop }: { onCreate: () => void; onJoin: () => void; onOpenPlan: (id: number) => void; desktop?: boolean }) {
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  const openExample = async () => {
    setExampleError(null);
    setExampleLoading(true);
    try {
      const { data, error } = await createBrowserSupabaseClient().rpc("fn_guest_seed_demo");
      if (error) throw error;
      onOpenPlan(data as number);
    } catch (error) {
      console.error("[mis-planes] example plan error", error instanceof Error ? error.message : error);
      setExampleError("No se ha podido abrir el ejemplo. Vuelve a intentarlo.");
      setExampleLoading(false);
    }
  };

  const example = (
    <article className={`${CARD} rounded-[12px]`}>
      <div className="relative">
        <div className="relative h-[112px] overflow-hidden bg-surface-inset md:h-[160px]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element -- static placeholder cover */}
          <img src={DEFAULT_PLAN_COVER_IMAGE.desktop} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
        </div>
        <span className="absolute left-2 top-2 inline-flex h-[26px] items-center rounded-full border border-app bg-surface px-3 text-[12px] font-[var(--fw-semibold)] text-app">
          Ejemplo
        </span>
      </div>
      <div className="px-4 pb-1 pt-3">
        <h4 className={`${SERIF} text-[26px] leading-[30px] text-app`}>Escapada a Lisboa</h4>
        <p className="mt-0.5 text-[13px] text-muted">Barcelona → Lisboa · 4 personas · actividades, gastos y chat</p>
        <button type="button" onClick={() => void openExample()} disabled={exampleLoading} className={`${TEXT_BTN} mt-0.5 disabled:opacity-60 ${FOCUS}`}>
          {exampleLoading ? "Abriendo el ejemplo…" : "Ver el ejemplo"}
          <ArrowRight size={16} aria-hidden />
        </button>
        {exampleError && <p className="pb-2 text-[14px] text-error-token">{exampleError}</p>}
      </div>
    </article>
  );

  const steps = [
    ["Crea el plan", "Destino y fechas, aunque sean aproximadas."],
    ["Invita con un enlace", "Quien lo abre entra en el plan y en su chat."],
    ["Decidid juntos", "Encuestas, gastos y el día a día del viaje."],
  ] as const;

  return (
    <div className={desktop ? "grid grid-cols-[minmax(0,1fr)_400px] items-start gap-12 pt-8" : "px-4 pt-5"}>
      <div>
        <h2 className={`${SERIF} text-app [text-wrap:balance] ${desktop ? "max-w-[18ch] text-[48px] leading-[52px]" : "text-[36px] leading-[38px]"}`}>
          Organiza el próximo viaje con tus amigos
        </h2>
        <p className="mt-2 max-w-[52ch] text-[15px] leading-normal text-muted">Fechas, sitios, gastos y el chat del grupo, todo en el mismo plan.</p>
        <div className={`mt-4 flex gap-2 ${desktop ? "" : "flex-col"}`}>
          <button type="button" onClick={onCreate} className={`${FILL_BTN} ${desktop ? "" : "w-full"} ${FOCUS}`}>
            <Plus size={18} aria-hidden />
            Crea tu primer plan
          </button>
          <button type="button" onClick={onJoin} className={`${GHOST_BTN} ${desktop ? "" : "w-full"} ${FOCUS}`}>
            <Link2 size={18} aria-hidden />
            Unirme con un enlace
          </button>
        </div>
        {desktop && (
          <ol className="mt-10 grid max-w-[640px] grid-cols-3 gap-6">
            {steps.map(([title, text], i) => (
              <li key={title}>
                <span className={`${SERIF} text-[32px] leading-none text-[var(--chat-accent-text)]`}>{i + 1}</span>
                <p className="mt-2 text-[16px] font-[var(--fw-semibold)] text-app">{title}</p>
                <p className="mt-1 text-[14px] leading-normal text-muted">{text}</p>
              </li>
            ))}
          </ol>
        )}
        {!desktop && <h3 className={`${LABEL} mt-6`}>Así se ve un plan</h3>}
        {!desktop && <div className="mt-2">{example}</div>}
      </div>
      {desktop && example}
    </div>
  );
}
