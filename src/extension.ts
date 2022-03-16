// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Connection from './connection';

export let connection: Connection;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "micropython-esp32" is now active!',
  );

  const openSerialPort: () => Promise<void> = async () => {
    const path = await vscode.window.showInputBox({ title: 'Input port path' });
    if (path !== undefined) {
      const baudRate = await vscode.window.showInputBox({
        title: 'Input baud rate',
        value: '115200',
      });
      if (baudRate !== undefined) {
        connection = new Connection({ type: 'serial', path, baudRate });
        return;
      }
    }
    vscode.window.showInformationMessage('Cancelled.');
  };

  const openWebSock: () => Promise<void> = async () => {
    const url = await vscode.window.showInputBox({ title: 'Input URL' });
    if (url !== undefined) {
      const password = await vscode.window.showInputBox({
        title: 'Input password',
        password: true,
      });
      if (password !== undefined) {
        connection = new Connection({ type: 'websock', url, password });
        return;
      }
    }
    vscode.window.showInformationMessage('Cancelled.');
  };

  const connectESP32: () => Promise<void> = async () => {
    try {
      const type = await vscode.window.showQuickPick(
        [
          { label: 'serial', description: 'SerialPort' },
          { label: 'websock', description: 'WebSocket (Not Supported Yet)' },
        ],
        {
          title: 'Choose connection type',
        },
      );
      if (type !== undefined) {
        switch (type?.label) {
          case 'serial': {
            await openSerialPort();
            break;
          }
          case 'websock': {
            await openWebSock();
            break;
          }
          default: {
            throw new Error('Unknown connection type.');
          }
        }
        await connection.init();
        await vscode.commands.executeCommand(
          'setContext',
          'micropython-esp32.connected',
          true,
        );
        vscode.window.showInformationMessage('Connected.');
        return;
      }
      vscode.window.showInformationMessage('Cancelled.');
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const disconnectESP32: () => Promise<void> = async () => {
    try {
      await connection.close();
      await vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        false,
      );
      vscode.window.showInformationMessage('Disconnected.');
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'micropython-esp32.connectESP32',
      connectESP32,
    ),
    vscode.commands.registerCommand(
      'micropython-esp32.disconnectESP32',
      disconnectESP32,
    ),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
