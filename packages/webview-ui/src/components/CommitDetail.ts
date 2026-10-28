// ============================================================
// @dabzse/omnigit-webview-ui — Commit Detail Panel
//
// Renders full commit information in the right-side panel:
//   - Hash, author, date, message
//   - Changed files with status icons and stats
// ============================================================

import type { Commit, DiffFileStat } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

const STATUS_LABELS: Record<string, { letter: string; class: string }> = {
  added:    { letter: 'A', class: 'detail-file-status--added' },
  modified: { letter: 'M', class: 'detail-file-status--modified' },
  deleted:  { letter: 'D', class: 'detail-file-status--deleted' },
  renamed:  { letter: 'R', class: 'detail-file-status--renamed' },
  copied:   { letter: 'C', class: 'detail-file-status--renamed' },
  untracked:{ letter: '?', class: 'detail-file-status--added' },
};

/**
 * Render commit details into the detail panel body.
 */
export function renderCommitDetail(
  container: HTMLElement,
  commit: Commit,
  files: DiffFileStat[] = [],
): void {
  container.innerHTML = '';
  container.className = 'detail-body slide-in-right';

  // Actions Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'detail-toolbar';

  const checkoutBtn = createActionButton('Checkout', () => {
    bridge.send({ type: 'checkoutCommit', data: { hash: commit.hash } });
  });

  const cherryPickBtn = createActionButton('Cherry-Pick', () => {
    bridge.send({ type: 'cherryPick', data: { hash: commit.hash } });
  });

  const revertBtn = createActionButton('Revert', () => {
    bridge.send({ type: 'revert', data: { hash: commit.hash } });
  });

  const branchBtn = createActionButton('New Branch', () => {
    const name = prompt(`Create branch at ${commit.shortHash}:`);
    if (name?.trim()) {
      bridge.send({ type: 'createBranch', data: { name: name.trim(), startPoint: commit.hash } });
    }
  });

  const tagBtn = createActionButton('New Tag', () => {
    const name = prompt(`Create tag at ${commit.shortHash}:`);
    if (name?.trim()) {
      bridge.send({ type: 'createTag', data: { name: name.trim(), hash: commit.hash } });
    }
  });

  const copyBtn = createActionButton('Copy Hash', () => {
    bridge.send({ type: 'copyToClipboard', data: { text: commit.hash } });
  });

  toolbar.appendChild(checkoutBtn);
  toolbar.appendChild(cherryPickBtn);
  toolbar.appendChild(revertBtn);
  toolbar.appendChild(branchBtn);
  toolbar.appendChild(tagBtn);
  toolbar.appendChild(copyBtn);
  container.appendChild(toolbar);

  const info = document.createElement('div');
  info.className = 'detail-commit-info';

  // Hash
  info.appendChild(createField('Commit', commit.hash, true));

  // Author
  info.appendChild(
    createField('Author', `${commit.author.name} <${commit.author.email}>`),
  );

  // Date
  const dateStr = new Date(commit.authorDate * 1000).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  info.appendChild(createField('Date', dateStr));

  // Parents
  if (commit.parents.length > 0) {
    const parentsValue = commit.parents
      .map((p: string) => p.slice(0, 7))
      .join(', ');
    info.appendChild(createField('Parents', parentsValue, true));
  }

  // Message
  const msgSection = document.createElement('div');
  msgSection.className = 'detail-field';

  const msgLabel = document.createElement('div');
  msgLabel.className = 'detail-label';
  msgLabel.textContent = 'Message';
  msgSection.appendChild(msgLabel);

  const msgValue = document.createElement('div');
  msgValue.className = 'detail-message';
  msgValue.textContent = commit.body
    ? `${commit.subject}\n\n${commit.body}`
    : commit.subject;
  msgSection.appendChild(msgValue);

  info.appendChild(msgSection);

  container.appendChild(info);

  // Files
  if (files.length > 0) {
    const filesHeader = document.createElement('div');
    filesHeader.className = 'detail-label';
    filesHeader.style.marginTop = 'var(--og-space-lg)';
    filesHeader.textContent = `Changed Files (${files.length})`;
    container.appendChild(filesHeader);

    const fileList = document.createElement('div');
    fileList.className = 'detail-files';

    for (const file of files) {
      fileList.appendChild(createFileItem(file, commit.hash));
    }

    container.appendChild(fileList);
  }
}

