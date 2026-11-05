import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { clear, defaultFlagPath, FlagWatcher, isRaised, raise, toggle } from "../src/flag";

let dir: string;
let flag: string;
let watchers: FlagWatcher[];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "raise-hand-"));
  flag = path.join(dir, "raised-hand");
  watchers = [];
});

afterEach(() => {
  watchers.forEach((w) => w.dispose());
  fs.rmSync(dir, { recursive: true, force: true });
});

function watch(onChange: (raised: boolean) => void, target = flag, retryMs?: number): FlagWatcher {
  const watcher = new FlagWatcher(target, onChange, retryMs);
  watchers.push(watcher);
  return watcher;
}

async function until(condition: () => boolean, what: string): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() > deadline) {
      assert.fail(`timed out waiting for ${what}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

describe("flag file", () => {
  it("uses the path the hook checks", () => {
    assert.equal(defaultFlagPath, path.join(os.homedir(), ".claude", "raised-hand"));
  });

  it("raise creates the flag, and clear removes it", () => {
    raise(flag);
    assert.equal(isRaised(flag), true);
    clear(flag);
    assert.equal(isRaised(flag), false);
  });

  it("raise creates a missing parent directory", () => {
    const nested = path.join(dir, "missing", "raised-hand");
    raise(nested);
    assert.equal(isRaised(nested), true);
  });

  it("raise is safe when the flag is already set", () => {
    raise(flag);
    raise(flag);
    assert.equal(isRaised(flag), true);
  });

  it("clear is safe when the flag is already gone", () => {
    assert.doesNotThrow(() => clear(flag));
  });
});

describe("toggle", () => {
  it("raises when shown as not raised", () => {
    toggle(flag, false);
    assert.equal(isRaised(flag), true);
  });

  it("clears when shown as raised", () => {
    raise(flag);
    toggle(flag, true);
    assert.equal(isRaised(flag), false);
  });

  it("does not raise again if the hook consumed the flag before the click", () => {
    toggle(flag, true);
    assert.equal(isRaised(flag), false);
  });
});

describe("FlagWatcher", () => {
  it("starts with the current state", () => {
    assert.equal(watch(() => {}).isRaised, false);
    raise(flag);
    assert.equal(watch(() => {}).isRaised, true);
  });

  it("sees the flag created by another process", async () => {
    const seen: boolean[] = [];
    const watcher = watch((raised) => seen.push(raised));
    fs.writeFileSync(flag, "");
    await until(() => seen.length > 0, "the change");
    assert.deepEqual(seen, [true]);
    assert.equal(watcher.isRaised, true);
  });

  it("sees the flag deleted by another process, as the hook does", async () => {
    raise(flag);
    const seen: boolean[] = [];
    const watcher = watch((raised) => seen.push(raised));
    fs.rmSync(flag);
    await until(() => seen.length > 0, "the change");
    assert.deepEqual(seen, [false]);
    assert.equal(watcher.isRaised, false);
  });

  it("keeps working across repeated create and delete", async () => {
    const seen: boolean[] = [];
    watch((raised) => seen.push(raised));
    for (let i = 1; i <= 3; i++) {
      raise(flag);
      await until(() => seen.at(-1) === true, `raise ${i}`);
      clear(flag);
      await until(() => seen.at(-1) === false, `clear ${i}`);
    }
    assert.deepEqual(seen, [true, false, true, false, true, false]);
  });

  it("ignores other files in the directory", async () => {
    const seen: boolean[] = [];
    watch((raised) => seen.push(raised));
    fs.writeFileSync(path.join(dir, "history.jsonl"), "x");
    await settle();
    assert.deepEqual(seen, []);
  });

  it("refresh reports a change once, without waiting for an event", () => {
    const seen: boolean[] = [];
    const watcher = watch((raised) => seen.push(raised));
    raise(flag);
    watcher.refresh();
    watcher.refresh();
    assert.deepEqual(seen, [true]);
  });

  it("agrees across several watchers, like open windows", async () => {
    const a = watch(() => {});
    const b = watch(() => {});
    raise(flag);
    await until(() => a.isRaised && b.isRaised, "both watchers to see the raise");
    clear(flag);
    await until(() => !a.isRaised && !b.isRaised, "both watchers to see the clear");
  });

  it("watches a parent directory that did not exist", async () => {
    const nested = path.join(dir, "missing", "raised-hand");
    const seen: boolean[] = [];
    watch((raised) => seen.push(raised), nested);
    fs.writeFileSync(nested, "");
    await until(() => seen.length > 0, "the change");
    assert.deepEqual(seen, [true]);
  });

  it("recovers when the watch cannot start at first", async () => {
    // A file where the parent directory should be makes the first attempt fail.
    const parent = path.join(dir, "blocked");
    fs.writeFileSync(parent, "");
    const nested = path.join(parent, "raised-hand");
    const seen: boolean[] = [];
    watch((raised) => seen.push(raised), nested, 20);
    fs.rmSync(parent);
    await until(() => fs.existsSync(parent), "the retry to create the directory");
    fs.writeFileSync(nested, "");
    await until(() => seen.length > 0, "the change");
    assert.deepEqual(seen, [true]);
  });

  it("reports nothing after dispose", async () => {
    const seen: boolean[] = [];
    const watcher = watch((raised) => seen.push(raised));
    watcher.dispose();
    raise(flag);
    watcher.refresh();
    await settle();
    assert.deepEqual(seen, []);
  });
});
