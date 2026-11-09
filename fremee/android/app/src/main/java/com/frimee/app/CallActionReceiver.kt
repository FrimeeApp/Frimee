package com.frimee.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

/**
 * Buttons of the call notifications that work without opening Frimee.
 * - "Rechazar" (incoming): tells the server with the signed code that came in the push
 *   (call-action), so the caller learns it straight away.
 * - "Silenciar" / "Colgar" (ongoing call, M19b): passed to the web app through CallNativePlugin.
 */
class CallActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_DECLINE = "com.frimee.app.CALL_DECLINE"
        const val ACTION_MUTE = "com.frimee.app.CALL_MUTE"
        const val ACTION_HANGUP = "com.frimee.app.CALL_HANGUP"
        private const val TAG = "FrimeeCalls"
    }

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            ACTION_DECLINE -> decline(context, intent)
            ACTION_MUTE -> CallNativePlugin.emitAction("mute")
            ACTION_HANGUP -> {
                // The app answers by hanging up; if it is gone, at least the notification goes.
                if (!CallNativePlugin.emitAction("hangup")) CallService.stop(context)
            }
        }
    }

    private fun decline(context: Context, intent: Intent) {
        val llamadaId = intent.getStringExtra("llamada_id") ?: return
        CallNotifications.cancelIncoming(context, llamadaId)
        val url = intent.getStringExtra("action_url") ?: return
        val body = JSONObject()
            .put("action", "decline")
            .put("llamada_id", llamadaId)
            .put("user_id", intent.getStringExtra("recipient_id") ?: "")
            .put("token", intent.getStringExtra("decline_token") ?: "")
            .toString()
        val pending = goAsync()
        thread {
            try {
                val conn = URL(url).openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.connectTimeout = 8_000
                conn.readTimeout = 8_000
                conn.doOutput = true
                conn.setRequestProperty("Content-Type", "application/json")
                conn.outputStream.use { it.write(body.toByteArray()) }
                Log.i(TAG, "decline → ${conn.responseCode}")
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "decline failed", e)
            } finally {
                pending.finish()
            }
        }
    }
}