function createActionButton(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'detail-action-btn';
  btn.textContent = label;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

function createField(label: string, value: string, mono = false): HTMLDivElement {
  const field = document.createElement('div');
  field.className = 'detail-field';

  const labelEl = document.createElement('div');
  labelEl.className = 'detail-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('div');
  valueEl.className = mono ? 'detail-value detail-value--mono' : 'detail-value';
  valueEl.textContent = value;

  field.appendChild(labelEl);
  field.appendChild(valueEl);

  return field;
}

function createFileItem(file: DiffFileStat, commitHash: string): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'detail-file-item';

  // Status badge
  const statusInfo = STATUS_LABELS[file.status] ?? { letter: '?', class: '' };
  const statusEl = document.createElement('span');
  statusEl.className = `detail-file-status ${statusInfo.class}`;
  statusEl.textContent = statusInfo.letter;
  statusEl.title = file.status;

  // File path
  const pathEl = document.createElement('span');
  pathEl.className = 'detail-file-path';
  const displayPath = file.oldPath ? `${file.oldPath} → ${file.path}` : file.path;
  pathEl.textContent = displayPath;
  pathEl.title = displayPath;

  // File quick action buttons (History, Open)
  const actionsEl = document.createElement('div');
  actionsEl.className = 'detail-file-actions';

  const historyBtn = document.createElement('button');
  historyBtn.className = 'detail-file-action-btn';
  historyBtn.title = 'View file history';
  historyBtn.textContent = 'History';
  historyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bridge.send({ type: 'requestFileHistory', data: { filePath: file.path } });
  });

  const openBtn = document.createElement('button');
  openBtn.className = 'detail-file-action-btn';
  openBtn.title = 'Open in editor';
  openBtn.textContent = 'Open';
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bridge.send({ type: 'openFile', data: { filePath: file.path } });
  });

  actionsEl.appendChild(historyBtn);
  actionsEl.appendChild(openBtn);

  // Stats
  const statsEl = document.createElement('span');
  statsEl.className = 'detail-file-stats';
  if (file.additions > 0) {
    const addEl = document.createElement('span');
    addEl.className = 'detail-file-additions';
    addEl.textContent = `+${file.additions}`;
    statsEl.appendChild(addEl);
  }
  if (file.deletions > 0) {
    if (file.additions > 0) {
      statsEl.appendChild(document.createTextNode(' '));
    }
    const delEl = document.createElement('span');
    delEl.className = 'detail-file-deletions';
    delEl.textContent = `-${file.deletions}`;
    statsEl.appendChild(delEl);
  }

  item.appendChild(statusEl);
  item.appendChild(pathEl);
  item.appendChild(actionsEl);
  item.appendChild(statsEl);

  // Click to open file diff
  item.addEventListener('click', () => {
    bridge.send({
      type: 'requestFileDiff',
      data: { hash: commitHash, filePath: file.path },
    });
  });

  return item;
}

/**
 * Render commit comparison results into the detail panel body.
 */
export function renderCommitComparison(
  container: HTMLElement,
  base: string,
  target: string,
  files: DiffFileStat[] = [],
): void {
  container.innerHTML = '';
  container.className = 'detail-body slide-in-right';

  const header = document.createElement('div');
  header.className = 'detail-field';

  const labelEl = document.createElement('div');
  labelEl.className = 'detail-label';
  labelEl.textContent = 'Commit Comparison';

  const rangeEl = document.createElement('div');
  rangeEl.className = 'detail-value detail-value--mono';
  rangeEl.textContent = `${base.slice(0, 7)} ↔ ${target.slice(0, 7)}`;

  const countEl = document.createElement('div');
  countEl.style.fontSize = 'var(--og-font-size-xs)';
  countEl.style.color = 'var(--og-fg-subtle)';
  countEl.style.marginTop = '4px';
  countEl.textContent = `${files.length} files changed between commits`;

  header.appendChild(labelEl);
  header.appendChild(rangeEl);
  header.appendChild(countEl);
  container.appendChild(header);

  if (files.length > 0) {
    const fileList = document.createElement('div');
    fileList.className = 'detail-files';
    for (const file of files) {
      fileList.appendChild(createFileItem(file, target));
    }
    container.appendChild(fileList);
  }
}

/**
 * Show the detail panel with animation.
 */
export function showDetailPanel(): void {
  const panel = document.getElementById('detail-panel');
  if (panel) {
    panel.classList.remove('hidden');
  }
}

/**
 * Hide the detail panel.
 */
export function hideDetailPanel(): void {
  const panel = document.getElementById('detail-panel');
  if (panel) {
    panel.classList.add('hidden');
  }
}
