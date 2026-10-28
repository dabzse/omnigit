# @dabzse/omnigit-notepadplusplus — OmniGit for Notepad++

> Universal Git Graph visualization and GitLens-style productivity plugin for **Notepad++** (x64 / x86).

---

## ⚡ Features

- **Scintilla Line Annotations**: Renders inline commit author, date, and hash right next to lines (`SCI_ANNOTATIONSETTEXT`).
- **Interactive Git Graph**: Command **Plugins → OmniGit → Show Git Graph** launches the full OmniGit webview interface.
- **Dockable Window Interface**: Supports embedding Microsoft WebView2 inside a dockable Notepad++ window.
- **Commands**:
  - `OmniGit: Show Git Graph` (`Ctrl+Alt+G`)
  - `OmniGit: Toggle Inline Blame`

---

## 🛠️ Building & Installing

1. Open `NppOmniGit.vcxproj` in Visual Studio.
2. Build `Release|x64`.
3. Copy `NppOmniGit.dll` to:
   `%ProgramFiles%\Notepad++\plugins\NppOmniGit\NppOmniGit.dll`
4. Restart Notepad++.
