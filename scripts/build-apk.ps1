# 一键构建 Music++ Android APK
param(
  [switch]$Release = $true
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

# Windows 下系统 TEMP 可能被杀软/索引占用，esbuild 删临时文件会报 Access denied，
# 这里统一改用工作区内的临时目录。
$tmp = Join-Path $root ".tmp"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$env:TEMP = (Resolve-Path $tmp).Path
$env:TMP = $env:TEMP

Write-Host "==> 类型检查 & 构建 Web 资源" -ForegroundColor Cyan
npm run build

Write-Host "==> 同步到 Android 工程" -ForegroundColor Cyan
npx cap sync android

$env:JAVA_HOME = if ($env:JAVA_HOME) { $env:JAVA_HOME } else { "C:\Users\$env:USERNAME\scoop\apps\temurin21-jdk\current" }
$env:GRADLE_OPTS = "-Dhttps.proxyHost=127.0.0.1 -Dhttps.proxyPort=7890 -Dhttp.proxyHost=127.0.0.1 -Dhttp.proxyPort=7890"

Push-Location android
$task = if ($Release) { "assembleRelease" } else { "assembleDebug" }
Write-Host "==> Gradle $task（首次会下载依赖，较慢）" -ForegroundColor Cyan
& .\gradlew.bat $task
Pop-Location

$apk = if ($Release) {
  "android\app\build\outputs\apk\release\app-release.apk"
} else {
  "android\app\build\outputs\apk\debug\app-debug.apk"
}

if (Test-Path $apk) {
  New-Item -ItemType Directory -Force -Path "release" | Out-Null
  $version = (node -p "require('./package.json').version").Trim()
  $name = if ($Release) { "MusicPP-v$version.apk" } else { "MusicPP-v$version-debug.apk" }
  Copy-Item $apk "release\$name" -Force
  Write-Host ""
  Write-Host "构建完成：release\$name" -ForegroundColor Green
  Get-Item "release\$name" | Select-Object FullName, Length | Format-List
} else {
  Write-Host "未找到 APK：$apk" -ForegroundColor Red
}

Pop-Location

