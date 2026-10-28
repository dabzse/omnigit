# OmniGit — Universal Git History & Graph Plugin

> A high-performance, unified Git graph visualization and GitLens-style productivity tool designed to deliver an identical, first-class Git experience across all major code editors and IDEs.

---

## Supported Editors & Platforms

| Platform / Editor                                     | Adapter Technology                   | Status | Key Features                                                             |
| :---------------------------------------------------- | :----------------------------------- | :----- | :----------------------------------------------------------------------- |
| **VSCodium / Devin / Cursor / Antigravity / VS Code** | TypeScript (Extension & Webview API) | Ready  | Full Git Graph, inline blame, hover cards, CodeLens, status bar sync     |
| **JetBrains IDEs** (IntelliJ, PyCharm, RustRover...)  | Kotlin (JCEF Webview + Java Bridge)  | Ready  | Dockable tool window, JCEF webview, gutter blame annotations, actions    |
| **Visual Studio** (2017, 2019, 2022+)                 | C# / WPF (WebView2 + MEF Margin)     | Ready  | View window, IWpfTextViewMargin inline blame, full Git CLI bridge        |
| **Zed**                                               | Rust (Wasm Extension API)            | Ready  | Extension manifest and Git CLI commands                                  |
| **Eclipse**                                           | Java (SWT Browser + Tycho Maven)     | Ready  | ViewPart with SWT Browser, gutter annotation model, Git bridge           |
| **Sublime Text** (3 & 4)                              | Python                               | Ready  | `minihtml` inline blame phantoms, command palette, shortcut `Ctrl+Alt+G` |
| **Notepad++**                                         | C++ (Win32 Native Plugin)            | Ready  | Scintilla line annotations, dockable WebView2 host window                |
| **Lapce**                                             | Rust (WASI WebAssembly Plugin)       | Ready  | WASI plugin, command palette integration, shared webview                 |
| **Lite-XL**                                           | Lua                                  | Ready  | Inline renderer blame decorations, docview hooks, command palette        |

---

## Key Features

- **Interactive SVG Git Graph**:
  - Topological branch lanes with bezier curve routing.
  - Virtualized row rendering for smooth performance on repositories with 10,000+ commits.
  - Commit detail pane with affected files, insertions, deletions, and stats.

- **GitLens-Style Code Intelligence**:
  - Non-intrusive inline blame annotations showing commit author, relative date, and subject.
  - Gutter commit heatmaps showing code age.
  - Rich hover details and CodeLens authors breakdown.

- **Diffs & Partial Staging**:
  - Side-by-side and unified diff viewer.
  - Granular staging: stage individual files, single hunks, or selected lines.

- **Visual Interactive Rebase**:
  - Drag-and-drop commit reordering modal.
  - Pick, reword, edit, squash, fixup, and drop actions with one click.

- **Stash & Branch Management**:
  - Visual stash list with instant patch inspection, apply, pop, and drop.
  - Branch and tag CRUD operations (create, checkout, delete, switch).

- **Contributors Analytics & Search**:
  - Author commit contribution bars and statistics.
  - Instant commit filter by message, hash, author, or branch.

---

## Monorepo Architecture

This repository is organized as a monorepo powered by **pnpm workspaces**:

```text
git-plugin/
├── packages/
│   ├── core/                  # @dabzse/omnigit-core — Shared TypeScript Git CLI engine
│   ├── webview-ui/            # @dabzse/omnigit-webview-ui — Shared SVG graph and webview frontend (Vite)
│   ├── vscode/                # VS Code extension (TypeScript)
│   ├── jetbrains/             # JetBrains IDE plugin (Kotlin, JCEF)
│   ├── eclipse/               # Eclipse plugin (Java, SWT Browser)
│   ├── visualstudio/          # Visual Studio extension (C#, WPF, WebView2)
│   ├── sublimetext/           # Sublime Text package (Python)
│   ├── notepadplusplus/       # Notepad++ native plugin (C++)
│   ├── lapce/                 # Lapce editor extension (Rust / WASI)
│   ├── litexl/                # Lite-XL editor plugin (Lua)
│   └── zed/                   # Zed editor extension (Rust / Wasm)
├── package.json               # Root workspace manifest
├── pnpm-workspace.yaml        # Workspace configuration
└── tsconfig.base.json         # Base TypeScript configuration
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) `>= 20.0.0`
- [pnpm](https://pnpm.io/) `>= 9.0.0`
- System `git` CLI installed and available in `PATH`

### Installation

Clone the repository and install workspace dependencies:

```bash
git clone https://github.com/dabzse/omnigit.git
cd omnigit
pnpm install
```

### Development & Build Commands

- **Build shared core engine**:

  ```bash
  pnpm --filter @dabzse/omnigit-core build
  ```

- **Run core test suite**:

  ```bash
  pnpm --filter @dabzse/omnigit-core test
  ```

- **Run standalone webview development server**:

  ```bash
  pnpm --filter @dabzse/omnigit-webview-ui dev
  ```

  *(Opens the SVG graph with mock data on `http://localhost:5173`)*

- **Build webview production bundle**:

  ```bash
  pnpm --filter @dabzse/omnigit-webview-ui build
  ```

- **Build VS Code extension**:

  ```bash
  pnpm --filter omnigit-vscode build
  ```

---

## Author & Contact

- **Author**: Mihaly Nyilas ([@dabzse](https://github.com/dabzse))
- **Repository**: [https://github.com/dabzse/omnigit](https://github.com/dabzse/omnigit)
- **Issues & Discussions**: [https://github.com/dabzse/omnigit/issues](https://github.com/dabzse/omnigit/issues)

---

## License

This project is licensed under the [MIT License](LICENSE).
