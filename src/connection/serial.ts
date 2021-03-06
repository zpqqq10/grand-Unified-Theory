import { SerialPort } from 'serialport';
import Port, { PortOptions } from './port';
import * as util from '../util';

export interface SerialOptions extends PortOptions {
  type: 'serial';
  path: string;
  baudRate: string;
}

export default class Serial implements Port {
  private _serialport: SerialPort;
  readonly address: string;

  constructor(options: SerialOptions) {
    this._serialport = new SerialPort(
      {
        path: options.path,
        baudRate: parseInt(options.baudRate),
      },
      options.onOpen,
    );
    this._serialport.setEncoding('utf8');
    this._serialport.on('error', options.onError);
    this.address = `${options.path}, baud rate ${options.baudRate}`;
  }

  get readableLength(): number {
    return this._serialport.readableLength;
  }

  async read(size: number, timeout?: number): Promise<string> {
    for (;;) {
      const data = this._serialport.read(size);
      if (data !== null) {
        return data;
      }
      if (timeout !== undefined && --timeout < 0) {
        throw util.ESP32Error.readTimedOut();
      }
      await util.sleep(1);
    }
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._serialport.write(data);
      this._serialport.drain(err => {
        if (err) {
          reject(err);
        } else {
          console.log('serial write', data);
          resolve();
        }
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._serialport.close(err => {
        if (err) {
          reject(err);
        } else {
          console.log('serial close');
          resolve();
        }
      });
    });
  }
}
