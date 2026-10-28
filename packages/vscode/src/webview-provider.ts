// ============================================================
// OmniGit VS Code — Webview Panel Provider
//
// Manages the webview panel lifecycle and bridges messages
// between the webview UI and the git core engine.
// ============================================================

import * as vscode from 'vscode';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  GitExecutor,
  getLog,
  getCommitDiffStats,
  getBlame,
  getRepoStatus,
  listBranches,
  listTags,
  listStashes,
  getContributors,
  getFileDiff,
  checkout,
  createBranch,
  deleteBranch,
  createTag,
  deleteTag,
  cherryPick,
  revert,
  stashSave,
  stashApply,
  stashPop,
  stashDrop,
  getStashDiff,
  stageFile,
  unstageFile,
  stageHunkByIndex,
  unstageHunkByIndex,
  stageLinesByIndex,
  unstageLinesByIndex,
  getRebasePlan,
  executeInteractiveRebase,
  rebaseContinue,
  rebaseAbort,
  getDiffStats,
  computeGraphLayout,
} from '@dabzse/omnigit-core';
import type { MessageFromWebview, MessageToWebview } from '@dabzse/omnigit-core';

export class GitGraphPanel {
  public static readonly viewType = 'omnigit.graphPanel';
  private static instance: GitGraphPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly git: GitExecutor;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ) {
    this.panel = panel;
    this.extensionUri = context.extensionUri;

    // Initialize git executor with the first workspace folder
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    this.git = new GitExecutor({ cwd });

    // Set webview HTML content
    this.panel.webview.html = this.getHtmlForWebview();

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message: MessageFromWebview) => {
        void this.handleMessage(message);
      },
      null,
      this.disposables,
    );

    // Handle panel disposal
    this.panel.onDidDispose(
      () => this.dispose(),
      null,
      this.disposables,
    );

    // Watch for workspace changes
    const fsWatcher = vscode.workspace.createFileSystemWatcher('**/.git/**');
    fsWatcher.onDidChange(() => this.onGitChange());
    fsWatcher.onDidCreate(() => this.onGitChange());
    fsWatcher.onDidDelete(() => this.onGitChange());
    this.disposables.push(fsWatcher);
  }

  /**
   * Create or show the git graph panel.
   */
  public static createOrShow(context: vscode.ExtensionContext): void {
    // If we already have a panel, show it
    if (GitGraphPanel.instance) {
      GitGraphPanel.instance.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    // Create a new panel
    const panel = vscode.window.createWebviewPanel(
      GitGraphPanel.viewType,
      'OmniGit',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'dist'),
          vscode.Uri.joinPath(context.extensionUri, '..', 'webview-ui', 'dist'),
        ],
      },
    );

    GitGraphPanel.instance = new GitGraphPanel(panel, context);
  }

  /**
   * Create or show panel and immediately request history for a file.
   */
  public static showFileHistory(context: vscode.ExtensionContext, filePath: string): void {
    GitGraphPanel.createOrShow(context);
    if (GitGraphPanel.instance) {
      void GitGraphPanel.instance.handleMessage({
        type: 'requestFileHistory',
        data: { filePath },
      });
    }
  }

  /**
   * Revive a serialized panel.
   */
  public static revive(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
  ): void {
    GitGraphPanel.instance = new GitGraphPanel(panel, context);
  }

  /**
   * Send a message to the webview.
   */
  private postMessage(message: MessageToWebview): void {
    this.panel.webview.postMessage(message);
  }

  /**
   * Handle messages from the webview.
   */
  /**
   * Handle messages from the webview.
   */
  private async handleMessage(message: MessageFromWebview): Promise<void> {
    try {
      const handled = await this.handleQueryMessage(message);
      if (!handled) {
        await this.handleActionMessage(message);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.postMessage({
        type: 'error',
        data: { message: errorMsg },
      });
      vscode.window.showErrorMessage(`OmniGit: ${errorMsg}`);
    }
  }

  private async handleQueryMessage(message: MessageFromWebview): Promise<boolean> {
    switch (message.type) {
      case 'requestCommits': {
        const commits = await getLog(this.git, message.data);
        const graphData = computeGraphLayout(commits);
        this.postMessage({ type: 'commits', data: commits });
        this.postMessage({ type: 'graphLayout', data: graphData });
        return true;
      }

      case 'requestCommitDetail': {
        const commits = await getLog(this.git, {
          maxCount: 1,
          refs: [message.data.hash],
          all: false,
        });
        const commit = commits[0];
        if (commit) {
          const files = await getCommitDiffStats(this.git, message.data.hash);
          this.postMessage({
            type: 'commitDetail',
            data: { commit, files },
          });
        }
        return true;
      }

      case 'requestBlame': {
        const result = await getBlame(
          this.git,
          message.data.filePath,
          message.data.startLine,
          message.data.endLine,
        );
        this.postMessage({ type: 'blame', data: result });
        return true;
      }

      case 'requestStatus': {
        const status = await getRepoStatus(this.git);
        this.postMessage({ type: 'status', data: status });
        return true;
      }

      case 'requestBranches': {
        const branches = await listBranches(this.git);
        this.postMessage({ type: 'branches', data: branches });
        return true;
      }

      case 'requestTags': {
        const tags = await listTags(this.git);
        this.postMessage({ type: 'tags', data: tags });
        return true;
      }

      case 'requestStashes': {
        const stashes = await listStashes(this.git);
        this.postMessage({ type: 'stashes', data: stashes });
        return true;
      }

      case 'requestContributors': {
        const contributors = await getContributors(this.git);
        this.postMessage({ type: 'contributors', data: contributors });
        return true;
      }

      case 'requestFileHistory': {
        const commits = await getLog(this.git, {
          filePath: message.data.filePath,
          maxCount: 100,
        });
        this.postMessage({
          type: 'fileHistory',
          data: { filePath: message.data.filePath, commits },
        });
        return true;
      }

      case 'requestFileDiff': {
        const diff = await getFileDiff(this.git, message.data.hash, message.data.filePath);
        if (diff) {
          this.postMessage({ type: 'fileDiff', data: diff });
        }
        return true;
      }

      case 'viewStashDiff': {
        const diffs = await getStashDiff(this.git, message.data.index);
        this.postMessage({ type: 'stashDiff', data: { index: message.data.index, diffs } });
        return true;
      }

      case 'requestRebasePlan': {
        const plan = await getRebasePlan(this.git, message.data.upstream);
        this.postMessage({ type: 'rebasePlan', data: plan });
        return true;
      }

      case 'requestCompareCommits': {
        const files = await getDiffStats(this.git, `${message.data.base}..${message.data.target}`);
        this.postMessage({
          type: 'commitComparison',
          data: {
            base: message.data.base,
            target: message.data.target,
            files,
          },
        });
        return true;
      }

      default:
        return false;
    }
  }

  private async handleActionMessage(message: MessageFromWebview): Promise<void> {
    switch (message.type) {
      case 'checkoutBranch':
        await checkout(this.git, message.data.name);
        vscode.window.showInformationMessage(`Checked out: ${message.data.name}`);
        break;

      case 'createBranch':
        await createBranch(this.git, message.data.name, message.data.startPoint);
        vscode.window.showInformationMessage(`Branch created: ${message.data.name}`);
        break;

      case 'deleteBranch':
        await deleteBranch(this.git, message.data.name, message.data.force);
        vscode.window.showInformationMessage(`Branch deleted: ${message.data.name}`);
        break;

      case 'createTag':
        await createTag(this.git, message.data.name, message.data.hash, message.data.message);
        vscode.window.showInformationMessage(`Tag created: ${message.data.name}`);
        break;

      case 'deleteTag':
        await deleteTag(this.git, message.data.name);
        vscode.window.showInformationMessage(`Tag deleted: ${message.data.name}`);
        break;

      case 'cherryPick':
        await cherryPick(this.git, message.data.hash);
        vscode.window.showInformationMessage(`Cherry-picked: ${message.data.hash.slice(0, 7)}`);
        break;

      case 'revert':
        await revert(this.git, message.data.hash);
        vscode.window.showInformationMessage(`Reverted: ${message.data.hash.slice(0, 7)}`);
        break;

      case 'stashSave':
        await stashSave(this.git, message.data.message, message.data.includeUntracked);
        vscode.window.showInformationMessage('Changes stashed');
        break;

      case 'stashApply':
        await stashApply(this.git, message.data.index);
        break;

      case 'stashPop':
        await stashPop(this.git, message.data.index);
        break;

      case 'stashDrop':
        await stashDrop(this.git, message.data.index);
        break;

      case 'stageFile':
        await stageFile(this.git, message.data.filePath);
        break;

      case 'unstageFile':
        await unstageFile(this.git, message.data.filePath);
        break;

      case 'stageHunk':
        await stageHunkByIndex(this.git, message.data.filePath, message.data.hunkIndex);
        vscode.window.showInformationMessage(`Staged hunk in ${message.data.filePath}`);
        break;

      case 'unstageHunk':
        await unstageHunkByIndex(this.git, message.data.filePath, message.data.hunkIndex);
        vscode.window.showInformationMessage(`Unstaged hunk in ${message.data.filePath}`);
        break;

      case 'stageLines':
        await stageLinesByIndex(this.git, message.data.filePath, message.data.hunkIndex, message.data.lineIndices);
        vscode.window.showInformationMessage(`Staged lines in ${message.data.filePath}`);
        break;

      case 'unstageLines':
        await unstageLinesByIndex(this.git, message.data.filePath, message.data.hunkIndex, message.data.lineIndices);
        vscode.window.showInformationMessage(`Unstaged lines in ${message.data.filePath}`);
        break;

      case 'startInteractiveRebase':
        await executeInteractiveRebase(this.git, message.data.upstream, message.data.plan);
        vscode.window.showInformationMessage(`Rebase completed onto ${message.data.upstream.slice(0, 7)}`);
        await this.handleMessage({ type: 'requestCommits', data: { maxCount: 500, all: true } });
        break;

      case 'rebaseContinue':
        await rebaseContinue(this.git);
        vscode.window.showInformationMessage('Rebase continued');
        await this.handleMessage({ type: 'requestCommits', data: { maxCount: 500, all: true } });
        break;

      case 'rebaseAbort':
        await rebaseAbort(this.git);
        vscode.window.showInformationMessage('Rebase aborted');
        await this.handleMessage({ type: 'requestCommits', data: { maxCount: 500, all: true } });
        break;

      case 'checkoutCommit':
        await checkout(this.git, message.data.hash);
        vscode.window.showInformationMessage(`Checked out commit: ${message.data.hash.slice(0, 7)}`);
        break;

      case 'openFile': {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) return;
        const uri = vscode.Uri.file(path.join(root, message.data.filePath));
        const doc = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
        if (message.data.line) {
          const pos = new vscode.Position(message.data.line - 1, 0);
          editor.selection = new vscode.Selection(pos, pos);
          editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
        }
        break;
      }

      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(message.data.text);
        vscode.window.showInformationMessage('Copied to clipboard');
        break;

      default:
        break;
    }
  }

  /**
   * Called when the .git directory changes — auto-refresh.
   */
  private onGitChange(): void {
    // Debounce: only refresh if the panel is visible
    if (this.panel.visible) {
      // Small delay to batch rapid changes
      setTimeout(() => {
        void this.handleMessage({ type: 'requestStatus' });
      }, 500);
    }
  }

  /**
   * Generate the HTML content for the webview.
   */
  private getHtmlForWebview(): string {
    const webview = this.panel.webview;

    // Try to use the built webview-ui assets
    const webviewDistPath = vscode.Uri.joinPath(
      this.extensionUri, '..', 'webview-ui', 'dist',
    );

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDistPath, 'assets', 'index.js'),
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewDistPath, 'assets', 'index.css'),
    );

    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} 'unsafe-inline';
                 script-src 'nonce-${nonce}';
                 font-src ${webview.cspSource} data:;" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>OmniGit</title>
