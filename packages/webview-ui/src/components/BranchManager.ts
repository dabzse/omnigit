// ============================================================
// @dabzse/omnigit-webview-ui — Branch Manager Component
//
// UI for branch and tag CRUD operations:
//   - List branches (local + remote)
//   - Create, checkout, delete, rename branches
//   - List, create, delete tags
// ============================================================

import type { Branch, Tag } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

/**
 * Render the branch manager panel.
 */
export function renderBranchManager(
  container: HTMLElement,
  branches: Branch[],
  tags: Tag[],
): void {
  container.innerHTML = '';
  container.className = 'branch-manager fade-in';

  // Tabs: Branches | Tags
  const tabs = document.createElement('div');
  tabs.className = 'branch-tabs';

  const branchTab = createTab('Branches', branches.length, true);
  const tagTab = createTab('Tags', tags.length, false);

  const branchPanel = document.createElement('div');
  branchPanel.className = 'branch-tab-panel';
  branchPanel.id = 'branch-tab-branches';

  const tagPanel = document.createElement('div');
  tagPanel.className = 'branch-tab-panel hidden';
  tagPanel.id = 'branch-tab-tags';

  branchTab.addEventListener('click', () => {
    branchTab.classList.add('active');
    tagTab.classList.remove('active');
    branchPanel.classList.remove('hidden');
    tagPanel.classList.add('hidden');
  });

  tagTab.addEventListener('click', () => {
    tagTab.classList.add('active');
    branchTab.classList.remove('active');
    tagPanel.classList.remove('hidden');
    branchPanel.classList.add('hidden');
  });

  tabs.appendChild(branchTab);
  tabs.appendChild(tagTab);
  container.appendChild(tabs);

  // Branch list
  renderBranchList(branchPanel, branches);
  container.appendChild(branchPanel);

  // Tag list
  renderTagList(tagPanel, tags);
  container.appendChild(tagPanel);
}

function createTab(label: string, count: number, active: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = `branch-tab ${active ? 'active' : ''}`;
  btn.innerHTML = `${label} <span class="branch-tab-count">${count}</span>`;
  return btn;
}

// Branch List

function renderBranchList(container: HTMLElement, branches: Branch[]): void {
  // Create branch button
  const createBar = document.createElement('div');
  createBar.className = 'branch-create-bar';

  const nameInput = document.createElement('input');
  nameInput.className = 'branch-input';
  nameInput.placeholder = 'New branch name...';
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;

  const createBtn = document.createElement('button');
  createBtn.className = 'branch-action-btn branch-action-btn--create';
  createBtn.textContent = 'Create';
  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    bridge.send({ type: 'createBranch', data: { name } });
    nameInput.value = '';
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
  });

  createBar.appendChild(nameInput);
  createBar.appendChild(createBtn);
  container.appendChild(createBar);

  // Separate local and remote branches
  const localBranches = branches.filter((b) => !b.isRemote);
  const remoteBranches = branches.filter((b) => b.isRemote);

  if (localBranches.length > 0) {
    const section = createSection('Local Branches');
    for (const branch of localBranches) {
      section.appendChild(createBranchItem(branch));
    }
    container.appendChild(section);
  }

  if (remoteBranches.length > 0) {
    const section = createSection('Remote Branches');
    for (const branch of remoteBranches) {
      section.appendChild(createBranchItem(branch));
    }
    container.appendChild(section);
  }
}

