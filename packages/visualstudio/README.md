# @dabzse/omnigit-visualstudio — OmniGit for Visual Studio

> Universal Git Graph visualization, commit history inspection, partial staging, visual interactive rebase, and inline editor blame annotations for Microsoft Visual Studio.

---

## 💻 Supported Visual Studio Editions & Versions

OmniGit provides first-class support for:

- **Visual Studio Community** (and upward: **Professional** & **Enterprise**)
- **Visual Studio 2022** (v17.0+ — 64-bit `amd64`)
- **Visual Studio 2019** (v16.0 — 32-bit `x86`)
- **Visual Studio 2017** (v15.0+ — 32-bit `x86`)

---

## 🏗️ Architecture

```text
OmniGit.VisualStudio/
├── OmniGitPackage.cs              # AsyncPackage entrypoint & command registration
├── OmniGitPackage.vsct            # Visual Studio Command Table (Menus & Shortcuts)
├── source.extension.vsixmanifest  # VSIX Manifest targeting VS 2017/2019/2022 (x86 & amd64)
├── ToolWindows/
│   ├── GitGraphToolWindow.cs          # ToolWindowPane hosting WPF control
│   ├── GitGraphToolWindowControl.xaml # WPF XAML hosting Microsoft.Web.WebView2
│   └── GitGraphToolWindowControl.xaml.cs # WebView2 lifecycle & message routing
├── Git/
│   ├── GitBridge.cs                   # Asynchronous Git CLI bridge & JSON dispatcher
│   ├── GitModels.cs                   # Strongly-typed Git models & message contracts
│   └── GitProcess.cs                  # UTF-8 process execution wrapper
└── Editor/
    ├── BlameMargin.cs                 # IWpfTextViewMargin for inline GitLens blame
    └── BlameMarginFactory.cs          # MEF provider for Visual Studio text editors
```

---

## ⚡ Features in Visual Studio

1. **Interactive Git Graph Tool Window**:
   - Access via **View → Other Windows → OmniGit Git Graph** or keyboard shortcut `Ctrl+Alt+G`.
   - Embeds the shared `@dabzse/omnigit-webview-ui` using Microsoft WebView2 (Evergreen runtime).
   - Topological swimlane graph layout, bezier curves, commit author avatars, and branch/tag badges.
2. **Repository Management & Actions**:
   - Checkout branches or commit hashes.
   - Fast-forward, merge, cherry-pick, and revert.
   - Stash manager: list, inspect diffs, push, apply, pop, and drop.
   - Interactive rebase assistant: visual reorder, squash, edit, drop, and fixup commits.
3. **Partial Staging & Diff Inspection**:
   - Split & unified diff viewer with file, hunk, and individual line staging.
4. **Editor Inline Blame (GitLens Style)**:
   - MEF `IWpfTextViewMargin` attached to the editor gutter.
   - Displays commit hash, author name, and relative timestamp (`3d`, `2mo`, `1y`) for lines.
   - Toggle on/off via the **View → Toggle OmniGit File Blame** command.

---

## 🚀 Building & Developing

### Prerequisites

- Visual Studio 2017 (15.8+), 2019, or 2022 with **Visual Studio extension development** workload installed.
- Microsoft Edge WebView2 Evergreen Runtime.
- Git CLI (2.20+) on your system `PATH`.

### Build VSIX Package

```powershell
# Restore NuGet dependencies
nuget restore OmniGit.sln

# Build Release VSIX
msbuild OmniGit.sln /p:Configuration=Release
```

The output VSIX file will be generated at:
`OmniGit.VisualStudio\bin\Release\OmniGit.VisualStudio.vsix`

### Live Development with Vite Hot Reload

1. In `packages/webview-ui`, start the dev server:

   ```bash
   npm run dev
   ```

   (Runs on `http://localhost:5173`)
2. Open `OmniGit.sln` in Visual Studio and press `F5` to start the Experimental Instance.
3. Open any Git solution in the experimental instance and open the OmniGit window (`Ctrl+Alt+G`).
4. The WebView2 control automatically connects to `http://localhost:5173` with instant hot module replacement!
