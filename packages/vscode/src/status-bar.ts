// ============================================================
// OmniGit VS Code — Status Bar Items
//
// Shows branch info, sync status, and quick actions in the
// VS Code status bar.
// ============================================================

import * as vscode from 'vscode';
import { GitExecutor, getRepoStatus } from '@dabzse/omnigit-core';
import type { RepoStatus } from '@dabzse/omnigit-core';

export class GitStatusBar implements vscode.Disposable {
  private readonly branchItem: vscode.StatusBarItem;
  private readonly syncItem: vscode.StatusBarItem;
  private readonly changesItem: vscode.StatusBarItem;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly updateTimer: ReturnType<typeof setInterval> | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(_context: vscode.ExtensionContext) {
    // Branch indicator (leftmost)
    this.branchItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      1000,
    );
    this.branchItem.command = 'omnigit.showGraph';
    this.branchItem.tooltip = 'OmniGit: Show Git Graph';

    // Sync status (ahead/behind)
    this.syncItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      999,
    );
    this.syncItem.tooltip = 'OmniGit: Sync Status';

    // Changes count
    this.changesItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      998,
    );
    this.changesItem.command = 'omnigit.showGraph';
    this.changesItem.tooltip = 'OmniGit: Working Changes';

    // Watch for git changes
    const fsWatcher = vscode.workspace.createFileSystemWatcher('**/.git/**');
    fsWatcher.onDidChange(() => this.scheduleUpdate());
    fsWatcher.onDidCreate(() => this.scheduleUpdate());
    fsWatcher.onDidDelete(() => this.scheduleUpdate());

    // Register watchers together
    this.disposables.push(
      fsWatcher,
      vscode.window.onDidChangeActiveTextEditor(() => this.scheduleUpdate()),
      vscode.workspace.onDidSaveTextDocument(() => this.scheduleUpdate()),
    );

    // Initial update scheduled synchronously
    this.scheduleUpdate();

    // Periodic refresh (every 30s)
    this.updateTimer = setInterval(() => {
      void this.updateStatus();
    }, 30_000);
  }

  private scheduleUpdate(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      void this.updateStatus();
    }, 500);
  }

  private async updateStatus(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      this.hideAll();
      return;
    }

    const cwd = workspaceFolders[0].uri.fsPath;
    const git = new GitExecutor({ cwd });

    try {
      const isRepo = await git.isGitRepo();
      if (!isRepo) {
        this.hideAll();
        return;
      }

      const status = await getRepoStatus(git);
      this.renderBranch(status);
      this.renderSync(status);
      this.renderChanges(status);
    } catch {
      this.hideAll();
    }
  }

  private renderBranch(status: RepoStatus): void {
    if (status.currentBranch) {
      let icon = '$(git-branch)';
      if (status.merging) icon = '$(git-merge)';
      else if (status.rebasing) icon = '$(git-pull-request)';
      else if (status.cherryPicking) icon = '$(git-commit)';

      this.branchItem.text = `${icon} ${status.currentBranch}`;
    } else if (status.detachedHead) {
      this.branchItem.text = '$(git-branch) (detached)';
    } else {
      this.branchItem.text = '$(git-branch) —';
    }

    this.branchItem.show();
  }

  private renderSync(status: RepoStatus): void {
    if (status.ahead === 0 && status.behind === 0) {
      this.syncItem.hide();
      return;
    }

    const parts: string[] = [];
    if (status.ahead > 0) parts.push(`$(arrow-up) ${status.ahead}`);
    if (status.behind > 0) parts.push(`$(arrow-down) ${status.behind}`);

    this.syncItem.text = parts.join(' ');
    this.syncItem.tooltip = `${status.ahead} ahead, ${status.behind} behind upstream`;
    this.syncItem.show();
  }

  private renderChanges(status: RepoStatus): void {
    const totalChanges =
      status.staged.length +
      status.unstaged.length +
      status.untracked.length;

    if (totalChanges === 0) {
      this.changesItem.hide();
      return;
    }

    const parts: string[] = [];
    if (status.staged.length > 0) parts.push(`+${status.staged.length}`);
    if (status.unstaged.length > 0) parts.push(`~${status.unstaged.length}`);
    if (status.untracked.length > 0) parts.push(`?${status.untracked.length}`);

    this.changesItem.text = `$(diff) ${parts.join(' ')}`;
    this.changesItem.tooltip =
      `${status.staged.length} staged, ` +
      `${status.unstaged.length} modified, ` +
      `${status.untracked.length} untracked`;
    this.changesItem.show();
  }

  private hideAll(): void {
    this.branchItem.hide();
    this.syncItem.hide();
    this.changesItem.hide();
  }

  dispose(): void {
    if (this.updateTimer) clearInterval(this.updateTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.branchItem.dispose();
    this.syncItem.dispose();
    this.changesItem.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
