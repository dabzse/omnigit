// ============================================================
// @dabzse/omnigit-webview-ui — Commit Row Renderer
//
// Builds commit row elements for the commit list table.
// ============================================================

import type { Commit, Ref } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

/**
 * Format a unix timestamp as a relative time string.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}

/**
 * Create a ref badge element.
 */
function createRefBadge(ref: Ref): HTMLSpanElement {
  const el = document.createElement('span');

  let className = 'commit-ref';
  if (ref.isHead) {
    className += ' commit-ref--current';
  } else if (ref.type === 'tag') {
    className += ' commit-ref--tag';
  } else if (ref.type === 'remote') {
    className += ' commit-ref--remote';
  } else {
    className += ' commit-ref--head';
  }

  el.className = className;
  el.textContent = ref.name;
  el.title = ref.name;

  return el;
}

/**
 * Create a commit row element.
 */
export function createCommitRow(
  commit: Commit,
  onClick: (hash: string) => void,
): HTMLDivElement {
  const row = document.createElement('div');
  row.className = 'commit-row';
  row.dataset.hash = commit.hash;

  // Hash
  const hashEl = document.createElement('span');
  hashEl.className = 'commit-hash';
  hashEl.textContent = commit.shortHash;
  hashEl.title = commit.hash;

  // Message
  const messageEl = document.createElement('span');
  messageEl.className = 'commit-message';
  messageEl.textContent = commit.subject;
  messageEl.title = commit.subject;

  // Ref badges
  const refsEl = document.createElement('span');
  refsEl.className = 'commit-refs';
  for (const ref of commit.refs) {
    if (ref.name === 'HEAD') continue; // Skip standalone HEAD
    refsEl.appendChild(createRefBadge(ref));
  }

  // Author
  const authorEl = document.createElement('span');
  authorEl.className = 'commit-author';
  authorEl.textContent = commit.author.name;
  authorEl.title = `${commit.author.name} <${commit.author.email}>`;

  // Date
  const dateEl = document.createElement('span');
  dateEl.className = 'commit-date';
  dateEl.textContent = formatRelativeTime(commit.authorDate);
  dateEl.title = new Date(commit.authorDate * 1000).toLocaleString();

  // Assemble row
  row.appendChild(hashEl);
  if (refsEl.children.length > 0) {
    row.appendChild(refsEl);
  }
  row.appendChild(messageEl);
  row.appendChild(authorEl);
  row.appendChild(dateEl);

  // Click handler
  row.addEventListener('click', () => onClick(commit.hash));

  // Context menu
  row.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showCommitContextMenu(e.clientX, e.clientY, commit);
  });

  return row;
}

function showCommitContextMenu(x: number, y: number, commit: Commit): void {
  // Remove existing context menu
  document.querySelectorAll('.commit-context-menu').forEach((el) => el.remove());

  const menu = document.createElement('div');
  menu.className = 'commit-context-menu fade-in';
  menu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 230)}px`;

  const items = [
    {
      label: `Checkout ${commit.shortHash}`,
      action: () => bridge.send({ type: 'checkoutCommit', data: { hash: commit.hash } }),
    },
    {
      label: 'Cherry-Pick Commit',
      action: () => bridge.send({ type: 'cherryPick', data: { hash: commit.hash } }),
    },
    {
      label: 'Interactive Rebase from here...',
      action: () => bridge.send({ type: 'requestRebasePlan', data: { upstream: commit.hash } }),
    },
    {
      label: 'Revert Commit',
      action: () => bridge.send({ type: 'revert', data: { hash: commit.hash } }),
    },
    {
      label: 'Create Branch Here...',
      action: () => {
        const name = prompt(`Branch name at ${commit.shortHash}:`);
        if (name?.trim()) {
          bridge.send({ type: 'createBranch', data: { name: name.trim(), startPoint: commit.hash } });
        }
      },
    },
    {
      label: 'Create Tag Here...',
      action: () => {
        const name = prompt(`Tag name at ${commit.shortHash}:`);
        if (name?.trim()) {
          bridge.send({ type: 'createTag', data: { name: name.trim(), hash: commit.hash } });
        }
      },
    },
    {
      label: 'Copy Commit Hash',
      action: () => bridge.send({ type: 'copyToClipboard', data: { text: commit.hash } }),
    },
  ];

  for (const item of items) {
    const itemEl = document.createElement('div');
    itemEl.className = 'context-menu-item';
    itemEl.textContent = item.label;
    itemEl.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      item.action();
    });
    menu.appendChild(itemEl);
  }

  document.body.appendChild(menu);

  // Close when clicking outside
  const closeHandler = () => {
    menu.remove();
    document.removeEventListener('click', closeHandler);
  };
  setTimeout(() => document.addEventListener('click', closeHandler), 0);
}

/**
 * Update the selected state of commit rows.
 */
export function selectCommitRow(container: HTMLElement, hash: string): void {
  // Deselect all
  container.querySelectorAll('.commit-row.selected').forEach((el) => {
    el.classList.remove('selected');
  });

  // Select the matching row
  const row = container.querySelector(`.commit-row[data-hash="${hash}"]`);
  if (row) {
    row.classList.add('selected');
    // Scroll into view if needed
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
