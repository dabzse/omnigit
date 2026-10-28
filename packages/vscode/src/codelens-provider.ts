// ============================================================
// OmniGit VS Code — CodeLens Provider
//
// Shows "N authors, last changed X ago" annotations above
// functions, classes, and other symbol definitions.
// ============================================================

import * as vscode from 'vscode';
import { GitExecutor, getBlame } from '@dabzse/omnigit-core';
import type { BlameResult, BlameLine } from '@dabzse/omnigit-core';

export class GitCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
  private readonly blameCache = new Map<string, BlameResult>();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(_context: vscode.ExtensionContext) {
    // Register as CodeLens provider and refresh on save
    this.disposables.push(
      vscode.languages.registerCodeLensProvider(
        { scheme: 'file' },
        this,
      ),
      vscode.workspace.onDidSaveTextDocument((doc) => {
        this.blameCache.delete(doc.uri.fsPath);
        this._onDidChangeCodeLenses.fire();
      }),
    );
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CodeLens[]> {
    const enabled = vscode.workspace.getConfiguration('omnigit.codelens').get('enabled', true);
    if (!enabled) return [];

    if (document.uri.scheme !== 'file') return [];
    if (document.isUntitled) return [];

    const cwd = vscode.workspace.getWorkspaceFolder(document.uri)?.uri.fsPath;
    if (!cwd) return [];

    try {
      // Get document symbols (functions, classes, etc.)
      const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri,
      );

      if (!symbols || symbols.length === 0) return [];

      // Get blame data
      let blame = this.blameCache.get(document.uri.fsPath);
      if (!blame) {
        const git = new GitExecutor({ cwd });
        const relativePath = document.uri.fsPath
          .replace(cwd + '/', '')
          .replace(cwd + '\\', '');
        blame = await getBlame(git, relativePath);
        this.blameCache.set(document.uri.fsPath, blame);
      }

      // Build CodeLens for top-level symbols
      const lenses: vscode.CodeLens[] = [];
      const interestingKinds = new Set([
        vscode.SymbolKind.Function,
        vscode.SymbolKind.Method,
        vscode.SymbolKind.Class,
        vscode.SymbolKind.Interface,
        vscode.SymbolKind.Module,
        vscode.SymbolKind.Constructor,
      ]);

      this.collectLenses(symbols, blame, lenses, interestingKinds);

      return lenses;
    } catch {
      return [];
    }
  }

  private collectLenses(
    symbols: vscode.DocumentSymbol[],
    blame: BlameResult,
    lenses: vscode.CodeLens[],
    interestingKinds: Set<vscode.SymbolKind>,
  ): void {
    for (const symbol of symbols) {
      if (interestingKinds.has(symbol.kind)) {
        const startLine = symbol.range.start.line + 1;
        const endLine = symbol.range.end.line + 1;

        // Find blame lines in this range
        const blameLines = blame.lines.filter(
          (l) => l.currentLine >= startLine && l.currentLine <= endLine,
        );

        if (blameLines.length > 0) {
          const lens = this.createCodeLens(symbol, blameLines);
          if (lens) lenses.push(lens);
        }
      }

      // Recurse into children (methods inside classes, etc.)
      if (symbol.children.length > 0) {
        this.collectLenses(symbol.children, blame, lenses, interestingKinds);
      }
    }
  }

  private createCodeLens(
    symbol: vscode.DocumentSymbol,
    blameLines: BlameLine[],
  ): vscode.CodeLens | null {
    // Count unique authors
    const authors = new Set(blameLines.map((l) => l.author.email));

    // Find most recent change
    let mostRecent = 0;
    for (const line of blameLines) {
      if (line.authorDate > mostRecent) {
        mostRecent = line.authorDate;
      }
    }

    if (mostRecent === 0) return null;

    const authorCount = authors.size;
    const authorText = authorCount === 1
      ? `1 author`
      : `${authorCount} authors`;
    const dateText = formatRelativeDate(mostRecent);

    return new vscode.CodeLens(
      symbol.range,
      {
        title: `$(person) ${authorText}, $(clock) ${dateText}`,
        tooltip: `${authorText} modified this ${symbol.kind === vscode.SymbolKind.Class ? 'class' : 'function'}\nLast change: ${new Date(mostRecent * 1000).toLocaleString()}`,
        command: 'omnigit.showGraph',
      },
    );
  }

  resolveCodeLens(
    codeLens: vscode.CodeLens,
    _token: vscode.CancellationToken,
  ): vscode.CodeLens {
    return codeLens;
  }

  dispose(): void {
    this._onDidChangeCodeLenses.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function formatRelativeDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}
