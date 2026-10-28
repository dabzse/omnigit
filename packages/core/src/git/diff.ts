// ============================================================
// @dabzse/omnigit-core — Diff Generation & Parsing
//
// Generates and parses unified diffs, file stats, and
// individual file patches from git.
// ============================================================

import type { GitExecutor } from './executor.js';
import type {
  DiffFileStat,
  DiffHunk,
  DiffHunkHeader,
  DiffLine,
  DiffLineType,
  FileDiff,
  FileStatus,
} from './types.js';

// Status Mapping

const STATUS_MAP: Record<string, FileStatus> = {
  A: 'added',
  M: 'modified',
  D: 'deleted',
  R: 'renamed',
  C: 'copied',
  '?': 'untracked',
};

function parseFileStatus(code: string): FileStatus {
  // Rename/copy codes include a similarity percentage: R100, C080
  if (code.startsWith('R')) return 'renamed';
  if (code.startsWith('C')) return 'copied';
  return STATUS_MAP[code] ?? 'modified';
}

// Diff Stat (--numstat + --name-status)

/**
 * Get file change statistics between two commits (or working tree).
 */
export async function getDiffStats(
  git: GitExecutor,
  from?: string,
  to?: string,
): Promise<DiffFileStat[]> {
  // Get numstat for additions/deletions
  const numstatArgs = ['diff', '--numstat', '-z'];
  // Get name-status for change type
  const statusArgs = ['diff', '--name-status', '-z'];

  if (from) {
    numstatArgs.push(from);
    statusArgs.push(from);
  }
  if (to) {
    numstatArgs.push(to);
    statusArgs.push(to);
  }

  const [numstatRaw, statusRaw] = await Promise.all([
    git.run(numstatArgs),
    git.run(statusArgs),
  ]);

  const stats = parseNumstat(numstatRaw);
  const statuses = parseNameStatus(statusRaw);

  // Merge numstat with name-status
  return stats.map((stat, i) => ({
    ...stat,
    status: statuses[i]?.status ?? 'modified',
    oldPath: statuses[i]?.oldPath,
    similarity: statuses[i]?.similarity,
  }));
}

const NUMSTAT_REGEX = /^(\d+|-)\t(\d+|-)\t(.+)$/;

function parseNumstat(raw: string): Array<{ path: string; additions: number; deletions: number }> {
  if (!raw.trim()) return [];

  // -z format: "<add>\t<del>\t<path>\0" (or "<add>\t<del>\t\0<old>\0<new>\0" for renames)
  const parts = raw.split('\0').filter(Boolean);
  const results: Array<{ path: string; additions: number; deletions: number }> = [];

  for (const part of parts) {
    const match = NUMSTAT_REGEX.exec(part);
    if (match) {
      results.push({
        additions: match[1] === '-' ? 0 : Number.parseInt(match[1], 10),
        deletions: match[2] === '-' ? 0 : Number.parseInt(match[2], 10),
        path: match[3],
      });
    }
  }

  return results;
}

function parseNameStatus(
  raw: string,
): Array<{ path: string; oldPath?: string; status: FileStatus; similarity?: number }> {
  if (!raw.trim()) return [];

  const parts = raw.split('\0').filter(Boolean);
  const results: Array<{ path: string; oldPath?: string; status: FileStatus; similarity?: number }> = [];
  let i = 0;

  while (i < parts.length) {
    const statusCode = parts[i];
    const status = parseFileStatus(statusCode);

    if (status === 'renamed' || status === 'copied') {
      // Renames/copies have two path entries
      const oldPath = parts[i + 1];
      const newPath = parts[i + 2];
      const similarity = Number.parseInt(statusCode.slice(1), 10) || undefined;
      results.push({ path: newPath, oldPath, status, similarity });
      i += 3;
    } else {
      const path = parts[i + 1];
      results.push({ path, status });
      i += 2;
    }
  }

  return results;
}