function createBranchItem(branch: Branch): HTMLDivElement {
  const item = document.createElement('div');
  item.className = `branch-item ${branch.isCurrent ? 'branch-item--current' : ''}`;

  // Branch icon
  const icon = document.createElement('span');
  icon.className = 'branch-item-icon';
  icon.innerHTML = branch.isCurrent
    ? `<svg width="14" height="14" viewBox="0 0 16 16" fill="var(--og-success)"><circle cx="8" cy="8" r="3"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 16 16" fill="var(--og-fg-subtle)"><circle cx="8" cy="8" r="2.5" stroke="currentColor" fill="none"/></svg>`;

  // Branch name
  const nameEl = document.createElement('span');
  nameEl.className = 'branch-item-name';
  nameEl.textContent = branch.name;
  if (branch.isCurrent) nameEl.classList.add('branch-item-name--current');

  // Last commit info
  const infoEl = document.createElement('span');
  infoEl.className = 'branch-item-info';
  infoEl.textContent = branch.lastCommitSubject;
  infoEl.title = `${branch.hash.slice(0, 7)} — ${branch.lastCommitSubject}`;

  // Actions
  const actions = document.createElement('div');
  actions.className = 'branch-item-actions';

  if (!branch.isCurrent && !branch.isRemote) {
    // Checkout button
    const checkoutBtn = createIconButton(
      'Checkout',
      `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h4v1H3v10h10V9h1v5H2V2zm5.293 7L12 4.293V7h1V2H8v1h2.707L6 7.707 6.293 8 10.293 12H8v1h5v-5h-1v2.707L7.293 6 12 1.293V4h1V-1H8v1h2.707L6 4.707z"/></svg>`,
    );
    checkoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      bridge.send({ type: 'checkoutBranch', data: { name: branch.name } });
    });
    actions.appendChild(checkoutBtn);

    // Delete button
    const deleteBtn = createIconButton(
      'Delete',
      `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 011-1h2a1 1 0 011 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5zm2 2h1v5H7V6zm3 0h-1v5h1V6z"/></svg>`,
    );
    deleteBtn.classList.add('branch-action-btn--danger');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Delete branch "${branch.name}"?`)) {
        bridge.send({ type: 'deleteBranch', data: { name: branch.name } });
      }
    });
    actions.appendChild(deleteBtn);
  }

  item.appendChild(icon);
  item.appendChild(nameEl);
  item.appendChild(infoEl);
  item.appendChild(actions);

  // Click to checkout
  if (!branch.isCurrent && !branch.isRemote) {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      bridge.send({ type: 'checkoutBranch', data: { name: branch.name } });
    });
  }

  return item;
}

// Tag List

function renderTagList(container: HTMLElement, tags: Tag[]): void {
  // Create tag bar
  const createBar = document.createElement('div');
  createBar.className = 'branch-create-bar';

  const nameInput = document.createElement('input');
  nameInput.className = 'branch-input';
  nameInput.placeholder = 'New tag name...';
  nameInput.autocomplete = 'off';
  nameInput.spellcheck = false;

  const msgInput = document.createElement('input');
  msgInput.className = 'branch-input';
  msgInput.placeholder = 'Tag message (optional)...';
  msgInput.autocomplete = 'off';
  msgInput.spellcheck = false;

  const createBtn = document.createElement('button');
  createBtn.className = 'branch-action-btn branch-action-btn--create';
  createBtn.textContent = 'Create';
  createBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    if (!name) return;
    const message = msgInput.value.trim() || undefined;
    bridge.send({
      type: 'createTag',
      data: { name, hash: 'HEAD', message },
    });
    nameInput.value = '';
    msgInput.value = '';
  });

  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') msgInput.focus();
  });
  msgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createBtn.click();
  });

  createBar.appendChild(nameInput);
  createBar.appendChild(msgInput);
  createBar.appendChild(createBtn);
  container.appendChild(createBar);

  if (tags.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'branch-empty';
    empty.textContent = 'No tags found';
    container.appendChild(empty);
    return;
  }

  const list = createSection('Tags');
  for (const tag of tags) {
    list.appendChild(createTagItem(tag));
  }
  container.appendChild(list);
}

function createTagItem(tag: Tag): HTMLDivElement {
  const item = document.createElement('div');
  item.className = 'branch-item';

  const icon = document.createElement('span');
  icon.className = 'branch-item-icon';
  icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="var(--og-warning)"><path d="M7.74 1.053a.5.5 0 01.52 0l5.5 3.5a.5.5 0 01.24.427v6.04a.5.5 0 01-.24.427l-5.5 3.5a.5.5 0 01-.52 0l-5.5-3.5A.5.5 0 012 11.02V4.98a.5.5 0 01.24-.427l5.5-3.5z"/></svg>`;

  const nameEl = document.createElement('span');
  nameEl.className = 'branch-item-name';
  nameEl.textContent = tag.name;

  const infoEl = document.createElement('span');
  infoEl.className = 'branch-item-info';
  infoEl.textContent = tag.message || tag.hash.slice(0, 7);
  infoEl.title = tag.hash;

  const actions = document.createElement('div');
  actions.className = 'branch-item-actions';

  const deleteBtn = createIconButton(
    'Delete',
    `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M10 3h3v1h-1v9l-1 1H5l-1-1V4H3V3h3V2a1 1 0 011-1h2a1 1 0 011 1v1zM9 2H7v1h2V2zM5 4v9h6V4H5zm2 2h1v5H7V6zm3 0h-1v5h1V6z"/></svg>`,
  );
  deleteBtn.classList.add('branch-action-btn--danger');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Delete tag "${tag.name}"?`)) {
      bridge.send({ type: 'deleteTag', data: { name: tag.name } });
    }
  });
  actions.appendChild(deleteBtn);

  item.appendChild(icon);
  item.appendChild(nameEl);
  item.appendChild(infoEl);
  item.appendChild(actions);

  return item;
}

// Helpers

function createSection(title: string): HTMLDivElement {
  const section = document.createElement('div');
  section.className = 'branch-section';

  const header = document.createElement('div');
  header.className = 'branch-section-header';
  header.textContent = title;
  section.appendChild(header);

  return section;
}

function createIconButton(title: string, svgHtml: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'icon-btn';
  btn.title = title;
  btn.innerHTML = svgHtml;
  return btn;
}
