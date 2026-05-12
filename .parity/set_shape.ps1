param([Parameter(Mandatory=$true)][string]$Shape)
$sql = @"
UPDATE cosmetic_items SET editor_config = jsonb_set(
  editor_config,
  '{frame_config,size_overrides,profile,avatar_shape}',
  '"$Shape"'::jsonb
) WHERE id='frames_turkuaz_premium_0xik';
"@
Set-Content -Path "C:\SopranoChat\.parity\_shape.sql" -Value $sql
& supabase db query --linked --file C:/SopranoChat/.parity/_shape.sql 2>&1 | Out-Null

$env:Path += ';C:\Users\yogun\AppData\Local\Android\Sdk\platform-tools'
adb -s emulator-5554 shell am force-stop com.sopranochat.app | Out-Null
Start-Sleep 1
adb -s emulator-5554 shell monkey -p com.sopranochat.app -c android.intent.category.LAUNCHER 1 2>&1 | Out-Null
Start-Sleep 8
adb -s emulator-5554 shell screencap -p /sdcard/t.png | Out-Null
adb -s emulator-5554 pull /sdcard/t.png "C:\SopranoChat\.parity\apk_$Shape.png" 2>&1 | Out-Null
Write-Output "OK $Shape"
