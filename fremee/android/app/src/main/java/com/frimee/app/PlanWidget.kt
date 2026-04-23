package com.frimee.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import java.net.HttpURLConnection
import java.net.URL

class PlanWidget : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    override fun onEnabled(context: Context) {}

    override fun onDisabled(context: Context) {}
}

internal fun buildPlanPendingIntent(
    context: Context,
    appWidgetId: Int,
    planId: String
): PendingIntent {
    val intent = if (planId.isNotEmpty()) {
        Intent(
            Intent.ACTION_VIEW,
            Uri.parse("fremee://plans/static?id=$planId"),
            context,
            MainActivity::class.java
        )
    } else {
        Intent(context, MainActivity::class.java)
    }
    intent.flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP

    return PendingIntent.getActivity(
        context,
        appWidgetId,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
}

internal fun updateAppWidget(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int
) {
    val prefs = context.getSharedPreferences("frimee_widget", Context.MODE_PRIVATE)
    val title = prefs.getString("plan_title", "Sin planes proximos") ?: "Sin planes proximos"
    val subtitle = prefs.getString("plan_subtitle", "") ?: ""
    val coverUrl = prefs.getString("plan_cover_url", "") ?: ""
    val planId = prefs.getString("plan_id", "") ?: ""
    val startAt = prefs.getString("plan_start_at", "") ?: ""
    val countdown = buildCountdownUi(startAt)

    val views = RemoteViews(context.packageName, R.layout.plan_widget)
    views.setImageViewResource(R.id.widget_cover, R.drawable.widget_cover_placeholder)
    views.setTextViewText(R.id.widget_countdown, countdown.value)
    views.setTextViewText(R.id.widget_title, title)
    views.setTextViewText(R.id.widget_subtitle, subtitle)
    views.setViewVisibility(R.id.widget_subtitle, if (subtitle.isBlank()) View.GONE else View.VISIBLE)

    if (coverUrl.isNotEmpty()) {
        Thread {
            try {
                val connection = (URL(coverUrl).openConnection() as HttpURLConnection).apply {
                    doInput = true
                    connectTimeout = 5000
                    readTimeout = 5000
                    connect()
                }
                connection.inputStream.use { stream ->
                    val bitmap = BitmapFactory.decodeStream(stream)
                    if (bitmap != null) {
                        views.setImageViewBitmap(R.id.widget_cover, bitmap)
                        appWidgetManager.updateAppWidget(appWidgetId, views)
                    }
                }
                connection.disconnect()
            } catch (_: Exception) {
            }
        }.start()
    }

    val pendingIntent = buildPlanPendingIntent(context, appWidgetId, planId)
    views.setOnClickPendingIntent(R.id.widget_root, pendingIntent)
    views.setOnClickPendingIntent(R.id.widget_cover, pendingIntent)

    appWidgetManager.updateAppWidget(appWidgetId, views)
}
