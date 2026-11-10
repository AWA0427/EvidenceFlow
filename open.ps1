$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8

function Test-Health([int]$port) {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port/api/health" -UseBasicParsing -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

for ($port = 3000; $port -le 3010; $port++) {
  if (Test-Health $port) {
    Start-Process "http://127.0.0.1:$port"
    Write-Host "已打开 http://127.0.0.1:$port" -ForegroundColor Green
    exit 0
  }
}

Write-Host '服务还没有运行，先启动服务。' -ForegroundColor Cyan
& "$root\start.ps1"
