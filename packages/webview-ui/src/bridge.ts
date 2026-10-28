// ============================================================
// @dabzse/omnigit-webview-ui — Message Bridge
//
// Abstraction layer for IDE ↔ webview communication.
// In VS Code, uses acquireVsCodeApi().
// In standalone/dev mode, uses mock data.
// In JetBrains/Eclipse, uses window.cefQuery / SWT bridge.
// ============================================================

import type { MessageFromWebview, MessageToWebview } from '@dabzse/omnigit-core';

export type MessageHandler = (message: MessageToWebview) => void;

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

/**
 * The bridge singleton — mediates all communication between
 * the webview UI and the host IDE extension.
 */
class MessageBridge {
  private readonly handlers = new Set<MessageHandler>();
  private readonly vscodeApi: VsCodeApi | null = null;
  private readonly isDevMode: boolean = false;
  private readonly isWebView2: boolean = false;
  private readonly isCef: boolean = false;
  private readonly isEclipse: boolean = false;
  private readonly isNetBeans: boolean = false;
  private readonly isWebKit: boolean = false;

  constructor() {
    // 1. Detect VS Code
    if (typeof acquireVsCodeApi === 'function') {
      try {
        this.vscodeApi = acquireVsCodeApi();
      } catch {
        // Not in VS Code webview context
      }
    }

    // 2. Detect Visual Studio WebView2 (Microsoft.Web.WebView2)
    const chromeWebview = (window as unknown as { chrome?: { webview?: { postMessage(msg: unknown): void; addEventListener(type: string, listener: (e: { data: unknown }) => void): void } } })?.chrome?.webview;
    if (chromeWebview) {
      this.isWebView2 = true;
      chromeWebview.addEventListener('message', (event: { data: unknown }) => {
        const message = (typeof event.data === 'string' ? JSON.parse(event.data) : event.data) as MessageToWebview;
        if (message?.type) {
          this.notifyHandlers(message);
        }
      });
      console.info('[OmniGit] Connected to Visual Studio WebView2');
    }

    // 3. Detect JetBrains JCEF
    if (typeof (window as unknown as { cefQuery?: unknown }).cefQuery === 'function') {
      this.isCef = true;
      console.info('[OmniGit] Connected to JetBrains JCEF');
    }

    // 4. Detect Eclipse SWT Browser Function
    if (typeof (window as unknown as { eclipseBridge?: unknown }).eclipseBridge === 'function') {
      this.isEclipse = true;
      console.info('[OmniGit] Connected to Eclipse Browser Bridge');
    }

    // 5. Detect NetBeans JavaFX WebEngine Bridge
    if (typeof (window as unknown as { netBeansBridge?: unknown }).netBeansBridge === 'object') {
      this.isNetBeans = true;
      console.info('[OmniGit] Connected to NetBeans JavaFX Bridge');
    }

    // 6. Detect macOS WKWebView (Xcode Companion / Apple WebKit)
    const webkitHandler = (window as unknown as { webkit?: { messageHandlers?: { omniGit?: { postMessage(msg: unknown): void } } } })?.webkit?.messageHandlers?.omniGit;
    if (webkitHandler) {
      this.isWebKit = true;
      console.info('[OmniGit] Connected to macOS WKWebView (Xcode Companion)');
    }

    // 7. Expose direct JS bridge hook for any host container
    (window as unknown as { __omnigit_receive?: (msg: MessageToWebview | string) => void }).__omnigit_receive = (message: MessageToWebview | string) => {
      try {
        const parsed = (typeof message === 'string' ? JSON.parse(message) : message) as MessageToWebview;
        if (parsed?.type) {
          this.notifyHandlers(parsed);
        }
      } catch (err) {
        console.error('[OmniGit] Failed to handle incoming message via direct bridge:', err);
      }
    };

    // If no IDE host detected, fall back to dev mode
    if (!this.vscodeApi && !this.isWebView2 && !this.isCef && !this.isEclipse && !this.isNetBeans && !this.isWebKit) {
      this.isDevMode = true;
      console.info('[OmniGit] Running in standalone/dev mode');
    }

    // Standard DOM message listener for VS Code and web environments
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.origin !== window.location.origin && !event.origin.startsWith('vscode-webview:')) {
        return;
      }
      const message = event.data as MessageToWebview;
      if (message?.type) {
        this.notifyHandlers(message);
      }
    });
  }

  /**
   * Send a message to the host IDE extension.
   */
  send(message: MessageFromWebview): void {
    if (this.vscodeApi) {
      this.vscodeApi.postMessage(message);
    } else if (this.isWebView2) {
      const chromeWebview = (window as unknown as { chrome?: { webview?: { postMessage(msg: unknown): void } } })?.chrome?.webview;
      chromeWebview?.postMessage(message);
    } else if (this.isCef) {
      const cefQuery = (window as unknown as { cefQuery: (opts: { request: string; onSuccess?: (res: string) => void; onFailure?: (code: number, msg: string) => void }) => void }).cefQuery;
      cefQuery({
        request: JSON.stringify(message),
        onSuccess: (res: string) => {
          if (res) {
            try {
              const parsed = JSON.parse(res) as MessageToWebview;
              this.notifyHandlers(parsed);
            } catch (e) {
              console.error('[OmniGit] Error parsing CEF response:', e);
            }
          }
        },
        onFailure: (code: number, msg: string) => {
          console.error('[OmniGit] CEF request failed:', code, msg);
        },
      });
    } else if (this.isEclipse) {
      const eclipseBridge = (window as unknown as { eclipseBridge: (json: string) => void }).eclipseBridge;
      eclipseBridge(JSON.stringify(message));
    } else if (this.isNetBeans) {
      const netBeansBridge = (window as unknown as { netBeansBridge: { postMessage(json: string): void } }).netBeansBridge;
      netBeansBridge.postMessage(JSON.stringify(message));
    } else if (this.isWebKit) {
      const webkitHandler = (window as unknown as { webkit: { messageHandlers: { omniGit: { postMessage(msg: unknown): void } } } }).webkit.messageHandlers.omniGit;
      webkitHandler.postMessage(message);
    } else if (this.isDevMode) {
      console.log('[OmniGit] → Host:', message);
      this.handleDevMessage(message);
    }
  }

  /**
   * Subscribe to messages from the host.
   * Returns an unsubscribe function.
   */
  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /**
   * Wait for a specific message type.
   */
  waitFor<T extends MessageToWebview['type']>(
    type: T,
    timeout = 10_000,
  ): Promise<Extract<MessageToWebview, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub();
        reject(new Error(`Timeout waiting for message: ${type}`));
      }, timeout);

      const unsub = this.onMessage((msg) => {
        if (msg.type === type) {
          clearTimeout(timer);
          unsub();
          resolve(msg as Extract<MessageToWebview, { type: T }>);
        }
      });
    });
  }

  /**
   * Save webview state (VS Code only — persists across tab switches).
   */
  saveState(state: unknown): void {
    this.vscodeApi?.setState(state);
  }

  /**
   * Restore webview state (VS Code only).
   */
  getState<T>(): T | undefined {
    return this.vscodeApi?.getState() as T | undefined;
  }

  private notifyHandlers(message: MessageToWebview): void {
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch (err) {
        console.error('[OmniGit] Handler error:', err);
      }
    }
  }

  /**
   * Dev mode: generate mock responses for testing the UI
   * without a real git repo connection.
   */
  private handleDevMessage(message: MessageFromWebview): void {
    switch (message.type) {
      case 'requestCommits':
        this.notifyHandlers({
          type: 'commits',
          data: generateMockCommits(),
        });
        break;

      case 'requestStatus':
        this.notifyHandlers({
          type: 'status',
          data: {
            currentBranch: 'main',
            detachedHead: false,
            upstream: 'origin/main',
            ahead: 2,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: [],
            conflicts: [],
            merging: false,
            rebasing: false,
            cherryPicking: false,
          },
        });
        break;

      case 'requestCommitDetail': {
        const commits = generateMockCommits();
        const commit = commits.find((c) => c.hash === message.data.hash) ?? commits[0];
        this.notifyHandlers({
          type: 'commitDetail',
          data: {
            commit,
            files: [
              { path: 'src/graph/layout.ts', status: 'modified', additions: 42, deletions: 12 },
              { path: 'src/components/DiffView.ts', status: 'added', additions: 185, deletions: 0 },
              { path: 'src/components/FileHistory.ts', status: 'modified', additions: 25, deletions: 5 },
              { path: 'package.json', status: 'modified', additions: 3, deletions: 1 },
            ],
          },
        });
        break;
      }

      case 'requestBranches':
        this.notifyHandlers({
          type: 'branches',
          data: [
            { name: 'main', isRemote: false, isCurrent: true, hash: generateHash(0), lastCommitDate: Math.floor(Date.now() / 1000), lastCommitSubject: 'feat: add interactive graph visualization' },
            { name: 'feature/graph-ui', isRemote: false, isCurrent: false, hash: generateHash(2), lastCommitDate: Math.floor(Date.now() / 1000) - 7200, lastCommitSubject: 'refactor: extract graph layout algorithm' },
            { name: 'fix/lane-routing', isRemote: false, isCurrent: false, hash: generateHash(6), lastCommitDate: Math.floor(Date.now() / 1000) - 18000, lastCommitSubject: 'fix: correct lane assignment for octopus merges' },
            { name: 'origin/main', isRemote: true, isCurrent: false, remote: 'origin', hash: generateHash(0), lastCommitDate: Math.floor(Date.now() / 1000), lastCommitSubject: 'feat: add interactive graph visualization' },
            { name: 'origin/develop', isRemote: true, isCurrent: false, remote: 'origin', hash: generateHash(5), lastCommitDate: Math.floor(Date.now() / 1000) - 14400, lastCommitSubject: 'feat: implement inline blame annotations' },
          ],
        });
        break;

      case 'requestTags':
        this.notifyHandlers({
          type: 'tags',
          data: [
            { name: 'v1.0.0', hash: generateHash(7), message: 'Release v1.0.0' },
            { name: 'v0.9.0', hash: generateHash(15), message: 'Beta release v0.9.0' },
          ],
        });
        break;

      case 'requestStashes':
        this.notifyHandlers({
          type: 'stashes',
          data: [
            { index: 0, hash: generateHash(18), message: 'WIP on main: partial hunk staging UI', date: Math.floor(Date.now() / 1000) - 3600, branch: 'main' },
            { index: 1, hash: generateHash(19), message: 'On feature/graph-ui: experimental zoom controls', date: Math.floor(Date.now() / 1000) - 86400, branch: 'feature/graph-ui' },
          ],
        });
        break;

      case 'requestContributors':
        this.notifyHandlers({
          type: 'contributors',
          data: [
            { name: 'Alice Chen', email: 'alice.chen@example.com', commits: 142, firstCommitDate: Math.floor(Date.now() / 1000) - 86400 * 180, lastCommitDate: Math.floor(Date.now() / 1000) },
            { name: 'Bob Smith', email: 'bob.smith@example.com', commits: 98, firstCommitDate: Math.floor(Date.now() / 1000) - 86400 * 150, lastCommitDate: Math.floor(Date.now() / 1000) - 7200 },
            { name: 'Charlie Dev', email: 'charlie.dev@example.com', commits: 64, firstCommitDate: Math.floor(Date.now() / 1000) - 86400 * 90, lastCommitDate: Math.floor(Date.now() / 1000) - 14400 },
            { name: 'Diana Ops', email: 'diana.ops@example.com', commits: 37, firstCommitDate: Math.floor(Date.now() / 1000) - 86400 * 60, lastCommitDate: Math.floor(Date.now() / 1000) - 86400 },
            { name: 'Eve Sec', email: 'eve.sec@example.com', commits: 19, firstCommitDate: Math.floor(Date.now() / 1000) - 86400 * 30, lastCommitDate: Math.floor(Date.now() / 1000) - 86400 * 2 },
          ],
        });
        break;

      case 'requestFileHistory':
        this.notifyHandlers({
          type: 'fileHistory',
          data: {
            filePath: message.data.filePath,
            commits: generateMockCommits().slice(0, 6),
          },
        });
        break;

      case 'requestFileDiff':
        this.notifyHandlers({
          type: 'fileDiff',
          data: {
            path: message.data.filePath,
            status: 'modified',
            isBinary: false,
            hunks: [
              {
                header: { oldStart: 12, oldCount: 6, newStart: 12, newCount: 9, context: 'function computeLayout()' },
                lines: [
                  { type: 'context', content: '  const lanes: Lane[] = [];', oldLineNumber: 12, newLineNumber: 12 },
                  { type: 'context', content: '  const branches = getActiveBranches();', oldLineNumber: 13, newLineNumber: 13 },
                  { type: 'delete', content: '  // Old single-pass lane assignment', oldLineNumber: 14 },
                  { type: 'delete', content: '  assignLanesSimple(commits, lanes);', oldLineNumber: 15 },
                  { type: 'add', content: '  // Topological branch routing algorithm', newLineNumber: 14 },
                  { type: 'add', content: '  const graph = buildCommitGraph(commits);', newLineNumber: 15 },
                  { type: 'add', content: '  assignOptimizedLanes(graph, lanes);', newLineNumber: 16 },
                  { type: 'add', content: '  routeMergeBorders(graph, lanes);', newLineNumber: 17 },
                  { type: 'context', content: '  return { lanes, maxColumns: lanes.length };', oldLineNumber: 16, newLineNumber: 18 },
                  { type: 'context', content: '}', oldLineNumber: 17, newLineNumber: 19 },
                ],
              },
            ],
          },
        });
        break;

      case 'viewStashDiff':
        this.notifyHandlers({
          type: 'stashDiff',
          data: {
            index: message.data.index,
            diffs: [
              {
                path: 'src/components/StashPanel.ts',
                status: 'modified',
                isBinary: false,
                hunks: [
                  {
                    header: { oldStart: 1, oldCount: 4, newStart: 1, newCount: 6, context: 'renderStashPanel' },
                    lines: [
                      { type: 'context', content: '  // Stash entry actions', oldLineNumber: 1, newLineNumber: 1 },
                      { type: 'add', content: '  const diffBtn = document.createElement("button");', newLineNumber: 2 },
                      { type: 'add', content: '  diffBtn.textContent = "Diff";', newLineNumber: 3 },
                      { type: 'context', content: '  actions.appendChild(diffBtn);', oldLineNumber: 2, newLineNumber: 4 },
                    ],
                  },
                ],
              },
            ],
          },
        });
        break;

      case 'requestRebasePlan': {
        const mockCommits = generateMockCommits().slice(0, 4);
        this.notifyHandlers({
          type: 'rebasePlan',
          data: {
            upstream: message.data.upstream,
            upstreamShortHash: message.data.upstream.slice(0, 7),
            commits: mockCommits.map((c) => ({
              hash: c.hash,
              shortHash: c.shortHash,
              subject: c.subject,
              author: c.author.name,
              action: 'pick',
            })),
          },
        });
        break;
      }

      default:
        console.log('[OmniGit] Dev mode handled action:', message.type);
    }
  }
}

