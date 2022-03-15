import Port from './port';
import Serial, { SerialOptions } from './serial';
import WebSock, { WebSockOptions } from './websock';

export type ConnectionOptions = SerialOptions | WebSockOptions;

export default class Connection {
  private port: Port;

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
  }
}
