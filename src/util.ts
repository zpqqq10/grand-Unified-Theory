import * as vscode from 'vscode';
import { OpenCallback, ErrorCallback } from './connection/port';
import Connection, { connection, setConnection } from './connection';
import { statusBarItem } from './extension';

/**
 * The connection open callback.
 */
const onOpen: OpenCallback = async () => {
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

/**
 * The connection error callback.
 */
const onError: ErrorCallback = err => {
  vscode.window.showErrorMessage(err.message);
  setConnection(undefined);
  statusBarItem.text = 'Disconnected';
  vscode.commands.executeCommand(
    'setContext',
    'micropython-esp32.connected',
    false,
  );
};

export class ESP32Connection {
  static serial(path: string, baudRate: string): Connection {
    return new Connection({
      type: 'serial',
      path,
      baudRate,
      onOpen,
      onError,
    });
  }

  static websock(url: string, password: string): Connection {
    return new Connection({
      type: 'websock',
      url,
      password,
      onOpen,
      onError,
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

export const sleep: (ms: number) => Promise<void> = ms =>
  new Promise(resolve => setTimeout(resolve, ms));
