import Port from './port';
import Serial, { SerialOptions } from './serial';
import WebSock, { WebSockOptions } from './websock';

type ConnectionOptions = SerialOptions | WebSockOptions;

interface Result {
  data: string;
  err: string;
}

export default class Connection {
  private port: Port;
  public readonly type: string;

  constructor(options: ConnectionOptions) {
    switch (options.type) {
      case 'serial': {
        this.port = new Serial(options);
        break;
      }
      case 'websock': {
        this.port = new WebSock(options);
        break;
      }
      default: {
        throw new Error('Unknown connection type.');
      }
    }
    this.type = options.type;
  }

  get address() {
    return this.port.address;
  }

  private async readUntil(suffix: string): Promise<string> {
    for (let data = ''; ; ) {
      data += await this.port.read(1);
      if (data.endsWith(suffix)) {
        return data;
      }
    }
  }

  async init(): Promise<void> {
    await this.port.write('\x03\x03');
    for (; this.port.readableLength > 0; ) {
      await this.port.read(this.port.readableLength);
    }
    await this.port.write('\x01');
    await this.readUntil('raw REPL; CTRL-B to exit\r\n');
    await this.port.write('\x04');
    await this.readUntil('MPY: soft reboot\r\n');
    await this.readUntil('raw REPL; CTRL-B to exit\r\n');
  }

  async exec(command: string): Promise<Result> {
    if (command === '') {
      return { data: '', err: '' };
    }
    await this.readUntil('>');
    await this.port.write(command + '\x04');
    await this.readUntil('OK');
    const data = await this.readUntil('\x04');
    const err = await this.readUntil('\x04');
    return {
      data: data.slice(0, data.length - 1),
      err: err.slice(0, err.length - 1),
    };
  }

  async eval(expression: string): Promise<Result> {
    return await this.exec(`print(${expression})`);
  }

  async close(): Promise<void> {
    await this.port.close();
  }
}
