import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { defaultStateDir, HandState, HandWatcher, lower, raise, readState, toggle } from "../src/flag";

let dir: string;
let watchers: HandWatcher[];

beforeEach(() => {
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "raise-hand-")), "state");
  watchers = [];
});

afterEach(() => {
  watchers.forEach((w) => w.dispose());
  fs.rmSync(path.dirname(dir), { recursive: true, force: true });
});

// What the hook does when it acknowledges the hand.
const acknowledge = (d = dir) => fs.renameSync(path.join(d, "raised"), path.join(d, "acknowledged"));

function watch(onChange: (state: HandState) => void, target = dir, retryMs?: number): HandWatcher {
  const watcher = new HandWatcher(target, onChange, retryMs);
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

describe("hand state", () => {
  it("uses the directory the hook checks", () => {
    assert.equal(defaultStateDir, path.join(os.homedir(), ".raise-hand"));
  });

  it("is down when there are no files, including no directory", () => {
    assert.equal(readState(dir), "down");
  });

  it("raise creates the directory and raises the hand", () => {
    raise(dir);
    assert.equal(readState(dir), "raised");
  });

  it("reads as acknowledged after the hook renames the file", () => {
    raise(dir);
    acknowledge();
    assert.equal(readState(dir), "acknowledged");
  });

  it("lower clears both raised and acknowledged", () => {
    raise(dir);
    lower(dir);
    assert.equal(readState(dir), "down");
    raise(dir);
    acknowledge();
    lower(dir);
    assert.equal(readState(dir), "down");
  });

  it("lower is safe when the hand is already down", () => {
    assert.doesNotThrow(() => lower(dir));
  });
});

describe("toggle", () => {
  it("raises when shown as down", () => {
    toggle(dir, "down");
    assert.equal(readState(dir), "raised");
  });

  it("lowers when shown as raised or acknowledged", () => {
    raise(dir);
    toggle(dir, "raised");
    assert.equal(readState(dir), "down");
    raise(dir);
    acknowledge();
    toggle(dir, "acknowledged");
    assert.equal(readState(dir), "down");
  });

  it("does not raise again if the turn ended just before the click", () => {
    toggle(dir, "acknowledged");
    assert.equal(readState(dir), "down");
  });
});

describe("HandWatcher", () => {
  it("starts with the current state", () => {
    assert.equal(watch(() => {}).state, "down");
    raise(dir);
    assert.equal(watch(() => {}).state, "raised");
  });

  it("follows a full cycle made by other processes", async () => {
    const seen: HandState[] = [];
    watch((state) => seen.push(state));
    for (let i = 1; i <= 2; i++) {
      fs.writeFileSync(path.join(dir, "raised"), "");
      await until(() => seen.at(-1) === "raised", `raise ${i}`);
      acknowledge();
      await until(() => seen.at(-1) === "acknowledged", `acknowledge ${i}`);
      fs.rmSync(path.join(dir, "acknowledged"));
      await until(() => seen.at(-1) === "down", `turn end ${i}`);
    }
    assert.deepEqual(seen, ["raised", "acknowledged", "down", "raised", "acknowledged", "down"]);
  });

  it("ignores other files in the directory", async () => {
    const seen: HandState[] = [];
    watch((state) => seen.push(state));
    fs.writeFileSync(path.join(dir, "hook.sh"), "x");
    await settle();
    assert.deepEqual(seen, []);
  });

  it("refresh reports a change once, without waiting for an event", () => {
    const seen: HandState[] = [];
    const watcher = watch((state) => seen.push(state));
    raise(dir);
    watcher.refresh();
    watcher.refresh();
    assert.deepEqual(seen, ["raised"]);
  });

  it("agrees across several watchers, like open windows", async () => {
    const a = watch(() => {});
    const b = watch(() => {});
    raise(dir);
    await until(() => a.state === "raised" && b.state === "raised", "both to see the raise");
    acknowledge();
    await until(() => a.state === "acknowledged" && b.state === "acknowledged", "both to see it acknowledged");
    lower(dir);
    await until(() => a.state === "down" && b.state === "down", "both to see it lowered");
  });

  it("recovers when the watch cannot start at first", async () => {
    // A file where the directory should be makes the first attempt fail.
    fs.writeFileSync(dir, "");
    const seen: HandState[] = [];
    watch((state) => seen.push(state), dir, 20);
    fs.rmSync(dir);
    await until(() => fs.existsSync(dir), "the retry to create the directory");
    fs.writeFileSync(path.join(dir, "raised"), "");
    await until(() => seen.length > 0, "the change");
    assert.deepEqual(seen, ["raised"]);
  });

  it("reports nothing after dispose", async () => {
    const seen: HandState[] = [];
    const watcher = watch((state) => seen.push(state));
    watcher.dispose();
    raise(dir);
    watcher.refresh();
    await settle();
    assert.deepEqual(seen, []);
  });
});
