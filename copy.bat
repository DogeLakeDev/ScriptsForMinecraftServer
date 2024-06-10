@echo off

rmdir /s /q "C:\Users\Dell\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\ScriptsForMinecraftServer_BP"
xcopy /I /Q /s /e "D:\GitHub\ScriptsForMinecraftServer\ScriptsForMinecraftServer_BP" "C:\Users\Dell\AppData\Local\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\ScriptsForMinecraftServer_BP"
