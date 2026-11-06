#!/bin/sh
# Hooks for the Raise Hand VS Code extension, which creates ~/.raise-hand/raised when you click its
# status bar button. The argument says which hook is calling:
#
#   pre-tool   Before each tool call. The first call to find the hand raised acknowledges it and is
#              blocked, and so is every call after it, until the turn ends.
#   turn-end   When the agent's turn ends. Lowers the hand. Always exits 0, because some agents
#              treat a failing turn-end hook as a reason to keep working.
#   (none)     For agents without a turn-end hook: blocks one tool call and lowers the hand.
#
# Exit 2 blocks the tool call and hands stderr to the agent.
dir="$HOME/.raise-hand"
raised="$dir/raised"
acknowledged="$dir/acknowledged"

first() {
  echo "The user has raised a hand. Stop now: make no more tool calls, say in a line where things stand, and end your turn so they can speak." >&2
  exit 2
}

still() {
  echo "The user's hand is still raised. This is the same raised hand as any earlier block, not a new one. Stop now: make no more tool calls, and end your turn so they can speak." >&2
  exit 2
}

case "$1" in
  pre-tool)
    [ -e "$acknowledged" ] && still
    # A rename can't half-happen, so when several calls check at once, exactly one of them wins.
    mv "$raised" "$acknowledged" 2>/dev/null && first
    # Another call may have acknowledged it between the two checks above.
    [ -e "$acknowledged" ] && still
    exit 0
    ;;
  turn-end)
    rm -f "$raised" "$acknowledged"
    exit 0
    ;;
  "")
    if [ -e "$raised" ] || [ -e "$acknowledged" ]; then
      rm -f "$raised" "$acknowledged"
      first
    fi
    exit 0
    ;;
  *)
    echo "raise-hand hook: unknown argument '$1'" >&2
    exit 1
    ;;
esac
