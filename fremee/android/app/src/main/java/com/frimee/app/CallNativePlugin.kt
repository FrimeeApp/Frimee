package com.frimee.app

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
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
 * - startRinging / stopRinging: the phone's ringtone while a call rings on Frimee's own screen
 *   (with the app closed the notification rings; once Frimee shows the call it takes over).
 */
@CapacitorPlugin(name = "CallNative")
class CallNativePlugin : Plugin() {
    companion object {
        private var instance: CallNativePlugin? = null

        /** False when the app is not running (nobody to tell). */
        @JvmStatic
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
        stopRingtone()
        if (instance === this) instance = null
    }

    private var ringtone: Ringtone? = null

    private fun vibrator(): Vibrator? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }

    private fun stopRingtone() {
        ringtone?.stop()
        ringtone = null
        vibrator()?.cancel()
    }

    /** Ring like a phone call: silent mode = nothing, vibrate mode = only vibration. */
    @PluginMethod
    fun startRinging(call: PluginCall) {
        if (ringtone?.isPlaying == true) {
            call.resolve()
            return
        }
        val audio = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        val mode = audio?.ringerMode ?: AudioManager.RINGER_MODE_NORMAL
        if (mode == AudioManager.RINGER_MODE_NORMAL) {
            val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            ringtone = RingtoneManager.getRingtone(context, uri)?.apply {
                audioAttributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
                play()
            }
        }
        if (mode != AudioManager.RINGER_MODE_SILENT) {
            val pattern = longArrayOf(0, 1000, 1000)
            vibrator()?.vibrate(VibrationEffect.createWaveform(pattern, 0))
        }
        call.resolve()
    }

    @PluginMethod
    fun stopRinging(call: PluginCall) {
        stopRingtone()
        call.resolve()
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

    /** The call link Frimee was opened with (cold start), once. */
    @PluginMethod
    fun takePendingCall(call: PluginCall) {
        val url = MainActivity.pendingCallUri
        MainActivity.pendingCallUri = null
        call.resolve(JSObject().put("url", url))
    }

    @PluginMethod
    fun cancelIncoming(call: PluginCall) {
        call.getString("llamadaId")?.let { CallNotifications.cancelIncoming(context, it) }
        call.resolve()
    }
}
