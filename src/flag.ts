// The hand's state, kept as files so that the hook (~/.raise-hand/hook.sh) can share it. This has
// no dependency on VS Code, so it can be tested directly.
//
// - `raised` exists: the user raised a hand, and no agent has seen it yet.
// - `acknowledged` exists: the hook has blocked a tool call. It blocks every later call too, until
//   the agent's turn ends and the turn-end hook removes both files.
//
// The hook acknowledges with a rename, so the two files never exist from a single raise.
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export type HandState = "down" | "raised" | "acknowledged";

export const defaultStateDir = path.join(os.homedir(), ".raise-hand");

const WATCH_RETRY_MS = 5000;

const raisedFile = (dir: string) => path.join(dir, "raised");
const acknowledgedFile = (dir: string) => path.join(dir, "acknowledged");

export function readState(dir: string): HandState {
  if (fs.existsSync(acknowledgedFile(dir))) {
    return "acknowledged";
  }
  return fs.existsSync(raisedFile(dir)) ? "raised" : "down";
}

export function raise(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(raisedFile(dir), "");
}

export function lower(dir: string): void {
  fs.rmSync(raisedFile(dir), { force: true });
  fs.rmSync(acknowledgedFile(dir), { force: true });
}

/**
 * Acts on what the user was shown, not on the files. If the turn ends just as the user clicks to
 * lower their hand, re-reading the files would raise it again and stop the next tool call.
 */
export function toggle(dir: string, shown: HandState): void {
  if (shown === "down") {
    raise(dir);
  } else {
    lower(dir);
  }
}

/**
 * Tracks the hand's state. It watches the directory because the files come and go, and a watch on
 * a path does not survive that path being deleted.
 */
export class HandWatcher {
  private current: HandState;
  private watcher?: fs.FSWatcher;
  private retryTimer?: NodeJS.Timeout;
  private disposed = false;

  constructor(
    private readonly dir: string,
    private readonly onChange: (state: HandState) => void,
    private readonly retryMs: number = WATCH_RETRY_MS,
  ) {
    this.current = readState(dir);
    this.start();
  }

  get state(): HandState {
    return this.current;
  }

  /** Re-reads the files, and calls `onChange` only if the state differs. */
  refresh(): void {
    if (this.disposed) {
      return;
    }
    const state = readState(this.dir);
    if (state !== this.current) {
      this.current = state;
      this.onChange(state);
    }
  }

  dispose(): void {
    this.disposed = true;
    clearTimeout(this.retryTimer);
    this.watcher?.close();
  }

  private start(): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      this.watcher = fs.watch(this.dir, () => this.refresh());
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
