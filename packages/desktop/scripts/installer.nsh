!macro customInstall
  FileOpen $0 "$INSTDIR\installed.json" w
  FileWrite $0 '{"installed":true}'
  FileClose $0
!macroend
!macro customUnInstall
  Delete "$INSTDIR\installed.json"
!macroend
