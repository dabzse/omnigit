// ============================================================
// OmniGit VS Code Extension — Main Activation
// ============================================================

import * as vscode from 'vscode';
import { GitGraphPanel } from './webview-provider';
import { BlameDecorationProvider } from './blame-decoration';
import { GitHoverProvider } from './hover-provider';
import { GitCodeLensProvider } from './codelens-provider';
import { GitStatusBar } from './status-bar';
import { registerCommands } from './commands';

export function activate(context: vscode.ExtensionContext): void {
  console.log('[OmniGit] Activating extension...');

  // Check for git repos in workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    console.log('[OmniGit] No workspace folders found');
    return;
  }

  // Initialize providers
  const blameProvider = new BlameDecorationProvider(context);
  const hoverProvider = new GitHoverProvider(context);
  const codeLensProvider = new GitCodeLensProvider(context);
  const statusBar = new GitStatusBar(context);

  // Register all commands
  registerCommands(context, blameProvider);

  // Register disposables
  context.subscriptions.push(
    blameProvider,
    hoverProvider,
    codeLensProvider,
    statusBar,
  );

  // Register the webview panel serializer for state persistence
  vscode.window.registerWebviewPanelSerializer(
    GitGraphPanel.viewType,
    {
      deserializeWebviewPanel(panel: vscode.WebviewPanel, _state: unknown): Promise<void> {
        GitGraphPanel.revive(panel, context);
        return Promise.resolve();
      },
    },
  );

  console.log('[OmniGit] Extension activated');
}

export function deactivate(): void {
  console.log('[OmniGit] Extension deactivated');
}
