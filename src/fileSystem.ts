import * as vscode from 'vscode';
import { connection } from './extension';

class File implements vscode.FileStat {
  type: vscode.FileType;
  ctime: number;
  mtime: number;
  size: number;

  constructor(type: vscode.FileType) {
    this.type = type;
    this.ctime = Date.now();
    this.mtime = Date.now();
    this.size = 0;
  }
}

export default class ESP32FS implements vscode.FileSystemProvider {
  emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();

  onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.emitter.event;

  private async ls(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    if (connection === undefined) {
      throw new Error('No connection.');
    }
    const { data, err } = await connection.exec(
      `import os\nfor f in os.ilistdir('${uri.path}'):\n print('{} {}'.format(f[0], 'f' if f[1] == 0x8000 else 'd'))`,
    );
    if (err) {
      throw new Error(err);
    }
    return data
      .trim()
      .split('\n')
      .map((file) => {
        const stat = file.split(' ');
        return [
          stat[0],
          stat[1] === 'f' ? vscode.FileType.File : vscode.FileType.Directory,
        ];
      });
  }

  watch(
    uri: vscode.Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    },
  ): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat | Thenable<vscode.FileStat> {
    return new File(vscode.FileType.Directory);
  }

  readDirectory(
    uri: vscode.Uri,
  ): [string, vscode.FileType][] | Thenable<[string, vscode.FileType][]> {
    return this.ls(uri);
  }

  createDirectory(uri: vscode.Uri): void | Thenable<void> {}

  readFile(uri: vscode.Uri): Uint8Array | Thenable<Uint8Array> {
    const arr = new Uint8Array();
    return arr;
  }

  writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean },
  ): void | Thenable<void> {}

  delete(
    uri: vscode.Uri,
    options: { readonly recursive: boolean },
  ): void | Thenable<void> {}

  rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean },
  ): void | Thenable<void> {}
}
