# @dabzse/omnigit-lapce — OmniGit for Lapce

> Universal Git Graph visualization and GitLens-style productivity extension for the **Lapce** editor.

---

## ⚡ Features

- **Interactive Git Graph**: Command `OmniGit: Show Git Graph` launches the shared OmniGit webview UI.
- **GitLens Line Blame**: Toggle inline blame annotations for the current file.
- **Commands**:
  - `omnigit.show_graph`: Open interactive Git graph.
  - `omnigit.toggle_blame`: Toggle line blame decorations.

---

## 🛠️ Building

Compile to WebAssembly (`wasm32-wasip1`):

```bash
cargo build --target wasm32-wasip1 --release
```

Copy `target/wasm32-wasip1/release/omnigit_lapce.wasm` and `plugin.toml` to your Lapce plugins directory (`~/.local/share/lapce/plugins/`).
