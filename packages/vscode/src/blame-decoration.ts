// ============================================================
// OmniGit VS Code — Inline Blame Decorations
//
// Shows "who changed this line & when" annotations in the
// editor gutter, similar to GitLens.
// ============================================================

import * as vscode from 'vscode';
import { GitExecutor, getBlame } from '@dabzse/omnigit-core';
import type { BlameResult } from '@dabzse/omnigit-core';

export class BlameDecorationProvider implements vscode.Disposable {
  private enabled = true;
  private readonly decorationType: vscode.TextEditorDecorationType;
  private readonly heatmapDecorationType: vscode.TextEditorDecorationType;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly blameCache = new Map<string, BlameResult>();
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Create the blame decoration type
    this.decorationType = vscode.window.createTextEditorDecorationType({
      after: {
        margin: '0 0 0 3em',
        color: new vscode.ThemeColor('editorCodeLens.foreground'),
      },
      isWholeLine: true,
    });

    // Heatmap gutter decoration
    this.heatmapDecorationType = vscode.window.createTextEditorDecorationType({
      isWholeLine: true,
    });

    // Read config
    this.enabled = vscode.workspace.getConfiguration('omnigit.blame').get('enabled', true);

    // Register event listeners
    this.disposables.push(
      // Listen for active editor changes
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) this.scheduleUpdate(editor);
      }),

      // Listen for cursor movement (update current line blame)
      vscode.window.onDidChangeTextEditorSelection((e) => {
        this.scheduleUpdate(e.textEditor);
      }),

      // Listen for document saves (invalidate cache)
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.blameCache.delete(doc.uri.fsPath);
        const editor = vscode.window.activeTextEditor;
        if (editor?.document.uri.fsPath === doc.uri.fsPath) {
          this.scheduleUpdate(editor);
        }
      }),

      // Listen for config changes
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('omnigit.blame')) {
          this.enabled = vscode.workspace.getConfiguration('omnigit.blame').get('enabled', true);
          const editor = vscode.window.activeTextEditor;
          if (editor) {
            if (this.enabled) {
              this.scheduleUpdate(editor);
            } else {
              this.clearDecorations(editor);
            }
          }
        }
      }),
    );

    // Initial decoration for current editor
    if (vscode.window.activeTextEditor) {
      this.scheduleUpdate(vscode.window.activeTextEditor);
    }
  }

  /**
   * Toggle blame annotations on/off.
   */
  public toggle(): void {
    this.enabled = !this.enabled;

    const editor = vscode.window.activeTextEditor;
    if (editor) {
      if (this.enabled) {
        this.scheduleUpdate(editor);
      } else {
        this.clearDecorations(editor);
      }
    }

    vscode.window.showInformationMessage(
      `OmniGit: Inline blame ${this.enabled ? 'enabled' : 'disabled'}`,
    );
  }

  /**
   * Schedule an update with debouncing to avoid excessive git calls.
   */
  private scheduleUpdate(editor: vscode.TextEditor): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      void this.updateDecorations(editor);
    }, 100);
  }

  /**
   * Update blame decorations for the active editor.
   */
  private async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    if (!this.enabled) return;

    const doc = editor.document;

    // Only blame tracked files
    if (doc.uri.scheme !== 'file') return;
    if (doc.isUntitled) return;

    const filePath = doc.uri.fsPath;
    const cwd = vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath;
    if (!cwd) return;

    try {
      // Get or cache blame
      let blame = this.blameCache.get(filePath);
      if (!blame) {
        const git = new GitExecutor({ cwd });
        const relativePath = filePath.replace(cwd + '/', '').replace(cwd + '\\', '');
        blame = await getBlame(git, relativePath);
        this.blameCache.set(filePath, blame);
      }

      // Only show blame for the current line
      const cursorLine = editor.selection.active.line;
      const blameLine = blame.lines.find((l) => l.currentLine === cursorLine + 1);

      if (!blameLine) {
        this.clearDecorations(editor);
        return;
      }

      // Format the annotation
      const format = vscode.workspace.getConfiguration('omnigit.blame')
        .get('format', '${author}, ${date} • ${message}');

      const dateStr = formatRelativeDate(blameLine.authorDate);
      const text = format
        .replace('${author}', blameLine.author.name)
        .replace('${date}', dateStr)
        .replace('${message}', blameLine.subject)
        .replace('${hash}', blameLine.shortHash);

      // Apply decoration
      const decoration: vscode.DecorationOptions = {
        range: new vscode.Range(cursorLine, 0, cursorLine, 0),
        renderOptions: {
          after: {
            contentText: `  ${text}`,
            fontStyle: 'italic',
          },
        },
        hoverMessage: new vscode.MarkdownString(
          `**${blameLine.author.name}** — ${blameLine.shortHash}\n\n` +
          `${blameLine.subject}\n\n` +
          `_${new Date(blameLine.authorDate * 1000).toLocaleString()}_`,
        ),
      };

      editor.setDecorations(this.decorationType, [decoration]);

      // Heatmap: color gutter based on recency
      if (vscode.workspace.getConfiguration('omnigit.heatmap').get('enabled', true)) {
        this.updateHeatmap(editor, blame);
      }
    } catch {
      // Untracked or non-git files fail gracefully without rendering blame decorations
      this.clearDecorations(editor);
    }
  }

  /**
   * Apply heatmap coloring to the gutter based on commit recency.
   */
  private updateHeatmap(editor: vscode.TextEditor, blame: BlameResult): void {
    const now = Math.floor(Date.now() / 1000);
    const decorations: vscode.DecorationOptions[] = [];

    // Find date range for normalization
    let oldest = now;
    let newest = 0;
    for (const line of blame.lines) {
      oldest = Math.min(oldest, line.authorDate);
      newest = Math.max(newest, line.authorDate);
    }
    const range = newest - oldest || 1;

    for (const line of blame.lines) {
      // Normalize age to 0-1 (0 = oldest, 1 = newest)
      const age = (line.authorDate - oldest) / range;

      // Map to opacity: newer = more visible
      const opacity = 0.03 + age * 0.12;

      decorations.push({
        range: new vscode.Range(line.currentLine - 1, 0, line.currentLine - 1, 0),
        renderOptions: {
          before: {
            width: '4px',
            backgroundColor: `rgba(137, 180, 250, ${opacity})`,
          },
        },
      });
    }

    editor.setDecorations(this.heatmapDecorationType, decorations);
  }

  private clearDecorations(editor: vscode.TextEditor): void {
    editor.setDecorations(this.decorationType, []);
    editor.setDecorations(this.heatmapDecorationType, []);
  }

  dispose(): void {
    this.decorationType.dispose();
    this.heatmapDecorationType.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

function formatRelativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} months ago`;
  return `${Math.floor(diff / 31536000)} years ago`;
}
