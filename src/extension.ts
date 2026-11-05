import * as vscode from "vscode";
import { defaultFlagPath, FlagWatcher, toggle } from "./flag";

const TOGGLE_COMMAND = "raiseHand.toggle";

// A high priority keeps the item from being pushed off when the status bar is crowded.
const STATUS_BAR_PRIORITY = 10000;

export function activate(context: vscode.ExtensionContext): void {
  const item = vscode.window.createStatusBarItem(
    "raiseHand.status",
    vscode.StatusBarAlignment.Left,
    STATUS_BAR_PRIORITY,
  );
  item.name = "Raise Hand";
  item.command = TOGGLE_COMMAND;

  const render = (raised: boolean): void => {
    if (raised) {
      item.text = "$(raise-hand-filled) Hand raised";
      item.tooltip = "The agent's next tool call will be blocked. Click to lower your hand.";
      item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    } else {
      item.text = "$(raise-hand-outline) Raise hand";
      item.tooltip = "Click to block the agent's next tool call.";
      item.backgroundColor = undefined;
    }
  };

  const watcher = new FlagWatcher(defaultFlagPath, render);
  render(watcher.isRaised);
  item.show();

  context.subscriptions.push(
    item,
    { dispose: () => watcher.dispose() },
    vscode.commands.registerCommand(TOGGLE_COMMAND, () => {
      try {
        toggle(defaultFlagPath, watcher.isRaised);
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
