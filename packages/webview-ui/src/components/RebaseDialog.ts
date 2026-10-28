// ============================================================
// @dabzse/omnigit-webview-ui — Interactive Rebase Dialog Component
//
// Visual interactive rebase interface allowing users to:
//   - Reorder commits via Up/Down buttons or drag-and-drop
//   - Set actions: pick, reword, edit, squash, fixup, drop
//   - Visual action badges and summary
//   - Start or cancel rebase
// ============================================================

import type { RebaseAction, RebaseCommit, RebasePlan } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

const ACTION_DESCRIPTIONS: Record<RebaseAction, string> = {
  pick: 'Use commit as-is',
  reword: 'Use commit, but edit commit message',
  edit: 'Use commit, but stop for amending',
  squash: 'Meld into previous commit, keep message',
  fixup: 'Meld into previous commit, discard message',
  drop: 'Remove commit entirely',
};

const ACTION_OPTIONS: RebaseAction[] = ['pick', 'reword', 'edit', 'squash', 'fixup', 'drop'];

/**
 * Open the visual interactive rebase dialog.
 */
export function showRebaseDialog(plan: RebasePlan): void {
  // Remove existing dialog if open
  const existing = document.getElementById('rebase-dialog-modal');
  if (existing) existing.remove();

  // Create local working copy of planned commits
  const currentCommits: RebaseCommit[] = plan.commits.map((c: RebaseCommit) => ({ ...c }));

  // Modal backdrop
  const backdrop = document.createElement('div');
  backdrop.id = 'rebase-dialog-modal';
  backdrop.className = 'modal-backdrop fade-in';

  // Modal container
  const modal = document.createElement('div');
  modal.className = 'rebase-modal slide-in-down';

  // Header
  const header = document.createElement('div');
  header.className = 'rebase-modal-header';

  const titleBox = document.createElement('div');
  const title = document.createElement('h3');
  title.className = 'rebase-modal-title';
  title.innerHTML = `<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style="vertical-align: -3px; margin-right: 8px;">
    <path d="M5 3.254V3.25a.75.75 0 111.5 0v.004a2.25 2.25 0 01-.75 4.364v2.764a2.25 2.25 0 011.5 2.118.75.75 0 11-1.5 0 2.25 2.25 0 01-1.5-2.118V7.618a2.25 2.25 0 01.75-4.364zM10.25 4a.75.75 0 100 1.5.75.75 0 000-1.5zm0-1.5a2.25 2.25 0 110 4.5 2.25 2.25 0 010-4.5z"/>
  </svg>Interactive Rebase onto <span class="rebase-upstream-badge">${plan.upstreamShortHash || plan.upstream.slice(0, 7)}</span>`;

  const subtitle = document.createElement('p');
  subtitle.className = 'rebase-modal-subtitle';
  subtitle.textContent = 'Reorder commits and adjust actions. Commits are applied from top to bottom.';

  titleBox.appendChild(title);
  titleBox.appendChild(subtitle);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'icon-btn';
  closeBtn.title = 'Cancel and close';
  closeBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.708-.708L8 7.293 4.354 3.646l-.708.708L7.293 8l-3.647 3.646.708.708L8 8.707z"/>
  </svg>`;
  closeBtn.addEventListener('click', () => backdrop.remove());

  header.appendChild(titleBox);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Commit List Container
  const listContainer = document.createElement('div');
  listContainer.className = 'rebase-list-container';

  function renderList(): void {
    listContainer.innerHTML = '';

    if (currentCommits.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'rebase-empty-notice';
      emptyMsg.textContent = 'No commits to rebase (current branch is up to date with target).';
      listContainer.appendChild(emptyMsg);
      return;
    }

    currentCommits.forEach((commit, index) => {
      const row = document.createElement('div');
      row.className = `rebase-row rebase-row--${commit.action}`;

      // Move buttons (Up / Down)
      const moveControls = document.createElement('div');
      moveControls.className = 'rebase-row-reorder';

      const upBtn = document.createElement('button');
      upBtn.className = 'rebase-order-btn';
      upBtn.title = 'Move up';
      upBtn.disabled = index === 0;
      upBtn.innerHTML = '▲';
      upBtn.addEventListener('click', () => {
        if (index > 0) {
          const temp = currentCommits[index - 1];
          currentCommits[index - 1] = currentCommits[index];
          currentCommits[index] = temp;
          renderList();
          updateSummary();
        }
      });

      const downBtn = document.createElement('button');
      downBtn.className = 'rebase-order-btn';
      downBtn.title = 'Move down';
      downBtn.disabled = index === currentCommits.length - 1;
      downBtn.innerHTML = '▼';
      downBtn.addEventListener('click', () => {
        if (index < currentCommits.length - 1) {
          const temp = currentCommits[index + 1];
          currentCommits[index + 1] = currentCommits[index];
          currentCommits[index] = temp;
          renderList();
          updateSummary();
        }
      });

      moveControls.appendChild(upBtn);
      moveControls.appendChild(downBtn);

      // Action Selector
      const actionSelect = document.createElement('select');
      actionSelect.className = `rebase-action-select rebase-action--${commit.action}`;
      for (const act of ACTION_OPTIONS) {
        const opt = document.createElement('option');
        opt.value = act;
        opt.textContent = act.toUpperCase();
        opt.selected = commit.action === act;
        actionSelect.appendChild(opt);
      }
      actionSelect.title = ACTION_DESCRIPTIONS[commit.action];
      actionSelect.addEventListener('change', () => {
        commit.action = actionSelect.value as RebaseAction;
        actionSelect.className = `rebase-action-select rebase-action--${commit.action}`;
        row.className = `rebase-row rebase-row--${commit.action}`;
        actionSelect.title = ACTION_DESCRIPTIONS[commit.action];
        updateSummary();
      });

      // Commit Info
      const info = document.createElement('div');
      info.className = 'rebase-row-info';

      const hashSpan = document.createElement('span');
      hashSpan.className = 'rebase-commit-hash';
      hashSpan.textContent = commit.shortHash || commit.hash.slice(0, 7);

      const subjectSpan = document.createElement('span');
      subjectSpan.className = 'rebase-commit-subject';
      subjectSpan.textContent = commit.subject;
      subjectSpan.title = commit.subject;

      const authorSpan = document.createElement('span');
      authorSpan.className = 'rebase-commit-author';
      authorSpan.textContent = commit.author;

      info.appendChild(hashSpan);
      info.appendChild(subjectSpan);
      info.appendChild(authorSpan);

      row.appendChild(moveControls);
      row.appendChild(actionSelect);
      row.appendChild(info);

      listContainer.appendChild(row);
    });
  }

  modal.appendChild(listContainer);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'rebase-modal-footer';

  const summary = document.createElement('div');
  summary.className = 'rebase-modal-summary';

  function updateSummary(): void {
    const counts: Record<string, number> = {};
    for (const c of currentCommits) {
      counts[c.action] = (counts[c.action] || 0) + 1;
    }
    const breakdown = Object.entries(counts)
      .map(([act, cnt]) => `<span class="rebase-badge rebase-badge--${act}">${cnt} ${act}</span>`)
      .join(' ');
    summary.innerHTML = `${currentCommits.length} commits &nbsp;•&nbsp; ${breakdown}`;
  }

  const actions = document.createElement('div');
  actions.className = 'rebase-modal-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'rebase-btn rebase-btn--cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => backdrop.remove());

  const startBtn = document.createElement('button');
  startBtn.className = 'rebase-btn rebase-btn--start';
  startBtn.textContent = 'Start Rebase';
  startBtn.disabled = currentCommits.length === 0;
  startBtn.addEventListener('click', () => {
    backdrop.remove();
    bridge.send({
      type: 'startInteractiveRebase',
      data: {
        upstream: plan.upstream,
        plan: currentCommits.map((c) => ({ hash: c.hash, action: c.action })),
      },
    });
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(startBtn);

  footer.appendChild(summary);
  footer.appendChild(actions);
  modal.appendChild(footer);

  backdrop.appendChild(modal);
  document.getElementById('app')?.appendChild(backdrop);

  renderList();
  updateSummary();

  // Escape key to close
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      backdrop.remove();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);
}
