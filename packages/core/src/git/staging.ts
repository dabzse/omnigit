// ============================================================
// @dabzse/omnigit-core — Partial Staging
//
// Implements `git add -p` style hunk-level and line-level
// staging by applying patches via `git apply --cached`.
// ============================================================

import type { GitExecutor } from './executor.js';
import type { DiffHunk, DiffHunkHeader, FileStatus, StagingFile } from './types.js';
import { getWorkingDiff } from './diff.js';

/**
 * Get files with their hunks for the staging UI.
 */
export async function getStagingFiles(git: GitExecutor): Promise<StagingFile[]> {
  const diffs = await getWorkingDiff(git);

  return diffs.map((diff) => ({
    path: diff.path,
    status: diff.status,
    hunks: diff.hunks.map((hunk) => ({
      hunk,
      selected: false,
    })),
  }));
}

/**
 * Stage a full file.
 */
export async function stageFile(git: GitExecutor, filePath: string): Promise<void> {
  await git.run(['add', '--', filePath]);
}

/**
 * Unstage a file.
 */
export async function unstageFile(git: GitExecutor, filePath: string): Promise<void> {
  await git.run(['reset', 'HEAD', '--', filePath]);
}

/**
 * Stage a specific hunk by generating a patch and applying it.
 */
export async function stageHunk(
  git: GitExecutor,
  filePath: string,
  hunk: DiffHunk,
  fileStatus: FileStatus,
): Promise<void> {
  const patch = generatePatch(filePath, hunk, fileStatus);
  await applyPatch(git, patch, true);
}

/**
 * Unstage a specific hunk.
 */
export async function unstageHunk(
  git: GitExecutor,
  filePath: string,
  hunk: DiffHunk,
  fileStatus: FileStatus,
): Promise<void> {
  const patch = generatePatch(filePath, hunk, fileStatus);
  await applyPatch(git, patch, false);
}

/**
 * Stage a hunk by its index within a file's working diff.
 */
export async function stageHunkByIndex(
  git: GitExecutor,
  filePath: string,
  hunkIndex: number,
): Promise<void> {
  const diffs = await getWorkingDiff(git);
  const fileDiff = diffs.find((d) => d.path === filePath);
  if (!fileDiff) {
    throw new Error(`No working diff found for file: ${filePath}`);
  }
  const hunk = fileDiff.hunks[hunkIndex];
  if (!hunk) {
    throw new Error(`Hunk index ${hunkIndex} out of range for ${filePath}`);
  }
  await stageHunk(git, filePath, hunk, fileDiff.status);
}

/**
 * Unstage a hunk by its index within a file's staged diff.
 */
export async function unstageHunkByIndex(
  git: GitExecutor,
  filePath: string,
  hunkIndex: number,
): Promise<void> {
  const { getStagedDiff } = await import('./diff.js');
  const diffs = await getStagedDiff(git);
  const fileDiff = diffs.find((d) => d.path === filePath);
  if (!fileDiff) {
    throw new Error(`No staged diff found for file: ${filePath}`);
  }
  const hunk = fileDiff.hunks[hunkIndex];
  if (!hunk) {
    throw new Error(`Hunk index ${hunkIndex} out of range for ${filePath}`);
  }
  await unstageHunk(git, filePath, hunk, fileDiff.status);
}

/**
 * Stage selected lines within a hunk.
 *
 * @param selectedLineIndices - Indices (within the hunk's lines array)
 *   of lines to stage. Only 'add' and 'delete' lines can be selected.
 */
export async function stageLines(
  git: GitExecutor,
  filePath: string,
  hunk: DiffHunk,
  selectedLineIndices: number[],
  fileStatus: FileStatus,
): Promise<void> {
  const patch = generatePartialPatch(filePath, hunk, selectedLineIndices, fileStatus);
  await applyPatch(git, patch, true);
}

/**
 * Unstage selected lines within a hunk.
 */
export async function unstageLines(
  git: GitExecutor,
  filePath: string,
  hunk: DiffHunk,
  selectedLineIndices: number[],
  fileStatus: FileStatus,
): Promise<void> {
  const patch = generatePartialPatch(filePath, hunk, selectedLineIndices, fileStatus);
  await applyPatch(git, patch, false);
}

/**
 * Stage selected lines within a hunk by index.
 */
export async function stageLinesByIndex(
  git: GitExecutor,
  filePath: string,
  hunkIndex: number,
  selectedLineIndices: number[],
): Promise<void> {
  const diffs = await getWorkingDiff(git);
  const fileDiff = diffs.find((d) => d.path === filePath);
  if (!fileDiff) {
    throw new Error(`No working diff found for file: ${filePath}`);
  }
  const hunk = fileDiff.hunks[hunkIndex];
  if (!hunk) {
    throw new Error(`Hunk index ${hunkIndex} out of range for ${filePath}`);
  }
  await stageLines(git, filePath, hunk, selectedLineIndices, fileDiff.status);
}

