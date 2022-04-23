import Port from './port';
import Serial, { SerialOptions } from './serial';
import WebSock, { WebSockOptions } from './websock';
import * as util from '../util';

type ConnectionOptions = SerialOptions | WebSockOptions;

interface ReadCallback {
  (data: string): void;
}

export default class Connection {
  private _port: Port;
  private _locking: boolean = false;
  readonly type: string;

  constructor(options: ConnectionOptions) {
    switch (options.type) {
      case 'serial': {
        this._port = new Serial(options);
        break;
      }
      case 'websock': {
        this._port = new WebSock(options);
        break;
      }
    }
    this.type = options.type;
  }

  get address(): string {
    return this._port.address;
  }

  /**
   * Lock the port to ensure at most one ongoing operation.
   */
  async lock<T>(callback: () => Promise<T>): Promise<T> {
    for (; this._locking; ) {
      await util.sleep(1);
    }
    this._locking = true;
    try {
      return await callback();
    } finally {
      this._locking = false;
    }
  }

  /**
   * Read bytes from the port until a certain string is met.
   * @param suffix The string to stop read.
   * @param timeout The time limit of one-byte read.
   * @returns The bytes read from the port.
   * @throws readTimedOut
   */
  private async _readUntil(suffix: string, timeout: number): Promise<string> {
    for (let data = ''; ; ) {
      data += await this._port.read(1, timeout);
      if (data.endsWith(suffix)) {
        console.log('serial read', data);
        return data.slice(0, -suffix.length);
      }
      if (--timeout < 0) {
        throw util.ESP32Error.readTimedOut();
      }
    }
  }

  /**
   * Initialize the board.
   */
  init(): Promise<void> {
    return this.lock(async () => {
      for (;;) {
        try {
          await this._port.write('\x03\x03');
          for (; this._port.readableLength > 0; ) {
            await this._port.read(this._port.readableLength);
          }
          await this._port.write('\x01');
          await this._readUntil('raw REPL; CTRL-B to exit\r\n', 500);
          break;
        } catch {}
      }
      await this.dangerouslyExec('import os');
    });
  }

  /**
   * Execute Python code on the board without locking.
   * @param code The code to execute.
   * @param readCallback The port read callback.
   * @returns The execution result.
   */
  async dangerouslyExec(
    code: string,
    readCallback?: ReadCallback,
  ): Promise<string> {
    let data = '';
    let err = '';
    if (code) {
      await this._readUntil('>', 500);
      await this._port.write(`${code}\x04`);
      await this._readUntil('OK', 500);
      readCallback && readCallback('');
      for (let i = 0; i < 2; i++) {
        for (;;) {
          const s = await this._port.read(1);
          if (s === '\x04') {
            break;
          }
          i ? (err += s) : (data += s);
          readCallback && readCallback(s);
        }
      }
    }
    if (err) {
      throw new Error(err);
    }
    return data;
  }

  /**
   * Execute Python code on the board.
   * @param code The code to execute.
   * @param readCallback The port read callback.
   * @returns The execution result.
   */
  exec(code: string, readCallback?: ReadCallback): Promise<string> {
    return this.lock(() => this.dangerouslyExec(code, readCallback));
  }

  /**
   * Evalute the result of an expression.
   * @param expression The expression to evaluate.
   * @returns The evaluation result.
   */
  eval(expression: string): Promise<string> {
    return this.exec(`print(${expression},end='')`);
  }

  /**
   * Configure WebREPL.
   * @param password The password of WebREPL.
   * @param existed Whether there is a webreplcfg.py.
   * @returns The execution result.
   */
  // configWebREPL(password: string, existed: boolean): Promise<Result> {
  //   return this.lock(async () => {
  //     if (!password) {
  //       return { data: '', err: '' };
  //     }
  //     await this._port.write('import webrepl_setup\x04');
  //     await this._readUntil('> ', 500);
  //     await this._port.write('E\n');
  //     if (existed) {
  //       // change password?
  //       await this._readUntil('password? (y/n) ', 500);
  //       await this._port.write('y\n');
  //     } else {
  //       // new password
  //     }
  //     await this._readUntil('(4-9 chars): ', 500);
  //     await this._port.write(password + '\n');
  //     await this._readUntil('Confirm password: ', 500);
  //     await this._port.write(password + '\n');
  //     await this._readUntil('reboot now? (y/n) ', 500);
  //     await this._port.write('y\n');
  //     // reboot
  //     // reenter raw-repl
  //     await this.init();
  //     console.log('444444444444444444444');
  //     await this._port.write('import webrepl_setup\x04');
  //     await this._readUntil('> ', 500);
  //     await this._port.write('D\n');
  //     const data = '';
  //     const err = '';
  //     return { data, err };
  //   });
  // }

  /**
   * Write bytes to the port without locking.
   * @param data The bytes to write.
   */
  dangerouslyWrite(data: string): Promise<void> {
    return this._port.write(data);
  }

  /**
   * Close the port.
   */
  close(): Promise<void> {
    return this._port.close();
  }
}

export let connection: Connection | undefined = undefined;

export const setConnection: (newConnection: Connection | undefined) => void = (
  newConnection,
) => {
  connection = newConnection;
};
