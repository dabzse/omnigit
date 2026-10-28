// ============================================================
// @dabzse/omnigit-core — Branch & Tag Operations (Refs)
// ============================================================

import type { GitExecutor } from './executor.js';
import type { Branch, RepoStatus, Tag, Contributor, DiffFileStat } from './types.js';

// Branches

/**
 * List all local and remote branches.
 */
export async function listBranches(git: GitExecutor): Promise<Branch[]> {
  const output = await git.run([
    'branch', '-a', '--format',
    '%(refname:short)\x1e%(objectname)\x1e%(upstream:short)\x1e%(HEAD)\x1e%(creatordate:unix)\x1e%(subject)',
  ]);

  if (!output.trim()) return [];

  return output.trim().split('\n').map((line) => {
    const [name, hash, upstream, headMarker, dateRaw, subject] = line.split('\x1e');
    const isRemote = name.includes('/');
    const remote = isRemote ? name.split('/')[0] : undefined;

    return {
      name: name.trim(),
      hash: hash.trim(),
      isRemote,
      isCurrent: headMarker.trim() === '*',
      remote,
      upstream: upstream?.trim() || undefined,
      lastCommitDate: Number.parseInt(dateRaw?.trim() ?? '0', 10),
      lastCommitSubject: subject?.trim() ?? '',
    };
  });
}

/**
 * Create a new branch.
 */
export async function createBranch(
  git: GitExecutor,
  name: string,
  startPoint?: string,
): Promise<void> {
  const args = ['branch', name];
  if (startPoint) args.push(startPoint);
  await git.run(args);
}

/**
 * Delete a branch.
 */
export async function deleteBranch(
  git: GitExecutor,
  name: string,
  force = false,
): Promise<void> {
  await git.run(['branch', force ? '-D' : '-d', name]);
}

/**
 * Rename a branch.
 */
export async function renameBranch(
  git: GitExecutor,
  oldName: string,
  newName: string,
): Promise<void> {
  await git.run(['branch', '-m', oldName, newName]);
}

/**
 * Checkout a branch or commit.
 */
export async function checkout(
  git: GitExecutor,
  refName: string,
): Promise<void> {
  await git.run(['checkout', refName]);
}

/**
 * Create and checkout a new branch.
 */
export async function checkoutNewBranch(
  git: GitExecutor,
  name: string,
  startPoint?: string,
): Promise<void> {
  const args = ['checkout', '-b', name];
  if (startPoint) args.push(startPoint);
  await git.run(args);
}

// Tags

/**
 * List all tags.
 */
export async function listTags(git: GitExecutor): Promise<Tag[]> {
  const output = await git.run([
    'tag', '-l', '--format',
    '%(refname:short)\x1e%(*objectname)\x1e%(objectname)\x1e%(subject)\x1e%(taggername)\x1e%(taggeremail)\x1e%(creatordate:unix)',
  ]);

  if (!output.trim()) return [];

  return output.trim().split('\n').map((line) => {
    const [name, derefHash, tagHash, message, taggerName, taggerEmail, dateRaw] = line.split('\x1e');
    // For annotated tags, derefHash is the commit; for lightweight, it's empty
    const commitHash = derefHash?.trim() || tagHash?.trim() || '';

    return {
      name: name.trim(),
      hash: commitHash,
      tagHash: derefHash?.trim() ? tagHash?.trim() : undefined,
      message: message?.trim() || undefined,
      tagger: taggerName?.trim()
        ? { name: taggerName.trim(), email: taggerEmail?.trim().replace(/[<>]/g, '') ?? '' }
        : undefined,
      date: dateRaw?.trim() ? Number.parseInt(dateRaw.trim(), 10) : undefined,
    };
  });
}

/**
 * Create a tag.
 */
export async function createTag(
  git: GitExecutor,
  name: string,
  hash?: string,
  message?: string,
): Promise<void> {
  const args = ['tag'];
  if (message) {
    args.push('-a', name, '-m', message);
  } else {
    args.push(name);
  }
  if (hash) args.push(hash);
  await git.run(args);
}

/**
 * Delete a tag.
 */
export async function deleteTag(git: GitExecutor, name: string): Promise<void> {
  await git.run(['tag', '-d', name]);
}

const BRANCH_AB_REGEX = /\+(\d+) -(\d+)/;