// Mock Data Generator

function generateMockCommits(): import('@dabzse/omnigit-core').Commit[] {
  const now = Math.floor(Date.now() / 1000);
  const names = ['Alice Chen', 'Bob Smith', 'Charlie Dev', 'Diana Ops', 'Eve Sec'];
  const messages = [
    'feat: add interactive graph visualization',
    'fix: resolve merge conflict in layout engine',
    'refactor: extract graph layout algorithm',
    'docs: update README with installation guide',
    'chore: bump dependencies to latest versions',
    'feat: implement inline blame annotations',
    'fix: correct lane assignment for octopus merges',
    'style: improve commit row hover effects',
    'test: add unit tests for log parser',
    'feat: add commit search and filtering',
    'fix: handle detached HEAD state gracefully',
    'perf: optimize SVG rendering for large graphs',
    'feat: add branch management UI',
    'fix: prevent graph from shifting on window resize',
    'docs: add contribution guidelines',
    'feat: implement stash management panel',
    'refactor: split monolith into core/ui packages',
    'fix: resolve off-by-one in hunk staging',
    'feat: add file history timeline view',
    'chore: configure CI/CD pipeline',
  ];

  const commits: import('@dabzse/omnigit-core').Commit[] = [];
  let prevHash = '';

  for (let i = 0; i < 20; i++) {
    const hash = generateHash(i);
    const isMerge = i === 3 || i === 8 || i === 14;
    const parents: string[] = [];

    if (i > 0) {
      parents.push(generateHash(i - 1));
    }
    if (isMerge && i > 2) {
      parents.push(generateHash(i - 2));
    }

    const author = names[i % names.length];
    const refs: import('@dabzse/omnigit-core').Ref[] = [];

    if (i === 0) {
      refs.push(
        { name: 'main', type: 'head', isHead: true },
        { name: 'origin/main', type: 'remote', remote: 'origin', isHead: false },
      );
    }
    if (i === 2) {
      refs.push({ name: 'feature/graph-ui', type: 'head', isHead: false });
    }
    if (i === 5) {
      refs.push({ name: 'origin/develop', type: 'remote', remote: 'origin', isHead: false });
    }
    if (i === 7) {
      refs.push({ name: 'v1.0.0', type: 'tag', isHead: false });
    }

    commits.push({
      hash,
      shortHash: hash.slice(0, 7),
      parents,
      subject: messages[i % messages.length],
      body: '',
      author: { name: author, email: `${author.toLowerCase().replace(' ', '.')}@example.com` },
      authorDate: now - i * 3600,
      committer: { name: author, email: `${author.toLowerCase().replace(' ', '.')}@example.com` },
      commitDate: now - i * 3600,
      refs,
    });
  }

  return commits;
}

function generateHash(seed: number): string {
  const chars = '0123456789abcdef';
  let hash = '';
  let s = seed + 42;
  for (let i = 0; i < 40; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    hash += chars[s % 16];
  }
  return hash;
}

// Singleton Export

export const bridge = new MessageBridge();
