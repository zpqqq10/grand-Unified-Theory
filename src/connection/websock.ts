import * as WebSocket from 'ws';
import Port, { PortOptions } from './port';
import * as util from '../util';

export interface WebSockOptions extends PortOptions {
  type: 'websock';
  url: string;
  password: string;
}

export default class WebSock implements Port {
  private _socket: WebSocket;
  private _status: 'disconnected' | 'connecting' | 'connected';
  private _receiveData: string;
  readonly address: string;

  constructor(options: WebSockOptions) {
    // 建立登录的连接
    this._socket = new WebSocket(options.url);
    this._socket.onopen = async () => {
      console.log('WebSocket成功连接');
    };
    this._socket.onmessage = async msg => {
      console.log('接收到来自ESP32的消息：');
      console.log(msg.data);
      if (
        this._status === 'disconnected' &&
        msg.data.toString() === 'Password: '
      ) {
        this._socket.send(`${options.password}\r\n`);
        this._status = 'connecting';
      } else if (
        this._status === 'connecting' &&
        msg.data.toString() === '\r\nWebREPL connected\r\n>>> '
      ) {
        options.onOpen();
        this._status = 'connected';
      } else if (this._status === 'connected') {
        this._receiveData += msg.data.toString();
      }
    };
    this._socket.onerror = options.onError;
    this._status = 'disconnected';
    this._receiveData = '';
    this.address = options.url;
  }

  get readableLength(): number {
    return this._receiveData.length;
  }

  async read(size: number, timeout?: number): Promise<string> {
    for (;;) {
      if (this._receiveData.length >= size) {
        const tmpData = this._receiveData.slice(0, size);
        this._receiveData = this._receiveData.slice(size);
        return tmpData;
      }
      if (timeout !== undefined && --timeout < 0) {
        throw util.ESP32Error.readTimedOut();
      }
      await util.sleep(1);
    }
  }

  write(data: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.send(
        data,
        {
          binary: false,
          mask: false,
        },
        err => {
          if (err) {
            reject(err);
          } else {
            console.log('websock write', data);
            resolve();
          }
        },
      );
    });
  }

  async close(): Promise<void> {
    this._socket.close();
    for (; this._socket.readyState === 2; ) {
      await util.sleep(1);
    }
    if (this._socket.readyState !== 1) {
      throw new Error('Failed to close WebSocket.');
    }
    console.log('websock close');
  }
}
