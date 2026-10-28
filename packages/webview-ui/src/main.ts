// ============================================================
// @dabzse/omnigit-webview-ui — Main Entry Point
//
// Initializes the webview, requests data from the host,
// and wires up all UI components.
// ============================================================

import type { Commit, GraphData, DiffFileStat, Branch, Tag, StashEntry, Contributor, FileDiff } from '@dabzse/omnigit-core';
import { computeGraphLayout } from '@dabzse/omnigit-core/graph';
import { bridge } from './bridge.js';
import { renderGraph, highlightNode } from './components/Graph.js';
import { createCommitRow, selectCommitRow } from './components/CommitRow.js';
import { renderCommitDetail, renderCommitComparison, showDetailPanel, hideDetailPanel } from './components/CommitDetail.js';
import { initSearchBar, applySearchFilter } from './components/SearchBar.js';
import { renderBranchManager } from './components/BranchManager.js';
import { renderStashPanel } from './components/StashPanel.js';
import { renderContributors } from './components/Contributors.js';
import { renderFileHistory } from './components/FileHistory.js';
import { showDiffOverlay } from './components/DiffView.js';
import { showRebaseDialog } from './components/RebaseDialog.js';

// State

interface AppState {
  commits: Commit[];
  graphData: GraphData | null;
  selectedHash: string | null;
  loading: boolean;
  currentView: 'graph' | 'branches' | 'stashes' | 'contributors';
  branches: Branch[];
  tags: Tag[];
  stashes: StashEntry[];
  contributors: Contributor[];
}

const state: AppState = {
  commits: [],
  graphData: null,
  selectedHash: null,
  loading: false,
  currentView: 'graph',
  branches: [],
  tags: [],
  stashes: [],
  contributors: [],
};

// DOM References

const graphSvg = document.getElementById('graph-svg') as unknown as SVGSVGElement;
const commitList = document.getElementById('commit-list') as HTMLDivElement;
const detailBody = document.getElementById('detail-body') as HTMLDivElement;
const statusBranch = document.getElementById('status-branch') as HTMLSpanElement;
const statusCommits = document.getElementById('status-commits') as HTMLSpanElement;
const statusLoading = document.getElementById('status-loading') as HTMLSpanElement;
const btnRefresh = document.getElementById('btn-refresh') as HTMLButtonElement;
const btnCloseDetail = document.getElementById('btn-close-detail') as HTMLButtonElement;

// View panels
const viewPanels: Record<string, HTMLDivElement | null> = {
  graph: document.getElementById('view-graph') as HTMLDivElement,
  branches: document.getElementById('view-branches') as HTMLDivElement,
  stashes: document.getElementById('view-stashes') as HTMLDivElement,
  contributors: document.getElementById('view-contributors') as HTMLDivElement,
};

// View tabs
const viewTabs: Record<string, HTMLButtonElement | null> = {
  graph: document.getElementById('tab-graph') as HTMLButtonElement,
  branches: document.getElementById('tab-branches') as HTMLButtonElement,
  stashes: document.getElementById('tab-stashes') as HTMLButtonElement,
  contributors: document.getElementById('tab-contributors') as HTMLButtonElement,
};

// Initialization

