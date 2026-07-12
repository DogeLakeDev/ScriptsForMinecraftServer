$vsBase = "C:\Program Files\Microsoft Visual Studio\18\Community\VC\Tools\MSVC\14.51.36231"
$sdkBase = "C:\Program Files (x86)\Windows Kits\10\Lib\10.0.26100.0"

$env:LIB = "$vsBase\lib\onecore\x64;$sdkBase\um\x64;$sdkBase\ucrt\x64"

Write-Host "LIB=$env:LIB"
Write-Host "Building bds-panel..."

$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"
cargo build @args