/**
 * Unstage selected lines within a hunk by index.
 */
export async function unstageLinesByIndex(
  git: GitExecutor,
  filePath: string,
  hunkIndex: number,
  selectedLineIndices: number[],
): Promise<void> {
  const { getStagedDiff } = await import('./diff.js');
  const diffs = await getStagedDiff(git);
  const fileDiff = diffs.find((d) => d.path === filePath);
  if (!fileDiff) {
    throw new Error(`No staged diff found for file: ${filePath}`);
  }
  const hunk = fileDiff.hunks[hunkIndex];
  if (!hunk) {
    throw new Error(`Hunk index ${hunkIndex} out of range for ${filePath}`);
  }
  await unstageLines(git, filePath, hunk, selectedLineIndices, fileDiff.status);
}


// Patch Generation

function formatHunkHeader(header: DiffHunkHeader): string {
  const oldPart = header.oldCount === 1
    ? `${header.oldStart}`
    : `${header.oldStart},${header.oldCount}`;
  const newPart = header.newCount === 1
    ? `${header.newStart}`
    : `${header.newStart},${header.newCount}`;
  const ctx = header.context ? ` ${header.context}` : '';
  return `@@ -${oldPart} +${newPart} @@${ctx}`;
}

function generatePatch(filePath: string, hunk: DiffHunk, fileStatus: FileStatus): string {
  const header = buildPatchFileHeader(filePath, fileStatus);
  const hunkStr = formatHunkHeader(hunk.header);
  const lines = hunk.lines.map((l) => {
    switch (l.type) {
      case 'add': return `+${l.content}`;
      case 'delete': return `-${l.content}`;
      case 'context': return ` ${l.content}`;
    }
  });

  return `${header}\n${hunkStr}\n${lines.join('\n')}\n`;
}

function generatePartialPatch(
  filePath: string,
  hunk: DiffHunk,
  selectedLineIndices: number[],
  fileStatus: FileStatus,
): string {
  const selected = new Set(selectedLineIndices);
  const header = buildPatchFileHeader(filePath, fileStatus);

  // For non-selected 'add' lines: skip them entirely
  // For non-selected 'delete' lines: turn them into context lines
  let oldCount = 0;
  let newCount = 0;
  const patchLines: string[] = [];

  for (let i = 0; i < hunk.lines.length; i++) {
    const line = hunk.lines[i];

    if (line.type === 'context') {
      patchLines.push(` ${line.content}`);
      oldCount++;
      newCount++;
    } else if (line.type === 'add') {
      if (selected.has(i)) {
        patchLines.push(`+${line.content}`);
        newCount++;
      }
      // else: skip this line entirely
    } else if (line.type === 'delete') {
      if (selected.has(i)) {
        patchLines.push(`-${line.content}`);
        oldCount++;
      } else {
        // Keep as context
        patchLines.push(` ${line.content}`);
        oldCount++;
        newCount++;
      }
    }
  }

  const patchHeader = `@@ -${hunk.header.oldStart},${oldCount} +${hunk.header.newStart},${newCount} @@`;

  return `${header}\n${patchHeader}\n${patchLines.join('\n')}\n`;
}

function buildPatchFileHeader(filePath: string, fileStatus: FileStatus): string {
  if (fileStatus === 'added') {
    return [
      `diff --git a/${filePath} b/${filePath}`,
      'new file mode 100644',
      '--- /dev/null',
      `+++ b/${filePath}`,
    ].join('\n');
  }

  if (fileStatus === 'deleted') {
    return [
      `diff --git a/${filePath} b/${filePath}`,
      'deleted file mode 100644',
      `--- a/${filePath}`,
      '+++ /dev/null',
    ].join('\n');
  }

  return [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
  ].join('\n');
}

async function applyPatch(git: GitExecutor, patch: string, stage: boolean): Promise<void> {
  const args = ['apply', '--cached'];
  if (!stage) {
    args.push('--reverse');
  }

  // We need to pipe the patch to stdin — use a temp approach via echo
  // In practice, this will be done differently per platform; for now,
  // we write to a temp file approach using git's ability to read from stdin.
  const { writeFile, unlink } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');

  const tmpPath = join(tmpdir(), `omnigit-patch-${Date.now()}.patch`);

  try {
    await writeFile(tmpPath, patch, 'utf-8');
    await git.run([...args, tmpPath]);
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
