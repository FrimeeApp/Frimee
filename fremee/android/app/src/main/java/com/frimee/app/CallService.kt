package com.frimee.app

import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * The call while Frimee is in the background (board M19b): a foreground service, so Android keeps
 * the microphone (and the camera) working, with the ongoing-call notification: who, how many,
 * "Toca para volver", "Silenciar" and "Colgar". Started and updated by CallNativePlugin.
 */
class CallService : Service() {
    companion object {
        const val ACTION_START = "com.frimee.app.CALL_SERVICE_START"
        const val ACTION_UPDATE = "com.frimee.app.CALL_SERVICE_UPDATE"
        const val ACTION_STOP = "com.frimee.app.CALL_SERVICE_STOP"

        fun stop(context: Context) {
            context.startService(Intent(context, CallService::class.java).setAction(ACTION_STOP))
        }
    }

    private var startedAt = 0L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START, ACTION_UPDATE -> {
                if (startedAt == 0L) startedAt = System.currentTimeMillis()
                val notification = build(intent)
                val video = intent.getBooleanExtra("video", false)
                var type = 0
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    type = ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    if (video) type = type or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                }
                try {
                    ServiceCompat.startForeground(this, CallNotifications.ID_ONGOING, notification, type)
                } catch (e: Exception) {
                    // Without the camera permission (or started from the background) keep the microphone.
                    ServiceCompat.startForeground(this, CallNotifications.ID_ONGOING, notification,
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0)
                }
            }
            ACTION_STOP -> {
                ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
        }
        return START_NOT_STICKY
    }

    private fun build(intent: Intent): android.app.Notification {
        CallNotifications.ensureChannels(this)
        val title = intent.getStringExtra("title") ?: "Llamada de Frimee"
        val subtitle = intent.getStringExtra("subtitle") ?: "Toca para volver"
        val muted = intent.getBooleanExtra("muted", false)
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

        val open = PendingIntent.getActivity(this, 47_010, CallNotifications.openAppIntent(this, null), flags)
        val hangUp = PendingIntent.getBroadcast(this, 47_011,
            Intent(this, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_HANGUP), flags)
        val mute = PendingIntent.getBroadcast(this, 47_012,
            Intent(this, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_MUTE), flags)

        val person = Person.Builder().setName(title).setImportant(true).build()
        return NotificationCompat.Builder(this, CallNotifications.CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setContentIntent(open)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setWhen(startedAt)
            .setUsesChronometer(true)
            .setColor(ContextCompat.getColor(this, android.R.color.holo_green_dark))
            .addAction(0, if (muted) "Activar micro" else "Silenciar", mute)
            .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp))
            .build()
    }
}
