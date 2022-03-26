// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Connection from './connection';
import ESP32FS from './fileSystem';

export let connection: Connection | undefined = undefined;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "micropython-esp32" is now active!',
  );

  const statusBarItem = vscode.window.createStatusBarItem();
  const outputChannel = vscode.window.createOutputChannel('MicroPython-ESP32');

  statusBarItem.name = statusBarItem.tooltip = 'ESP32 Connection';
  statusBarItem.command = 'micropython-esp32.connect';
  statusBarItem.text = 'Disconnected';
  statusBarItem.show();

  const initWorkspace: () => void = () => {
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      name: 'ESP32 File System',
      uri: vscode.Uri.parse('esp32fs:/'),
    });
  };

  const openSerialPort: () => Promise<Connection | undefined> = async () => {
    const path = await vscode.window.showInputBox({ title: 'Input port path' });
    if (path === undefined) {
      return;
    }
    const baudRate = await vscode.window.showInputBox({
      title: 'Input baud rate',
      value: '115200',
    });
    if (baudRate === undefined) {
      return;
    }
    return new Connection({
      type: 'serial',
      path,
      baudRate,
      onError: (err) => {
        vscode.window.showErrorMessage(err.message);
        vscode.commands.executeCommand(
          'setContext',
          'micropython-esp32.connected',
          false,
        );
        connection = undefined;
      },
    });
  };

  const openWebSock: () => Promise<Connection | undefined> = async () => {
    const url = await vscode.window.showInputBox({ title: 'Input URL' });
    if (url === undefined) {
      return;
    }
    const password = await vscode.window.showInputBox({
      title: 'Input password',
      password: true,
    });
    if (password === undefined) {
      return;
    }
    return new Connection({
      type: 'websock',
      url,
      password,
      onError: (err) => {
        vscode.window.showErrorMessage(err.message);
        vscode.commands.executeCommand(
          'setContext',
          'micropython-esp32.connected',
          false,
        );
        connection = undefined;
      },
    });
  };

  const connect: () => Promise<void> = async () => {
    try {
      await disconnect();
      const type = await vscode.window.showQuickPick(
        [
          { label: 'serial', description: 'SerialPort' },
          { label: 'websock', description: 'WebSocket (Not Supported Yet)' },
        ],
        {
          title: 'Choose connection type',
        },
      );
      if (type === undefined) {
        return;
      }
      switch (type.label) {
        case 'serial': {
          connection = await openSerialPort();
          break;
        }
        case 'websock': {
          connection = await openWebSock();
          break;
        }
        default: {
          throw new Error('Unknown connection type.');
        }
      }
      if (connection === undefined) {
        return;
      }
      await connection.init();
      statusBarItem.text = `Connected ${connection.address}`;
      vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        true,
      );
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const executeCommand: () => Promise<void> = async () => {
    try {
      if (connection === undefined) {
        return;
      }
      const command = await vscode.window.showInputBox({
        title: 'Input Python command',
      });
      if (command === undefined) {
        return;
      }
      outputChannel.show();
      const { data, err } = await connection.exec(command);
      if (data) {
        outputChannel.appendLine('> Output <');
        outputChannel.appendLine(data);
      }
      if (err) {
        outputChannel.appendLine('> Error <');
        outputChannel.appendLine(err);
      }
      outputChannel.appendLine('> ----- <');
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const disconnect: () => Promise<void> = async () => {
    try {
      if (connection === undefined) {
        return;
      }
      await connection.close();
      statusBarItem.text = 'Disconnected';
      vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        false,
      );
      connection = undefined;
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const esp32Fs = new ESP32FS();

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    statusBarItem,
    outputChannel,
    vscode.commands.registerCommand(
      'micropython-esp32.initWorkspace',
      initWorkspace,
    ),
    vscode.commands.registerCommand('micropython-esp32.connect', connect),
    vscode.commands.registerCommand(
      'micropython-esp32.executeCommand',
      executeCommand,
    ),
    vscode.commands.registerCommand('micropython-esp32.disconnect', disconnect),
    vscode.workspace.registerFileSystemProvider('esp32fs', esp32Fs, {
      isCaseSensitive: true,
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
