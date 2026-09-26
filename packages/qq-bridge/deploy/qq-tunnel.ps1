# 游戏机主动连接阿里云，只在云机回环地址暴露 db-server 转发端口。
$logPath = Join-Path $PSScriptRoot 'qq-tunnel.log'

while ($true) {
  if ((Test-Path -LiteralPath $logPath) -and (Get-Item -LiteralPath $logPath).Length -gt 1048576) {
    Clear-Content -LiteralPath $logPath
  }
  "$(Get-Date -Format o) 尝试建立 QQ 反向隧道" | Add-Content -LiteralPath $logPath
  & 'C:\Windows\System32\OpenSSH\ssh.exe' -N -T `
    -o BatchMode=yes -o ConnectTimeout=10 -o ExitOnForwardFailure=yes `
    -o ServerAliveInterval=30 -o ServerAliveCountMax=3 `
    -R 127.0.0.1:13001:127.0.0.1:3001 aliyun 2>> $logPath
  "$(Get-Date -Format o) SSH 退出，代码 $LASTEXITCODE" | Add-Content -LiteralPath $logPath
  Start-Sleep -Seconds 5
}
