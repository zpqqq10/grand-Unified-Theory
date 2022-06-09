import * as vscode from 'vscode';
import { connection } from './connection';
import * as util from './util';

export interface TerminalOptions {
  code?: string;
  isFile?: boolean;
  isREPL?: boolean;
}

export default class ESP32Pty implements vscode.Pseudoterminal {
  private _options: TerminalOptions;
  private _finished: boolean = true;
  private _emitter = new vscode.EventEmitter<string>();
  readonly onDidWrite: vscode.Event<string> = this._emitter.event;

  constructor(options: TerminalOptions) {
    this._options = options;
  }

  async open(
    initialDimensions: vscode.TerminalDimensions | undefined,
  ): Promise<void> {
    if (!connection) {
      throw util.ESP32Error.noConnection();
    }
    const { code = '', isFile, isREPL } = this._options;
    if (!isFile && !isREPL) {
      this._emitter.fire(`> ${code}\r\n`);
    }
    const onRead = (data: string) => {
      this._finished = false;
      this._emitter.fire(data);
    };
    try {
      if (isREPL) {
        await connection.startREPL(onRead);
      } else {
        await connection.exec(code, { onRead });
      }
    } catch {}
    this._finished = true;
    this._emitter.fire('> Finished <');
  }

  async close(): Promise<void> {
    if (this._finished) {
      return;
    }
    if (!connection) {
      throw util.ESP32Error.noConnection();
    }
    if (this._options.isREPL) {
      connection.stopREPL();
    }
    for (; !this._finished; ) {
      await connection.dangerouslyWrite('\x03\x03');
      await util.sleep(500);
    }
  }

  async handleInput(data: string): Promise<void> {
    if (this._finished) {
      return;
    }
    if (!connection) {
      throw util.ESP32Error.noConnection();
    }
    if (
      data !== '\x01' &&
      data !== '\x02' &&
      data !== '\x04' &&
      data !== '\x05'
    ) {
      await connection.dangerouslyWrite(data);
    }
  }
}
