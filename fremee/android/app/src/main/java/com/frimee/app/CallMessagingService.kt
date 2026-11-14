package com.frimee.app

import com.capacitorjs.plugins.pushnotifications.MessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Frimee's push receiver: calls are handled here, natively, so they ring even with the app
 * closed; everything else goes to Capacitor's push plugin as before.
 * - "incoming_call": the call-style notification (full screen when locked). With Frimee open,
 *   the app shows its own incoming screen instead.
 * - "call_cancel": the call stopped ringing (hung up, answered elsewhere, expired).
 */
class CallMessagingService : MessagingService() {
    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        when (data["type"]) {
            "incoming_call" -> {
                if (!MainActivity.isInForeground) CallNotifications.showIncoming(applicationContext, data)
            }
            "call_cancel" -> data["llamada_id"]?.let { CallNotifications.cancelIncoming(applicationContext, it) }
            else -> super.onMessageReceived(remoteMessage)
        }
    }
}
