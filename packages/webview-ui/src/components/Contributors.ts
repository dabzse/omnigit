// ============================================================
// @dabzse/omnigit-webview-ui — Contributors View
//
// Displays repository contributors sorted by commit count,
// with stats, avatars, and date ranges.
// ============================================================

import type { Contributor } from '@dabzse/omnigit-core';

/**
 * Render the contributors view.
 */
export function renderContributors(
  container: HTMLElement,
  contributors: Contributor[],
): void {
  container.innerHTML = '';
  container.className = 'contributors fade-in';

  // Header
  const header = document.createElement('div');
  header.className = 'contributors-header';

  const titleEl = document.createElement('h3');
  titleEl.className = 'contributors-title';
  titleEl.textContent = `Contributors (${contributors.length})`;
  header.appendChild(titleEl);

  const totalCommits = contributors.reduce((sum, c) => sum + c.commits, 0);
  const statsEl = document.createElement('span');
  statsEl.className = 'contributors-stats';
  statsEl.textContent = `${totalCommits.toLocaleString()} total commits`;
  header.appendChild(statsEl);

  container.appendChild(header);

  if (contributors.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'contributors-empty';
    empty.textContent = 'No contributors found';
    container.appendChild(empty);
    return;
  }

  // Find max commits for bar scaling
  const maxCommits = contributors[0]?.commits ?? 1;

  const list = document.createElement('div');
  list.className = 'contributors-list';

  for (let i = 0; i < contributors.length; i++) {
    list.appendChild(createContributorCard(contributors[i], i + 1, maxCommits));
  }

  container.appendChild(list);
}

function createContributorCard(
  contributor: Contributor,
  rank: number,
  maxCommits: number,
): HTMLDivElement {
  const card = document.createElement('div');
  card.className = 'contributor-card';

  // Rank
  const rankEl = document.createElement('span');
  rankEl.className = 'contributor-rank';
  rankEl.textContent = `#${rank}`;

  // Avatar (gravatar-style initials)
  const avatar = document.createElement('div');
  avatar.className = 'contributor-avatar';
  avatar.textContent = getInitials(contributor.name);
  avatar.style.backgroundColor = getAvatarColor(contributor.email);

  // Info
  const info = document.createElement('div');
  info.className = 'contributor-info';

  const nameEl = document.createElement('div');
  nameEl.className = 'contributor-name';
  nameEl.textContent = contributor.name;

  const emailEl = document.createElement('div');
  emailEl.className = 'contributor-email';
  emailEl.textContent = contributor.email;

  const dateRange = document.createElement('div');
  dateRange.className = 'contributor-dates';
  dateRange.textContent = `${formatDate(contributor.firstCommitDate)} — ${formatDate(contributor.lastCommitDate)}`;

  info.appendChild(nameEl);
  info.appendChild(emailEl);
  info.appendChild(dateRange);

  // Commits bar + count
  const commitInfo = document.createElement('div');
  commitInfo.className = 'contributor-commits';

  const countEl = document.createElement('span');
  countEl.className = 'contributor-commit-count';
  countEl.textContent = `${contributor.commits}`;

  const barContainer = document.createElement('div');
  barContainer.className = 'contributor-bar-container';

  const bar = document.createElement('div');
  bar.className = 'contributor-bar';
  const percentage = (contributor.commits / maxCommits) * 100;
  bar.style.width = `${percentage}%`;

  barContainer.appendChild(bar);
  commitInfo.appendChild(countEl);
  commitInfo.appendChild(barContainer);

  card.appendChild(rankEl);
  card.appendChild(avatar);
  card.appendChild(info);
  card.appendChild(commitInfo);

  return card;
}

// Helpers

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    const lastPart = parts.at(-1) ?? '';
    return (parts[0][0] + (lastPart[0] ?? '')).toUpperCase();
  }
  return (name[0] ?? '?').toUpperCase();
}

function getAvatarColor(email: string): string {
  // Simple hash-based color
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = ((hash << 5) - hash) + (email.codePointAt(i) ?? 0);
    hash &= hash;
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
