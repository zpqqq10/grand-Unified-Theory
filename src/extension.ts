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
  statusBarItem.command = 'micropython-esp32.connectESP32';
  statusBarItem.text = 'Disconnected';
  statusBarItem.show();

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
    return new Connection({ type: 'serial', path, baudRate });
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
    return new Connection({ type: 'websock', url, password });
  };

  const connectESP32: () => Promise<void> = async () => {
    try {
      await disconnectESP32();
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
      await vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        true,
      );
      console.log(
        vscode.workspace.updateWorkspaceFolders(0, 0, {
          name: 'ESP32FS',
          uri: vscode.Uri.parse('esp32fs:/'),
        }),
      );
      statusBarItem.text = `Connected ${connection.address}`;
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const executePythonCommand: () => Promise<void> = async () => {
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
        outputChannel.appendLine(data);
      }
      if (err) {
        outputChannel.appendLine(err);
      }
      outputChannel.appendLine('> ----- <');
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const disconnectESP32: () => Promise<void> = async () => {
    try {
      if (connection === undefined) {
        return;
      }
      await connection.close();
      await vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        false,
      );
      console.log(vscode.workspace.updateWorkspaceFolders(0, 1));
      statusBarItem.text = 'Disconnected';
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
      'micropython-esp32.connectESP32',
      connectESP32,
    ),
    vscode.commands.registerCommand(
      'micropython-esp32.executePythonCommand',
      executePythonCommand,
    ),
    vscode.commands.registerCommand(
      'micropython-esp32.disconnectESP32',
      disconnectESP32,
    ),
    vscode.workspace.registerFileSystemProvider('esp32fs', esp32Fs),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
