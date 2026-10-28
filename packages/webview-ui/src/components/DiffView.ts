// ============================================================
// @dabzse/omnigit-webview-ui — Diff View Component
//
// Renders side-by-side or unified diffs within the webview.
// Supports syntax-highlighted additions, deletions, context
// lines, hunk headers, and binary file indicators.
// ============================================================

import type { FileDiff, DiffHunk, DiffLine } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

export type DiffDisplayMode = 'unified' | 'side-by-side';

interface DiffViewOptions {
  mode?: DiffDisplayMode;
  /** Whether to show line numbers. */
  lineNumbers?: boolean;
  /** Whether to wrap long lines. */
  wordWrap?: boolean;
}

const DEFAULT_OPTIONS: Required<DiffViewOptions> = {
  mode: 'unified',
  lineNumbers: true,
  wordWrap: false,
};

/**
 * Render a full diff view for a file into a container.
 */
export function renderDiffView(
  container: HTMLElement,
  diff: FileDiff,
  options: DiffViewOptions = {},
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  container.innerHTML = '';
  container.className = 'diff-view fade-in';

  // File header
  const header = document.createElement('div');
  header.className = 'diff-file-header';

  const statusBadge = document.createElement('span');
  statusBadge.className = `diff-status diff-status--${diff.status}`;
  statusBadge.textContent = diff.status.charAt(0).toUpperCase();

  const pathEl = document.createElement('span');
  pathEl.className = 'diff-file-path';
  pathEl.textContent = diff.oldPath
    ? `${diff.oldPath} → ${diff.path}`
    : diff.path;

  // Mode toggle
  const modeToggle = document.createElement('div');
  modeToggle.className = 'diff-mode-toggle';

  const unifiedBtn = document.createElement('button');
  unifiedBtn.className = `diff-mode-btn ${opts.mode === 'unified' ? 'active' : ''}`;
  unifiedBtn.textContent = 'Unified';
  unifiedBtn.title = 'Unified diff view';

  const sideBySideBtn = document.createElement('button');
  sideBySideBtn.className = `diff-mode-btn ${opts.mode === 'side-by-side' ? 'active' : ''}`;
  sideBySideBtn.textContent = 'Split';
  sideBySideBtn.title = 'Side-by-side diff view';

  unifiedBtn.addEventListener('click', () => {
    renderDiffView(container, diff, { ...opts, mode: 'unified' });
  });

  sideBySideBtn.addEventListener('click', () => {
    renderDiffView(container, diff, { ...opts, mode: 'side-by-side' });
  });

  modeToggle.appendChild(unifiedBtn);
  modeToggle.appendChild(sideBySideBtn);

  // File actions
  const actionsEl = document.createElement('div');
  actionsEl.className = 'diff-file-actions';

  const stageBtn = document.createElement('button');
  stageBtn.className = 'diff-hunk-btn';
  stageBtn.textContent = 'Stage';
  stageBtn.title = 'Stage this entire file';
  stageBtn.addEventListener('click', () => {
    bridge.send({ type: 'stageFile', data: { filePath: diff.path } });
  });

  const unstageBtn = document.createElement('button');
  unstageBtn.className = 'diff-hunk-btn';
  unstageBtn.textContent = 'Unstage';
  unstageBtn.title = 'Unstage this entire file';
  unstageBtn.addEventListener('click', () => {
    bridge.send({ type: 'unstageFile', data: { filePath: diff.path } });
  });

  const openBtn = document.createElement('button');
  openBtn.className = 'diff-hunk-btn';
  openBtn.textContent = 'Open';
  openBtn.title = 'Open file in editor';
  openBtn.addEventListener('click', () => {
    bridge.send({ type: 'openFile', data: { filePath: diff.path } });
  });

  actionsEl.appendChild(stageBtn);
  actionsEl.appendChild(unstageBtn);
  actionsEl.appendChild(openBtn);

  header.appendChild(statusBadge);
  header.appendChild(pathEl);
  header.appendChild(actionsEl);
  header.appendChild(modeToggle);
  container.appendChild(header);

  // Binary file
  if (diff.isBinary) {
    const binaryMsg = document.createElement('div');
    binaryMsg.className = 'diff-binary-notice';
    binaryMsg.textContent = 'Binary file — content not displayed';
    container.appendChild(binaryMsg);
    return;
  }

  // No changes
  if (diff.hunks.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.className = 'diff-empty-notice';
    emptyMsg.textContent = 'No text changes to display';
    container.appendChild(emptyMsg);
    return;
  }

  // Render hunks
  if (opts.mode === 'unified') {
    renderUnifiedDiff(container, diff.path, diff.hunks, opts);
  } else {
    renderSideBySideDiff(container, diff.path, diff.hunks, opts);
  }
}

