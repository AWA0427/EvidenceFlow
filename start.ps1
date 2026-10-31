$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

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

Write-Host '========================================' -ForegroundColor Green
Write-Host '  证析 EvidenceFlow · 一键启动' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Stop-WithMessage '没有检测到 Node.js。请先安装 Node.js LTS：https://nodejs.org/'
}

$nodeVersion = node --version
Write-Host "Node.js: $nodeVersion"

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
Write-Host ''

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

$runCommand = if ($packageManager -eq 'pnpm') { 'pnpm dev' } else { 'npm run dev' }
$serverCommand = "Set-Location '$root'; `$env:PORT='$port'; $runCommand"
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit', '-NoProfile', '-Command', $serverCommand) -WindowStyle Normal

Write-Host '正在启动服务，请稍等...' -ForegroundColor Cyan
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 1
    if ($response.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {}
}

$url = "http://127.0.0.1:$port"
if ($ready) {
  Write-Host ''
  Write-Host '启动成功，正在打开浏览器...' -ForegroundColor Green
  Start-Process $url
} else {
  Write-Host ''
  Write-Host '服务窗口已经打开，但接口还没就绪。' -ForegroundColor Yellow
  Write-Host "请手动打开：$url"
}

Write-Host ''
Write-Host "地址：$url" -ForegroundColor Green
Write-Host '服务在另一个 PowerShell 窗口运行。关闭那个窗口即可停止服务。'
Write-Host ''
Read-Host '按回车关闭这个启动窗口'
