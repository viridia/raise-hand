# Raise Hand

A VS Code extension that adds an always-visible button for interrupting a Claude Code agent.
`README.md` has the setup steps and build commands.

"The author" below means the project's maintainer, `viridia`. If you are working for someone who
cloned this repository, the sections on the mechanism and the extension still apply, but "Working
with the author" does not: follow your own user's instructions. The paths and configuration
described here are the maintainer's setup, and theirs may differ.

## The problem

While an agent works, the author sometimes wants it to stop and listen. Rejecting a tool call is
clumsy, and a keyboard shortcut gets forgotten, since it is needed too rarely to become habit. A
visible button removes the need to remember anything.

## The stopping mechanism

It is installed outside this repository, and it is a file contract kept in `~/.raise-hand`. The hand
is in one of three states:

| State | Files | Entered when |
| --- | --- | --- |
| Down | neither | at the start, at the end of a turn, or on a click to lower it |
| Raised | `raised` | the user clicks |
| Acknowledged | `acknowledged` | a pre-tool hook blocks a call, renaming `raised` |

`hook/hook.sh` is the source of the installed script, and people install it by following the
README. Its argument says which hook is calling:

- `pre-tool`: blocks every tool call while the hand is up. The call that acknowledges it gets a
  "raised a hand" message, and later calls are told it is the same hand, so that an agent seeing
  several blocks in one batch knows the user raised it once. The rename is what makes exactly one
  call the first, even when several check at once.
- `turn-end`: lowers the hand. It must always exit 0, since exit 2 from a `Stop` hook sends Claude
  back to work.
- No argument: blocks one call and lowers the hand, for agents without a turn-end hook.

Holding the block until the turn ends exists because one-shot blocking stopped only one call of a
batch, and an agent could ignore the message and carry on. The folder isn't under `~/.claude`
because the extension isn't specific to Claude Code.

| File | Role |
| --- | --- |
| `~/.raise-hand/hook.sh` | The installed hook script. |
| `~/.claude/settings.json` | Runs it as `pre-tool` for `PreToolUse` (matcher `*`), and as `turn-end` for `Stop` and `StopFailure`. |
| `~/Library/Application Support/Code/User/keybindings.json` | Binds `ctrl+alt+h` to the command `raiseHand.toggle`. |

Known limits of the mechanism, which the extension cannot remove:

- It fires only at a tool call, so it cannot interrupt an agent while it writes a long reply.
- The hand is global, so it stops whichever session makes the next tool call, and any session ending
  its turn lowers it.
- Claude Code doesn't run `Stop` when the user interrupts with Escape, so an acknowledged hand stays
  up until the next turn ends or the user clicks.

**Working on this project can stop you.** A hand left up, even by a test click, blocks your own tool
calls until your turn ends. Treat that as the author raising a hand. Never create the real files
yourself, and use a temporary path or `HOME` in tests.

## What the extension does

- A status bar item, visible in every window, that raises the hand when clicked. A click works
  wherever keyboard focus is, including inside the Claude panel.
- The item shows all three states, by watching the directory, so every open window agrees. It
  watches outside the workspace API, since `~/.raise-hand` is not in the workspace.
- Clicking while the hand is raised or acknowledged lowers it. The click acts on the state the item
  shows, so a click that races the turn ending doesn't raise the hand again.
- A command for the same action, so it can be bound to a key.

`src/flag.ts` holds the state logic and has no dependency on VS Code, so it can be tested directly.
`src/extension.ts` is the status bar item and command.

**Not built yet:** per-project flags, installing or editing the hook, and publishing to the
Marketplace. Bring any of these to the author as a proposal first. Per-project flags are the likely
next step; the difficulty is knowing which project is meant in a multi-root workspace.

## Working with the author

- The author commits. Never run `git commit` or `git push`; give the commit message as text. Their
  GitHub username is `viridia`.
- Never post publicly, including publishing the extension.
- The repository is meant to be shared, so the README is written for people who don't know this
  setup. Reports from other people belong in GitHub issues.
- Don't change `~/.raise-hand/`, `~/.claude/` or the VS Code user configuration without asking.
- Propose any new dependency briefly first, and keep them few. This is a small tool, so it does not
  need a ledger structure unless the author asks for one.

## Verification

After a change, package it and install it into the author's own VS Code. Confirm that:

1. A click raises the hand, and the item changes in every open window.
2. A second click lowers it.
3. With an agent working, a click blocks its next tool call, and the item shows "Agent stopping".
4. When that agent's turn ends, the item returns to normal.

The author has to do these steps, or watch them, since an agent cannot click the button. Say so
rather than reporting them as done. Automated tests should cover what can be tested without VS Code.

Use the Node version in `.nvmrc`. The current `vsce` needs Node 22 or newer.
