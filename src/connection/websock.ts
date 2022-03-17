import Port from './port';
import { io, Socket } from 'socket.io-client';

export interface WebSockOptions {
  type: 'websock';
  url: string;
  password: string;
}

export default class WebSock implements Port {
  private socket: Socket;
  public readonly address: string;

  constructor(options: WebSockOptions) {
    this.socket = io(options.url);
    this.address = options.url;
  }

  get length(): number {
    return 0;
  }

  read(size: number): Promise<string> {
    return new Promise((resolve, reject) => reject());
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => reject());
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => reject());
  }
}