function createHunkHeaderElement(hunk: DiffHunk, filePath: string, hunkIndex: number): HTMLElement {
  const hunkHeader = document.createElement('div');
  hunkHeader.className = 'diff-hunk-header';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'diff-hunk-title';
  titleSpan.textContent = formatHunkHeader(hunk);
  hunkHeader.appendChild(titleSpan);

  const actions = document.createElement('div');
  actions.className = 'diff-hunk-actions';

  const stageHunkBtn = document.createElement('button');
  stageHunkBtn.className = 'diff-hunk-btn';
  stageHunkBtn.textContent = 'Stage Hunk';
  stageHunkBtn.title = `Stage hunk #${hunkIndex + 1}`;
  stageHunkBtn.addEventListener('click', () => {
    bridge.send({
      type: 'stageHunk',
      data: { filePath, hunkIndex },
    });
  });

  const unstageHunkBtn = document.createElement('button');
  unstageHunkBtn.className = 'diff-hunk-btn';
  unstageHunkBtn.textContent = 'Unstage Hunk';
  unstageHunkBtn.title = `Unstage hunk #${hunkIndex + 1}`;
  unstageHunkBtn.addEventListener('click', () => {
    bridge.send({
      type: 'unstageHunk',
      data: { filePath, hunkIndex },
    });
  });

  actions.appendChild(stageHunkBtn);
  actions.appendChild(unstageHunkBtn);
  hunkHeader.appendChild(actions);

  return hunkHeader;
}

function getDiffLinePrefix(type: string): string {
  if (type === 'add') return '+';
  if (type === 'delete') return '-';
  return ' ';
}

function createUnifiedLineRow(
  line: DiffLine,
  lineIdx: number,
  filePath: string,
  hunkIndex: number,
  opts: Required<DiffViewOptions>,
): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = `diff-line diff-line--${line.type}`;

  // Line staging action gutter
  const actionTd = document.createElement('td');
  actionTd.className = 'diff-line-action';
  if (line.type === 'add' || line.type === 'delete') {
    const stageBtn = document.createElement('button');
    stageBtn.className = 'diff-line-stage-btn';
    stageBtn.title = 'Stage this line';
    stageBtn.textContent = '+';
    stageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bridge.send({
        type: 'stageLines',
        data: { filePath, hunkIndex, lineIndices: [lineIdx] },
      });
    });
    actionTd.appendChild(stageBtn);
  }
  tr.appendChild(actionTd);

  if (opts.lineNumbers) {
    const oldNumTd = document.createElement('td');
    oldNumTd.className = 'diff-line-num diff-line-num--old';
    oldNumTd.textContent = line.oldLineNumber != null ? `${line.oldLineNumber}` : '';

    const newNumTd = document.createElement('td');
    newNumTd.className = 'diff-line-num diff-line-num--new';
    newNumTd.textContent = line.newLineNumber != null ? `${line.newLineNumber}` : '';

    tr.appendChild(oldNumTd);
    tr.appendChild(newNumTd);
  }

  const prefixTd = document.createElement('td');
  prefixTd.className = 'diff-line-prefix';
  prefixTd.textContent = getDiffLinePrefix(line.type);

  const contentTd = document.createElement('td');
  contentTd.className = 'diff-line-content';
  if (opts.wordWrap) contentTd.classList.add('diff-wrap');
  contentTd.textContent = line.content;

  tr.appendChild(prefixTd);
  tr.appendChild(contentTd);
  return tr;
}

/**
 * Render unified diff hunks.
 */
function renderUnifiedDiff(
  container: HTMLElement,
  filePath: string,
  hunks: readonly DiffHunk[],
  opts: Required<DiffViewOptions>,
): void {
  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex];
    container.appendChild(createHunkHeaderElement(hunk, filePath, hunkIndex));

    const table = document.createElement('table');
    table.className = 'diff-table diff-table--unified';

    for (let lineIdx = 0; lineIdx < hunk.lines.length; lineIdx++) {
      table.appendChild(createUnifiedLineRow(hunk.lines[lineIdx], lineIdx, filePath, hunkIndex, opts));
    }

    container.appendChild(table);
  }
}

