import * as vscode from 'vscode';
import { connection, createError } from './extension';

export default class ESP32Pty implements vscode.Pseudoterminal {
  private _code: string;
  private _isFile: boolean;
  private _finished: boolean = true;
  private _emitter = new vscode.EventEmitter<string>();
  readonly onDidWrite: vscode.Event<string> = this._emitter.event;

  constructor(code: string, isFile: boolean) {
    this._code = code;
    this._isFile = isFile;
  }

  async open(
    initialDimensions: vscode.TerminalDimensions | undefined,
  ): Promise<void> {
    if (connection === undefined) {
      throw createError.noConnection();
    }
    if (!this._isFile) {
      this._emitter.fire(`> ${this._code}\r\n`);
    }
    await connection.interactivelyExec(this._code, (data: string) => {
      this._finished = false;
      this._emitter.fire(data);
    });
    this._finished = true;
    this._emitter.fire('> Finished <');
  }

  async close(): Promise<void> {
    if (this._finished) {
      return;
    }
    if (connection === undefined) {
      throw createError.noConnection();
    }
    for (; !this._finished; ) {
      await connection.dangerouslyWrite('\r\x03\x03');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async handleInput(data: string): Promise<void> {
    if (this._finished) {
      return;
    }
    if (connection === undefined) {
      throw createError.noConnection();
    }
    await connection.dangerouslyWrite(data);
  }
}