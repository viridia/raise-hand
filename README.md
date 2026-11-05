# Raise Hand

A VS Code status bar button that stops a coding agent so you can speak. Click **Raise hand**, and
the agent's next tool call is blocked with a message telling it to stop and end its turn.

It has two parts, and you need both:

- **The extension** creates the file `~/.claude/raised-hand` when you click. Clicking again while the
  hand is raised removes it.
- **A hook** runs before each of the agent's tool calls. If the file exists, the hook deletes it and
  blocks the call.

The agent needs no instructions or project files. The hook's message tells it what to do at the
moment it is blocked.

## Limits

- It takes effect at a tool call, so it can't interrupt an agent while it writes a long reply.
- The flag is shared, so it stops whichever session makes the next tool call, in any project.
- A hand raised while no agent is working stays raised and stops the next session's first tool call.
  The status bar shows this, and a click clears it.

## Setup

You need VS Code 1.140 or newer, Claude Code, Git, and Node 22 or newer. Node is only used to build
the extension, and you don't need to know any JavaScript. If you don't have it, get it from
[nodejs.org](https://nodejs.org) or through a version manager such as
[nvm](https://github.com/nvm-sh/nvm).

It has only been run on macOS. It should work on Linux. Windows would need a way to run the `sh`
hook, which is untested. Please [open an issue](https://github.com/viridia/raise-hand/issues) to say
how it went on either.

### 1. Build and install the extension

The extension isn't on the Marketplace, so you build it yourself:

```sh
git clone https://github.com/viridia/raise-hand.git
cd raise-hand
npm install
npm run package
code --install-extension raise-hand-0.1.0.vsix
```

`npm install` may warn about install scripts that weren't run. Packaging works anyway.

If you don't have the `code` command, run **Shell Command: Install 'code' command in PATH** from the
VS Code command palette. Or use **Extensions: Install from VSIX...** instead of the last line.

Then run **Developer: Reload Window** in each open VS Code window. **Raise hand** appears at the left
of the status bar.

### 2. Install the hook

The hook runs before every tool call, in every project, so read
[`hook/raise-hand.sh`](hook/raise-hand.sh) first. It's a few lines long, and only touches the flag
file. Copy it from the `raise-hand` folder:

```sh
mkdir -p ~/.claude
cp hook/raise-hand.sh ~/.claude/raise-hand.sh
chmod +x ~/.claude/raise-hand.sh
```

Then add this to `~/.claude/settings.json`, merging it with anything already there. If you already
have a `PreToolUse` list, add the entry to it rather than replacing it.

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "\"$HOME\"/.claude/raise-hand.sh" }
        ]
      }
    ]
  }
}
```

Your agent can do this step for you. In Claude Code, try: "Follow step 2 of the Setup section in
README.md. Merge the hook into my existing settings without changing anything else, and show me the
result."

### 3. Check that it works

1. Start a **new** Claude Code session, so it loads the hook.
2. Ask it to do something that takes several tool calls, such as reading each file in a folder and
   summarizing it.
3. Click **Raise hand** while it works. The item turns to **Hand raised**.

At its next tool call, the agent should stop and say where things stand, and the item should return
to normal.

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
whether the agent sees the script's message, so it may be blocked without being told to stop.

- Copilot CLI: add a JSON file to `~/.copilot/hooks/`, with this content:

  ```json
  {
    "version": 1,
    "hooks": {
      "preToolUse": [
        { "type": "command", "bash": "\"$HOME\"/.claude/raise-hand.sh", "timeoutSec": 5 }
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
