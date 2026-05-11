import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { createBrowserSupabaseClient } from "@/services/supabase/client";

export type PushDeepLinkHandler = (path: string) => void;

let _navigate: PushDeepLinkHandler | null = null;

export function setPushNavigationHandler(handler: PushDeepLinkHandler) {
  _navigate = handler;
}

// ─── Token storage ────────────────────────────────────────────────────────────

async function saveToken(token: string): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const platform = Capacitor.getPlatform() as "ios" | "android";
  const { error } = await supabase.rpc("fn_push_token_upsert", {
    p_token: token,
    p_platform: platform,
  });
  if (error) console.warn("[push] saveToken error:", error.message);
}

export async function removeToken(): Promise<void> {
  try {
    const registration = await PushNotifications.getDeliveredNotifications();
    void registration; // just to check plugin is available
  } catch {
    return;
  }
  const supabase = createBrowserSupabaseClient();
  const { error } = await supabase.rpc("fn_push_token_delete");
  if (error) console.warn("[push] removeToken error:", error.message);
}

// ─── Deep link resolution ─────────────────────────────────────────────────────

function resolveNotificationPath(data: Record<string, string> | undefined): string | null {
  if (!data) return null;

  const { type, plan_id, expense_id, message_id } = data;

  switch (type) {
    case "trip_invitation_received":
    case "trip_invitation_accepted":
    case "trip_invitation_declined":
    case "trip_activity_added":
    case "trip_activity_updated":
    case "trip_activity_deleted":
    case "trip_cancelled":
    case "trip_starting_24h":
    case "trip_starting_1h":
    case "trip_completed":
      return plan_id ? `/plans/static?id=${plan_id}` : "/calendar";

    case "expense_added_you_owe":
    case "expense_added_fyi":
    case "expense_payment_received":
    case "expense_payment_reminder":
    case "expense_split_updated":
    case "expense_deleted":
    case "balance_trip_closed":
      return plan_id ? `/plans/static?id=${plan_id}&tab=gastos` : "/wallet";

    case "group_chat_mention":
    case "group_chat_message":
      return plan_id ? `/messages?planId=${plan_id}` : "/messages";

    case "group_poll_created":
    case "group_poll_closing_soon":
    case "group_poll_result":
    case "group_member_joined":
    case "group_member_left":
    case "group_member_removed":
      return plan_id ? `/plans/static?id=${plan_id}` : "/calendar";

    case "reminder_document":
    case "reminder_packing":
    case "reminder_custom":
      return plan_id ? `/plans/static?id=${plan_id}` : "/calendar";

    default:
      return "/notifications";
  }
}

// ─── Initializer ─────────────────────────────────────────────────────────────

export async function requestPushPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  let permStatus = await PushNotifications.checkPermissions();

  if (permStatus.receive === "prompt") {
    permStatus = await PushNotifications.requestPermissions();
  }

  return permStatus.receive === "granted";
}

export async function initPushNotifications(navigate: PushDeepLinkHandler): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  setPushNavigationHandler(navigate);

  const granted = await requestPushPermission();
  if (!granted) {
    console.info("[push] permission denied");
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener("registration", (token: Token) => {
    void saveToken(token.value);
  });

  PushNotifications.addListener("registrationError", (err) => {
    console.warn("[push] registration error:", err.error);
  });

  // Foreground: show in Notifications tray but don't auto-navigate
  PushNotifications.addListener(
    "pushNotificationReceived",
    (_notification: PushNotificationSchema) => {
      // Notifications received while app is in foreground are handled
      // by the in-app notification system (Supabase realtime).
    }
  );

  // Tapped: navigate to the relevant screen
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action: ActionPerformed) => {
      const data = action.notification.data as Record<string, string> | undefined;
      const path = resolveNotificationPath(data);
      if (path && _navigate) {
        _navigate(path);
      }
    }
  );
}

export async function deliverInitialNotification(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { notifications } = await PushNotifications.getDeliveredNotifications();
  if (notifications.length === 0) return;
  const latest = notifications[notifications.length - 1];
  const data = latest.data as Record<string, string> | undefined;
  const path = resolveNotificationPath(data);
  if (path && _navigate) {
    _navigate(path);
  }
  await PushNotifications.removeAllDeliveredNotifications();
}
