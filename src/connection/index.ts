import Port from './port';
import Serial, { SerialOptions } from './serial';
import WebSock, { WebSockOptions } from './websock';

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
    await new Promise<void>((resolve) => {
      const lock = () => {
        if (!this._locking) {
          this._locking = true;
          resolve();
        } else {
          setTimeout(lock, 1);
        }
      };
      lock();
    });
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
   */
  private async _readUntil(suffix: string, timeout?: number): Promise<string> {
    for (let data = ''; ; ) {
      data += await this._port.read(1, timeout);
      if (data.endsWith(suffix)) {
        console.log('serial read', data);
        return data.slice(0, -suffix.length);
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
          await this._readUntil('raw REPL; CTRL-B to exit\r\n', 100);
        } catch {
          continue;
        }
        return;
      }
    });
    await this.exec('import os');
  }

  /**
   * Execute Python code on the board.
   * @param code The code to execute.
   * @returns The execution result.
   */
  async exec(code: string): Promise<Result> {
    try {
      return await this._lock<Result>(async () => {
        if (code === '') {
          return { data: '', err: '' };
        }
        await this._readUntil('>', 100);
        await this._port.write(code + '\x04');
        await this._readUntil('OK', 100);
        const data = await this._readUntil('\x04');
        const err = await this._readUntil('\x04');
        return { data, err };
      });
    } catch (err) {
      await this.init();
      throw err;
    }
  }

  /**
   * Evalute the result of an expression.
   * @param expression The expression to evaluate.
   * @returns The evaluation result.
   */
  async eval(expression: string): Promise<Result> {
    return await this.exec(`print(${expression},end='')`);
  }

  /**
   * Execute Python code interactively on the board.
   * @param code The code to execute.
   * @param readCallback The port read callback.
   */
  async interactivelyExec(
    code: string,
    readCallback: ReadCallback,
  ): Promise<void> {
    try {
      await this._lock<void>(async () => {
        readCallback('');
        if (code === '') {
          return;
        }
        await this._readUntil('>', 100);
        await this._port.write(code + '\x04');
        await this._readUntil('OK', 100);
        for (let i = 0; i < 2; i++) {
          for (;;) {
            const data = await this._port.read(1);
            if (data === '\x04') {
              break;
            }
            readCallback(data);
          }
        }
      });
    } catch (err) {
      await this.init();
      throw err;
    }
  }

  /**
   * Write bytes to the port without locking.
   * @param data The bytes to write.
   */
  async dangerouslyWrite(data: string): Promise<void> {
    await this._port.write(data);
  }

  /**
   * Close the port.
   */
  async close(): Promise<void> {
    await this._port.close();
  }
}
