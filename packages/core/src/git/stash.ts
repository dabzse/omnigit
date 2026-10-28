// ============================================================
// @dabzse/omnigit-core — Stash Management
// ============================================================

import type { GitExecutor } from './executor.js';
import type { FileDiff, StashEntry } from './types.js';
import { parseUnifiedDiff } from './diff.js';

/**
 * Parse git stash list formatted output.
 */
export function parseStashOutput(raw: string): StashEntry[] {
  if (!raw.trim()) return [];

  return raw.trim().split('\n').map((line) => {
    const [hash, ref, message, dateRaw] = line.split('\x1e');
    const indexMatch = ref ? /\{(\d+)\}/.exec(ref) : null;
    const index = indexMatch ? Number.parseInt(indexMatch[1], 10) : 0;

    const branchMatch = message ? /(?:WIP )?[Oo]n (.+?):/.exec(message) : null;
    const branch = branchMatch?.[1] ?? '';

    return {
      index,
      hash: (hash ?? '').trim(),
      message: (message ?? '').trim(),
      date: dateRaw ? Number.parseInt(dateRaw.trim(), 10) : 0,
      branch,
    };
  });
}

/**
 * List all stash entries.
 */
export async function listStashes(git: GitExecutor): Promise<StashEntry[]> {
  const output = await git.tryRun([
    'stash', 'list',
    '--format=%H\x1e%gd\x1e%gs\x1e%at',
  ]);

  return parseStashOutput(output ?? '');
}

/**
 * Save changes to stash.
 */
export async function stashSave(
  git: GitExecutor,
  message?: string,
  includeUntracked = false,
): Promise<void> {
  const args = ['stash', 'push'];
  if (includeUntracked) args.push('-u');
  if (message) args.push('-m', message);
  await git.run(args);
}

/**
 * Apply a stash without removing it from the stash list.
 */
export async function stashApply(git: GitExecutor, index = 0): Promise<void> {
  await git.run(['stash', 'apply', `stash@{${index}}`]);
}

/**
 * Pop (apply + drop) a stash.
 */
export async function stashPop(git: GitExecutor, index = 0): Promise<void> {
  await git.run(['stash', 'pop', `stash@{${index}}`]);
}

/**
 * Drop a stash entry.
 */
export async function stashDrop(git: GitExecutor, index: number): Promise<void> {
  await git.run(['stash', 'drop', `stash@{${index}}`]);
}

/**
 * Drop all stash entries.
 */
export async function stashClear(git: GitExecutor): Promise<void> {
  await git.run(['stash', 'clear']);
}

/**
 * Get diff for a specific stash entry.
 */
export async function getStashDiff(
  git: GitExecutor,
  index: number,
): Promise<FileDiff[]> {
  const output = await git.run([
    'stash',
    'show',
    '-p',
    '--no-color',
    '-M',
    '-C',
    `stash@{${index}}`,
  ]);
  return parseUnifiedDiff(output);
}

