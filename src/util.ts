import * as vscode from 'vscode';
import Connection, { setConnection } from './connection';
import { ErrorEvent } from 'ws';
import { connection } from './connection';
import { statusBarItem } from './extension';

/**
 * The error handler for connection.
 */
const onError: (err: Error | ErrorEvent) => void = (err) => {
  vscode.window.showErrorMessage(err.message);
  vscode.commands.executeCommand(
    'setContext',
    'micropython-esp32.connected',
    false,
  );
  setConnection(undefined);
};

/**
* Init Serial/WebSocket Port.
* Require user to input URL and WebREPL password.
* @returns The connection if successfully created, or `undefined` otherwise.
*/
const portInitFunc: () => Promise<void> = async () => {
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
};

export class ESP32Connection {
  static serial(path: string, baudRate: string): Connection {
    return new Connection({
      type: 'serial',
      path,
      baudRate,
      onError,
      init: portInitFunc,
    });
  }

  static websock(url: string, password: string): Connection {
    return new Connection({
      type: 'websock',
      url,
      password,
      onError,
      init: portInitFunc,
    });
  }
}

export class ESP32Error {
  static noSerialPreference(): Error {
    return new Error('Please configure serial port preference first.');
  }

  static noWebSockPreference(): Error {
    return new Error('Please configure WebSocket preference first.');
  }

  static noConnection(): Error {
    return new Error('Please connect to ESP32 first.');
  }

  static readTimedOut(): Error {
    return new Error('Port read timed out. Please try again.');
  }
}

export const sleep: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));
