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

It is installed outside this repository, and it is a file contract: **when `~/.raise-hand/raised`
exists, the agent's next tool call is blocked.** `hook/hook.sh` is the source of the installed script,
and people install it by following the README. The folder isn't under `~/.claude` because the
extension isn't specific to Claude Code.

| File | Role |
| --- | --- |
| `~/.raise-hand/hook.sh` | The hook. If the flag exists, deletes it, prints a stop message to stderr and exits 2. |
| `~/.claude/settings.json` | Runs the script as a `PreToolUse` hook, matcher `*`, in every project. |
| `~/Library/Application Support/Code/User/keybindings.json` | Binds `ctrl+alt+h` to the command `raiseHand.toggle`. |

The extension's core job is to create that flag file; the hook does not need to change.

Known limits of the mechanism, which the extension cannot remove:

- It fires only at a tool call, so it cannot interrupt an agent while it writes a long reply.
- The flag is global, so it stops whichever session makes the next tool call.

**Working on this project can stop you.** A flag left set, even by a test click, blocks your own next
tool call, and the hook then deletes it. Treat that as the author raising a hand. Never create the
real flag yourself, and use a temporary path or `HOME` in tests.

## What the extension does

- A status bar item, visible in every window, that creates the flag when clicked. A click works
  wherever keyboard focus is, including inside the Claude panel.
- The item shows when the flag is set, by watching the file, so every open window agrees. It watches
  outside the workspace API, since `~/.raise-hand` is not in the workspace.
- Clicking while the flag is set clears it. A flag set when no agent is running otherwise stays set
  and stops the first tool call of the next session.
- A command for the same action, so it can be bound to a key.

`src/flag.ts` holds the file logic and has no dependency on VS Code, so it can be tested directly.
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

1. A click creates the flag, and the item changes in every open window.
2. A second click clears the flag.
3. The flag being deleted by the hook returns the item to normal.
4. With an agent working, a click blocks its next tool call.

The author has to do these steps, or watch them, since an agent cannot click the button. Say so
rather than reporting them as done. Automated tests should cover what can be tested without VS Code.

Use the Node version in `.nvmrc`. The current `vsce` needs Node 22 or newer.
