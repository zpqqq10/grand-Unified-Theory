import * as vscode from 'vscode';
import Connection, { setConnection } from './connection';

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
  setConnection(undefined);
};

export class ESP32Connection {
  static serial(path: string, baudRate: string): Connection {
    return new Connection({
      type: 'serial',
      path,
      baudRate,
      onError,
    });
  }

  static websock(url: string, password: string): Connection {
    return new Connection({
      type: 'websock',
      url,
      password,
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

export const sleep: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));
