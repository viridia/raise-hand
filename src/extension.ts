import * as vscode from "vscode";
import { defaultStateDir, HandState, HandWatcher, toggle } from "./flag";

const TOGGLE_COMMAND = "raiseHand.toggle";

// A high priority keeps the item from being pushed off when the status bar is crowded.
const STATUS_BAR_PRIORITY = 10000;

const LOOKS: Record<HandState, { text: string; tooltip: string; highlight: boolean }> = {
  down: {
    text: "$(raise-hand-outline) Raise hand",
    tooltip: "Click to stop the agent at its next tool call.",
    highlight: false,
  },
  raised: {
    text: "$(raise-hand-filled) Hand raised",
    tooltip: "No agent has seen it yet. Its next tool call will be blocked. Click to lower your hand.",
    highlight: true,
  },
  acknowledged: {
    text: "$(raise-hand-filled) Agent stopping",
    tooltip:
      "An agent has been told to stop, and its tool calls are blocked until its turn ends. " +
      "Click to lower your hand.",
    highlight: true,
  },
};

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    "raiseHand.status",
    vscode.StatusBarAlignment.Left,
    STATUS_BAR_PRIORITY,
  );
  item.name = "Raise Hand";
  item.command = TOGGLE_COMMAND;

  const render = (state: HandState): void => {
    const look = LOOKS[state];
    item.text = look.text;
    item.tooltip = look.tooltip;
    item.backgroundColor = look.highlight
      ? new vscode.ThemeColor("statusBarItem.warningBackground")
      : undefined;
  };

  const watcher = new HandWatcher(defaultStateDir, render);
  render(watcher.state);
  item.show();

  context.subscriptions.push(
    item,
    { dispose: () => watcher.dispose() },
    vscode.commands.registerCommand(TOGGLE_COMMAND, () => {
      try {
        toggle(defaultStateDir, watcher.state);
      } catch (err) {
        void vscode.window.showErrorMessage(`Raise Hand: ${String(err)}`);
      }
      // Update this window now rather than waiting for the file event.
      watcher.refresh();
    }),
    // A safety net, in case a file event was missed.
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        watcher.refresh();
      }
    }),
  );
}

export function deactivate(): void {}
