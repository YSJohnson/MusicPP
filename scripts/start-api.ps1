# 启动 KuGouMusicApi（概念版模式），并打印局域网地址
param(
  [int]$Port = 3000,
  [string]$Platform = "lite",
  [string]$Proxy = ""
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

# 优先复用已安装的副本（本项目自带的参考目录或 server 目录）
$candidates = @(
  (Join-Path $root "server\KuGouMusicApi"),
  (Join-Path $root "_ref\KuGouMusicApi")
)
$serverDir = $null
foreach ($c in $candidates) {
  if ((Test-Path (Join-Path $c "node_modules")) -and (Test-Path (Join-Path $c "app.js"))) {
    $serverDir = $c
    break
  }
}

if (-not $serverDir) {
  $serverDir = Join-Path $root "server\KuGouMusicApi"
  if (-not (Test-Path (Join-Path $serverDir "app.js"))) {
    Write-Host "==> 克隆 KuGouMusicApi 到 server/KuGouMusicApi ..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $serverDir) | Out-Null
    git clone --depth 1 https://github.com/MakcRe/KuGouMusicApi.git $serverDir
  }
}

Push-Location $serverDir
Write-Host "==> 使用服务目录：$serverDir" -ForegroundColor DarkGray

if (-not (Test-Path "node_modules")) {
  Write-Host "==> 安装依赖（约 1-2 分钟）..." -ForegroundColor Cyan
  npm install --no-audit --no-fund
}

# 生成 .env（不存在时）
if (-not (Test-Path ".env")) {
  $guid = [guid]::NewGuid().ToString()
  $dev = -join ((48..57) + (65..90) | Get-Random -Count 10 | ForEach-Object { [char]$_ })
  @"
platform='$Platform'
PORT='$Port'
HOST='0.0.0.0'
KUGOU_API_PROXY='$Proxy'
KUGOU_API_GUID='$guid'
KUGOU_API_DEV='$dev'
KUGOU_API_MAC='02:00:00:00:00:00'
KUGOU_API_WEBGL='9655615838832711846'
CORS_ALLOW_ORIGIN='*'
"@ | Set-Content -Path ".env" -Encoding UTF8
  Write-Host "==> 已生成 .env（platform=$Platform）" -ForegroundColor Green
} else {
  # 老 .env 可能缺少 CORS 配置，补上，避免手机端请求被浏览器策略拦截
  $envText = Get-Content ".env" -Raw
  if ($envText -notmatch "CORS_ALLOW_ORIGIN") {
    Add-Content -Path ".env" -Value "CORS_ALLOW_ORIGIN='*'" -Encoding UTF8
    Write-Host "==> 已补充 CORS_ALLOW_ORIGIN='*'" -ForegroundColor Green
  }
}

Write-Host ""
Write-Host "================ Music++ API ================" -ForegroundColor Yellow
Write-Host " 本机地址 : http://127.0.0.1:$Port"
$lanList = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
  $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and
  $_.InterfaceAlias -notmatch "Radmin|Loopback|vEthernet|VPN"
} | Sort-Object -Property @{ Expression = { $_.InterfaceAlias -match "WLAN|Wi-Fi" } } -Descending

if ($lanList) {
  Write-Host " 手机填写 :" -ForegroundColor Green
  foreach ($addr in $lanList) {
    Write-Host "            http://$($addr.IPAddress):$Port   [$($addr.InterfaceAlias)]" -ForegroundColor Green
  }
  Write-Host "            （选与手机同一 Wi-Fi 的那个网段）" -ForegroundColor DarkGray
}
Write-Host " 模式     : $Platform (lite = 酷狗概念版)"
Write-Host " 提示     : 保持本窗口运行，手机与电脑需在同一 Wi-Fi"
Write-Host "            若手机无法访问，请在 Windows 防火墙中允许 Node.js"
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

if ($Proxy) { $env:KUGOU_API_PROXY = $Proxy }
$env:PORT = "$Port"
npm run dev

Pop-Location