</head>
<body data-vscode-theme>
  <div id="app">
    <header id="toolbar" class="toolbar">
      <div class="toolbar-left">
        <button id="btn-refresh" class="icon-btn" title="Refresh">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.451 5.609l-.579-.939-1.068.812-.076.094c.335.601.525 1.283.525 2.01 0 2.313-1.86 4.188-4.153 4.188-2.294 0-4.154-1.875-4.154-4.188S5.806 3.398 8.1 3.398c.747 0 1.448.2 2.052.546l.095-.076.814-1.063-.94-.581A5.42 5.42 0 008.1 1.773C4.915 1.773 2.347 4.36 2.347 7.586S4.915 13.398 8.1 13.398s5.753-2.586 5.753-5.812a5.842 5.842 0 00-.402-2.177z"/>
            <path d="M13 1v4H9"/>
          </svg>
        </button>

        <!-- View tabs -->
        <div class="view-tabs">
          <button id="tab-graph" class="view-tab active" title="Commit Graph">Graph</button>
          <button id="tab-branches" class="view-tab" title="Branches & Tags">Branches</button>
          <button id="tab-stashes" class="view-tab" title="Stashes">Stashes</button>
          <button id="tab-contributors" class="view-tab" title="Contributors">Contributors</button>
        </div>

        <div class="search-container">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.742 10.344a6.5 6.5 0 10-1.397 1.398l3.85 3.85a1 1 0 001.415-1.414l-3.868-3.834zm-5.242.156a4.5 4.5 0 110-9 4.5 4.5 0 010 9z"/>
          </svg>
          <input id="search-input" type="text" placeholder="Search commits by message, author, hash..." autocomplete="off" spellcheck="false" />
        </div>
      </div>
      <div class="toolbar-right">
        <select id="branch-select" class="branch-select" title="Filter by branch">
          <option value="__all__">All branches</option>
        </select>
      </div>
    </header>
    <main id="main-content" class="main-content">
      <!-- View: Graph (default) -->
      <div id="view-graph" class="view-panel">
        <div id="graph-viewport" class="graph-viewport">
          <div id="graph-canvas" class="graph-canvas">
            <svg id="graph-svg" class="graph-svg"></svg>
          </div>
          <div id="commit-list" class="commit-list"></div>
        </div>
      </div>

      <!-- View: Branches & Tags -->
      <div id="view-branches" class="view-panel hidden">
        <div id="branch-manager-container"></div>
      </div>

      <!-- View: Stashes -->
      <div id="view-stashes" class="view-panel hidden">
        <div id="stash-panel-container"></div>
      </div>

      <!-- View: Contributors -->
      <div id="view-contributors" class="view-panel hidden">
        <div id="contributors-container"></div>
      </div>

      <!-- Commit Detail Panel (right side, collapsible) -->
      <div id="detail-panel" class="detail-panel hidden">
        <div class="detail-header">
          <h3 id="detail-title" class="detail-title">Commit Details</h3>
          <button id="btn-close-detail" class="icon-btn" title="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
            </svg>
          </button>
        </div>
        <div id="detail-body" class="detail-body"></div>
      </div>
    </main>
    <footer id="status-bar" class="status-bar">
      <span id="status-branch" class="status-item"></span>
      <span id="status-commits" class="status-item"></span>
      <span id="status-loading" class="status-item hidden"><span class="spinner"></span> Loading...</span>
    </footer>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    GitGraphPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}

function getNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}
