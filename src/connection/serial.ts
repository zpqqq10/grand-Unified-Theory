import Port from './port';
import { SerialPort } from 'serialport';

export interface SerialOptions {
  type: 'serial';
  path: string;
  baudRate: number;
}

export default class Serial implements Port {
  private serialport: SerialPort;

  constructor(options: SerialOptions) {
    this.serialport = new SerialPort({
      path: options.path,
      baudRate: options.baudRate,
    });
    this.serialport.setEncoding('utf8');
    this.serialport.on('error', (err: Error) => console.log(err));
  }

  read(size: number): string | null {
    const data: string | null = this.serialport.read(size);
    console.log('serial read', data);
    return data;
  }

  write(data: string): boolean {
    console.log('serial write', data);
    return this.serialport.write(data);
  }
}