// Diff Stats for a Commit

/**
 * Get file change stats for a specific commit.
 */
export async function getCommitDiffStats(
  git: GitExecutor,
  hash: string,
): Promise<DiffFileStat[]> {
  // For a commit, diff against its parent
  return getDiffStats(git, `${hash}~1`, hash).catch(() => {
    // Root commit: no parent, diff against empty tree
    return getDiffStats(git, '4b825dc642cb6eb9a060e54bf899d69f82e68db4', hash);
  });
}

// Full Diff Parsing

function detectFileStatus(lines: string[]): { status: FileStatus; isBinary: boolean } {
  let status: FileStatus = 'modified';
  let isBinary = false;

  for (const line of lines.slice(1, 6)) {
    if (line.startsWith('new file')) status = 'added';
    else if (line.startsWith('deleted file')) status = 'deleted';
    else if (line.startsWith('rename from')) status = 'renamed';
    else if (line.startsWith('copy from')) status = 'copied';
    else if (line.includes('Binary files')) isBinary = true;
  }

  return { status, isBinary };
}

function parseDiffHeader(headerLine?: string): { oldPath: string; path: string } | null {
  if (!headerLine?.startsWith('a/')) return null;
  const sepIndex = headerLine.indexOf(' b/');
  if (sepIndex === -1) return null;
  const oldPath = headerLine.slice(2, sepIndex);
  const path = headerLine.slice(sepIndex + 3);
  return { oldPath, path };
}

/**
 * Parse a unified diff string into structured FileDiff objects.
 */
export function parseUnifiedDiff(raw: string): FileDiff[] {
  if (!raw.trim()) return [];

  const files: FileDiff[] = [];
  const diffSections = raw.split(/^diff --git /m).filter(Boolean);

  for (const section of diffSections) {
    const lines = section.split('\n');
    if (lines.length > 0 && lines.at(-1) === '') {
      lines.pop();
    }

    const header = parseDiffHeader(lines[0]);
    if (!header) continue;

    const { status, isBinary } = detectFileStatus(lines);

    if (isBinary) {
      files.push({
        path: header.path,
        oldPath: status === 'renamed' || status === 'copied' ? header.oldPath : undefined,
        status,
        hunks: [],
        isBinary: true,
      });
      continue;
    }

    // Parse hunks
    const hunks = parseHunks(lines);

    files.push({
      path: header.path,
      oldPath: status === 'renamed' || status === 'copied' ? header.oldPath : undefined,
      status,
      hunks,
      isBinary: false,
    });
  }

  return files;
}

function parseHunkHeader(line: string): DiffHunkHeader | null {
  if (!line.startsWith('@@ ')) return null;
  const secondAt = line.indexOf(' @@', 3);
  if (secondAt === -1) return null;

  const rangePart = line.slice(3, secondAt).trim();
  const context = line.slice(secondAt + 3).trim() || undefined;

  const parts = rangePart.split(' ');
  if (parts.length !== 2 || !parts[0].startsWith('-') || !parts[1].startsWith('+')) {
    return null;
  }

  const [oldStartStr, oldCountStr] = parts[0].slice(1).split(',');
  const [newStartStr, newCountStr] = parts[1].slice(1).split(',');

  const oldStart = Number.parseInt(oldStartStr, 10);
  const oldCount = oldCountStr !== undefined ? Number.parseInt(oldCountStr, 10) : 1;
  const newStart = Number.parseInt(newStartStr, 10);
  const newCount = newCountStr !== undefined ? Number.parseInt(newCountStr, 10) : 1;

  if (Number.isNaN(oldStart) || Number.isNaN(newStart)) {
    return null;
  }

  return {
    oldStart,
    oldCount,
    newStart,
    newCount,
    context,
  };
}

