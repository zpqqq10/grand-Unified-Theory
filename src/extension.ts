// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Connection from './connection';
import ESP32FS from './fileSystem';

export let connection: Connection | undefined = undefined;

const onError: (err: Error) => void = (err) => {
  vscode.window.showErrorMessage(err.message);
  vscode.commands.executeCommand(
    'setContext',
    'micropython-esp32.connected',
    false,
  );
  connection = undefined;
};

const createConnetion = {
  serial: (path: string, baudRate: string) =>
    new Connection({
      type: 'serial',
      path,
      baudRate,
      onError,
    }),
  websock: (url: string, password: string) =>
    new Connection({
      type: 'websock',
      url,
      password,
      onError,
    }),
};

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

  const _openSerialPort: () => Promise<Connection | undefined> = async () => {
    const config = vscode.workspace.getConfiguration(
      'micropython-esp32.connection.serial',
    );
    const path = await vscode.window.showInputBox({
      title: 'Input port path',
      value: config.get('path'),
    });
    if (path === undefined) {
      return;
    }
    const baudRate = await vscode.window.showInputBox({
      title: 'Input baud rate',
      value: config.get('baudRate'),
    });
    if (baudRate === undefined) {
      return;
    }
    return createConnetion.serial(path, baudRate);
  };

  const _openWebSock: () => Promise<Connection | undefined> = async () => {
    const config = vscode.workspace.getConfiguration(
      'micropython-esp32.connection.websock',
    );
    const url = await vscode.window.showInputBox({
      title: 'Input URL',
      value: config.get('url'),
    });
    if (url === undefined) {
      return;
    }
    const password = await vscode.window.showInputBox({
      title: 'Input password',
      value: config.get('password'),
      password: true,
    });
    if (password === undefined) {
      return;
    }
    return createConnetion.websock(url, password);
  };

  const connect: () => Promise<void> = async () => {
    try {
      await disconnect();
      const type = await vscode.window.showQuickPick(
        [
          {
            label: 'serial',
            description: 'Through serial port',
          },
          {
            label: 'websock',
            description: 'Through WebSocket (not supported yet)',
          },
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
          connection = await _openSerialPort();
          break;
        }
        case 'websock': {
          connection = await _openWebSock();
          break;
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

  const _executePython: (code: string) => Promise<void> = async (code) => {
    if (connection === undefined) {
      return;
    }
    outputChannel.show();
    const { data, err } = await connection.exec(code);
    if (data) {
      outputChannel.appendLine('> Output <');
      outputChannel.appendLine(data);
    }
    if (err) {
      outputChannel.appendLine('> Error <');
      outputChannel.appendLine(err);
    }
    outputChannel.appendLine('> ---------- <');
  };

  const executeCommand: () => Promise<void> = async () => {
    try {
      const command = await vscode.window.showInputBox({
        title: 'Input Python command',
      });
      if (command === undefined) {
        return;
      }
      await _executePython(command);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  const executeFile: (textEditor: vscode.TextEditor) => Promise<void> = async (
    textEditor,
  ) => {
    try {
      await _executePython(textEditor.document.getText());
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
    vscode.commands.registerTextEditorCommand(
      'micropython-esp32.executeFile',
      executeFile,
    ),
    vscode.commands.registerCommand('micropython-esp32.disconnect', disconnect),
    vscode.workspace.registerFileSystemProvider('esp32fs', esp32Fs, {
      isCaseSensitive: true,
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
