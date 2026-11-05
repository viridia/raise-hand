#!/bin/sh
# Pre-tool-call hook for the Raise Hand VS Code extension, which creates the flag when you click its
# status bar button. The next tool call in any session is blocked before any permission prompt, and
# the flag is cleared. Exit 2 blocks the call and hands stderr to the agent.
flag="$HOME/.raise-hand/raised"
[ -e "$flag" ] || exit 0
rm -f "$flag"
echo "The user has raised a hand. Stop now: make no more tool calls, say in a line where things stand, and end your turn so they can speak." >&2
exit 2
