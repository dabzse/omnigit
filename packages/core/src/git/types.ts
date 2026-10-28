// ============================================================
// @dabzse/omnigit-core — Shared type definitions
// ============================================================

// Git Object Types

/** A full 40-char SHA-1 hash. */
export type CommitHash = string & { readonly _brand?: 'CommitHash' };

/** A short (7–12 char) abbreviated hash for display. */
export type ShortHash = string & { readonly _brand?: 'ShortHash' };

/** Unix epoch timestamp in seconds. */
export type UnixTimestamp = number & { readonly _brand?: 'UnixTimestamp' };

// Commit

export interface CommitAuthor {
  readonly name: string;
  readonly email: string;
}

export interface Commit {
  /** Full SHA-1 hash. */
  readonly hash: CommitHash;
  /** Abbreviated hash for display. */
  readonly shortHash: ShortHash;
  /** Parent commit hashes (empty for root commits, 2+ for merges). */
  readonly parents: readonly CommitHash[];
  /** Commit subject (first line of message). */
  readonly subject: string;
  /** Full commit message body (may be empty). */
  readonly body: string;
  /** Author information. */
  readonly author: CommitAuthor;
  /** Author date as unix timestamp. */
  readonly authorDate: UnixTimestamp;
  /** Committer information (may differ from author). */
  readonly committer: CommitAuthor;
  /** Commit date as unix timestamp. */
  readonly commitDate: UnixTimestamp;
  /** Ref names decorating this commit (branches, tags, HEAD). */
  readonly refs: readonly Ref[];
}

// Refs

export type RefType = 'head' | 'remote' | 'tag' | 'stash';

export interface Ref {
  readonly name: string;
  readonly type: RefType;
  /** For remote branches: the remote name (e.g. "origin"). */
  readonly remote?: string;
  /** Whether this ref is the current HEAD. */
  readonly isHead: boolean;
}

// Blame

export interface BlameLine {
  /** The commit that last touched this line. */
  readonly hash: CommitHash;
  readonly shortHash: ShortHash;
  readonly author: CommitAuthor;
  readonly authorDate: UnixTimestamp;
  readonly subject: string;
  /** 1-based original line number in the blamed commit. */
  readonly originalLine: number;
  /** 1-based line number in the current file. */
  readonly currentLine: number;
  /** The content of the line. */
  readonly content: string;
}

export interface BlameResult {
  readonly filePath: string;
  readonly lines: readonly BlameLine[];
}

// Diff

export type FileStatus =
  | 'added'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'untracked';

export interface DiffFileStat {
  readonly path: string;
  readonly oldPath?: string;
  readonly status: FileStatus;
  readonly additions: number;
  readonly deletions: number;
  /** Rename similarity percentage (0-100). */
  readonly similarity?: number;
}

export interface DiffHunkHeader {
  readonly oldStart: number;
  readonly oldCount: number;
  readonly newStart: number;
  readonly newCount: number;
  /** Optional function/class context from the @@ header. */
  readonly context?: string;
}

export type DiffLineType = 'add' | 'delete' | 'context';

export interface DiffLine {
  readonly type: DiffLineType;
  readonly content: string;
  /** 1-based line number in old file (undefined for additions). */
  readonly oldLineNumber?: number;
  /** 1-based line number in new file (undefined for deletions). */
  readonly newLineNumber?: number;
}

export interface DiffHunk {
  readonly header: DiffHunkHeader;
  readonly lines: readonly DiffLine[];
}

export interface FileDiff {
  readonly path: string;
  readonly oldPath?: string;
  readonly status: FileStatus;
  readonly hunks: readonly DiffHunk[];
  readonly isBinary: boolean;
}

// Staging

export interface StagingHunk {
  /** The hunk from the diff. */
  readonly hunk: DiffHunk;
  /** Whether this hunk is selected for staging. */
  selected: boolean;
}

export interface StagingFile {
  readonly path: string;
  readonly status: FileStatus;
  readonly hunks: StagingHunk[];
}

// Stash

export interface StashEntry {
  readonly index: number;
  readonly hash: CommitHash;
  readonly message: string;
  readonly date: UnixTimestamp;
  readonly branch: string;
}