function parseLineType(line: string): { type: DiffLineType; content: string } | null {
  if (line.startsWith('+')) {
    return { type: 'add', content: line.slice(1) };
  }
  if (line.startsWith('-')) {
    return { type: 'delete', content: line.slice(1) };
  }
  if (line.startsWith(' ') || line === '') {
    return { type: 'context', content: line.startsWith(' ') ? line.slice(1) : line };
  }
  return null;
}

function calculateLineNumbers(
  prev: DiffLine | undefined,
  header: DiffHunkHeader,
  type: DiffLineType,
): { oldLineNumber?: number; newLineNumber?: number } {
  if (!prev) {
    return {
      oldLineNumber: type !== 'add' ? header.oldStart : undefined,
      newLineNumber: type !== 'delete' ? header.newStart : undefined,
    };
  }

  if (type === 'add') {
    return {
      newLineNumber: (prev.newLineNumber ?? header.newStart - 1) + 1,
    };
  }
  if (type === 'delete') {
    return {
      oldLineNumber: (prev.oldLineNumber ?? header.oldStart - 1) + 1,
    };
  }
  return {
    oldLineNumber: (prev.oldLineNumber ?? header.oldStart - 1) + 1,
    newLineNumber: (prev.newLineNumber ?? header.newStart - 1) + 1,
  };
}

function parseHunks(lines: string[]): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentHunk: { header: DiffHunkHeader; lines: DiffLine[] } | null = null;

  for (const line of lines) {
    const header = parseHunkHeader(line);
    if (header) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      currentHunk = {
        header,
        lines: [],
      };
      continue;
    }

    if (!currentHunk) continue;

    const parsed = parseLineType(line);
    if (!parsed) continue;

    const lineNums = calculateLineNumbers(
      currentHunk.lines.at(-1),
      currentHunk.header,
      parsed.type,
    );

    currentHunk.lines.push({
      type: parsed.type,
      content: parsed.content,
      oldLineNumber: lineNums.oldLineNumber,
      newLineNumber: lineNums.newLineNumber,
    });
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return hunks;
}

// High-Level Diff Fetchers

/**
 * Get the full diff for a commit.
 */
export async function getCommitDiff(
  git: GitExecutor,
  hash: string,
): Promise<FileDiff[]> {
  const output = await git.run([
    'diff',
    `${hash}~1`,
    hash,
    '--patch',
    '--no-color',
    '-M',  // detect renames
    '-C',  // detect copies
  ]).catch(() => {
    // Root commit
    return git.run([
      'diff',
      '4b825dc642cb6eb9a060e54bf899d69f82e68db4',
      hash,
      '--patch',
      '--no-color',
    ]);
  });

  return parseUnifiedDiff(output);
}

/**
 * Get the diff for a specific file in a commit.
 */
export async function getFileDiff(
  git: GitExecutor,
  hash: string,
  filePath: string,
): Promise<FileDiff | null> {
  const output = await git.run([
    'diff',
    `${hash}~1`,
    hash,
    '--patch',
    '--no-color',
    '-M',
    '-C',
    '--',
    filePath,
  ]).catch(() =>
    git.run([
      'diff',
      '4b825dc642cb6eb9a060e54bf899d69f82e68db4',
      hash,
      '--patch',
      '--no-color',
      '--',
      filePath,
    ]),
  );

  const diffs = parseUnifiedDiff(output);
  return diffs[0] ?? null;
}

/**
 * Get the working-tree diff (unstaged changes).
 */
export async function getWorkingDiff(git: GitExecutor): Promise<FileDiff[]> {
  const output = await git.run(['diff', '--patch', '--no-color', '-M', '-C']);
  return parseUnifiedDiff(output);
}

/**
 * Get the staged diff.
 */
export async function getStagedDiff(git: GitExecutor): Promise<FileDiff[]> {
  const output = await git.run(['diff', '--staged', '--patch', '--no-color', '-M', '-C']);
  return parseUnifiedDiff(output);
}
