// ============================================================
// @dabzse/omnigit-core — Git Log Parser
//
// Parses `git log` output into structured Commit objects.
// Uses a custom --format string with a unique delimiter to
// avoid ambiguity with commit messages containing pipes, etc.
// ============================================================

import type { GitExecutor } from './executor.js';
import type { Commit, CommitAuthor, LogOptions, Ref, RefType } from './types.js';

// We use ASCII record/unit separators as delimiters — these
// never appear in commit messages or author names.
const FIELD_SEP = '\x1e'; // ASCII Record Separator
const COMMIT_SEP = '\x1f'; // ASCII Unit Separator

// --format fields: hash, short hash, parents, subject, body,
// author name, author email, author date, committer name,
// committer email, commit date, decorations
const LOG_FORMAT = [
  '%H',   // hash
  '%h',   // short hash
  '%P',   // parent hashes (space-separated)
  '%s',   // subject
  '%b',   // body
  '%an',  // author name
  '%ae',  // author email
  '%at',  // author date (unix)
  '%cn',  // committer name
  '%ce',  // committer email
  '%ct',  // commit date (unix)
  '%D',   // decorations (ref names)
].join(FIELD_SEP) + COMMIT_SEP;

/**
 * Parse a ref decoration string from `git log --format=%D`.
 *
 * Examples:
 *   "HEAD -> main, origin/main, origin/HEAD"
 *   "tag: v1.0.0"
 *   "origin/feature-x"
 */
export function parseRefs(decorations: string): Ref[] {
  if (!decorations.trim()) return [];

  return decorations.split(',').map((raw) => {
    let name = raw.trim();
    let isHead = false;
    let type: RefType = 'head';
    let remote: string | undefined;

    // Check for HEAD pointer: "HEAD -> main"
    if (name.startsWith('HEAD -> ')) {
      isHead = true;
      name = name.slice('HEAD -> '.length);
    } else if (name === 'HEAD') {
      return { name: 'HEAD', type: 'head' as RefType, isHead: true };
    }

    // Check for tag
    if (name.startsWith('tag: ')) {
      name = name.slice('tag: '.length);
      type = 'tag';
    }
    // Check for remote ref
    else if (name.includes('/')) {
      const slashIndex = name.indexOf('/');
      remote = name.slice(0, slashIndex);
      // Don't strip the remote prefix from the name — keep full ref
      type = 'remote';
    }

    // Check for stash
    if (name.startsWith('refs/stash')) {
      type = 'stash';
    }

    return { name, type, remote, isHead };
  });
}

/**
 * Parse raw git log output into an array of Commit objects.
 */
export function parseLogOutput(raw: string): Commit[] {
  if (!raw.trim()) return [];

  const entries = raw.split(COMMIT_SEP).filter((e) => e.trim().length > 0);

  return entries.map((entry) => {
    const fields = entry.split(FIELD_SEP);

    if (fields.length < 12) {
      throw new Error(
        `Failed to parse commit: expected 12 fields, got ${fields.length}. Raw: "${entry.slice(0, 100)}..."`,
      );
    }

    const [
      hash,
      shortHash,
      parentsRaw,
      subject,
      body,
      authorName,
      authorEmail,
      authorDateRaw,
      committerName,
      committerEmail,
      commitDateRaw,
      decorationsRaw,
    ] = fields;

    const author: CommitAuthor = {
      name: authorName.trim(),
      email: authorEmail.trim(),
    };

    const committer: CommitAuthor = {
      name: committerName.trim(),
      email: committerEmail.trim(),
    };

    const parents = parentsRaw.trim()
      ? parentsRaw.trim().split(' ')
      : [];

    return {
      hash: hash.trim(),
      shortHash: shortHash.trim(),
      parents,
      subject: subject.trim(),
      body: body.trim(),
      author,
      authorDate: Number.parseInt(authorDateRaw.trim(), 10),
      committer,
      commitDate: Number.parseInt(commitDateRaw.trim(), 10),
      refs: parseRefs(decorationsRaw ?? ''),
    };
  });
}

/**
 * Build git log args from LogOptions.
 */
function buildLogArgs(options: LogOptions = {}): string[] {
  const args = ['log', `--format=${LOG_FORMAT}`];

  if (options.all !== false && !options.refs?.length) {
    args.push('--all');
  }

  args.push('--date-order');

  if (options.maxCount) {
    args.push(`-n`, `${options.maxCount}`);
  }

  if (options.skip) {
    args.push(`--skip=${options.skip}`);
  }

  if (options.author) {
    args.push(`--author=${options.author}`);
  }

  if (options.grep) {
    args.push(`--grep=${options.grep}`);
  }

  if (options.after) {
    args.push(`--after=${options.after.toISOString()}`);
  }

  if (options.before) {
    args.push(`--before=${options.before.toISOString()}`);
  }

  if (options.firstParent) {
    args.push('--first-parent');
  }

  if (options.refs?.length) {
    args.push(...options.refs);
  }

  // File path filter must come last, after --
  if (options.filePath) {
    args.push('--', options.filePath);
  }

  return args;
}

/**
 * Fetch and parse git log.
 */
export async function getLog(
  git: GitExecutor,
  options: LogOptions = {},
): Promise<Commit[]> {
  const args = buildLogArgs(options);
  const output = await git.run(args);
  return parseLogOutput(output);
}
