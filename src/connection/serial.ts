import * as vscode from 'vscode';
import Port from './port';
import { SerialPort } from 'serialport';

export interface SerialOptions {
  type: 'serial';
  path: string;
  baudRate: string;
}

export default class Serial implements Port {
  private serialport: SerialPort;

  constructor(options: SerialOptions) {
    this.serialport = new SerialPort({
      path: options.path,
      baudRate: parseInt(options.baudRate),
    });
    this.serialport.setEncoding('utf8');
    this.serialport.on('error', (err) =>
      vscode.window.showErrorMessage(err.message),
    );
  }

  read(size: number): Promise<string> {
    return new Promise((resolve) => {
      for (;;) {
        const data = this.serialport.read(size);
        if (data !== null) {
          console.log('serial read', data);
          resolve(data);
          return;
        }
      }
    });
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.serialport.write(data);
      this.serialport.drain((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('serial write', data);
          resolve();
        }
      });
    });
  }
}
