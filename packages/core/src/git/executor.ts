// ============================================================
// @dabzse/omnigit-core — Git CLI Executor
//
// Thin wrapper around the system `git` binary. Every git
// interaction in the plugin flows through this executor,
// making it easy to mock for tests and swap for a library
// implementation later.
// ============================================================

import { execFile, type ExecFileOptions } from 'node:child_process';

// Types

export interface GitExecutorOptions {
  /** Path to the git binary. Defaults to "git". */
  gitBinary?: string;
  /** Working directory (repo root). */
  cwd: string;
  /** Maximum buffer size in bytes. Defaults to 50MB. */
  maxBuffer?: number;
  /** Timeout in ms. Defaults to 30_000. */
  timeout?: number;
  /** Optional environment variable overrides. */
  env?: Record<string, string>;
}

export interface GitExecResult {
  /** stdout content. */
  stdout: string;
  /** stderr content. */
  stderr: string;
  /** Process exit code. */
  exitCode: number;
}

export class GitError extends Error {
  constructor(
    message: string,
    public readonly command: string,
    public readonly args: readonly string[],
    public readonly stderr: string,
    public readonly exitCode: number,
  ) {
    super(message);
    this.name = 'GitError';
  }
}

// Executor

const DEFAULT_MAX_BUFFER = 50 * 1024 * 1024; // 50 MB
const DEFAULT_TIMEOUT = 30_000; // 30 seconds

export class GitExecutor {
  private readonly gitBinary: string;
  private readonly cwd: string;
  private readonly maxBuffer: number;
  private readonly timeout: number;
  private readonly env: Record<string, string>;

  constructor(options: GitExecutorOptions) {
    this.gitBinary = options.gitBinary ?? 'git';
    this.cwd = options.cwd;
    this.maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.env = options.env ?? {};
  }

  /**
   * Execute a git command and return the result.
   * Throws `GitError` on non-zero exit code.
   */
  async exec(
    args: readonly string[],
    overrideOptions?: { env?: Record<string, string> },
  ): Promise<GitExecResult> {
    return new Promise((resolve, reject) => {
      const options: ExecFileOptions = {
        cwd: this.cwd,
        maxBuffer: this.maxBuffer,
        timeout: this.timeout,
        env: {
          ...process.env,
          // Prevent git from asking for credentials interactively
          GIT_TERMINAL_PROMPT: '0',
          // Force English output for reliable parsing
          LC_ALL: 'C',
          ...this.env,
          ...overrideOptions?.env,
        },
      };

      execFile(this.gitBinary, [...args], options, (error, stdout, stderr) => {
        const stdoutStr = typeof stdout === 'string' ? stdout : stdout?.toString() ?? '';
        const stderrStr = typeof stderr === 'string' ? stderr : stderr?.toString() ?? '';

        if (error) {
          const exitCode = (error as NodeJS.ErrnoException & { code?: number }).code
            ? 1
            : (error as any).status ?? 1;

          reject(
            new GitError(
              `git ${args.join(' ')} failed: ${stderrStr || error.message}`,
              this.gitBinary,
              args,
              stderrStr,
              exitCode,
            ),
          );
          return;
        }

        resolve({
          stdout: stdoutStr,
          stderr: stderrStr,
          exitCode: 0,
        });
      });
    });
  }

  /**
   * Execute a git command, returning stdout. Throws on failure.
   */
  async run(
    args: readonly string[],
    overrideOptions?: { env?: Record<string, string> },
  ): Promise<string> {
    const result = await this.exec(args, overrideOptions);
    return result.stdout;
  }

  /**
   * Execute a git command, returning stdout or null on error
   * (useful for commands where failure is expected, e.g.
   * checking if something exists).
   */
  async tryRun(
    args: readonly string[],
    overrideOptions?: { env?: Record<string, string> },
  ): Promise<string | null> {
    try {
      const result = await this.exec(args, overrideOptions);
      return result.stdout;
    } catch {
      return null;
    }
  }

  /** Get the top-level repo directory. */
  async getRepoRoot(): Promise<string> {
    const result = await this.run(['rev-parse', '--show-toplevel']);
    return result.trim();
  }

  /** Check if the cwd is inside a git repository. */
  async isGitRepo(): Promise<boolean> {
    const result = await this.tryRun(['rev-parse', '--is-inside-work-tree']);
    return result?.trim() === 'true';
  }

  /** Get the current HEAD hash. */
  async getHead(): Promise<string | null> {
    const result = await this.tryRun(['rev-parse', 'HEAD']);
    return result?.trim() ?? null;
  }

  /** Update the cwd for this executor (e.g. when the workspace changes). */
  withCwd(cwd: string): GitExecutor {
    return new GitExecutor({
      gitBinary: this.gitBinary,
      cwd,
      maxBuffer: this.maxBuffer,
      timeout: this.timeout,
      env: this.env,
    });
  }
}
