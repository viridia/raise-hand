import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, it } from "node:test";
import { isRaised, raise } from "../src/flag";

const script = path.join(__dirname, "..", "..", "hook", "raise-hand.sh");

let home: string;
let flag: string;

// The hook reads $HOME, so a temporary one keeps the real flag out of it.
function runHook() {
  return spawnSync("sh", [script], { env: { ...process.env, HOME: home }, encoding: "utf8" });
}

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "raise-hand-home-"));
  flag = path.join(home, ".claude", "raised-hand");
});

afterEach(() => {
  fs.rmSync(home, { recursive: true, force: true });
});

it("lets the tool call through when no flag is set", () => {
  const result = runHook();
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
});

it("blocks once on a flag the extension created, then lets calls through", () => {
  raise(flag);

  const blocked = runHook();
  assert.equal(blocked.status, 2);
  assert.match(blocked.stderr, /raised a hand/);
  assert.equal(isRaised(flag), false);

  assert.equal(runHook().status, 0);
});