// Branches & Tags

export interface Branch {
  readonly name: string;
  readonly isRemote: boolean;
  readonly isCurrent: boolean;
  readonly remote?: string;
  readonly upstream?: string;
  readonly hash: CommitHash;
  readonly lastCommitDate: UnixTimestamp;
  readonly lastCommitSubject: string;
}

export interface Tag {
  readonly name: string;
  readonly hash: CommitHash;
  /** If annotated tag, the tag object hash. */
  readonly tagHash?: CommitHash;
  readonly message?: string;
  readonly tagger?: CommitAuthor;
  readonly date?: UnixTimestamp;
}

// Repository Status

export interface RepoStatus {
  readonly currentBranch: string | null;
  readonly detachedHead: boolean;
  readonly upstream: string | null;
  readonly ahead: number;
  readonly behind: number;
  readonly staged: readonly DiffFileStat[];
  readonly unstaged: readonly DiffFileStat[];
  readonly untracked: readonly string[];
  readonly conflicts: readonly string[];
  /** Is a merge in progress? */
  readonly merging: boolean;
  /** Is a rebase in progress? */
  readonly rebasing: boolean;
  /** Is a cherry-pick in progress? */
  readonly cherryPicking: boolean;
}

// Contributors

export interface Contributor {
  readonly name: string;
  readonly email: string;
  readonly commits: number;
  readonly firstCommitDate: UnixTimestamp;
  readonly lastCommitDate: UnixTimestamp;
}

// Log Query Options

export interface LogOptions {
  /** Maximum number of commits to fetch. */
  readonly maxCount?: number;
  /** Skip this many commits from the start. */
  readonly skip?: number;
  /** Only include commits affecting this file path. */
  readonly filePath?: string;
  /** Only include commits by this author (regexp). */
  readonly author?: string;
  /** Only include commits with message matching this pattern. */
  readonly grep?: string;
  /** Only include commits after this date. */
  readonly after?: Date;
  /** Only include commits before this date. */
  readonly before?: Date;
  /** Specific refs/branches to include (default: --all). */
  readonly refs?: readonly string[];
  /** Include all refs (--all flag). Defaults to true. */
  readonly all?: boolean;
  /** Follow first parent only. */
  readonly firstParent?: boolean;
}

// Rebase

export type RebaseAction = 'pick' | 'reword' | 'edit' | 'squash' | 'fixup' | 'drop';

export interface RebaseCommit {
  readonly hash: CommitHash;
  readonly shortHash: ShortHash;
  readonly subject: string;
  readonly author: string;
  action: RebaseAction;
}

export interface RebasePlan {
  readonly upstream: CommitHash;
  readonly upstreamShortHash: ShortHash;
  readonly commits: RebaseCommit[];
}

export interface RebaseStatus {
  readonly inProgress: boolean;
  readonly current?: number;
  readonly total?: number;
  readonly message?: string;
  readonly stoppedAt?: CommitHash;
}

// Message Protocol (Webview ↔ Extension)

export type MessageToWebview =
  | { type: 'commits'; data: Commit[] }
  | { type: 'graphLayout'; data: GraphData }
  | { type: 'commitDetail'; data: { commit: Commit; files: DiffFileStat[]; diff?: FileDiff[] } }
  | { type: 'blame'; data: BlameResult }
  | { type: 'status'; data: RepoStatus }
  | { type: 'branches'; data: Branch[] }
  | { type: 'tags'; data: Tag[] }
  | { type: 'stashes'; data: StashEntry[] }
  | { type: 'stashDiff'; data: { index: number; diffs: FileDiff[] } }
  | { type: 'rebasePlan'; data: RebasePlan }
  | { type: 'rebaseStatus'; data: RebaseStatus }
  | { type: 'contributors'; data: Contributor[] }
  | { type: 'fileHistory'; data: { filePath: string; commits: Commit[] } }
  | { type: 'fileDiff'; data: FileDiff }
  | { type: 'commitComparison'; data: { base: CommitHash; target: CommitHash; files: DiffFileStat[]; diffs?: FileDiff[] } }
  | { type: 'error'; data: { message: string; code?: string } }
  | { type: 'themeChanged'; data: ThemeColors };

