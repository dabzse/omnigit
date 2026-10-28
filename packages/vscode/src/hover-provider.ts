// ============================================================
// OmniGit VS Code — Hover Provider
//
// Shows rich hover cards when hovering over blame annotations
// or source lines, displaying commit info, author, and date.
// ============================================================

import * as vscode from 'vscode';
import { GitExecutor, getBlame } from '@dabzse/omnigit-core';
import type { BlameResult } from '@dabzse/omnigit-core';

export class GitHoverProvider implements vscode.HoverProvider, vscode.Disposable {
  private readonly blameCache = new Map<string, BlameResult>();
  private readonly disposables: vscode.Disposable[] = [];

  constructor(_context: vscode.ExtensionContext) {
    // Register as hover provider and save watcher
    this.disposables.push(
      vscode.languages.registerHoverProvider(
        { scheme: 'file' },
        this,
      ),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.blameCache.delete(doc.uri.fsPath);
      }),
    );
  }

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    // Only provide hover if blame is enabled
    const enabled = vscode.workspace.getConfiguration('omnigit.blame').get('enabled', true);
    if (!enabled) return undefined;

    if (document.uri.scheme !== 'file') return undefined;
    if (document.isUntitled) return undefined;

    const filePath = document.uri.fsPath;
    const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!cwd) return undefined;

    try {
      // Get or cache blame
      let blame = this.blameCache.get(filePath);
      if (!blame) {
        const git = new GitExecutor({ cwd });
        const relativePath = filePath.replace(cwd + '/', '').replace(cwd + '\\', '');
        blame = await getBlame(git, relativePath);
        this.blameCache.set(filePath, blame);
      }

      const line = position.line + 1; // Blame is 1-indexed
      const blameLine = blame.lines.find((l) => l.currentLine === line);
      if (!blameLine) return undefined;

      // Build rich markdown hover
      const md = new vscode.MarkdownString();
      md.isTrusted = true;
      md.supportHtml = true;

      const dateStr = new Date(blameLine.authorDate * 1000).toLocaleString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const relativeDate = formatRelativeDate(blameLine.authorDate);

      md.appendMarkdown(`### $(git-commit) ${blameLine.shortHash}\n\n`);
      md.appendMarkdown(`**${blameLine.author.name}** &lt;${blameLine.author.email}&gt;\n\n`);
      md.appendMarkdown(`$(calendar) ${dateStr} (${relativeDate})\n\n`);
      md.appendMarkdown(`---\n\n`);
      md.appendMarkdown(`${blameLine.subject}\n\n`);
      md.appendMarkdown(
        `[Show in Graph](command:omnigit.showGraph) · ` +
        `[Copy Hash](command:omnigit.copyHash?${encodeURIComponent(JSON.stringify(blameLine.hash))})`,
      );

      return new vscode.Hover(md, new vscode.Range(position.line, 0, position.line, Number.MAX_SAFE_INTEGER));
    } catch {
      return undefined;
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
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
