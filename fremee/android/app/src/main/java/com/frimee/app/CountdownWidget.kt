package com.frimee.app

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.view.View
import android.widget.RemoteViews
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

internal data class CountdownUi(
    val value: String,
    val label: String,
    val date: String,
)

internal fun buildCountdownUi(startAt: String): CountdownUi {
    if (startAt.isBlank()) {
        return CountdownUi("--", "Sin fecha", "")
    }

    return try {
        val start = OffsetDateTime.parse(startAt)
        val now = OffsetDateTime.now()
        val minutesUntil = now.until(start, ChronoUnit.MINUTES)

        val (value, label) = when {
            minutesUntil <= 0 -> "0h" to "Ya ha empezado"
            minutesUntil < 60 -> "${minutesUntil}m" to "Para empezar"
            minutesUntil < 60 * 24 -> {
                val hours = minutesUntil / 60
                val minutes = minutesUntil % 60
                val value = if (minutes > 0) "${hours}h ${minutes}m" else "${hours}h"
                value to "Para empezar"
            }
            else -> {
                val days = minutesUntil / (60 * 24)
                val hours = (minutesUntil % (60 * 24)) / 60
                val value = if (hours > 0) "${days}d ${hours}h" else "${days}d"
                value to "Para empezar"
            }
        }

        val localDateTime = start.atZoneSameInstant(ZoneId.systemDefault())
        val formatter = DateTimeFormatter.ofPattern("EEE d MMM - HH:mm", Locale("es", "ES"))
        CountdownUi(value, label, formatter.format(localDateTime))
    } catch (_: Exception) {
        CountdownUi("--", "Fecha invalida", "")
    }
}

class CountdownWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateCountdownWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {}

    override fun onDisabled(context: Context) {}
}

internal fun updateCountdownWidget(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int
) {
    val prefs = context.getSharedPreferences("frimee_widget", Context.MODE_PRIVATE)
    val title = prefs.getString("plan_title", "Sin planes proximos") ?: "Sin planes proximos"
    val subtitle = prefs.getString("plan_subtitle", "") ?: ""
    val planId = prefs.getString("plan_id", "") ?: ""
    val startAt = prefs.getString("plan_start_at", "") ?: ""

    val countdown = buildCountdownUi(startAt)

    val views = RemoteViews(context.packageName, R.layout.countdown_widget)
    views.setTextViewText(R.id.countdown_plan_title, title)
    views.setTextViewText(R.id.countdown_subtitle, subtitle)
    views.setViewVisibility(R.id.countdown_subtitle, if (subtitle.isBlank()) View.GONE else View.VISIBLE)
    views.setTextViewText(R.id.countdown_value, countdown.value)
    views.setTextViewText(R.id.countdown_label, countdown.label)
    views.setTextViewText(R.id.countdown_date, countdown.date)

    val pendingIntent = buildPlanPendingIntent(context, appWidgetId + 1000, planId)
    views.setOnClickPendingIntent(R.id.countdown_root, pendingIntent)
    appWidgetManager.updateAppWidget(appWidgetId, views)
}