export type MessageFromWebview =
  | { type: 'requestCommits'; data: LogOptions }
  | { type: 'requestCommitDetail'; data: { hash: CommitHash } }
  | { type: 'requestBlame'; data: { filePath: string; startLine?: number; endLine?: number } }
  | { type: 'requestStatus' }
  | { type: 'requestBranches' }
  | { type: 'requestTags' }
  | { type: 'requestStashes' }
  | { type: 'requestContributors' }
  | { type: 'requestFileHistory'; data: { filePath: string } }
  | { type: 'requestFileDiff'; data: { hash: CommitHash; filePath: string } }
  | { type: 'requestCompareCommits'; data: { base: CommitHash; target: CommitHash } }
  | { type: 'checkoutBranch'; data: { name: string } }
  | { type: 'checkoutCommit'; data: { hash: CommitHash } }
  | { type: 'createBranch'; data: { name: string; startPoint?: string } }
  | { type: 'deleteBranch'; data: { name: string; force?: boolean } }
  | { type: 'createTag'; data: { name: string; hash: CommitHash; message?: string } }
  | { type: 'deleteTag'; data: { name: string } }
  | { type: 'cherryPick'; data: { hash: CommitHash } }
  | { type: 'revert'; data: { hash: CommitHash } }
  | { type: 'stashSave'; data: { message?: string; includeUntracked?: boolean } }
  | { type: 'stashApply'; data: { index: number } }
  | { type: 'stashPop'; data: { index: number } }
  | { type: 'stashDrop'; data: { index: number } }
  | { type: 'viewStashDiff'; data: { index: number } }
  | { type: 'stageFile'; data: { filePath: string } }
  | { type: 'unstageFile'; data: { filePath: string } }
  | { type: 'stageHunk'; data: { filePath: string; hunkIndex: number } }
  | { type: 'unstageHunk'; data: { filePath: string; hunkIndex: number } }
  | { type: 'stageLines'; data: { filePath: string; hunkIndex: number; lineIndices: number[] } }
  | { type: 'unstageLines'; data: { filePath: string; hunkIndex: number; lineIndices: number[] } }
  | { type: 'requestRebasePlan'; data: { upstream: CommitHash } }
  | { type: 'startInteractiveRebase'; data: { upstream: CommitHash; plan: { hash: CommitHash; action: RebaseAction }[] } }
  | { type: 'rebaseContinue' }
  | { type: 'rebaseAbort' }
  | { type: 'openFile'; data: { filePath: string; line?: number } }
  | { type: 'copyToClipboard'; data: { text: string } };

// Graph Layout Types

export interface GraphNode {
  /** The commit this node represents. */
  readonly hash: CommitHash;
  /** Column (lane) index, 0-based from left. */
  readonly column: number;
  /** Row index (position in the topological list). */
  readonly row: number;
  /** Color index for the lane. */
  readonly colorIndex: number;
}

export interface GraphEdge {
  /** Source node hash (child commit). */
  readonly from: CommitHash;
  /** Target node hash (parent commit). */
  readonly to: CommitHash;
  /** Column of the source node. */
  readonly fromColumn: number;
  /** Column of the target node. */
  readonly toColumn: number;
  /** Row of the source node. */
  readonly fromRow: number;
  /** Row of the target node. */
  readonly toRow: number;
  /** Color index for this edge. */
  readonly colorIndex: number;
  /** Type of connection for rendering. */
  readonly type: 'straight' | 'merge-in' | 'branch-out';
}

export interface GraphData {
  readonly nodes: readonly GraphNode[];
  readonly edges: readonly GraphEdge[];
  readonly commits: readonly Commit[];
  /** Number of columns (lanes) used. */
  readonly maxColumns: number;
}

// Theme

export interface ThemeColors {
  readonly background: string;
  readonly foreground: string;
  readonly border: string;
  readonly accent: string;
  readonly selectionBackground: string;
  readonly inputBackground: string;
  readonly inputForeground: string;
  readonly inputBorder: string;
  readonly buttonBackground: string;
  readonly buttonForeground: string;
  /** Branch lane colors. */
  readonly graphColors: readonly string[];
}
