import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { raise, readState } from "../src/flag";

const script = path.join(__dirname, "..", "..", "hook", "hook.sh");

const FIRST = /The user has raised a hand/;
const STILL = /still raised/;

let home: string;
let dir: string;

// The hook reads $HOME, so a temporary one keeps the real hand out of it.
const env = () => ({ ...process.env, HOME: home });

function runHook(...args: string[]) {
  return spawnSync("sh", [script, ...args], { env: env(), encoding: "utf8" });
}

function runHookAsync(...args: string[]): Promise<{ status: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("sh", [script, ...args], { env: env() });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stderr }));
  });
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "raise-hand-home-"));
  dir = path.join(home, ".raise-hand");
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

describe("pre-tool", () => {
  it("lets the call through when the hand is down", () => {
    const result = runHook("pre-tool");
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
  });

  it("blocks the first call, acknowledges, and keeps blocking with a different message", () => {
    raise(dir);

    const first = runHook("pre-tool");
    assert.equal(first.status, 2);
    assert.match(first.stderr, FIRST);
    assert.equal(readState(dir), "acknowledged");

    for (let i = 0; i < 3; i++) {
      const later = runHook("pre-tool");
      assert.equal(later.status, 2);
      assert.match(later.stderr, STILL);
      assert.doesNotMatch(later.stderr, FIRST);
    }
    assert.equal(readState(dir), "acknowledged");
  });

  it("gives the first message to exactly one of several calls checking at once", async () => {
    for (let round = 0; round < 10; round++) {
      raise(dir);
      const results = await Promise.all(Array.from({ length: 6 }, () => runHookAsync("pre-tool")));
      assert.ok(results.every((r) => r.status === 2), `round ${round}: every call blocked`);
      assert.equal(results.filter((r) => FIRST.test(r.stderr)).length, 1, `round ${round}: one first message`);
      runHook("turn-end");
    }
  });
});

describe("turn-end", () => {
  it("lowers a raised or acknowledged hand, and always exits 0", () => {
    assert.equal(runHook("turn-end").status, 0);

    raise(dir);
    assert.equal(runHook("turn-end").status, 0);
    assert.equal(readState(dir), "down");

    raise(dir);
    runHook("pre-tool");
    const result = runHook("turn-end");
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(readState(dir), "down");
  });

  it("lets the next turn's calls through", () => {
    raise(dir);
    runHook("pre-tool");
    runHook("turn-end");
    assert.equal(runHook("pre-tool").status, 0);
  });
});

describe("no argument, for agents without a turn-end hook", () => {
  it("lets the call through when the hand is down", () => {
    assert.equal(runHook().status, 0);
  });

  it("blocks once on a raised hand, then lowers it", () => {
    raise(dir);
    const blocked = runHook();
    assert.equal(blocked.status, 2);
    assert.match(blocked.stderr, FIRST);
    assert.equal(readState(dir), "down");
    assert.equal(runHook().status, 0);
  });
});

it("rejects an unknown argument without blocking", () => {
  const result = runHook("bogus");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unknown argument/);
});
