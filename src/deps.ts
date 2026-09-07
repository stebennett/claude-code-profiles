/**
 * The effects the CLI cannot mock away — process state, terminal I/O, and
 * replacing the process with `claude`. Everything else the CLI does is pure or
 * ordinary filesystem work, so this is the whole injection surface.
 */
export interface CliDeps {
  /** The inherited environment. */
  env: Readonly<Record<string, string | undefined>>;
  /** Absolute path to the working directory. */
  cwd: string;
  /** Absolute path to the current user's home directory. */
  homeDir: string;
  /** Whether stdin is a terminal, and so whether a prompt can be answered. */
  isTTY: boolean;
  /** Writes to standard output verbatim; the caller supplies any newline. */
  stdout: (text: string) => void;
  /** Writes to standard error verbatim; the caller supplies any newline. */
  stderr: (text: string) => void;
  /** Asks a yes/no question, defaulting to no. */
  confirm: (question: string) => Promise<boolean>;
  /**
   * Replaces the current process with `command`. Never returns on success,
   * which is why a Run is only observable through this seam.
   */
  launch: (
    command: string,
    args: readonly string[],
    env: Readonly<Record<string, string>>,
  ) => Promise<never>;
}
