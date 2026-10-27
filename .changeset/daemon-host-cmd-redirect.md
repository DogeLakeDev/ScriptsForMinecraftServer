---
"@sfmc-bds/cli": patch
---

修复 Windows 守护进程外壳在守护进程第一次输出时崩溃、连带整个实例停服的问题：改由 cmd.exe 把输出追加到 daemon.log，不再使用 PowerShell 脚本块回调。
