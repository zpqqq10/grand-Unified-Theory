import Port from './port';
import WebSocket, { ErrorEvent } from 'ws';
import * as util from '../util';
import * as vscode from 'vscode';
import { connection } from '.';
import { statusBarItem } from '../extension';

export interface WebSockOptions {
  type: 'websock';
  url: string;
  password: string;
  wsError: (err: ErrorEvent) => void;
}

export default class WebSock implements Port {
  private _socket: WebSocket;
  private _receiveData: string;
  readonly address: string;

  constructor(options: WebSockOptions) {  // 建立登录的连接
    this._socket = new WebSocket(options.url);
    this._receiveData = "";
    this.address = options.url;

    // console.log("[DEBUG] 开始建立连接", options.url);
    this._socket.onopen = async () => {
      console.log('WebSocket成功连接');
    };

    this._socket.onmessage = async (msg) => {
      console.log('接收到来自ESP32的消息：');
      // console.log(msg);  // Only For Debug
      console.log(msg.data);
      if (msg.data.toString() === "Password: ") {
        // console.log("Here!");
        this._socket.send(options.password);
        this._socket.send('\r\n');
      }
      else if (msg.data.toString() === '\r\nWebREPL connected\r\n>>> ') {
        // console.log("Here 2!");
        if (connection) {
          await connection.init();
          statusBarItem.text =  `Connected ${connection.address}`;
          vscode.commands.executeCommand(
            'setContext',
            'micropython-esp32.connected',
            true,
          );
          vscode.commands.executeCommand(
            'setContext',
            'micropython-esp32.connectionType',
            connection.type,
          );
        }
      }
      else {
        this._receiveData = this._receiveData.concat(msg.data.toString());
      }
      // console.log("[BUFFER]", this._receiveData);
    };
    this._socket.onerror = options.wsError;
  }

  get readableLength(): number {
    return this._receiveData.length;
  }

  async read(size: number, timeout?: number): Promise<string> {
    for(;;) {
      if (size <= 0) {
        return "";
      }
      if (this._receiveData.length >= size) {
        let tmpData = this._receiveData.slice(0, size);
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
      this._socket.send(data, {
        binary: false,
        mask: false
      },
      function(err) {
        reject(err);
      });
      console.log('Websocket write', data);
      resolve();
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this._socket.close();
      while(this._socket.readyState === 2) {
        util.sleep(1);
      }
      if(this._socket.readyState === 1) {
        console.log('WebSocket成功断开');
        resolve();
      }
      else {
        reject('WebSocket断开失败');
      }
    });
  }
}