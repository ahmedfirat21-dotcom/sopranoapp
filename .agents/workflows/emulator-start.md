---
description: How to start the emulator correctly for SopranoChat development
---
// turbo-all

1. Set up ADB port forwarding (critical for emulator to reach Metro):
```
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; & "$env:ANDROID_HOME\platform-tools\adb.exe" reverse tcp:8081 tcp:8081
```

2. Start Metro with cache clear and Android:
```
npx expo start --android --clear
```

3. If the app shows the Expo dev client launcher (^ logo), force restart the app on the emulator:
```
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; & "$env:ANDROID_HOME\platform-tools\adb.exe" shell am force-stop com.sopranochat.mobil2; & "$env:ANDROID_HOME\platform-tools\adb.exe" shell am start -a android.intent.action.VIEW -d "exp+sopranochat://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"
```

4. Take a screenshot to verify:
```
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"; & "$env:ANDROID_HOME\platform-tools\adb.exe" shell screencap -p /sdcard/screen.png; & "$env:ANDROID_HOME\platform-tools\adb.exe" pull /sdcard/screen.png c:\SopranoChat\emulator_check.png
```

**Important Notes:**
- Always run `adb reverse` BEFORE starting Metro
- The `REACT_NATIVE_PACKAGER_HOSTNAME` env var may need to be set to `10.0.2.2` if Metro sends the wrong URL
- Package name is `com.sopranochat.mobil2`
- If bundle shows "1 module", the dev client loaded but the app didn't — force restart with the deep link URL
