// ============================================================
// OmniGit VS Code — Command Registrations
// ============================================================

import * as vscode from 'vscode';
import { GitGraphPanel } from './webview-provider';
import type { BlameDecorationProvider } from './blame-decoration';

export function registerCommands(
  context: vscode.ExtensionContext,
  blameProvider: BlameDecorationProvider,
): void {
  // Register all commands in a single subscriptions.push
  context.subscriptions.push(
    // Show Git Graph
    vscode.commands.registerCommand('omnigit.showGraph', () => {
      GitGraphPanel.createOrShow(context);
    }),

    // Toggle Inline Blame
    vscode.commands.registerCommand('omnigit.toggleBlame', () => {
      blameProvider.toggle();
    }),

    // Show File History
    vscode.commands.registerCommand('omnigit.showFileHistory', (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (targetUri?.scheme !== 'file') {
        vscode.window.showWarningMessage('No active file to show history for');
        return;
      }

      const cwd = vscode.workspace.getWorkspaceFolder(targetUri)?.uri.fsPath;
      const relativePath = cwd
        ? targetUri.fsPath.replace(cwd + '/', '').replace(cwd + '\\', '')
        : targetUri.fsPath;

      GitGraphPanel.showFileHistory(context, relativePath);
    }),

    // Copy Commit Hash (used in hover card links)
    vscode.commands.registerCommand('omnigit.copyHash', async (hash?: string) => {
      if (hash) {
        await vscode.env.clipboard.writeText(hash);
        vscode.window.showInformationMessage(`Copied commit hash: ${hash.slice(0, 7)}`);
      }
    }),

    // Refresh
    vscode.commands.registerCommand('omnigit.refresh', () => {
      GitGraphPanel.createOrShow(context);
    }),
  );
}
