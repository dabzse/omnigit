// ============================================================
// @dabzse/omnigit-webview-ui — File History Timeline
//
// Displays a vertical timeline of commits that affected
// a specific file, with author, date, message, and diff stats.
// ============================================================

import type { Commit } from '@dabzse/omnigit-core';
import { bridge } from '../bridge.js';

/**
 * Render file history as a timeline into a container.
 */
export function renderFileHistory(
  container: HTMLElement,
  filePath: string,
  commits: Commit[],
): void {
  container.innerHTML = '';
  container.className = 'file-history fade-in';

  // Header
  const header = document.createElement('div');
  header.className = 'file-history-header';

  const icon = document.createElement('span');
  icon.className = 'file-history-icon';
  icon.innerHTML = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.507 12.324a7 7 0 00.065-8.56A7 7 0 002 4.393V2H1v3.5l.5.5H5V5H2.811a6.008 6.008 0 1111.212 5.303l.514.786a7.036 7.036 0 00-.03-1.765zM8 5v3.585l2.243 1.58-.814 1.07L7 9.415V5h1z"/>
  </svg>`;

  const titleEl = document.createElement('span');
  titleEl.className = 'file-history-title';
  titleEl.textContent = `History: ${filePath.split('/').pop() ?? filePath}`;

  const countEl = document.createElement('span');
  countEl.className = 'file-history-count';
  countEl.textContent = `${commits.length} changes`;

  header.appendChild(icon);
  header.appendChild(titleEl);
  header.appendChild(countEl);
  container.appendChild(header);

  // Full path subtitle
  const subtitle = document.createElement('div');
  subtitle.className = 'file-history-path';
  subtitle.textContent = filePath;
  container.appendChild(subtitle);

  // Timeline
  if (commits.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'file-history-empty';
    empty.textContent = 'No history found for this file';
    container.appendChild(empty);
    return;
  }

  const timeline = document.createElement('div');
  timeline.className = 'file-history-timeline';

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const entry = createTimelineEntry(commit, i === 0, i === commits.length - 1, filePath);
    timeline.appendChild(entry);
  }

  container.appendChild(timeline);
}

function getRefBadgeModifier(ref: import('@dabzse/omnigit-core').Ref): string {
  if (ref.type === 'tag') return 'tag';
  if (ref.isHead) return 'current';
  if (ref.type === 'remote') return 'remote';
  return 'head';
}

function createTimelineRefs(refsList: readonly import('@dabzse/omnigit-core').Ref[]): HTMLDivElement | null {
  if (refsList.length === 0) return null;
  const refsContainer = document.createElement('div');
  refsContainer.className = 'timeline-refs';
  for (const ref of refsList) {
    if (ref.name === 'HEAD') continue;
    const badge = document.createElement('span');
    badge.className = `commit-ref commit-ref--${getRefBadgeModifier(ref)}`;
    badge.textContent = ref.name;
    refsContainer.appendChild(badge);
  }
  return refsContainer;
}

function createTimelineTrack(isFirst: boolean, isLast: boolean): HTMLDivElement {
  const track = document.createElement('div');
  track.className = 'timeline-track';

  const dot = document.createElement('div');
  dot.className = 'timeline-dot';
  if (isFirst) dot.classList.add('timeline-dot--current');
  track.appendChild(dot);

  if (!isLast) {
    const line = document.createElement('div');
    line.className = 'timeline-line';
    track.appendChild(line);
  }
  return track;
}

function createTimelineMeta(commit: Commit): HTMLDivElement {
  const meta = document.createElement('div');
  meta.className = 'timeline-meta';

  const hashEl = document.createElement('span');
  hashEl.className = 'timeline-hash';
  hashEl.textContent = commit.shortHash;
  hashEl.title = commit.hash;

  const authorEl = document.createElement('span');
  authorEl.className = 'timeline-author';
  authorEl.textContent = commit.author.name;

  const dateEl = document.createElement('span');
  dateEl.className = 'timeline-date';
  dateEl.textContent = formatDate(commit.authorDate);
  dateEl.title = new Date(commit.authorDate * 1000).toLocaleString();

  meta.appendChild(hashEl);
  meta.appendChild(document.createTextNode(' · '));
  meta.appendChild(authorEl);
  meta.appendChild(document.createTextNode(' · '));
  meta.appendChild(dateEl);
  return meta;
}

function createTimelineEntry(
  commit: Commit,
  isFirst: boolean,
  isLast: boolean,
  filePath: string,
): HTMLDivElement {
  const entry = document.createElement('div');
  entry.className = 'timeline-entry';
  if (isFirst) entry.classList.add('timeline-entry--first');
  if (isLast) entry.classList.add('timeline-entry--last');

  entry.appendChild(createTimelineTrack(isFirst, isLast));

  const content = document.createElement('div');
  content.className = 'timeline-content';

  const subject = document.createElement('div');
  subject.className = 'timeline-subject';
  subject.textContent = commit.subject;
  subject.title = commit.body ? `${commit.subject}\n\n${commit.body}` : commit.subject;

  const refsEl = createTimelineRefs(commit.refs);
  if (refsEl) {
    content.appendChild(refsEl);
  }

  content.appendChild(subject);
  content.appendChild(createTimelineMeta(commit));

  // Click to view file diff for this commit
  content.addEventListener('click', () => {
    bridge.send({
      type: 'requestFileDiff',
      data: { hash: commit.hash, filePath },
    });
  });
  content.style.cursor = 'pointer';

  entry.appendChild(content);
  return entry;
}

function formatDate(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;

  // Absolute date for older entries
  return new Date(timestamp * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Show the file history panel.
 */
export function showFileHistoryPanel(): void {
  const panel = document.getElementById('file-history-panel') ?? document.getElementById('detail-panel');
  if (panel) {
    panel.classList.remove('hidden');
  }
}

/**
 * Hide the file history panel.
 */
export function hideFileHistoryPanel(): void {
  const panel = document.getElementById('file-history-panel') ?? document.getElementById('detail-panel');
  if (panel) {
    panel.classList.add('hidden');
  }
}
