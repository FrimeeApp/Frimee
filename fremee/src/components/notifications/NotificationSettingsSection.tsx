"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell, BellOff, Plane, Receipt, Users, Clock, Megaphone,
  ChevronDown, Lock,
} from "lucide-react";
import {
  type NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeWithDefaults,
} from "@/services/notifications/preferences";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from "@/services/api/repositories/settings.repository";

// ─── Switch ──────────────────────────────────────────────────────────────────

function Switch({
  checked,
  onChange,
  disabled = false,
  size = "md",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const sm = size === "sm";
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={checked ? "Desactivar" : "Activar"}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`relative overflow-hidden rounded-chip shrink-0 transition-colors disabled:opacity-40 ${
        sm ? "h-[22px] w-[38px]" : "h-[var(--space-7)] w-[var(--space-12)]"
      } ${checked ? "bg-primary-token" : "bg-surface-2"}`}
    >
      <span
        className={`absolute top-[3px] rounded-full bg-surface shadow-elev-1 transition-transform duration-[var(--duration-base)] [transition-timing-function:var(--ease-standard)] ${
          sm
            ? `left-[3px] size-4 ${checked ? "translate-x-4" : "translate-x-0"}`
            : `left-[var(--space-1)] h-[var(--space-5)] w-[var(--space-5)] ${checked ? "translate-x-[var(--space-5)]" : "translate-x-0"}`
        }`}
      />
    </button>
  );
}

// ─── Category state indicator ─────────────────────────────────────────────────

function categoryState(
  enabled: boolean,
  children: Record<string, boolean>
): "on" | "off" | "mixed" {
  if (!enabled) return "off";
  const vals = Object.values(children);
  if (vals.every(Boolean)) return "on";
  if (vals.every((v) => !v)) return "mixed";
  return "mixed";
}

// ─── Category row (header + expandable children) ──────────────────────────────

type ChildItem = { key: string; label: string; description?: string };

