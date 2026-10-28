// ============================================================
// @dabzse/omnigit-core — Git Blame Engine
//
// Parses `git blame --porcelain` output into structured
// BlameLine objects for inline blame annotations.
// ============================================================

import type { GitExecutor } from './executor.js';
import type { BlameLine, BlameResult, CommitAuthor } from './types.js';

interface BlameCommitInfo {
  hash: string;
  shortHash: string;
  author: CommitAuthor;
  authorDate: number;
  subject: string;
}

const BLAME_HEADER_REGEX = /^([0-9a-f]{40})\s+(\d+)\s+(\d+)(?:\s+(\d+))?$/;

interface ParsedCommitDetails {
  authorName: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
  content: string;
  nextIndex: number;
}

function parseCommitMetadata(rawLines: string[], startIndex: number): ParsedCommitDetails {
  let authorName = '';
  let authorEmail = '';
  let authorTime = 0;
  let summary = '';
  let content = '';
  let i = startIndex;

  while (i < rawLines.length) {
    const line = rawLines[i];

    if (line.startsWith('\t')) {
      content = line.slice(1);
      i++;
      break;
    }

    if (line.startsWith('author ')) {
      authorName = line.slice(7);
    } else if (line.startsWith('author-mail ')) {
      authorEmail = line.slice(12).replace(/[<>]/g, '');
    } else if (line.startsWith('author-time ')) {
      authorTime = Number.parseInt(line.slice(12), 10);
    } else if (line.startsWith('summary ')) {
      summary = line.slice(8);
    }

    i++;
  }

  return { authorName, authorEmail, authorTime, summary, content, nextIndex: i };
}

/**
 * Parse `git blame --porcelain` output.
 */
export function parseBlameOutput(raw: string, filePath: string): BlameResult {
  const lines: BlameLine[] = [];
  const commitCache = new Map<string, BlameCommitInfo>();

  const rawLines = raw.split('\n');
  let i = 0;

  while (i < rawLines.length) {
    const headerLine = rawLines[i];
    if (!headerLine?.trim()) {
      i++;
      continue;
    }

    const headerMatch = BLAME_HEADER_REGEX.exec(headerLine);
    if (!headerMatch) {
      i++;
      continue;
    }

    const hash = headerMatch[1];
    const originalLine = Number.parseInt(headerMatch[2], 10);
    const currentLine = Number.parseInt(headerMatch[3], 10);

    const details = parseCommitMetadata(rawLines, i + 1);
    i = details.nextIndex;

    let commitInfo = commitCache.get(hash);
    if (!commitInfo && details.authorName) {
      commitInfo = {
        hash,
        shortHash: hash.slice(0, 7),
        author: { name: details.authorName, email: details.authorEmail },
        authorDate: details.authorTime,
        subject: details.summary,
      };
      commitCache.set(hash, commitInfo);
    }

    if (commitInfo) {
      lines.push({
        hash: commitInfo.hash,
        shortHash: commitInfo.shortHash,
        author: commitInfo.author,
        authorDate: commitInfo.authorDate,
        subject: commitInfo.subject,
        originalLine,
        currentLine,
        content: details.content,
      });
    }
  }

  return { filePath, lines };
}

/**
 * Get blame for a file or a range of lines.
 */
export async function getBlame(
  git: GitExecutor,
  filePath: string,
  startLine?: number,
  endLine?: number,
): Promise<BlameResult> {
  const args = ['blame', '--porcelain'];

  if (startLine !== undefined && endLine !== undefined) {
    args.push(`-L${startLine},${endLine}`);
  } else if (startLine !== undefined) {
    args.push(`-L${startLine},`);
  }

  args.push('--', filePath);

  const output = await git.run(args);
  return parseBlameOutput(output, filePath);
}

/**
 * Get blame for a specific commit (historical blame).
 */
export async function getBlameAtCommit(
  git: GitExecutor,
  filePath: string,
  commitHash: string,
): Promise<BlameResult> {
  const args = ['blame', '--porcelain', commitHash, '--', filePath];
  const output = await git.run(args);
  return parseBlameOutput(output, filePath);
}
