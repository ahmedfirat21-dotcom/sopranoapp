package com.sopranochat

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS tarafından LiveKitForegroundService'i başlatıp durdurmak için köprü.
 * services/livekit.ts → connect öncesinde start, disconnect sırasında stop çağırır.
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
}
