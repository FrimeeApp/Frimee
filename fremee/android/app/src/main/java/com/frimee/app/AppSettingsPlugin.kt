package com.frimee.app

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/** Opens Frimee's page in Android's settings (permissions for the camera and the microphone). */
@CapacitorPlugin(name = "AppSettings")
class AppSettingsPlugin : Plugin() {

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
