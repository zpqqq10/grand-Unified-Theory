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

  read(size: number): Promise<string> {
    return new Promise((resolve, reject) => reject());
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => reject());
  }
}
