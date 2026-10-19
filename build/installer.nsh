!macro customInstall
  ; Clean up the stale uninstall entry left by older ClipPick packaging identity.
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\dacafee5-c0a8-56d6-9ecf-afc86bfd5d34"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\dacafee5-c0a8-56d6-9ecf-afc86bfd5d34"
  DeleteRegKey HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\dacafee5-c0a8-56d6-9ecf-afc86bfd5d34"

  ; Recreate shortcuts with the packaged icon file because executable resource editing is disabled.
  ${if} ${FileExists} "$INSTDIR\resources\resources\icon.ico"
    ${if} ${FileExists} "$newDesktopLink"
      Delete "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${endIf}

    ${if} ${FileExists} "$newStartMenuLink"
      Delete "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${endIf}

    System::Call 'Shell32::SHChangeNotify(i 0x8000000, i 0, i 0, i 0)'
  ${endIf}
!macroend
