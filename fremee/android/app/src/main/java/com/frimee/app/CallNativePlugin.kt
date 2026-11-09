package com.frimee.app

import android.content.Intent
import androidx.core.content.ContextCompat
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * The web app's side of native calls:
 * - startOngoing / updateOngoing / stopOngoing: the foreground service and its notification (M19b).
 * - cancelIncoming: drop the ringing notification once the app took the call.
 * - "callAction" events: "Silenciar" and "Colgar" pressed in the notification.
 */
@CapacitorPlugin(name = "CallNative")
class CallNativePlugin : Plugin() {
    companion object {
        private var instance: CallNativePlugin? = null

        /** False when the app is not running (nobody to tell). */
        fun emitAction(action: String): Boolean {
            val plugin = instance ?: return false
            plugin.notifyListeners("callAction", JSObject().put("action", action))
            return true
        }
    }

    override fun load() {
        instance = this
    }

    override fun handleOnDestroy() {
        if (instance === this) instance = null
    }

    private fun serviceIntent(call: PluginCall, action: String) =
        Intent(context, CallService::class.java).apply {
            this.action = action
            putExtra("title", call.getString("title"))
            putExtra("subtitle", call.getString("subtitle"))
            putExtra("video", call.getBoolean("video", false) ?: false)
            putExtra("muted", call.getBoolean("muted", false) ?: false)
        }

    @PluginMethod
    fun startOngoing(call: PluginCall) {
        try {
            ContextCompat.startForegroundService(context, serviceIntent(call, CallService.ACTION_START))
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo mostrar la llamada en curso", e)
        }
    }

    @PluginMethod
    fun updateOngoing(call: PluginCall) {
        try {
            ContextCompat.startForegroundService(context, serviceIntent(call, CallService.ACTION_UPDATE))
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudo actualizar la llamada en curso", e)
        }
    }

    @PluginMethod
    fun stopOngoing(call: PluginCall) {
        CallService.stop(context)
        // The call is over: the app no longer shows over the lock screen.
        activity?.runOnUiThread { (activity as? MainActivity)?.releaseLockScreen() }
        call.resolve()
    }

    @PluginMethod
    fun cancelIncoming(call: PluginCall) {
        call.getString("llamadaId")?.let { CallNotifications.cancelIncoming(context, it) }
        call.resolve()
    }
}
