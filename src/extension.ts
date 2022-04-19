// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Connection from './connection';
import ESP32FS from './fileSystem';
import ESP32Pty from './terminal';

export let connection: Connection | undefined = undefined;

export const createError = {
  noSerialPreference: () =>
    new Error('Please configure serial port preference first.'),
  noWebSockPreference: () =>
    new Error('Please configure WebSocket preference first.'),
  noConnection: () => new Error('Please connect to ESP32 first.'),
};

/**
 * The error handler for connection.
 */
const onError: (err: Error) => void = (err) => {
  vscode.window.showErrorMessage(err.message);
  vscode.commands.executeCommand(
    'setContext',
    'micropython-esp32.connected',
    false,
  );
  connection = undefined;
};

const createConnection = {
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

  /**
   * The status bar that displays connection state.
   */
  const statusBarItem = vscode.window.createStatusBarItem();
  statusBarItem.name = statusBarItem.tooltip = 'ESP32 Connection';
  statusBarItem.command = 'micropython-esp32.connect';
  statusBarItem.text = 'Disconnected';
  statusBarItem.show();

  /**
   * Initialize ESP32 file system workspace.
   */
  const initWorkspace: () => void = () => {
    vscode.workspace.updateWorkspaceFolders(0, 0, {
      name: 'ESP32 File System',
      uri: vscode.Uri.parse('esp32fs:/'),
    });
  };

  /**
   * Open serial port.
   * Require user to input path and baud rate.
   * @returns The connection if successfully created, or `undefined` otherwise.
   */
  const _openSerialPort: () => Promise<Connection | undefined> = async () => {
    const config = vscode.workspace.getConfiguration(
      'micropython-esp32.connection.serial',
    );
    const path = await vscode.window.showInputBox({
      title: 'Input port path',
      value: config.get('path'),
    });
    if (!path) {
      return;
    }
    const baudRate = await vscode.window.showInputBox({
      title: 'Input baud rate',
      value: config.get('baudRate'),
    });
    if (!baudRate) {
      return;
    }
    return createConnection.serial(path, baudRate);
  };

  /**
   * Open WebSocket.
   * Require user to input URL and WebREPL password.
   * @returns The connection if successfully created, or `undefined` otherwise.
   */
  const _openWebSock: () => Promise<Connection | undefined> = async () => {
    const config = vscode.workspace.getConfiguration(
      'micropython-esp32.connection.websock',
    );
    const url = await vscode.window.showInputBox({
      title: 'Input URL',
      value: config.get('url'),
    });
    if (!url) {
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
    return createConnection.websock(url, password);
  };

  /**
   * Connect to the board.
   * Require user to choose connection type.
   */
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
          {
            label: 'customSerial',
            description: 'Through custom serial port',
          },
          {
            label: 'customWebsock',
            description: 'Through custom WebSocket (not supported yet)',
          },
        ],
        {
          title: 'Choose connection type',
        },
      );
      if (type === undefined) {
        return;
      }
      const config = vscode.workspace.getConfiguration(
        'micropython-esp32.connection',
      );
      switch (type.label) {
        case 'serial': {
          const path = config.get<string>('serial.path');
          const baudRate = config.get<number>('serial.baudRate');
          if (path && baudRate) {
            connection = createConnection.serial(path, baudRate.toString());
          } else {
            throw createError.noSerialPreference();
          }
          break;
        }
        case 'websock': {
          const url = config.get<string>('websock.url');
          const password = config.get<string>('websock.password');
          if (url && password !== undefined) {
            connection = createConnection.websock(url, password);
          } else {
            throw createError.noWebSockPreference();
          }
          break;
        }
        case 'customSerial': {
          connection = await _openSerialPort();
          break;
        }
        case 'customWebsock': {
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

  /**
   * Execute Python code.
   * @param code The code to execute.
   * @param isFile Specify whether the code is from a file.
   *               If not, it will be displayed in the terminal.
   */
  const _executePython: (code: string, isFile: boolean) => void = (
    code,
    isFile,
  ) => {
    if (connection === undefined) {
      throw createError.noConnection();
    }
    const terminal = vscode.window.createTerminal({
      name: 'MicroPython-ESP32',
      pty: new ESP32Pty(code, isFile),
    });
    terminal.show();
    context.subscriptions.push(terminal);
  };

  /**
   * Execute Python command.
   * Require user to input command.
   */
  const executeCommand: () => Promise<void> = async () => {
    try {
      const command = await vscode.window.showInputBox({
        title: 'Input Python command',
      });
      if (command === undefined) {
        return;
      }
      _executePython(command, false);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  /**
   * Execute Python file.
   * @param textEditor The active editor.
   */
  const executeFile: (textEditor: vscode.TextEditor) => void = (textEditor) => {
    try {
      _executePython(textEditor.document.getText(), true);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  /**
   * Disconnect to the board.
   */
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

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  context.subscriptions.push(
    statusBarItem,
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
    vscode.workspace.registerFileSystemProvider('esp32fs', new ESP32FS(), {
      isCaseSensitive: true,
    }),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
