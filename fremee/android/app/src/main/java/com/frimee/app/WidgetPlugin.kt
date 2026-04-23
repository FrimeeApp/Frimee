package com.frimee.app

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "WidgetPlugin")
class WidgetPlugin : Plugin() {

    @PluginMethod
    fun updatePlanWidget(call: PluginCall) {
        val title = call.getString("title") ?: ""
        val subtitle = call.getString("subtitle") ?: ""
        val coverUrl = call.getString("coverUrl") ?: ""
        val planId = call.getString("planId") ?: ""
        val startAt = call.getString("startAt") ?: ""

        val context: Context = context
        val prefs = context.getSharedPreferences("frimee_widget", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("plan_title", title)
            .putString("plan_subtitle", subtitle)
            .putString("plan_cover_url", coverUrl)
            .putString("plan_id", planId)
            .putString("plan_start_at", startAt)
            .apply()

        val manager = AppWidgetManager.getInstance(context)
        val ids = manager.getAppWidgetIds(ComponentName(context, PlanWidget::class.java))
        for (id in ids) {
            updateAppWidget(context, manager, id)
        }
        val countdownIds = manager.getAppWidgetIds(ComponentName(context, CountdownWidget::class.java))
        for (id in countdownIds) {
            updateCountdownWidget(context, manager, id)
        }

        call.resolve()
    }
}
