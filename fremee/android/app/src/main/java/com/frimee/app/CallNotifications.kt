package com.frimee.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person

/**
 * Calls in Android's own call style (board M19a): with Frimee closed or the phone locked, an
 * incoming call rings full screen with "Rechazar" and "Contestar". The data comes from the
 * "incoming_call" push that send-push sends when a call starts ringing.
 */
object CallNotifications {
    const val CHANNEL_INCOMING = "frimee_calls_incoming"
    const val CHANNEL_ONGOING = "frimee_calls_ongoing"
    const val ID_ONGOING = 47_001
    private const val TAG = "FrimeeCalls"
    private const val RING_MS = 45_000L

    fun incomingId(llamadaId: String): Int = 47_100 + ((llamadaId.toLongOrNull() ?: 0L) % 10_000L).toInt()

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_INCOMING) == null) {
            val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            val channel = NotificationChannel(CHANNEL_INCOMING, "Llamadas entrantes", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Llamadas y videollamadas de Frimee"
                setSound(ringtone, AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build())
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 1000)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            manager.createNotificationChannel(channel)
        }
        if (manager.getNotificationChannel(CHANNEL_ONGOING) == null) {
            val channel = NotificationChannel(CHANNEL_ONGOING, "Llamada en curso", NotificationManager.IMPORTANCE_LOW).apply {
                description = "Mientras estás en una llamada de Frimee"
                setSound(null, null)
            }
            manager.createNotificationChannel(channel)
        }
    }

    /** fremee://call/<action>?llamada=…&room=…&chat=…&tipo=… — read by the web app (appUrlOpen). */
    fun callUri(action: String, data: Map<String, String>): Uri =
        Uri.Builder().scheme("fremee").authority("call").appendPath(action)
            .appendQueryParameter("llamada", data["llamada_id"] ?: "")
            .appendQueryParameter("room", data["room_name"] ?: "")
            .appendQueryParameter("chat", data["chat_id"] ?: "")
            .appendQueryParameter("tipo", data["tipo"] ?: "audio")
            .build()

    /** With a call link: through CallLinkActivity, which keeps the link. Without: straight to Frimee. */
    fun openAppIntent(context: Context, uri: Uri?): Intent =
        Intent(context, if (uri != null) CallLinkActivity::class.java else MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = uri
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }

    private fun pendingFlags() = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    fun showIncoming(context: Context, data: Map<String, String>) {
        val llamadaId = data["llamada_id"] ?: return
        val expiresAt = data["expires_at"]?.toLongOrNull()
        val remaining = if (expiresAt != null) expiresAt - System.currentTimeMillis() else RING_MS
        if (remaining <= 0) return // arrived late: the call already stopped ringing
        ensureChannels(context)

        val video = data["tipo"] == "video"
        val name = data["caller_name"]?.takeIf { it.isNotBlank() } ?: "Frimee"
        val plan = data["chat_tipo"] == "PLAN" && !data["chat_nombre"].isNullOrBlank()
        val text = buildString {
            append(if (video) "Videollamada entrante" else "Llamada entrante")
            if (plan) append(" · ").append(data["chat_nombre"])
        }
        val requestCode = incomingId(llamadaId)

        val fullScreen = PendingIntent.getActivity(context, requestCode, openAppIntent(context, callUri("incoming", data)), pendingFlags())
        val answer = PendingIntent.getActivity(context, requestCode + 1, openAppIntent(context, callUri("answer", data)), pendingFlags())
        val decline = PendingIntent.getBroadcast(
            context,
            requestCode + 2,
            Intent(context, CallActionReceiver::class.java).apply {
                action = CallActionReceiver.ACTION_DECLINE
                data.forEach { (k, v) -> putExtra(k, v) }
            },
            pendingFlags(),
        )

        val person = Person.Builder().setName(name).setImportant(true).build()
        val notification = NotificationCompat.Builder(context, CHANNEL_INCOMING)
            .setSmallIcon(R.drawable.ic_stat_call)
            .setContentTitle(name)
            .setContentText(text)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(remaining)
            .setContentIntent(fullScreen)
            .setFullScreenIntent(fullScreen, true)
            .setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer).setIsVideo(video))
            .build()
        // Ring and vibrate again and again, like a phone call, until it is taken away.
        notification.flags = notification.flags or android.app.Notification.FLAG_INSISTENT

        try {
            NotificationManagerCompat.from(context).notify(requestCode, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "No permission to post the call notification", e)
        }
    }

    fun cancelIncoming(context: Context, llamadaId: String) {
        NotificationManagerCompat.from(context).cancel(incomingId(llamadaId))
    }
}