function createSideBySideRow(pair: SideBySidePair, opts: Required<DiffViewOptions>): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = 'diff-line--split';

  if (opts.lineNumbers) {
    const leftNum = document.createElement('td');
    leftNum.className = 'diff-line-num';
    leftNum.textContent = pair.oldLine?.oldLineNumber != null ? `${pair.oldLine.oldLineNumber}` : '';
    tr.appendChild(leftNum);
  }

  const leftContent = document.createElement('td');
  const isDelete = pair.oldLine?.type === 'delete';
  leftContent.className = `diff-line-content diff-line-content--left ${isDelete ? 'diff-line--delete' : ''}`;
  if (opts.wordWrap) leftContent.classList.add('diff-wrap');
  leftContent.textContent = pair.oldLine?.content ?? '';
  tr.appendChild(leftContent);

  if (opts.lineNumbers) {
    const rightNum = document.createElement('td');
    rightNum.className = 'diff-line-num';
    rightNum.textContent = pair.newLine?.newLineNumber != null ? `${pair.newLine.newLineNumber}` : '';
    tr.appendChild(rightNum);
  }

  const rightContent = document.createElement('td');
  const isAdd = pair.newLine?.type === 'add';
  rightContent.className = `diff-line-content diff-line-content--right ${isAdd ? 'diff-line--add' : ''}`;
  if (opts.wordWrap) rightContent.classList.add('diff-wrap');
  rightContent.textContent = pair.newLine?.content ?? '';
  tr.appendChild(rightContent);

  return tr;
}

/**
 * Render side-by-side diff.
 */
function renderSideBySideDiff(
  container: HTMLElement,
  filePath: string,
  hunks: readonly DiffHunk[],
  opts: Required<DiffViewOptions>,
): void {
  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex];
    container.appendChild(createHunkHeaderElement(hunk, filePath, hunkIndex));

    const table = document.createElement('table');
    table.className = 'diff-table diff-table--side-by-side';
    const pairs = buildSideBySidePairs(hunk.lines);

    for (const pair of pairs) {
      table.appendChild(createSideBySideRow(pair, opts));
    }

    container.appendChild(table);
  }
}

// Helpers

interface SideBySidePair {
  oldLine: DiffLine | null;
  newLine: DiffLine | null;
}

/**
 * Build paired lines for side-by-side display.
 * Context lines appear on both sides; deletions on left, additions on right.
 */
function buildSideBySidePairs(lines: readonly DiffLine[]): SideBySidePair[] {
  const pairs: SideBySidePair[] = [];
  const deletions: DiffLine[] = [];
  const additions: DiffLine[] = [];

  function flushPending(): void {
    const maxLen = Math.max(deletions.length, additions.length);
    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        oldLine: deletions[i] ?? null,
        newLine: additions[i] ?? null,
      });
    }
    deletions.length = 0;
    additions.length = 0;
  }

  for (const line of lines) {
    if (line.type === 'context') {
      flushPending();
      pairs.push({ oldLine: line, newLine: line });
    } else if (line.type === 'delete') {
      deletions.push(line);
    } else if (line.type === 'add') {
      additions.push(line);
    }
  }

  flushPending();
  return pairs;
}

function formatHunkHeader(hunk: DiffHunk): string {
  const { header } = hunk;
  const oldPart = header.oldCount === 1
    ? `${header.oldStart}`
    : `${header.oldStart},${header.oldCount}`;
  const newPart = header.newCount === 1
    ? `${header.newStart}`
    : `${header.newStart},${header.newCount}`;
  const ctx = header.context ? ` ${header.context}` : '';
  return `@@ -${oldPart} +${newPart} @@${ctx}`;
}

/**
 * Show a diff view overlay panel.
 */
export function showDiffOverlay(diff: FileDiff): void {
  // Remove existing overlay if any
  const existing = document.getElementById('diff-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'diff-overlay';
  overlay.className = 'diff-overlay slide-in-right';

  // Overlay header with close button
  const header = document.createElement('div');
  header.className = 'diff-overlay-header';

  const title = document.createElement('h3');
  title.className = 'diff-overlay-title';
  title.textContent = diff.path;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.title = 'Close diff';
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
  </svg>`;
  closeBtn.addEventListener('click', () => overlay.remove());

  header.appendChild(title);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Diff content
  const body = document.createElement('div');
  body.className = 'diff-overlay-body';
  renderDiffView(body, diff);
  overlay.appendChild(body);

  document.getElementById('app')?.appendChild(overlay);

  // Escape to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