function CategorySection({
  icon,
  label,
  enabled,
  state,
  locked,
  lockedReason,
  onToggle,
  children: items,
  values,
  onChildToggle,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  enabled: boolean;
  state: "on" | "off" | "mixed";
  locked?: boolean;
  lockedReason?: string;
  onToggle: (next: boolean) => void;
  children: ChildItem[];
  values: Record<string, boolean>;
  onChildToggle: (key: string, next: boolean) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = items.length > 0;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      {/* Category header */}
      <div className="flex min-h-[56px] items-center gap-3 py-3">
        <span className="shrink-0 text-muted">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-[var(--fw-medium)] text-app">{label}</p>
          {locked && lockedReason && (
            <p className="text-[13px] leading-snug text-muted">{lockedReason}</p>
          )}
          {!locked && state === "mixed" && enabled && (
            <p className="text-[13px] leading-snug text-muted">Algunas desactivadas</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {locked ? (
            <Lock className="size-4 text-muted" aria-hidden />
          ) : (
            <Switch checked={enabled} onChange={onToggle} disabled={disabled} />
          )}
          {hasChildren && !locked && (
            <button
              type="button"
              aria-label={open ? "Colapsar" : "Expandir"}
              onClick={() => setOpen((v) => !v)}
              className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface"
            >
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          )}
        </div>
      </div>

      {/* Child items */}
      {hasChildren && open && !locked && (
        <div className="mb-2 ml-8 flex flex-col gap-0 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          {items.map((item, idx) => (
            <div
              key={item.key}
              className={`flex min-h-[48px] items-center justify-between gap-3 px-4 py-2 ${
                idx < items.length - 1 ? "border-b border-[var(--border)]" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-sm text-app">{item.label}</p>
                {item.description && (
                  <p className="text-[12px] leading-snug text-muted">{item.description}</p>
                )}
              </div>
              <Switch
                checked={values[item.key] ?? false}
                onChange={(next) => onChildToggle(item.key, next)}
                disabled={disabled || !enabled}
                size="sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quiet hours row ──────────────────────────────────────────────────────────

function QuietHoursRow({
  enabled,
  start,
  end,
  onToggle,
  onStartChange,
  onEndChange,
  disabled,
}: {
  enabled: boolean;
  start: string;
  end: string;
  onToggle: (next: boolean) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <div className="flex min-h-[56px] items-center gap-3 py-3">
        <span className="shrink-0 text-muted"><Clock className="size-[20px]" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-[var(--fw-medium)] text-app">Silencio nocturno</p>
          {enabled && (
            <p className="text-[13px] leading-snug text-muted">{start} – {end}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch checked={enabled} onChange={onToggle} disabled={disabled} />
          <button
            type="button"
            aria-label={open ? "Colapsar" : "Expandir"}
            onClick={() => setOpen((v) => !v)}
            className="flex size-7 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface"
          >
            <ChevronDown
              className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="mb-2 ml-8 flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <p className="text-[13px] text-muted">
            No recibirás notificaciones en este intervalo (excepto alertas de seguridad).
          </p>
          <div className="flex items-center gap-4">
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[12px] font-[var(--fw-medium)] text-muted uppercase tracking-wide">Desde</label>
              <input
                type="time"
                value={start}
                disabled={disabled || !enabled}
                onChange={(e) => onStartChange(e.target.value)}
                className="rounded-input border border-app bg-[var(--bg)] px-3 py-2 text-body-sm disabled:opacity-40"
              />
            </div>
            <div className="flex flex-1 flex-col gap-1">
              <label className="text-[12px] font-[var(--fw-medium)] text-muted uppercase tracking-wide">Hasta</label>
              <input
                type="time"
                value={end}
                disabled={disabled || !enabled}
                onChange={(e) => onEndChange(e.target.value)}
                className="rounded-input border border-app bg-[var(--bg)] px-3 py-2 text-body-sm disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NotificationSettingsSection({ disabled: parentDisabled }: { disabled?: boolean }) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await getNotificationPreferences();
        if (!cancelled) setPrefs(data);
      } catch (e) {
        console.warn("[notif-prefs] load error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const persistPrefs = useCallback((next: NotificationPreferences) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSaving(true);
      setSaveMsg(null);
      try {
        const saved = await saveNotificationPreferences(next);
        setPrefs(saved);
        setSaveMsg({ type: "ok", text: "Guardado" });
        setTimeout(() => setSaveMsg(null), 2000);
      } catch (e) {
        console.warn("[notif-prefs] save error:", e);
        setSaveMsg({ type: "error", text: "Error al guardar" });
      } finally {
        setSaving(false);
      }
    }, 800);
  }, []);

  const update = useCallback(
    (updater: (prev: NotificationPreferences) => NotificationPreferences) => {
      setPrefs((prev) => {
        const next = updater(prev);
        persistPrefs(next);
        return next;
      });
    },
    [persistPrefs]
  );

  const toggleCategory = (cat: keyof Omit<NotificationPreferences, "quiet_hours">) =>
    (next: boolean) =>
      update((p) => ({ ...p, [cat]: { ...p[cat], enabled: next } }));

  const toggleChild =
    (cat: keyof Omit<NotificationPreferences, "quiet_hours">, key: string) =>
    (next: boolean) =>
      update((p) => ({ ...p, [cat]: { ...p[cat], [key]: next } }));

  const disabled = parentDisabled || loading || saving;

  if (loading) {
    return (
      <div className="flex flex-col gap-3 py-2" role="status" aria-label="Cargando preferencias">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="skeleton-shimmer size-5 rounded-full shrink-0" />
            <div className="skeleton-shimmer h-4 flex-1 max-w-[180px] rounded-full" />
            <div className="skeleton-shimmer h-7 w-12 rounded-chip" />
          </div>
        ))}
      </div>
    );
  }

  const { viajes, gastos, grupo, recordatorios, marketing, quiet_hours } = prefs;

  return (
    <div className="relative">
      {/* Save indicator */}
      {saveMsg && (
        <p className={`mb-2 text-[13px] ${saveMsg.type === "ok" ? "text-success-token" : "text-error-token"}`}>
          {saveMsg.text}
        </p>
      )}

      <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg)] divide-y divide-[var(--border)] px-1">

        {/* ─ Viajes ─ */}
        <CategorySection
          icon={<Plane className="size-[20px]" />}
          label="Viajes"
          enabled={viajes.enabled}
          state={categoryState(viajes.enabled, {
            trip_invitation_received: viajes.trip_invitation_received,
            trip_invitation_accepted: viajes.trip_invitation_accepted,
            trip_activity_added: viajes.trip_activity_added,
            trip_activity_updated: viajes.trip_activity_updated,
            trip_activity_deleted: viajes.trip_activity_deleted,
            trip_cancelled: viajes.trip_cancelled,
            trip_starting_24h: viajes.trip_starting_24h,
            trip_starting_1h: viajes.trip_starting_1h,
            trip_completed: viajes.trip_completed,
          })}
          onToggle={toggleCategory("viajes")}
          values={viajes}
          onChildToggle={(key, next) => toggleChild("viajes", key)(next)}
          disabled={disabled}
        >
          {[
            { key: "trip_invitation_received", label: "Invitaciones a viajes" },
            { key: "trip_invitation_accepted", label: "Alguien acepta tu invitación" },
            { key: "trip_activity_added", label: "Nueva actividad en el itinerario" },
            { key: "trip_activity_updated", label: "Cambio de hora o lugar" },
            { key: "trip_activity_deleted", label: "Actividad eliminada" },
            { key: "trip_cancelled", label: "Viaje cancelado" },
            { key: "trip_starting_24h", label: "Recordatorio 24h antes" },
            { key: "trip_starting_1h", label: "Recordatorio 1h antes" },
            { key: "trip_completed", label: "Resumen al terminar el viaje", description: "Enviado al día siguiente" },
          ]}
        </CategorySection>

        {/* ─ Gastos ─ */}
        <CategorySection
          icon={<Receipt className="size-[20px]" />}
          label="Gastos"
          enabled={gastos.enabled}
          state={categoryState(gastos.enabled, {
            expense_added_you_owe: gastos.expense_added_you_owe,
            expense_added_fyi: gastos.expense_added_fyi,
            expense_payment_received: gastos.expense_payment_received,
            expense_payment_reminder: gastos.expense_payment_reminder,
            expense_split_updated: gastos.expense_split_updated,
            expense_deleted: gastos.expense_deleted,
            balance_trip_closed: gastos.balance_trip_closed,
          })}
          onToggle={toggleCategory("gastos")}
          values={gastos}
          onChildToggle={(key, next) => toggleChild("gastos", key)(next)}
          disabled={disabled}
        >
          {[
            { key: "expense_added_you_owe", label: "Te toca pagar tu parte" },
            { key: "expense_added_fyi", label: "Nuevo gasto (solo info)", description: "Cuando no debes nada" },
            { key: "expense_payment_received", label: "Pagos recibidos" },
            { key: "expense_payment_reminder", label: "Recordatorio de deuda pendiente" },
            { key: "expense_split_updated", label: "Reparto actualizado" },
            { key: "expense_deleted", label: "Gasto eliminado" },
            { key: "balance_trip_closed", label: "Resumen final de gastos" },
          ]}
        </CategorySection>

        {/* ─ Grupo ─ */}
        <CategorySection
          icon={<Users className="size-[20px]" />}
          label="Grupo"
          enabled={grupo.enabled}
          state={categoryState(grupo.enabled, {
            group_member_joined: grupo.group_member_joined,
            group_member_left: grupo.group_member_left,
            group_member_removed: grupo.group_member_removed,
            group_chat_mention: grupo.group_chat_mention,
            group_chat_message: grupo.group_chat_message,
            group_poll_created: grupo.group_poll_created,
            group_poll_closing_soon: grupo.group_poll_closing_soon,
            group_poll_result: grupo.group_poll_result,
          })}
          onToggle={toggleCategory("grupo")}
          values={grupo}
          onChildToggle={(key, next) => toggleChild("grupo", key)(next)}
          disabled={disabled}
        >
          {[
            { key: "group_chat_mention", label: "Te mencionan en el chat" },
            { key: "group_chat_message", label: "Mensajes del grupo", description: "Máx. 3 por hora" },
            { key: "group_poll_created", label: "Nueva encuesta" },
            { key: "group_poll_closing_soon", label: "Encuesta cerrando pronto" },
            { key: "group_poll_result", label: "Resultado de encuesta" },
            { key: "group_member_joined", label: "Alguien se une al viaje" },
            { key: "group_member_left", label: "Alguien abandona el viaje" },
            { key: "group_member_removed", label: "Te sacan de un viaje" },
          ]}
        </CategorySection>

        {/* ─ Recordatorios ─ */}
        <CategorySection
          icon={<Bell className="size-[20px]" />}
          label="Recordatorios"
          enabled={recordatorios.enabled}
          state={categoryState(recordatorios.enabled, {
            reminder_document: recordatorios.reminder_document,
            reminder_packing: recordatorios.reminder_packing,
            reminder_custom: recordatorios.reminder_custom,
          })}
          onToggle={toggleCategory("recordatorios")}
          values={recordatorios}
          onChildToggle={(key, next) => toggleChild("recordatorios", key)(next)}
          disabled={disabled}
        >
          {[
            { key: "reminder_document", label: "Documentos y visados" },
            { key: "reminder_packing", label: "Recordatorio de maleta", description: "3 días antes del viaje" },
            { key: "reminder_custom", label: "Recordatorios del organizador" },
          ]}
        </CategorySection>

        {/* ─ Seguridad (locked) ─ */}
        <CategorySection
          icon={<Lock className="size-[20px]" />}
          label="Seguridad"
          enabled={true}
          state="on"
          locked={true}
          lockedReason="Siempre activas — no se pueden desactivar"
          onToggle={() => {}}
          values={{}}
          onChildToggle={() => {}}
          disabled={true}
        >
          {[]}
        </CategorySection>

        {/* ─ Marketing ─ */}
        <CategorySection
          icon={<Megaphone className="size-[20px]" />}
          label="Novedades y ofertas"
          enabled={marketing.enabled}
          state={categoryState(marketing.enabled, {
            promo_seasonal: marketing.promo_seasonal,
            feature_announcement: marketing.feature_announcement,
            reengagement_no_trip: marketing.reengagement_no_trip,
          })}
          onToggle={toggleCategory("marketing")}
          values={marketing}
          onChildToggle={(key, next) => toggleChild("marketing", key)(next)}
          disabled={disabled}
        >
          {[
            { key: "promo_seasonal", label: "Campañas y promociones" },
            { key: "feature_announcement", label: "Nuevas funciones de la app" },
            { key: "reengagement_no_trip", label: "¿Cuándo es el próximo viaje?" },
          ]}
        </CategorySection>
      </div>

      {/* ─ Quiet hours ─ */}
      <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg)] px-1">
        <QuietHoursRow
          enabled={quiet_hours.enabled}
          start={quiet_hours.start}
          end={quiet_hours.end}
          onToggle={(next) => update((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, enabled: next } }))}
          onStartChange={(v) => update((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, start: v } }))}
          onEndChange={(v) => update((p) => ({ ...p, quiet_hours: { ...p.quiet_hours, end: v } }))}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
