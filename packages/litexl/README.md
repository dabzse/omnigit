# @dabzse/omnigit-litexl — OmniGit for Lite-XL

> Universal Git Graph visualization and GitLens-style productivity plugin for the lightweight **Lite-XL** editor.

---

## ⚡ Features

- **Inline GitLens-Style Blame**: Draws commit hash, author name, and summary directly on the line text using Lite-XL's custom renderer.
- **Interactive Git Graph**: Command `omnigit:show-graph` (`Ctrl+Alt+G`) launches the OmniGit webview interface.
- **Commands & Keybindings**:
  - `Ctrl+Alt+G`: `omnigit:show-graph`
  - `Ctrl+Alt+B`: `omnigit:toggle-blame`
  - `omnigit:refresh-blame`: Re-scans Git blame for the current document.

---

## 📦 Installation

Copy `packages/litexl/init.lua` into your Lite-XL plugins folder:

- **Linux**: `~/.config/lite-xl/plugins/omnigit.lua`
- **macOS**: `~/.config/lite-xl/plugins/omnigit.lua`
- **Windows**: `%USERPROFILE%\.config\lite-xl\plugins\omnigit.lua`
