package com.sopranochat

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS tarafından LiveKitForegroundService'i başlatıp durdurmak için köprü.
 * services/livekit.ts → connect öncesinde start, disconnect sırasında stop çağırır.
 *
 * ★ v1.7.13.27: Pil iyileştirme muafiyeti (Doze mode bypass) köprüsü eklendi.
 *   isIgnoringBatteryOptimizations() ile durum kontrol, requestIgnore...() ile
 *   sistem ayarına yönlendirme. Foreground service tek başına yetmiyor —
 *   Doze mode WebSocket'i suspend ediyor, oda sessizleşiyor.
 */
class LiveKitForegroundServiceModule(
    private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "LiveKitForegroundService"

    @ReactMethod
    fun start(promise: Promise) {
        try {
            LiveKitForegroundService.start(reactContext.applicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LK_FG_START_ERR", e.message ?: "start failed", e)
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        try {
            LiveKitForegroundService.stop(reactContext.applicationContext)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LK_FG_STOP_ERR", e.message ?: "stop failed", e)
        }
    }

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true)
                return
            }
            val ctx = reactContext.applicationContext
            val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(ctx.packageName))
        } catch (e: Exception) {
            promise.reject("LK_BATT_CHECK_ERR", e.message ?: "check failed", e)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true)
                return
            }
            val ctx = reactContext.applicationContext
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:" + ctx.packageName)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            ctx.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LK_BATT_REQUEST_ERR", e.message ?: "request failed", e)
        }
    }
}
