import Port from './port';
import Serial, { SerialOptions } from './serial';
import WebSock, { WebSockOptions } from './websock';
import * as util from '../util';

type ConnectionOptions = SerialOptions | WebSockOptions;

interface Result {
  data: string;
  err: string;
}

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
  private async _lock<T>(callback: () => Promise<T>): Promise<T> {
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
  async init(): Promise<void> {
    await this._lock<void>(async () => {
      for (;;) {
        await this._port.write('\r\x03\x03');
        for (; this._port.readableLength > 0; ) {
          await this._port.read(this._port.readableLength);
        }
        await this._port.write('\r\x01');
        try {
          await this._readUntil('raw REPL; CTRL-B to exit\r\n', 500);
          return;
        } catch {}
      }
    });
    await this.exec('import os');
  }

  /**
   * Execute Python code on the board.
   * @param code The code to execute.
   * @param readCallback The port read callback.
   * @returns The execution result.
   */
  async exec(code: string, readCallback?: ReadCallback): Promise<Result> {
    try {
      return await this._lock<Result>(async () => {
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
              i === 0 ? (data += s) : (err += s);
              readCallback && readCallback(s);
            }
          }
        }
        return { data, err };
      });
    } catch (err) {
      await this.init();
      throw err;
    }
  }

  /**
   * Configure WebREPL.
   * @param password The password of WebREPL.
   * @param existed Whether there is a webreplcfg.py.
   * @returns The execution result.
   */
  //  async configWebREPL(password: string, existed: boolean): Promise<Result> {
  //   try {
  //     return await this._lock<Result>(async () => {
  //       if (!password) {
  //         return { data: '', err: '' };
  //       }
  //       await this._port.write('import webrepl_setup\x04');
  //       await this._readUntil('> ', 500);
  //       await this._port.write('E\r');
  //       if(existed){
  //         // change password?
  //         await this._readUntil('password? (y/n) ', 500);
  //         await this._port.write('y\r');
  //       }
  //       else{
  //         // new password
  //       }
  //       await this._readUntil('(4-9 chars): ', 500);
  //       await this._port.write(password+'\r');
  //       await this._readUntil('Confirm password: ', 500);
  //       await this._port.write(password+'\r');
  //       await this._readUntil('reboot now? (y/n) ', 500);
  //       await this._port.write('y\r');
  //       // reboot
  //       // reenter raw-repl
  //       await this.init();
  //       console.log('444444444444444444444');
  //       await this._port.write('import webrepl_setup\x04');
  //       await this._readUntil('> ', 500);
  //       await this._port.write('D\r');
  //       const data = '';
  //       const err = '';
  //       return { data, err };
  //     });
  //   } catch (err) {
  //     await this.init();
  //     throw err;
  //   }
  // }

  /**
   * Evalute the result of an expression.
   * @param expression The expression to evaluate.
   * @returns The evaluation result.
   */
  eval(expression: string): Promise<Result> {
    return this.exec(`print(${expression},end='')`);
  }

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