function init(): void {
  // Wire up UI events
  btnRefresh?.addEventListener('click', requestCommits);
  btnCloseDetail?.addEventListener('click', () => {
    hideDetailPanel();
    state.selectedHash = null;
    if (graphSvg) {
      graphSvg.querySelectorAll('.graph-node-ring.active').forEach((el) => {
        el.classList.remove('active');
      });
    }
    commitList?.querySelectorAll('.commit-row.selected').forEach((el) => {
      el.classList.remove('selected');
    });
  });

  // Wire up view tab switching
  for (const [viewName, tab] of Object.entries(viewTabs)) {
    tab?.addEventListener('click', () => {
      switchView(viewName as AppState['currentView']);
    });
  }

  // Listen for messages from the host
  bridge.onMessage((message) => {
    switch (message.type) {
      case 'commits':
        handleCommits(message.data);
        break;

      case 'commitDetail':
        handleCommitDetail(
          message.data.commit,
          message.data.files,
        );
        break;

      case 'status':
        handleStatus(message.data);
        break;

      case 'graphLayout':
        handleGraphLayout(message.data);
        break;

      case 'branches':
        handleBranches(message.data);
        break;

      case 'tags':
        handleTags(message.data);
        break;

      case 'stashes':
        handleStashes(message.data);
        break;

      case 'contributors':
        handleContributors(message.data);
        break;

      case 'fileHistory':
        handleFileHistory(message.data);
        break;

      case 'fileDiff':
        handleFileDiff(message.data);
        break;

      case 'commitComparison':
        handleCommitComparison(message.data);
        break;

      case 'rebasePlan':
        showRebaseDialog(message.data);
        break;

      case 'stashDiff':
        if (message.data.diffs.length > 0) {
          showDiffOverlay(message.data.diffs[0]);
        }
        break;

      case 'error':
        console.error('[OmniGit] Error:', message.data.message);
        break;
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Request initial data
  requestCommits();
  bridge.send({ type: 'requestStatus' });
}

// View Switching

function switchView(viewName: AppState['currentView']): void {
  state.currentView = viewName;

  // Toggle tab active state
  for (const [name, tab] of Object.entries(viewTabs)) {
    if (tab) {
      tab.classList.toggle('active', name === viewName);
    }
  }

  // Toggle panel visibility
  for (const [name, panel] of Object.entries(viewPanels)) {
    if (panel) {
      panel.classList.toggle('hidden', name !== viewName);
    }
  }

  // Request data for the new view if needed
  switch (viewName) {
    case 'branches':
      bridge.send({ type: 'requestBranches' });
      bridge.send({ type: 'requestTags' });
      break;
    case 'stashes':
      bridge.send({ type: 'requestStashes' });
      break;
    case 'contributors':
      bridge.send({ type: 'requestContributors' });
      break;
  }
}

// Data Handlers

function handleCommits(commits: Commit[]): void {
  state.commits = commits;
  state.loading = false;
  setLoading(false);

  // Compute graph layout locally
  state.graphData = computeGraphLayout(commits);

  // Render
  renderAll();

  // Update status
  statusCommits.textContent = `${commits.length} commits`;

  // Init search
  initSearchBar(commits, (searchState) => {
    applySearchFilter(commitList, searchState);
  });
}

function handleGraphLayout(graphData: GraphData): void {
  state.graphData = graphData;
  renderGraphView();
}

function handleCommitDetail(commit: Commit, files: DiffFileStat[]): void {
  renderCommitDetail(detailBody, commit, files);
  showDetailPanel();
}

function handleStatus(status: import('@dabzse/omnigit-core').RepoStatus): void {
  if (status.currentBranch) {
    const parts = [`⎇ ${status.currentBranch}`];
    if (status.ahead > 0) parts.push(`↑${status.ahead}`);
    if (status.behind > 0) parts.push(`↓${status.behind}`);
    statusBranch.textContent = parts.join(' ');
  } else if (status.detachedHead) {
    statusBranch.textContent = '⎇ (detached)';
  }
}

function handleBranches(branches: Branch[]): void {
  state.branches = branches;
  renderBranchManagerView();
}

function handleTags(tags: Tag[]): void {
  state.tags = tags;
  renderBranchManagerView();
}

function handleStashes(stashes: StashEntry[]): void {
  state.stashes = stashes;
  const container = document.getElementById('stash-panel-container');
  if (container) {
    renderStashPanel(container as HTMLDivElement, stashes);
  }
}

function handleContributors(contributors: Contributor[]): void {
  state.contributors = contributors;
  const container = document.getElementById('contributors-container');
  if (container) {
    renderContributors(container as HTMLDivElement, contributors);
  }
}

function handleFileHistory(data: { filePath: string; commits: Commit[] }): void {
  // Render file history in the detail panel
  const container = detailBody;
  if (container) {
    renderFileHistory(container, data.filePath, data.commits);
    showDetailPanel();
  }
}

function handleFileDiff(diff: FileDiff): void {
  showDiffOverlay(diff);
}

function handleCommitComparison(data: {
  base: string;
  target: string;
  files: DiffFileStat[];
}): void {
  const container = detailBody;
  if (container) {
    renderCommitComparison(container, data.base, data.target, data.files);
    showDetailPanel();
  }
}

// Rendering

function renderAll(): void {
  renderGraphView();
  renderCommitList();
}

function renderGraphView(): void {
  if (!state.graphData || !graphSvg) return;

  renderGraph(graphSvg, state.graphData, {}, (hash) => {
    selectCommit(hash);
  });
}

function renderCommitList(): void {
  if (!commitList) return;

  commitList.innerHTML = '';

  for (const commit of state.commits) {
    const row = createCommitRow(commit, (hash) => {
      selectCommit(hash);
    });
    commitList.appendChild(row);
  }
}

function renderBranchManagerView(): void {
  const container = document.getElementById('branch-manager-container');
  if (container) {
    renderBranchManager(container as HTMLDivElement, state.branches, state.tags);
  }
}

function selectCommit(hash: string): void {
  state.selectedHash = hash;

  // Highlight in graph
  if (graphSvg) {
    highlightNode(graphSvg, hash);
  }

  // Select in commit list
  if (commitList) {
    selectCommitRow(commitList, hash);
  }

  // Request commit details from host
  bridge.send({
    type: 'requestCommitDetail',
    data: { hash },
  });
}

// Actions

function requestCommits(): void {
  state.loading = true;
  setLoading(true);
  bridge.send({
    type: 'requestCommits',
    data: { maxCount: 500, all: true },
  });
}

function setLoading(loading: boolean): void {
  if (statusLoading) {
    statusLoading.classList.toggle('hidden', !loading);
  }
}

// Keyboard Navigation

function handleKeyboard(e: KeyboardEvent): void {
  // Focus search: Ctrl+F / Cmd+F
  if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
    e.preventDefault();
    const input = document.getElementById('search-input') as HTMLInputElement;
    input?.focus();
    input?.select();
    return;
  }

  // Navigate commits: Up/Down arrows
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    navigateCommits(e.key === 'ArrowDown' ? 1 : -1);
    return;
  }

  // Close detail: Escape
  if (e.key === 'Escape') {
    hideDetailPanel();
    state.selectedHash = null;
    return;
  }

  // Refresh: Ctrl+R / Cmd+R (if not in search)
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    const activeEl = document.activeElement;
    if (activeEl?.tagName !== 'INPUT') {
      e.preventDefault();
      requestCommits();
    }
  }

  // View switching: 1-4 number keys
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const viewKeys: Record<string, AppState['currentView']> = {
      '1': 'graph',
      '2': 'branches',
      '3': 'stashes',
      '4': 'contributors',
    };
    const targetView = viewKeys[e.key];
    if (targetView && document.activeElement?.tagName !== 'INPUT') {
      switchView(targetView);
    }
  }
}

function navigateCommits(direction: 1 | -1): void {
  if (state.commits.length === 0) return;

  const currentIndex = state.selectedHash
    ? state.commits.findIndex((c) => c.hash === state.selectedHash)
    : -1;

  const nextIndex = Math.max(0, Math.min(state.commits.length - 1, currentIndex + direction));
  const nextCommit = state.commits[nextIndex];

  if (nextCommit) {
    selectCommit(nextCommit.hash);
  }
}

// Boot

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
