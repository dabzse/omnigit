// ============================================================
// @dabzse/omnigit-core — Public API Barrel Export
// ============================================================

// Types
export type {
  BlameLine,
  BlameResult,
  Branch,
  Commit,
  CommitAuthor,
  CommitHash,
  Contributor,
  DiffFileStat,
  DiffHunk,
  DiffHunkHeader,
  DiffLine,
  DiffLineType,
  FileDiff,
  FileStatus,
  GraphData,
  GraphEdge,
  GraphNode,
  LogOptions,
  MessageFromWebview,
  MessageToWebview,
  RebaseAction,
  RebaseCommit,
  RebasePlan,
  RebaseStatus,
  Ref,
  RefType,
  RepoStatus,
  ShortHash,
  StagingFile,
  StagingHunk,
  StashEntry,
  Tag,
  ThemeColors,
  UnixTimestamp,
} from './git/types.js';

// Git Executor
export { GitExecutor, GitError } from './git/executor.js';
export type { GitExecutorOptions, GitExecResult } from './git/executor.js';

// Log Parser
export { getLog, parseLogOutput, parseRefs } from './git/log-parser.js';

// Blame
export { getBlame, getBlameAtCommit, parseBlameOutput } from './git/blame.js';

// Diff
export {
  getCommitDiff,
  getCommitDiffStats,
  getDiffStats,
  getFileDiff,
  getStagedDiff,
  getWorkingDiff,
  parseUnifiedDiff,
} from './git/diff.js';

// Staging
export {
  getStagingFiles,
  stageFile,
  stageHunk,
  stageHunkByIndex,
  stageLines,
  stageLinesByIndex,
  unstageFile,
  unstageHunk,
  unstageHunkByIndex,
  unstageLines,
  unstageLinesByIndex,
} from './git/staging.js';

// Stash
export {
  getStashDiff,
  listStashes,
  stashApply,
  stashClear,
  stashDrop,
  stashPop,
  stashSave,
} from './git/stash.js';

// Rebase
export {
  executeInteractiveRebase,
  formatRebaseTodo,
  getRebasePlan,
  getRebaseStatus,
  rebaseAbort,
  rebaseContinue,
} from './git/rebase.js';

// Refs (Branches, Tags, Status, Operations)
export {
  checkout,
  checkoutNewBranch,
  cherryPick,
  createBranch,
  createTag,
  deleteBranch,
  deleteTag,
  getContributors,
  getRepoStatus,
  listBranches,
  listTags,
  renameBranch,
  revert,
} from './git/refs.js';

// Graph Layout
export { computeGraphLayout, GRAPH_COLORS } from './graph/layout.js';

