package com.sopranochat
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager

import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    super.onCreate(null)

    // targetSdk 35+ forces edge-to-edge. On Android 15/16 adjustResize does not
    // reliably resize absolute React Native overlays, so apply the native IME
    // inset to the React root. This fixes every composer, including room chat
    // and the in-room DM drawer, from one authoritative keyboard boundary.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
      val content = findViewById<View>(android.R.id.content)
      ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
        val imeVisible = insets.isVisible(WindowInsetsCompat.Type.ime())
        val imeBottom = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        val navigationBottom = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
        val keyboardBottom = if (imeVisible) {
          (imeBottom - navigationBottom).coerceAtLeast(0)
        } else {
          0
        }
        if (view.paddingBottom != keyboardBottom) {
          view.setPadding(view.paddingLeft, view.paddingTop, view.paddingRight, keyboardBottom)
        }
        insets
      }
      ViewCompat.requestApplyInsets(content)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
