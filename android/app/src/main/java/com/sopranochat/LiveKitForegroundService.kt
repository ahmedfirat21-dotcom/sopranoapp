package com.sopranochat

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

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

    // ★ v1.7.13 (18 May 2026): Partial wake lock — ekran kapanınca CPU'yu uyutmasın.
    //   Önceden sadece foreground bildirimi vardı, CPU Doze'a girince WebRTC paketleri
    //   geç kalıyor, LiveKit bağlantısı kopuyor, kullanıcı odadan düşüyordu.
    //   Wake lock servis ömrü boyunca alınır, stop'ta bırakılır. Bildirim zaten
    //   görünür olduğu için Android pil iyileştirme uyarısı yok; mikrofon servisi
    //   için CPU canlı tutmak meşru sebep.
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                releaseWakeLock()
                stopForegroundCompat()
                stopSelf()
                return START_NOT_STICKY
            }
            else -> {
                startInForeground()
                acquireWakeLock()
            }
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        releaseWakeLock()
        super.onDestroy()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "SopranoChat:LiveKitRoom"
            ).apply {
                setReferenceCounted(false)
                // Servis yalnız aktif oda boyunca çalışır; ACTION_STOP/onDestroy wake lock'ı
                // bırakır. Süre sınırı uzun oturumlarda 1 saat sonra sessiz kopma yaratıyordu.
                acquire()
            }
        } catch (_: Exception) { /* sessiz fail */ }
    }

    private fun releaseWakeLock() {
        try {
            if (wakeLock?.isHeld == true) wakeLock?.release()
            wakeLock = null
        } catch (_: Exception) { /* sessiz fail */ }
    }

    private fun startInForeground() {
        ensureChannel()
        val notification = buildNotification()
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                // Android 14+: foregroundServiceType bit-mask zorunlu.
                // Yalnızca kullanıcının çalışma zamanı iznini verdiği capture tiplerini
                // etkinleştir. Aksi halde Android 14+ SecurityException fırlatıp tüm
                // foreground servisini durdurur; dinleyicilerde ses de arka planda kopar.
                var serviceTypes = ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                if (ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    serviceTypes = serviceTypes or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                }
                if (ContextCompat.checkSelfPermission(
                        this,
                        Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED
                ) {
                    serviceTypes = serviceTypes or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
                }
                startForeground(
                    NOTIFICATION_ID,
                    notification,
                    serviceTypes
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

        // ★ 2026-05-09: Önceki kod applicationInfo.icon (renkli launcher) kullanıyordu;
        //   Android sistemi monokrom bekliyor → lacivert plate içine sıkıştırıyordu.
        //   Standart yol: R.drawable.notification_icon (saydam, beyaz silüet) + setColor tint.
        //   Bu sayede status bar'da temiz silüet, expanded view'da tint'li ikon görünür.
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SopranoChat")
            .setContentText("Sesli odadasınız")
            .setSmallIcon(R.drawable.notification_icon)
            .setColor(ContextCompat.getColor(this, R.color.notification_icon_color))
            .setColorized(false)
            .setOngoing(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (pendingIntent != null) builder.setContentIntent(pendingIntent)
        return builder.build()
    }
}
