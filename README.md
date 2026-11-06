# Raise Hand

A VS Code status bar button that stops a coding agent so you can speak. Click **Raise hand**, and
the agent's tool calls are blocked with a message telling it to stop and end its turn.

It has two parts, and you need both:

- **The extension** creates the file `~/.raise-hand/raised` when you click, and shows the hand's
  state in the status bar. A click while the hand is up lowers it.
- **A hook script** that the agent runs at two points:
  - **Before each tool call.** The first call to find your hand raised acknowledges it and is
    blocked. The status bar then shows **Agent stopping**. Every later call is blocked too, including
    the rest of a batch of calls the agent made at once, and each of those tells the agent it is the
    same raised hand.
  - **When the agent's turn ends.** It lowers your hand.

The agent needs no instructions or project files. The hook's message tells it what to do at the
moment it is blocked.

## Limits

- It takes effect at a tool call, so it can't interrupt an agent while it writes a long reply. Your
  hand is still lowered when that reply ends, since the turn is over and you can speak.
- The hand is shared, so it stops whichever session makes the next tool call, in any project. Any
  session ending its turn lowers it.
- Interrupting the agent yourself (Escape, in Claude Code) doesn't count as its turn ending, so an
  acknowledged hand stays up and blocks the next turn's tool calls. The status bar shows this, and a
  click lowers it.

## Setup

The easiest way is to have your agent do it. Paste this into it:

> Set up Raise Hand for me by following the Setup section of
> https://github.com/viridia/raise-hand. Show me any change to my agent's settings before you make it.

You'll need to do two things yourself at the end: reload your VS Code windows, and try the button.

### Notes for agents

- The steps below are written for Claude Code. If you are a different agent, install the hook using
  your own mechanism, which must run before every tool call and be able to block it. See
  [Other agents](#other-agents). If you have no such mechanism, say so rather than working around it.
- Use `pre-tool` and `turn-end` only if your agent has a hook for its turn ending. Without one,
  nothing would lower the hand, and every tool call would be blocked until the user clicks. Run the
  script with no argument instead, which blocks one call and lowers the hand.
- Merge into the user's existing settings. Don't replace them.
- If this machine can't run the `sh` hook, tell the user rather than improvising.
- Don't create `~/.raise-hand/raised` to test the hook, since it would block your own next tool call.
  Set `HOME` to a temporary folder to test the script instead.
- If the user has an earlier version installed, install the new extension before the new hook.
  Otherwise an older extension can't show an acknowledged hand.
- You can't click the button. Finish by telling the user to reload their VS Code windows, start a new
  agent session so that the hook loads, and do step 3.

### Requirements

You need VS Code 1.140 or newer, Claude Code, Git, and Node 22 or newer. Node is only used to build
the extension, and you don't need to know any JavaScript. If you don't have it, get it from
[nodejs.org](https://nodejs.org) or through a version manager such as
[nvm](https://github.com/nvm-sh/nvm). On Ubuntu, `sudo apt install nodejs npm` is enough.

It runs on macOS and Linux (tested on Ubuntu 26.04, where `/bin/sh` is `dash`). Windows would need a
way to run the `sh` hook, which is untested. Please
[open an issue](https://github.com/viridia/raise-hand/issues) to say how it went.

### 1. Build and install the extension

The extension isn't on the Marketplace, so you build it yourself:

```sh
git clone https://github.com/viridia/raise-hand.git
cd raise-hand
npm install
npm run package
code --install-extension raise-hand-0.3.0.vsix
```

`npm install` may warn about install scripts that weren't run. Packaging works anyway.

If you don't have the `code` command, run **Shell Command: Install 'code' command in PATH** from the
VS Code command palette. Or use **Extensions: Install from VSIX...** instead of the last line.

Then run **Developer: Reload Window** in each open VS Code window. **Raise hand** appears at the left
of the status bar.

### 2. Install the hook

The hook runs before every tool call, in every project, so read [`hook/hook.sh`](hook/hook.sh)
first. It's short, and only touches the two files in `~/.raise-hand`. Copy it from the `raise-hand`
folder:

```sh
mkdir -p ~/.raise-hand
cp hook/hook.sh ~/.raise-hand/hook.sh
chmod +x ~/.raise-hand/hook.sh
```

Then add this to `~/.claude/settings.json`, merging it with anything already there. If you already
have any of these lists, add the entries to them rather than replacing them. `Stop` runs when the
agent's turn ends, and `StopFailure` when it ends with an API error.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "\"$HOME\"/.raise-hand/hook.sh pre-tool" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "\"$HOME\"/.raise-hand/hook.sh turn-end" }
        ]
      }
    ],
    "StopFailure": [
      {
        "hooks": [
          { "type": "command", "command": "\"$HOME\"/.raise-hand/hook.sh turn-end" }
        ]
      }
    ]
  }
}
```

### 3. Check that it works

1. Start a **new** Claude Code session, so it loads the hook.
2. Ask it to do something that takes several tool calls, such as reading each file in a folder and
   summarizing it.
3. Click **Raise hand** while it works. The item turns to **Hand raised**.

At its next tool call, the item should change to **Agent stopping**. The agent should then stop and
say where things stand, and the item should return to normal when it finishes.

## Optional: a keyboard shortcut

The command **Raise Hand: Toggle** does the same as a click. It has no default key. To bind one, add
this to your `keybindings.json`:

```json
{ "key": "ctrl+alt+h", "command": "raiseHand.toggle" }
```

## Other agents

The extension only creates a file, so any agent that can run a command before each tool call, and
block the call based on the result, can use it. Only Claude Code has been tested.

**GitHub Copilot (untested).** According to GitHub's documentation, Copilot's `preToolUse` hooks treat
exit code 2 as a denial, so the same script should block the call. The documentation doesn't say
whether the agent sees the script's message, so it may be blocked without being told to stop. The
setup below runs the script with no argument, so it blocks one call and lowers the hand, because it
doesn't use a turn-end hook.

- Copilot CLI: add a JSON file to `~/.copilot/hooks/`, with this content:

  ```json
  {
    "version": 1,
    "hooks": {
      "preToolUse": [
        { "type": "command", "bash": "\"$HOME\"/.raise-hand/hook.sh", "timeoutSec": 5 }
      ]
    }
  }
  ```

- Copilot in VS Code: hooks are in preview, and have their own settings. See
  [Configure agent hooks](https://code.visualstudio.com/docs/copilot/customization/hooks).
- Copilot's cloud agent can't work with this, because it can't see a file on your computer.

**Local models through Ollama.** Ollama only serves the model. The hook belongs to the agent program
talking to it. If that program is Claude Code, the setup above should apply unchanged. For any other
program, check whether it has a blocking hook that runs before tool calls.

If you try one of these, please [open an issue](https://github.com/viridia/raise-hand/issues) to say
how it went.

## Development

```sh
nvm use            # optional: the Node version from .nvmrc
npm test           # builds, then runs the tests
npm run package    # builds raise-hand-<version>.vsix
```

To try a change without installing it, open this folder in VS Code and press F5. That opens an
Extension Development Host window with the extension loaded.

## License

[MIT](LICENSE). The hand icon is from Material Symbols, under the Apache License 2.0. See
[resources/NOTICE.md](resources/NOTICE.md).
