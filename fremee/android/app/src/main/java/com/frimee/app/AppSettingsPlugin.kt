package com.frimee.app

import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.provider.Settings
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Small native helpers: Frimee's page in Android's settings (camera and microphone permissions),
 * and the window background behind the system bars (the app's colour for the current theme).
 */
@CapacitorPlugin(name = "AppSettings")
class AppSettingsPlugin : Plugin() {

    @PluginMethod
    fun setBackground(call: PluginCall) {
        val color = call.getString("color")
        if (color == null) {
            call.reject("Falta el color")
            return
        }
        try {
            val parsed = Color.parseColor(color)
            activity.runOnUiThread {
                activity.window.decorView.setBackgroundColor(parsed)
                call.resolve()
            }
        } catch (e: IllegalArgumentException) {
            call.reject("Color no válido: $color", e)
        }
    }

    @PluginMethod
    fun open(call: PluginCall) {
        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
            data = Uri.fromParts("package", context.packageName, null)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        try {
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("No se pudieron abrir los ajustes", e)
        }
    }
}
