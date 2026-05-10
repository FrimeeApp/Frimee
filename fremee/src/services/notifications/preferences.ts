export type NotificationPreferences = {
  viajes: {
    enabled: boolean;
    trip_invitation_received: boolean;
    trip_invitation_accepted: boolean;
    trip_activity_added: boolean;
    trip_activity_updated: boolean;
    trip_activity_deleted: boolean;
    trip_cancelled: boolean;
    trip_starting_24h: boolean;
    trip_starting_1h: boolean;
    trip_completed: boolean;
  };
  gastos: {
    enabled: boolean;
    expense_added_you_owe: boolean;
    expense_added_fyi: boolean;
    expense_payment_received: boolean;
    expense_payment_reminder: boolean;
    expense_split_updated: boolean;
    expense_deleted: boolean;
    balance_trip_closed: boolean;
  };
  grupo: {
    enabled: boolean;
    group_member_joined: boolean;
    group_member_left: boolean;
    group_member_removed: boolean;
    group_chat_mention: boolean;
    group_chat_message: boolean;
    group_poll_created: boolean;
    group_poll_closing_soon: boolean;
    group_poll_result: boolean;
  };
  recordatorios: {
    enabled: boolean;
    reminder_document: boolean;
    reminder_packing: boolean;
    reminder_custom: boolean;
  };
  marketing: {
    enabled: boolean;
    promo_seasonal: boolean;
    feature_announcement: boolean;
    reengagement_no_trip: boolean;
  };
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  viajes: {
    enabled: true,
    trip_invitation_received: true,
    trip_invitation_accepted: true,
    trip_activity_added: true,
    trip_activity_updated: true,
    trip_activity_deleted: true,
    trip_cancelled: true,
    trip_starting_24h: true,
    trip_starting_1h: true,
    trip_completed: false,
  },
  gastos: {
    enabled: true,
    expense_added_you_owe: true,
    expense_added_fyi: false,
    expense_payment_received: true,
    expense_payment_reminder: true,
    expense_split_updated: true,
    expense_deleted: false,
    balance_trip_closed: true,
  },
  grupo: {
    enabled: true,
    group_member_joined: false,
    group_member_left: false,
    group_member_removed: true,
    group_chat_mention: true,
    group_chat_message: false,
    group_poll_created: true,
    group_poll_closing_soon: true,
    group_poll_result: false,
  },
  recordatorios: {
    enabled: true,
    reminder_document: true,
    reminder_packing: true,
    reminder_custom: true,
  },
  marketing: {
    enabled: false,
    promo_seasonal: false,
    feature_announcement: false,
    reengagement_no_trip: false,
  },
  quiet_hours: {
    enabled: false,
    start: "23:00",
    end: "08:00",
  },
};

export function mergeWithDefaults(partial: Partial<NotificationPreferences>): NotificationPreferences {
  const defaults = DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    viajes: { ...defaults.viajes, ...(partial.viajes ?? {}) },
    gastos: { ...defaults.gastos, ...(partial.gastos ?? {}) },
    grupo: { ...defaults.grupo, ...(partial.grupo ?? {}) },
    recordatorios: { ...defaults.recordatorios, ...(partial.recordatorios ?? {}) },
    marketing: { ...defaults.marketing, ...(partial.marketing ?? {}) },
    quiet_hours: { ...defaults.quiet_hours, ...(partial.quiet_hours ?? {}) },
  };
}

export function isCategoryFullyEnabled(
  category: Omit<NotificationPreferences[keyof Omit<NotificationPreferences, "quiet_hours">], "enabled">,
  enabled: boolean
): "on" | "off" | "mixed" {
  if (!enabled) return "off";
  const values = Object.values(category) as boolean[];
  const allOn = values.every(Boolean);
  const allOff = values.every((v) => !v);
  if (allOn) return "on";
  if (allOff) return "mixed";
  return "mixed";
}
