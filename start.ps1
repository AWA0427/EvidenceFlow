param(
  [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

# Windows PowerShell 5.1 在 cmd 中默认可能按本地代码页输出，中文会乱码。
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

function Stop-WithMessage($message) {
  Write-Host ''
  Write-Host $message -ForegroundColor Yellow
  Write-Host ''
  Read-Host '按回车关闭窗口'
  exit 1
}

function Test-PortInUse([int]$port) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', $port)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Test-Health([int]$port) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Find-RunningPort {
  for ($candidate = 3000; $candidate -le 3010; $candidate++) {
    if (Test-Health $candidate) { return $candidate }
  }
  return 0
}

Write-Host '========================================' -ForegroundColor Green
Write-Host '  证析 EvidenceFlow · 一键启动' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''

# 已经启动过：直接打开，不再安装依赖、不再开第二个服务
$runningPort = Find-RunningPort
if ($runningPort -gt 0) {
  $runningUrl = "http://127.0.0.1:$runningPort"
  Write-Host "检测到服务已经运行：$runningUrl" -ForegroundColor Green
  if (-not $NoBrowser) { Start-Process $runningUrl }
  Write-Host '已打开浏览器，本次不需要重新安装。'
  Start-Sleep -Seconds 1
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage '没有检测到 Node.js。请先安装 Node.js LTS：https://nodejs.org/'
}

Write-Host "Node.js: $(node --version)"

$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue
$packageManager = $null

if ($pnpmCommand) {
  $packageManager = 'pnpm'
} elseif ($npmCommand) {
  $packageManager = 'npm'
}

if (-not $packageManager) {
  Stop-WithMessage '没有检测到 pnpm 或 npm。请重新安装 Node.js LTS（自带 npm）。'
}

Write-Host "包管理器：$packageManager"

# 已有 node_modules 就跳过安装，第二次启动会很快
if (-not (Test-Path 'node_modules\tsx')) {
  Write-Host '第一次启动，正在安装依赖，可能需要 1–3 分钟...' -ForegroundColor Cyan
  if ($packageManager -eq 'pnpm') {
    & pnpm install
  } else {
    & npm install
  }
  if ($LASTEXITCODE -ne 0) {
    Stop-WithMessage '依赖安装失败。请检查网络，或手动执行安装命令查看报错。'
  }
} else {
  Write-Host '依赖已安装，跳过安装步骤。' -ForegroundColor Green
}

if (-not (Test-Path '.env.local')) {
  Copy-Item '.env.example' '.env.local'
  Write-Host '已生成 .env.local（不填 API Key 也能先用示例）' -ForegroundColor Green
}

$port = 3000
while (Test-PortInUse $port) {
  $port += 1
}

Write-Host "使用端口：$port" -ForegroundColor Cyan
Write-Host '正在启动服务，请稍等...' -ForegroundColor Cyan

$runCommand = if ($packageManager -eq 'pnpm') { 'pnpm dev' } else { 'npm run dev' }
$serverCommand = "Set-Location '$root'; `$env:PORT='$port'; $runCommand"
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-NoProfile', '-Command', $serverCommand) -WindowStyle Normal

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  if (Test-Health $port) {
    $ready = $true
    break
  }
}

$url = "http://127.0.0.1:$port"
if ($ready) {
  Write-Host ''
  Write-Host '启动成功。' -ForegroundColor Green
  if (-not $NoBrowser) { Start-Process $url }
} else {
  Write-Host ''
  Write-Host '服务窗口已经打开，但接口还没就绪。' -ForegroundColor Yellow
  Write-Host "请手动打开：$url"
}

Write-Host "地址：$url" -ForegroundColor Green
Write-Host '服务在另一个 PowerShell 窗口运行。关闭那个窗口即可停止服务。'
Write-Host ''
if (-not $NoBrowser) { Read-Host '按回车关闭这个启动窗口' }
