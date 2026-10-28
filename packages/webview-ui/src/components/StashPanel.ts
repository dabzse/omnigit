// ============================================================
// @dabzse/omnigit-webview-ui — Stash Panel Component
//
// Stash management UI with:
//   - List of stash entries
//   - Apply, pop, drop operations
//   - Save new stash with optional message
// ============================================================

import type { StashEntry } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

/**
 * Render the stash management panel.
 */
export function renderStashPanel(
  container: HTMLElement,
  stashes: StashEntry[],
): void {
  container.innerHTML = '';
  container.className = 'stash-panel fade-in';

  // Header
  const header = document.createElement('div');
  header.className = 'stash-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'stash-title';
  titleEl.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -2px; margin-right: 6px">
    <path d="M14.5 2H9l-.35-.15-.65-.65-.65.65L7 2H1.5l-.5.5v3l.5.5H2v6.5l.5.5h11l.5-.5V6h.5l.5-.5v-3l-.5-.5zM13 12H3V6h1v.5l.5.5h7l.5-.5V6h1v6zm1-7H8V4l.5-.5h5l.5.5v1zM7 5H2V3h5v2z"/>
  </svg>Stashes <span class="stash-count">(${stashes.length})</span>`;
  header.appendChild(titleEl);
  container.appendChild(header);

  // Save stash bar
  const saveBar = document.createElement('div');
  saveBar.className = 'stash-save-bar';

  const msgInput = document.createElement('input');
  msgInput.className = 'stash-input';
  msgInput.placeholder = 'Stash message (optional)...';
  msgInput.autocomplete = 'off';
  msgInput.spellcheck = false;

  const untrackedCheckbox = document.createElement('label');
  untrackedCheckbox.className = 'stash-checkbox-label';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'stash-checkbox';
  untrackedCheckbox.appendChild(checkbox);
  untrackedCheckbox.appendChild(document.createTextNode(' Include untracked'));

  const saveBtn = document.createElement('button');
  saveBtn.className = 'stash-btn stash-btn--save';
  saveBtn.textContent = 'Stash';
  saveBtn.addEventListener('click', () => {
    bridge.send({
      type: 'stashSave',
      data: {
        message: msgInput.value.trim() || undefined,
        includeUntracked: checkbox.checked,
      },
    });
    msgInput.value = '';
    checkbox.checked = false;
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveBtn.click();
  });

  saveBar.appendChild(msgInput);
  saveBar.appendChild(untrackedCheckbox);
  saveBar.appendChild(saveBtn);
  container.appendChild(saveBar);

  // Stash list
  if (stashes.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'stash-empty';
    empty.innerHTML = `
      <svg width="48" height="48" viewBox="0 0 16 16" fill="var(--og-fg-subtle)" opacity="0.3">
        <path d="M14.5 2H9l-.35-.15-.65-.65-.65.65L7 2H1.5l-.5.5v3l.5.5H2v6.5l.5.5h11l.5-.5V6h.5l.5-.5v-3l-.5-.5zM13 12H3V6h1v.5l.5.5h7l.5-.5V6h1v6zm1-7H8V4l.5-.5h5l.5.5v1zM7 5H2V3h5v2z"/>
      </svg>
      <p>No stashes</p>
      <p class="stash-empty-hint">Use the form above to stash your working changes</p>
    `;
    container.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  list.className = 'stash-list';

  for (const stash of stashes) {
    list.appendChild(createStashEntry(stash));
  }

  container.appendChild(list);
}

function createStashEntry(stash: StashEntry): HTMLDivElement {
  const entry = document.createElement('div');
  entry.className = 'stash-entry';

  // Left: info
  const info = document.createElement('div');
  info.className = 'stash-entry-info';

  const indexEl = document.createElement('span');
  indexEl.className = 'stash-entry-index';
  indexEl.textContent = `stash@{${stash.index}}`;

  const messageEl = document.createElement('div');
  messageEl.className = 'stash-entry-message';
  messageEl.textContent = stash.message;
  messageEl.title = stash.message;

  const metaEl = document.createElement('div');
  metaEl.className = 'stash-entry-meta';
  metaEl.textContent = `on ${stash.branch} · ${formatStashDate(stash.date)}`;

  info.appendChild(indexEl);
  info.appendChild(messageEl);
  info.appendChild(metaEl);

  // Right: actions
  const actions = document.createElement('div');
  actions.className = 'stash-entry-actions';

  const diffBtn = document.createElement('button');
  diffBtn.className = 'stash-btn stash-btn--diff';
  diffBtn.textContent = 'Diff';
  diffBtn.title = 'View stashed changes';
  diffBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bridge.send({ type: 'viewStashDiff', data: { index: stash.index } });
  });

  const applyBtn = document.createElement('button');
  applyBtn.className = 'stash-btn stash-btn--apply';
  applyBtn.textContent = 'Apply';
  applyBtn.title = 'Apply stash (keep in list)';
  applyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bridge.send({ type: 'stashApply', data: { index: stash.index } });
  });

  const popBtn = document.createElement('button');
  popBtn.className = 'stash-btn stash-btn--pop';
  popBtn.textContent = 'Pop';
  popBtn.title = 'Apply stash and remove from list';
  popBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    bridge.send({ type: 'stashPop', data: { index: stash.index } });
  });

  const dropBtn = document.createElement('button');
  dropBtn.className = 'stash-btn stash-btn--drop';
  dropBtn.textContent = 'Drop';
  dropBtn.title = 'Delete stash permanently';
  dropBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Drop stash@{${stash.index}}?\n\n${stash.message}`)) {
      bridge.send({ type: 'stashDrop', data: { index: stash.index } });
    }
  });

  actions.appendChild(diffBtn);
  actions.appendChild(applyBtn);
  actions.appendChild(popBtn);
  actions.appendChild(dropBtn);

  entry.appendChild(info);
  entry.appendChild(actions);

  entry.addEventListener('click', () => {
    bridge.send({ type: 'viewStashDiff', data: { index: stash.index } });
  });

  return entry;
}

function formatStashDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
