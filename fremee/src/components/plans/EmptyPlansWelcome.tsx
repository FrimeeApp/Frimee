"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

// Invitation links are frimee.es/join/<uuid>; people may paste the whole link or just the code.
const JOIN_CODE_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function isNativeApp(): boolean {
  const w = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(w.Capacitor?.isNativePlatform?.());
}

type Props = {
  onCreatePlan: () => void;
  onOpenPlan: (planId: number) => void;
};

/** First screen of "Mis planes" for someone with no plans: what to do next instead of an empty list. */
export default function EmptyPlansWelcome({ onCreatePlan, onOpenPlan }: Props) {
  const router = useRouter();
  const [joinValue, setJoinValue] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [exampleLoading, setExampleLoading] = useState(false);
  const [exampleError, setExampleError] = useState<string | null>(null);

  const handleJoin = (e: FormEvent) => {
    e.preventDefault();
    const code = joinValue.match(JOIN_CODE_REGEX)?.[0];
    if (!code) {
      setJoinError("Pega el enlace de invitación que te han enviado.");
      return;
    }
    setJoinError(null);
    router.push(isNativeApp() ? `/join/static?code=${code}` : `/join/${code}`);
  };

  const handleExample = async () => {
    setExampleError(null);
    setExampleLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("fn_guest_seed_demo");
      if (error) throw error;
      onOpenPlan(data as number);
    } catch (error) {
      console.error("[calendar] example plan error", error);
      setExampleError("No se ha podido crear el plan de ejemplo. Inténtalo de nuevo.");
      setExampleLoading(false);
    }
  };

  return (
    <div className="pt-[var(--space-2)]">
      <h2 className="font-sans text-[20px] font-[var(--fw-semibold)] leading-tight text-app">
        Tu primer viaje empieza aquí
      </h2>
      <p className="mt-[var(--space-1)] max-w-[52ch] text-body-sm text-muted">
        En Frimee organizáis el viaje en grupo: itinerario con mapa, gastos repartidos y un chat con un asistente.
      </p>

      <div className="mt-[var(--space-4)] grid gap-[var(--space-3)]">
        <Option
          icon={<PlusIcon />}
          title="Crea tu primer plan"
          text="Pon destino y fechas, e invita a quien venga."
        >
          <button
            type="button"
            onClick={onCreatePlan}
            className="h-10 rounded-full bg-primary-token px-[var(--space-4)] text-[14px] font-[700] text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            Crear plan
          </button>
        </Option>

        <Option
          icon={<LinkIcon />}
          title="Únete a un plan"
          text="¿Te han invitado? Pega aquí el enlace que te han mandado."
        >
          <form onSubmit={handleJoin} className="flex w-full flex-wrap gap-[var(--space-2)]">
            <input
              value={joinValue}
              onChange={(e) => { setJoinValue(e.target.value); setJoinError(null); }}
              placeholder="frimee.es/join/…"
              aria-label="Enlace de invitación"
              className="h-10 min-w-0 flex-1 basis-[200px] rounded-full border border-app bg-[var(--input-bg)] px-[var(--space-3)] text-[14px] text-app placeholder:text-tertiary"
            />
            <button
              type="submit"
              className="h-10 rounded-full border border-app px-[var(--space-4)] text-[14px] font-[600] text-app transition-colors hover:bg-surface-2"
            >
              Unirme
            </button>
          </form>
          {joinError && <p className="mt-[var(--space-1)] text-body-sm text-error-token">{joinError}</p>}
        </Option>

        <Option
          icon={<MapIcon />}
          title="Mira un plan de ejemplo"
          text="Un viaje a Lisboa ya montado, con actividades, gastos y chat, para ver cómo funciona."
        >
          <button
            type="button"
            onClick={() => void handleExample()}
            disabled={exampleLoading}
            className="h-10 rounded-full border border-app px-[var(--space-4)] text-[14px] font-[600] text-app transition-colors hover:bg-surface-2 disabled:opacity-[var(--disabled-opacity)]"
          >
            {exampleLoading ? "Preparando…" : "Ver el ejemplo"}
          </button>
          {exampleError && <p className="mt-[var(--space-1)] text-body-sm text-error-token">{exampleError}</p>}
        </Option>
      </div>
    </div>
  );
}

function Option({ icon, title, text, children }: { icon: ReactNode; title: string; text: string; children: ReactNode }) {
  return (
    <section className="flex gap-[var(--space-3)] rounded-[16px] border border-app bg-surface p-[var(--space-4)]">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-app" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-[var(--fw-semibold)] text-app">{title}</h3>
        <p className="mt-0.5 text-body-sm text-muted">{text}</p>
        <div className="mt-[var(--space-3)]">{children}</div>
      </div>
    </section>
  );
}

const iconProps = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function PlusIcon() {
  return <svg {...iconProps}><path d="M12 5v14M5 12h14" /></svg>;
}

function LinkIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg {...iconProps}>
      <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </svg>
  );
}
