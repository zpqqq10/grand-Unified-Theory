// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Connection from './connection';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "micropython-esp32" is now active!',
  );

  let connection: Connection;

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

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'micropython-esp32.openSerialPort',
      openSerialPort,
    ),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
