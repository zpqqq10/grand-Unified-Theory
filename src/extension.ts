// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as fs from 'fs';
import Connection, { connection, setConnection } from './connection';
import ESP32FS from './fileSystem';
import ESP32Pty from './terminal';
import * as util from './util';
// import WebSock from './connection/websock';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "micropython-esp32" is now active!',
  );
  
  // let s = new WebSock({
  //   type: 'websock',
  //   url: 'ws://192.168.246.82:8266',
  //   password: '5729',
  //   onError: (err) => {
  //     console.log("[error] WebSocket Error", err);
  //   }
  // });


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
    return util.ESP32Connection.serial(path, baudRate);
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
    if (!password) {
      return;
    }
    return util.ESP32Connection.websock(url, password);
  };

  /**
   * Connect to the board.
   * Require user to choose connection type.
   * @throws noSerialPreference
   * @throws noWebSockPreference
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
      if (!type) {
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
            setConnection(
              util.ESP32Connection.serial(path, baudRate.toString()),
            );
          } else {
            throw util.ESP32Error.noSerialPreference();
          }
          break;
        }
        case 'websock': {
          const url = config.get<string>('websock.url');
          const password = config.get<string>('websock.password');
          if (url && password) {
            setConnection(util.ESP32Connection.websock(url, password));
          } else {
            throw util.ESP32Error.noWebSockPreference();
          }
          break;
        }
        case 'customSerial': {
          setConnection(await _openSerialPort());
          break;
        }
        case 'customWebsock': {
          setConnection(await _openWebSock());
          break;
        }
      }
      if (!connection) {
        return;
      }
      await connection.init();
      statusBarItem.text = `Connected ${connection.address}`;
      vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        true,
      );
      vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connectionType',
        connection.type,
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
   * @throws noConnection
   */
  const _executePython: (code: string, isFile: boolean) => void = (
    code,
    isFile,
  ) => {
    if (!connection) {
      throw util.ESP32Error.noConnection();
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
      if (!command) {
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
      if (!connection) {
        return;
      }
      await connection.close();
      statusBarItem.text = 'Disconnected';
      vscode.commands.executeCommand(
        'setContext',
        'micropython-esp32.connected',
        false,
      );
      setConnection(undefined);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  /**
   * The data format to save the configuration of the WebREPL.
   */
  interface WSInfo {
    boardname: string;
    wsurl: string;
    webreplpw: string;
    date: string;
  }

  /**
   * Get current time.
   * @returns The timestamp of current time.
   */
  const _getTime: () => string = () => {
    const date = new Date();
    const y = date.getFullYear();
    const m = date.getMonth();
    const d = date.getDate();
    const h = date.getHours();
    const min = date.getMinutes();
    return `${y}-${m}-${d} ${h}:${min}`;
  };

  /**
   * Save new infomation of a board to a local file.
   * @param boardname The name of the board.
   * @param wsurl The URL of the WebSocket.
   * @param webreplpw The password of the WebREPL.
   */
  const _saveJSON: (
    boardname: string,
    wsurl: string,
    webreplpw: string,
  ) => void = (boardname, wsurl, webreplpw) => {
    const config = vscode.workspace.getConfiguration('micropython-esp32.local');
    const path = `${config.get('path')}/esp32/WSInfo.json`;
    const json: WSInfo[] = fs.existsSync(path)
      ? JSON.parse(fs.readFileSync(path, 'utf-8'))
      : [];
    json.push({
      boardname: boardname,
      wsurl: wsurl,
      webreplpw: webreplpw,
      date: _getTime(),
    });
    !fs.existsSync(path) && fs.mkdirSync(`${config.get('path')}/esp32`);
    fs.writeFileSync(path, JSON.stringify(json));
  };

  /**
   * Configure the WebREPL while the serial port is connected.
   * Assume that PC has connected to the LAN already.
   */
  const configWebREPL: () => void = async () => {
    try {
      if (!connection) {
        throw util.ESP32Error.noConnection();
      }
      const config = vscode.workspace.getConfiguration(
        'micropython-esp32.connection.websock',
      );
      const lanname = await vscode.window.showInputBox({
        title: 'Input the name of the LAN to connect',
        value: config.get('net'),
      });
      const pw = await vscode.window.showInputBox({
        title: 'Input the password of the LAN to connect',
        value: config.get('netpw'),
        password: true,
      });
      // save name and password
      const name = await vscode.window.showInputBox({
        title: 'Input the name of the board',
      });
      let password: string | undefined = '';
      for (
        ;
        password !== undefined && (password.length < 4 || password.length > 9);
        password = await vscode.window.showInputBox({
          title: 'Input the password (4-9 chars) of the WebREPL',
          password: true,
        })
      ) { }
      if (!lanname || pw === undefined || name === undefined || !password) {
        return;
      }
      try {
        await esp32Fs.stat(vscode.Uri.file('./webrepl_cfg.py'));
        // overwrite
        await esp32Fs.writeFile(
          vscode.Uri.file('./webrepl_cfg.py'),
          Buffer.from(`PASS='${password}'`),
          { create: false, overwrite: true },
        );
      } catch {
        // create
        await esp32Fs.writeFile(
          vscode.Uri.file('./webrepl_cfg.py'),
          Buffer.from(`PASS='${password}'`),
          { create: true, overwrite: false },
        );
      }
      // connect to the LAN first
      const lan = `('${lanname}', '${pw}')`;
      const content = `
import network
import time
import webrepl
wlan = network.WLAN(network.STA_IF)
wlan.active(True)
if wlan.isconnected():
  wlan.disconnect()
wlan.connect${lan}
maxtries = 9
while maxtries >0:
  if wlan.isconnected():
    webrepl.start()
    break
  maxtries = maxtries - 1
  time.sleep_ms(500)
`;
      const connectWLAN = `import network\nwlan = network.WLAN(network.STA_IF)\nwlan.active(True)\nif wlan.isconnected():\n wlan.disconnect()\nwlan.connect${lan}\nimport webrepl`;
      await connection.exec(connectWLAN);
      // waiting for connecting
      setTimeout(async function () {
        if (!connection) {
          throw util.ESP32Error.noConnection();
        }
        const data = await connection.exec('webrepl.start()');
        const wsurl = data.match(/ws:\/\/\d+\.\d+\.\d+\.\d+:\d+/)?.toString();
        // TODO: remove commented commands
        if (!wsurl || /0\.0\.0\.0/.test(wsurl)) {
          vscode.window.showErrorMessage('here');
          throw new Error(
            'WebSocket is NOT open and the configuration is not saved!',
          );
        }
        esp32Fs.writeFile(
          vscode.Uri.file('boot.py'),
          Buffer.from(content),
          { create: true, overwrite: true, append: true },
        );
        if(!password){
          return ;
        }
        _saveJSON(name, wsurl, password);
        vscode.window.showInformationMessage(`URL: ${wsurl}`);
        vscode.window.showInformationMessage('Configure WebREPL successfully!');
      }, 3000);
    } catch (err: any) {
      vscode.window.showErrorMessage(err.message);
    }
  };

  /**
   * The ESP32 file system that manages files.
   */
  const esp32Fs = new ESP32FS();

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
    vscode.commands.registerCommand(
      'micropython-esp32.configWebREPL',
      configWebREPL,
    ),
    vscode.workspace.registerFileSystemProvider('esp32fs', esp32Fs, {
      isCaseSensitive: true,
    }),
  );
}
