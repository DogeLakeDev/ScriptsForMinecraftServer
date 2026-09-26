# 游戏机 qq_config.json 是唯一人工编辑入口；仅 official.transport=webhook 时同步云端桥配置。
param(
  [string]$Root = $PSScriptRoot,
  [switch]$Once
)

$ErrorActionPreference = 'Stop'
$OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$configPath = Join-Path $Root 'configs\qq_config.json'
$logPath = Join-Path $Root 'qq-config-sync.log'
$mutex = New-Object System.Threading.Mutex($false, 'Global\SFMCQQConfigSync')
if (-not $mutex.WaitOne(0)) { exit 0 }

function Write-SyncLog([string]$message) {
  if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 1048576) {
    Clear-Content -LiteralPath $logPath
  }
  "$(Get-Date -Format o) $message" | Add-Content -LiteralPath $logPath -Encoding UTF8
}

function Read-StableConfig {
  $first = [IO.File]::ReadAllText($configPath, [Text.Encoding]::UTF8)
  Start-Sleep -Seconds 1
  $second = [IO.File]::ReadAllText($configPath, [Text.Encoding]::UTF8)
  if ($first -ne $second) { throw '配置仍在写入' }
  try { return $second | ConvertFrom-Json } catch { throw 'qq_config.json 不是有效 JSON' }
}

function New-SyncPayload($config) {
  if ($null -eq $config.qq_backend -or $null -eq $config.official -or $null -eq $config.official.transport) {
    throw '缺少显式的 qq_backend 或 official.transport'
  }
  $backend = [string]$config.qq_backend
  $transport = [string]$config.official.transport
  if ($backend -notin @('official', 'llbot') -or $transport -notin @('websocket', 'webhook')) {
    throw 'qq_backend 或 official.transport 无效'
  }
  if ($backend -ne 'official' -or $config.qq_enabled -eq $false -or $transport -ne 'webhook') {
    return [ordered]@{ mode = 'websocket' }
  }
  if ([string]::IsNullOrWhiteSpace($config.official.app_id) -or
      [string]::IsNullOrWhiteSpace($config.official.app_secret)) {
    throw 'official.app_id 或 official.app_secret 未配置'
  }
  if (($null -ne $config.official.webhook.port -and [int]$config.official.webhook.port -ne 3005) -or
      ($null -ne $config.official.webhook.path -and $config.official.webhook.path -ne '/qqbot/webhook')) {
    throw '当前阿里云反向代理固定使用 3005 和 /qqbot/webhook'
  }
  $publicServer = $config.public_server
  $publicPort = if ($null -ne $publicServer -and $null -ne $publicServer.port) { [int]$publicServer.port } else { 19132 }
  $shared = [ordered]@{
    official = [ordered]@{
      app_id = [string]$config.official.app_id
      app_secret = [string]$config.official.app_secret
      sandbox = ($config.official.sandbox -eq $true)
      group_openid = [string]$config.official.group_openid
      admin_openids = @($config.official.admin_openids | Where-Object { $null -ne $_ })
      sync_menu_panel = ($config.official.sync_menu_panel -ne $false)
    }
    public_server = [ordered]@{
      address = [string]$publicServer.address
      port = $publicPort
      version = [string]$publicServer.version
    }
  }
  return [ordered]@{ mode = 'webhook'; shared = $shared }
}

try {
  $lastSuccess = ''
  $hadError = $false
  while ($true) {
    try {
      $payload = New-SyncPayload (Read-StableConfig)
      $json = ConvertTo-Json -InputObject $payload -Depth 8 -Compress
      $bytes = [Text.Encoding]::UTF8.GetBytes($json)
      $sha = [Security.Cryptography.SHA256]::Create()
      try { $fingerprint = [Convert]::ToBase64String($sha.ComputeHash($bytes)) } finally { $sha.Dispose() }
      if ($fingerprint -ne $lastSuccess) {
        $previousErrorPreference = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
          $json | & 'C:\Windows\System32\OpenSSH\ssh.exe' -T `
            -o BatchMode=yes -o ConnectTimeout=10 aliyun `
            'flock -w 30 /run/lock/sfmc-qq-config-sync.lock node /opt/sfmc-qq-bridge/deploy/sync-qq-config.mjs' 2>&1 | Out-Null
          $result = $LASTEXITCODE
        } finally {
          $ErrorActionPreference = $previousErrorPreference
        }
        if ($result -ne 0) { throw "阿里云同步失败（SSH 退出码 $result）" }
        $lastSuccess = $fingerprint
        Write-SyncLog "云端同步成功（mode=$($payload.mode)）"
      }
    } catch {
      # 异常可能包含解析位置，日志只记录固定原因，避免泄露配置内容。
      $hadError = $true
      Write-SyncLog '本轮未同步；请检查 QQ 配置、SSH 连接和阿里云服务状态'
    }
    if ($Once) { break }
    Start-Sleep -Seconds 30
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
if ($Once -and $hadError) { exit 1 }
