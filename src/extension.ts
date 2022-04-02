// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { platform } from 'os';
import Connection from './connection';
import ESP32FS from './fileSystem';

export let connection: Connection | undefined = undefined;

/**
 * Error handler for connection.
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
   * Status bar for connection state display.
   */
  const statusBarItem = vscode.window.createStatusBarItem();
  statusBarItem.name = statusBarItem.tooltip = 'ESP32 Connection';
  statusBarItem.command = 'micropython-esp32.connect';
  statusBarItem.text = 'Disconnected';
  statusBarItem.show();

  /**
   * Output channel for python code execution.
   */
  const outputChannel = vscode.window.createOutputChannel('MicroPython-ESP32');

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
          const pf = platform(); 
          const baudRate = config.get<number>('serial.baudRate');
          if(pf === 'win32'){
            const path = config.get<string>('serial.pathForWindows');
            if (path !== undefined && baudRate !== undefined) {
              connection = createConnection.serial(path, baudRate.toString());
            }
          }
          else if(pf === 'linux'){
            const path = config.get<string>('serial.pathForLinux');
            if (path !== undefined && baudRate !== undefined) {
              connection = createConnection.serial(path, baudRate.toString());
            }
          }
          else {
            throw new Error('Platform not supported!');
          }
          break;
        }
        case 'websock': {
          const url = config.get<string>('websock.url');
          const password = config.get<string>('websock.password');
          if (url !== undefined && password !== undefined) {
            connection = createConnection.websock(url, password);
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
   * @param code Code to execute.
   * @param isFile Whether show the source code in terminal
   */
  const _executePython: (code: string, isFile: boolean) => Promise<void> = async (code, isFile) => {
    if (connection === undefined) {
      return;
    }
    outputChannel.show();
    const { data, err } = await connection.exec(code);
    if(!isFile){
      outputChannel.appendLine('> ' + code); 
    }
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
      await _executePython(command, false);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  /**
   * Execute Python file.
   * @param textEditor The active editor.
   */
  const executeFile: (textEditor: vscode.TextEditor) => Promise<void> = async (
    textEditor,
  ) => {
    try {
      await _executePython(textEditor.document.getText(), true);
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

  /**
   * ESP32 file system for file management.
   */
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
