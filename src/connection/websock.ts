import Port from './port';
import { io, Socket } from 'socket.io-client';

export interface WebSockOptions {
  type: 'websock';
  url: string;
  password: string;
}

export default class WebSock implements Port {
  private socket: Socket;

  constructor(options: WebSockOptions) {
    this.socket = io(options.url);
  }

  read(size: number): string | null {
    return null;
  }

  write(data: string): boolean {
    return false;
  }
}
