param([Parameter(Mandatory=$true)][string]$Patch, [Parameter(Mandatory=$true)][string]$Label)
$env:Path += ';C:\Users\yogun\AppData\Local\Android\Sdk\platform-tools'
$ts = (Get-Date).ToString('HHmmss')
$apkOut = "C:\SopranoChat\.parity\apk_${Label}_${ts}.png"
$adminOut = "C:\SopranoChat\.parity\admin_${Label}_${ts}.png"
$mergeOut = "C:\SopranoChat\.parity\diff_${Label}_${ts}.png"

# 1. Apply DB patch (merges into profile size_override)
$sql = "UPDATE cosmetic_items SET editor_config = jsonb_set(editor_config, '{frame_config,size_overrides,profile}', (editor_config->'frame_config'->'size_overrides'->'profile') || '$Patch'::jsonb) WHERE id='frames_turkuaz_premium_0xik';"
supabase db query --linked $sql 2>$null | Out-Null

# 2. Restart APK
adb -s emulator-5554 shell am force-stop com.sopranochat.app | Out-Null
Start-Sleep 1
adb -s emulator-5554 shell monkey -p com.sopranochat.app -c android.intent.category.LAUNCHER 1 2>&1 | Out-Null
Start-Sleep 7
adb -s emulator-5554 shell screencap -p /sdcard/apk_test.png | Out-Null
adb -s emulator-5554 pull /sdcard/apk_test.png $apkOut 2>&1 | Out-Null

Write-Output "APK_OUT: $apkOut"
