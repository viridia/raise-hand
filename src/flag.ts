// The flag file contract, with no dependency on VS Code so it can be tested directly. While the flag
// exists, the hook (~/.raise-hand/hook.sh) blocks the agent's next tool call and deletes it.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const defaultFlagPath = path.join(os.homedir(), ".raise-hand", "raised");

const WATCH_RETRY_MS = 5000;

export function isRaised(flagPath: string): boolean {
  return fs.existsSync(flagPath);
}

export function raise(flagPath: string): void {
  fs.mkdirSync(path.dirname(flagPath), { recursive: true });
  fs.writeFileSync(flagPath, "");
}

export function clear(flagPath: string): void {
  fs.rmSync(flagPath, { force: true });
}

/**
 * Acts on what the user was shown, not on the file. If the hook consumes the flag just as the user
 * clicks to clear it, re-reading the file would raise the hand again and stop the next tool call.
 */
export function toggle(flagPath: string, shownAsRaised: boolean): void {
  if (shownAsRaised) {
    clear(flagPath);
  } else {
    raise(flagPath);
  }
}

/**
 * Tracks whether the flag exists. It watches the parent directory because the flag itself comes and
 * goes, and a watch on a path does not survive that path being deleted.
 */
export class FlagWatcher {
  private raised: boolean;
  private watcher?: fs.FSWatcher;
  private retryTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(
    private readonly flagPath: string,
    private readonly onChange: (raised: boolean) => void,
    private readonly retryMs: number = WATCH_RETRY_MS,
  ) {
    this.raised = isRaised(flagPath);
    this.start();
  }

  get isRaised(): boolean {
    return this.raised;
  }

  /** Re-reads the file, and calls `onChange` only if the state differs. */
  refresh(): void {
    if (this.disposed) {
      return;
    }
    const raised = isRaised(this.flagPath);
    if (raised !== this.raised) {
      this.raised = raised;
      this.onChange(raised);
    }
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.retryTimer);
    this.watcher?.close();
  }

  private start(): void {
    try {
      const dir = path.dirname(this.flagPath);
      fs.mkdirSync(dir, { recursive: true });
      // The directory is busy with unrelated files, so every event just re-reads the flag.
      this.watcher = fs.watch(dir, () => this.refresh());
      this.watcher.on("error", () => this.restartLater());
      // Covers a change between the first read and the watch starting.
      this.refresh();
    } catch {
      this.restartLater();
    }
  }

  private restartLater(): void {
    this.watcher?.close();
    this.watcher = undefined;
    if (this.disposed || this.retryTimer) {
      return;
    }
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.start();
    }, this.retryMs);
    this.retryTimer.unref();
  }
}
