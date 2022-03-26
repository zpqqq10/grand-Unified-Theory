import Port from './port';
import Serial, { SerialOptions } from './serial';
import WebSock, { WebSockOptions } from './websock';

type ConnectionOptions = SerialOptions | WebSockOptions;

interface Result {
  data: string;
  err: string;
}

export default class Connection {
  private _port: Port;
  private _blocking: boolean;
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
      default: {
        throw new Error('Unknown connection type.');
      }
    }
    this._blocking = false;
    this.type = options.type;
  }

  get address() {
    return this._port.address;
  }

  /**
   * Block the port to ensure at most one ongoing operation.
   */
  private _block(): Promise<void> {
    return new Promise((resolve) => {
      const lock = () => {
        if (!this._blocking) {
          this._blocking = true;
          resolve();
        } else {
          setTimeout(lock, 1);
        }
      };
      lock();
    });
  }

  /**
   * Read bytes from the port until a certain string is met.
   * @param suffix The string to stop read.
   * @returns The bytes read from the port.
   */
  private async _readUntil(suffix: string): Promise<string> {
    for (let data = ''; ; ) {
      data += await this._port.read(1);
      if (data.endsWith(suffix)) {
        console.log('serial read', data);
        return data;
      }
    }
  }

  private async _init(): Promise<void> {
    await this._port.write('\x03\x03');
    for (; this._port.readableLength > 0; ) {
      await this._port.read(this._port.readableLength);
    }
    await this._port.write('\x01');
    await this._readUntil('raw REPL; CTRL-B to exit\r\n');
    await this._port.write('\x04');
    await this._readUntil('MPY: soft reboot\r\n');
    await this._readUntil('raw REPL; CTRL-B to exit\r\n');
    await this._exec('import os');
  }

  /**
   * Initialize the board.
   */
  async init(): Promise<void> {
    await this._block();
    await this._init();
    this._blocking = false;
  }

  private async _exec(command: string): Promise<Result> {
    if (command === '') {
      return { data: '', err: '' };
    }
    await this._readUntil('>');
    await this._port.write(command + '\x04');
    await this._readUntil('OK');
    const data = await this._readUntil('\x04');
    const err = await this._readUntil('\x04');
    return {
      data: data.slice(0, data.length - 1),
      err: err.slice(0, err.length - 1),
    };
  }

  /**
   * Execute a command on the board.
   * @param command The command to execute.
   * @returns The execution result.
   */
  async exec(command: string): Promise<Result> {
    await this._block();
    const result = await this._exec(command);
    this._blocking = false;
    return result;
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
   * Close the port.
   */
  async close(): Promise<void> {
    await this._port.close();
  }
}