interface BranchHeaderInfo {
  head?: string;
  detached?: boolean;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

function parseBranchHeader(line: string): BranchHeaderInfo | null {
  if (line.startsWith('# branch.head ')) {
    const head = line.slice('# branch.head '.length);
    return head === '(detached)' ? { detached: true } : { head };
  }
  if (line.startsWith('# branch.upstream ')) {
    return { upstream: line.slice('# branch.upstream '.length) };
  }
  if (line.startsWith('# branch.ab ')) {
    const match = BRANCH_AB_REGEX.exec(line);
    if (match) {
      return {
        ahead: Number.parseInt(match[1], 10),
        behind: Number.parseInt(match[2], 10),
      };
    }
  }
  return null;
}

function parseChangedEntry(line: string): { staged?: DiffFileStat; unstaged?: DiffFileStat } {
  const parts = line.split(' ');
  const xy = parts[1];
  const pathParts = line.split('\t');
  const filePath = pathParts.at(-1) ?? '';
  const statusX = xy[0];
  const statusY = xy[1];

  const staged = statusX !== '.' ? {
    path: filePath,
    status: charToFileStatus(statusX),
    additions: 0,
    deletions: 0,
  } : undefined;

  const unstaged = statusY !== '.' ? {
    path: filePath,
    status: charToFileStatus(statusY),
    additions: 0,
    deletions: 0,
  } : undefined;

  return { staged, unstaged };
}

interface StatusData {
  currentBranch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  detachedHead: boolean;
  staged: DiffFileStat[];
  unstaged: DiffFileStat[];
  untracked: string[];
  conflicts: string[];
}

function parsePorcelainV2(output: string): StatusData {
  const result: StatusData = {
    currentBranch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    detachedHead: false,
    staged: [],
    unstaged: [],
    untracked: [],
    conflicts: [],
  };

  const handlers: Record<string, (line: string) => void> = {
    '#': (line) => {
      const info = parseBranchHeader(line);
      if (!info) return;
      if (info.detached) result.detachedHead = true;
      if (info.head) result.currentBranch = info.head;
      if (info.upstream) result.upstream = info.upstream;
      if (info.ahead !== undefined) result.ahead = info.ahead;
      if (info.behind !== undefined) result.behind = info.behind;
    },
    '?': (line) => {
      result.untracked.push(line.slice(2));
    },
    'u': (line) => {
      const conflict = line.split('\t').at(-1);
      if (conflict) result.conflicts.push(conflict);
    },
    '1': (line) => {
      const changed = parseChangedEntry(line);
      if (changed.staged) result.staged.push(changed.staged);
      if (changed.unstaged) result.unstaged.push(changed.unstaged);
    },
    '2': (line) => {
      const changed = parseChangedEntry(line);
      if (changed.staged) result.staged.push(changed.staged);
      if (changed.unstaged) result.unstaged.push(changed.unstaged);
    },
  };

  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const handler = handlers[trimmed[0]];
    if (handler) {
      handler(trimmed);
    }
  }

  return result;
}

// Repository Status

/**
 * Get comprehensive repository status.
 */
export async function getRepoStatus(git: GitExecutor): Promise<RepoStatus> {
  const output = await git.run(['status', '--porcelain=v2', '--branch', '-u']);
  const statusData = parsePorcelainV2(output);

  // Check for in-progress operations
  const [merging, rebasing, cherryPicking] = await Promise.all([
    git.tryRun(['rev-parse', '--verify', 'MERGE_HEAD']).then((res) => res !== null),
    git.tryRun(['rev-parse', '--verify', 'REBASE_HEAD']).then((res) => res !== null),
    git.tryRun(['rev-parse', '--verify', 'CHERRY_PICK_HEAD']).then((res) => res !== null),
  ]);

  return {
    ...statusData,
    merging,
    rebasing,
    cherryPicking,
  };
}

function charToFileStatus(char: string): import('./types.js').FileStatus {
  switch (char) {
    case 'A': return 'added';
    case 'M': return 'modified';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'C': return 'copied';
    default: return 'modified';
  }
}

// Git Operations

/**
 * Cherry-pick a commit.
 */
export async function cherryPick(git: GitExecutor, hash: string): Promise<void> {
  await git.run(['cherry-pick', hash]);
}

/**
 * Revert a commit.
 */
export async function revert(git: GitExecutor, hash: string): Promise<void> {
  await git.run(['revert', hash, '--no-edit']);
}

// Contributors

/**
 * Get repository contributors with commit counts and date ranges.
 */
export async function getContributors(git: GitExecutor): Promise<Contributor[]> {
  const output = await git.run([
    'log', '--all', '--format=%an\x1e%ae\x1e%at',
  ]);

  if (!output.trim()) return [];

  const contributorMap = new Map<string, {
    name: string;
    email: string;
    commits: number;
    firstCommitDate: number;
    lastCommitDate: number;
  }>();

  for (const line of output.trim().split('\n')) {
    const [name, email, dateRaw] = line.split('\x1e');
    const date = Number.parseInt(dateRaw, 10);
    const key = email.toLowerCase();

    const existing = contributorMap.get(key);
    if (existing) {
      existing.commits++;
      existing.firstCommitDate = Math.min(existing.firstCommitDate, date);
      existing.lastCommitDate = Math.max(existing.lastCommitDate, date);
    } else {
      contributorMap.set(key, {
        name: name.trim(),
        email: email.trim(),
        commits: 1,
        firstCommitDate: date,
        lastCommitDate: date,
      });
    }
  }

  return Array.from(contributorMap.values())
    .sort((a, b) => b.commits - a.commits);
}
