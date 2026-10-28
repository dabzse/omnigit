// ============================================================
// @dabzse/omnigit-core — Interactive Rebase
//
// Implements interactive rebase planning, execution, and state
// management for visual reordering, squash, fixup, edit, and drop.
// ============================================================

import type { GitExecutor } from './executor.js';
import type { CommitHash, RebaseAction, RebaseCommit, RebasePlan, RebaseStatus } from './types.js';

const FIELD_SEP = '\x1e';

/**
 * Generate a rebase plan listing commits between upstream and HEAD.
 * Commits are listed in chronological order (oldest first, the order git rebase applies them).
 */
export async function getRebasePlan(
  git: GitExecutor,
  upstream: CommitHash,
): Promise<RebasePlan> {
  // Get short hash of upstream
  const upstreamShortHash = await git.run(['rev-parse', '--short', upstream]).catch(() => upstream.slice(0, 7));

  // Get commits in chronological order (oldest first)
  const logOutput = await git.tryRun([
    'log',
    '--reverse',
    `--format=%H${FIELD_SEP}%h${FIELD_SEP}%s${FIELD_SEP}%an`,
    `${upstream}..HEAD`,
  ]);

  if (!logOutput?.trim()) {
    return {
      upstream,
      upstreamShortHash: upstreamShortHash.trim(),
      commits: [],
    };
  }

  const commits: RebaseCommit[] = logOutput
    .trim()
    .split('\n')
    .map((line) => {
      const [hash, shortHash, subject, author] = line.split(FIELD_SEP);
      return {
        hash: hash.trim(),
        shortHash: shortHash.trim(),
        subject: subject.trim(),
        author: author.trim(),
        action: 'pick' as RebaseAction,
      };
    });

  return {
    upstream,
    upstreamShortHash: upstreamShortHash.trim(),
    commits,
  };
}

/**
 * Format a git-rebase-todo file content from an ordered list of planned commit actions.
 */
export function formatRebaseTodo(
  plan: readonly { hash: CommitHash; action: RebaseAction; subject?: string }[],
): string {
  return plan
    .map((item) => {
      const subject = item.subject ? ` ${item.subject}` : '';
      return `${item.action} ${item.hash}${subject}`;
    })
    .join('\n') + '\n';
}

/**
 * Execute an interactive rebase using the configured plan.
 */
export async function executeInteractiveRebase(
  git: GitExecutor,
  upstream: CommitHash,
  plan: readonly { hash: CommitHash; action: RebaseAction; subject?: string }[],
): Promise<void> {
  const { writeFile, unlink } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');

  const todoContent = formatRebaseTodo(plan);
  const scriptPath = join(tmpdir(), `omnigit-rebase-todo-${Date.now()}.txt`);

  try {
    await writeFile(scriptPath, todoContent, 'utf-8');

    // Use GIT_SEQUENCE_EDITOR to overwrite the rebase todo file with our planned actions
    // On Unix platforms: cp <scriptPath> "$1"
    const editorCmd = `cp "${scriptPath}" "$1"`;

    await git.run(['rebase', '-i', upstream], {
      env: {
        ...process.env,
        GIT_SEQUENCE_EDITOR: editorCmd,
      },
    });
  } finally {
    await unlink(scriptPath).catch(() => {});
  }
}

/**
 * Continue a paused rebase (e.g. after resolving conflicts or editing a commit).
 */
export async function rebaseContinue(git: GitExecutor): Promise<void> {
  await git.run(['rebase', '--continue'], {
    env: {
      ...process.env,
      GIT_EDITOR: 'true',
    },
  });
}

/**
 * Abort an in-progress rebase and return to the state before rebase started.
 */
export async function rebaseAbort(git: GitExecutor): Promise<void> {
  await git.run(['rebase', '--abort']);
}

/**
 * Check the status of any current rebase operation.
 */
export async function getRebaseStatus(git: GitExecutor): Promise<RebaseStatus> {
  // Check if .git/rebase-merge or .git/rebase-apply exists
  const [rebaseMergePath, rebaseApplyPath] = await Promise.all([
    git.tryRun(['rev-parse', '--git-path', 'rebase-merge']),
    git.tryRun(['rev-parse', '--git-path', 'rebase-apply']),
  ]);

  const { readFile, access } = await import('node:fs/promises');
  const { join, resolve } = await import('node:path');

  const targetDir = rebaseMergePath?.trim() || rebaseApplyPath?.trim();
  if (!targetDir) {
    return { inProgress: false };
  }

  const gitRoot = await git.run(['rev-parse', '--show-toplevel']).catch(() => '');
  const absTargetDir = resolve(gitRoot.trim() || process.cwd(), targetDir);

  const exists = await access(absTargetDir).then(() => true).catch(() => false);
  if (!exists) {
    return { inProgress: false };
  }

  let current: number | undefined;
  let total: number | undefined;
  let stoppedAt: CommitHash | undefined;
  let message: string | undefined;

  try {
    const msgNumStr = await readFile(join(absTargetDir, 'msgnum'), 'utf-8').catch(() => '');
    const endStr = await readFile(join(absTargetDir, 'end'), 'utf-8').catch(() => '');
    const stoppedShaStr = await readFile(join(absTargetDir, 'stopped-sha'), 'utf-8').catch(() => '');
    const headNameStr = await readFile(join(absTargetDir, 'head-name'), 'utf-8').catch(() => '');

    if (msgNumStr.trim()) current = Number.parseInt(msgNumStr.trim(), 10);
    if (endStr.trim()) total = Number.parseInt(endStr.trim(), 10);
    if (stoppedShaStr.trim()) stoppedAt = stoppedShaStr.trim();
    if (headNameStr.trim()) message = `Rebasing ${headNameStr.trim()}`;
  } catch {
    // If files are not readable, return basic inProgress true
  }

  return {
    inProgress: true,
    current,
    total,
    stoppedAt,
    message: message ?? 'Interactive rebase in progress',
  };
}
