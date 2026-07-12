$root = $PSScriptRoot

wt -w 0 nt -d "D:\Minecraft\BEServer" cmd /k start.bat
wt -w 0 nt -d "$root\db-server" cmd /k node index.js
wt -w 0 nt -d "$root\scriptsforminecraftserver" cmd /k npm run local-deploy -- --watch

Write-Host ""
Write-Host "Development environment started." -ForegroundColor Green
Write-Host "  Tab 1 (current): $root — opencode" -ForegroundColor Cyan
Write-Host "  Tab 2: D:\Minecraft\BEServer — BDS server (start.bat)" -ForegroundColor Cyan
Write-Host "  Tab 3: $root\db-server — node index.js (port 3001) + QQ bridge" -ForegroundColor Cyan
Write-Host "  Tab 4: $root\scriptsforminecraftserver — npm run local-deploy --watch" -ForegroundColor Cyan
Write-Host "  [QQ Bridge] Set QQ_GROUP_ID and BRIDGE_CHANNEL_ID env vars to enable" -ForegroundColor Magenta
Write-Host ""
