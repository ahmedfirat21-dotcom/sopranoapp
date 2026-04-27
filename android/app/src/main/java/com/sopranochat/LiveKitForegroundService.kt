package com.sopranochat

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Odadayken arka planda çalan ön plan servisi (foreground service).
 * Android, ön plan servisi çalışmadığı sürece arka plana atılan
 * uygulamanın WebRTC bağlantısını birkaç saniye içinde keser (Doze).
 * Bu servis "Odadasınız" bildirimi göstererek işlemi canlı tutar;
 * mikrofon/ses akışı kullanıcı uygulamayı arka plana atsa bile sürer.
 */
class LiveKitForegroundService : Service() {

    companion object {
        const val NOTIFICATION_ID = 8421
        const val CHANNEL_ID = "soprano_live_room"
        const val ACTION_START = "com.sopranochat.action.START_LK"
        const val ACTION_STOP = "com.sopranochat.action.STOP_LK"

        fun start(ctx: Context) {
            val intent = Intent(ctx, LiveKitForegroundService::class.java).apply {
                action = ACTION_START
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent)
            } else {
                ctx.startService(intent)
            }
        }

        fun stop(ctx: Context) {
            val intent = Intent(ctx, LiveKitForegroundService::class.java).apply {
                action = ACTION_STOP
            }
            try { ctx.stopService(intent) } catch (_: Exception) {}
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopForegroundCompat()
                stopSelf()
                return START_NOT_STICKY
            }
            else -> startInForeground()
        }
        return START_NOT_STICKY
    }

    private fun startInForeground() {
        ensureChannel()
        val notification = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Android 14+: foregroundServiceType bit-mask zorunlu.
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                )
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
        } catch (_: Exception) {
            // ForegroundServiceStartNotAllowedException: nadir durum,
            // sessiz fail (bağlantı yine kurulur, sadece arka planda kopabilir).
        }
    }

    private fun stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Aktif Oda",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Bir SopranoChat odasındayken görünür"
                setShowBadge(false)
                enableVibration(false)
                setSound(null, null)
            }
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = if (launchIntent != null) {
            PendingIntent.getActivity(
                this,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        } else null

        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SopranoChat")
            .setContentText("Sesli odadasınız")
            .setSmallIcon(applicationInfo.icon)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (pendingIntent != null) builder.setContentIntent(pendingIntent)
        return builder.build()
    }
}
