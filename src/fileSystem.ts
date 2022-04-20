import * as vscode from 'vscode';
import { connection } from './connection';
import * as util from './util';

export default class ESP32FS implements vscode.FileSystemProvider {
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> =
    this._emitter.event;

  watch(
    uri: vscode.Uri,
    options: {
      readonly recursive: boolean;
      readonly excludes: readonly string[];
    },
  ): vscode.Disposable {
    return new vscode.Disposable(() => {});
  }

  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    const { data, err } = await connection.exec(
      `f=os.stat('${uri.path}')\rprint('{}/{}/{}/{}'.format('f'if f[0]&0x8000 else'd',f[9],f[8],f[6]))`,
    );
    if (err) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    const stat = data.trim().split('/');
    return {
      type: stat[0] === 'f' ? vscode.FileType.File : vscode.FileType.Directory,
      ctime: parseInt(stat[1]),
      mtime: parseInt(stat[2]),
      size: parseInt(stat[3]),
    };
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    if ((await this.stat(uri)).type !== vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileNotADirectory(uri);
    }
    const { data, err } = await connection.exec(
      `for f in os.ilistdir('${uri.path}'):\r print('{}/{}'.format(f[0],'f'if f[1]&0x8000 else'd'))`,
    );
    if (err) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return data
      .trim()
      .split('\r\n')
      .filter((str) => str)
      .map((file) => {
        const stat = file.split('/');
        return [
          stat[0],
          stat[1] === 'f' ? vscode.FileType.File : vscode.FileType.Directory,
        ];
      });
  }

  async createDirectory(uri: vscode.Uri): Promise<void> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    let stat: vscode.FileStat | undefined = undefined;
    try {
      stat = await this.stat(uri);
    } catch {}
    if (stat) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    const { err } = await connection.exec(`os.mkdir('${uri.path}')`);
    if (err) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    if ((await this.stat(uri)).type === vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    const { data, err } = await connection.eval(`open('${uri.path}').read()`);
    if (err) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    return Buffer.from(data);
  }

  async writeFile(
    uri: vscode.Uri,
    content: Uint8Array,
    options: { readonly create: boolean; readonly overwrite: boolean },
  ): Promise<void> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    let stat: vscode.FileStat | undefined = undefined;
    try {
      stat = await this.stat(uri);
    } catch {}
    if (stat?.type === vscode.FileType.Directory) {
      throw vscode.FileSystemError.FileIsADirectory(uri);
    }
    if (!stat && !options.create) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (stat && options.create && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(uri);
    }
    const { err } = await connection.exec(
      `f=open('${uri.path}','wb')\rf.write(b${JSON.stringify(
        content.toString().replace(/\r/g, ''),
      )})\rf.close()`,
    );
    if (err) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
    if (!stat) {
      this._emitter.fire([{ type: vscode.FileChangeType.Created, uri }]);
    }
    this._emitter.fire([{ type: vscode.FileChangeType.Changed, uri }]);
  }

  async delete(
    uri: vscode.Uri,
    options: { readonly recursive: boolean },
  ): Promise<void> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    const stat = await this.stat(uri);
    if (stat.type !== vscode.FileType.Directory) {
      const { err } = await connection.exec(`os.remove('${uri.path}')`);
      if (err) {
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    } else {
      if (!options.recursive) {
        throw vscode.FileSystemError.FileIsADirectory(uri);
      }
      const dir = await this.readDirectory(uri);
      for (const file of dir) {
        await this.delete(vscode.Uri.joinPath(uri, file[0]), {
          recursive: true,
        });
      }
      const { err } = await connection.exec(`os.rmdir('${uri.path}')`);
      if (err) {
        throw vscode.FileSystemError.FileNotFound(uri);
      }
    }
    this._emitter.fire([{ type: vscode.FileChangeType.Deleted, uri }]);
  }

  async rename(
    oldUri: vscode.Uri,
    newUri: vscode.Uri,
    options: { readonly overwrite: boolean },
  ): Promise<void> {
    if (connection === undefined) {
      throw util.ESP32Error.noConnection();
    }
    let stat: vscode.FileStat | undefined = undefined;
    try {
      stat = await this.stat(newUri);
    } catch {}
    if (stat && !options.overwrite) {
      throw vscode.FileSystemError.FileExists(newUri);
    }
    const { err } = await connection.exec(
      `os.rename('${oldUri.path}','${newUri.path}')`,
    );
    if (err) {
      throw vscode.FileSystemError.FileNotFound(oldUri);
    }
    this._emitter.fire([
      { type: vscode.FileChangeType.Deleted, uri: oldUri },
      { type: vscode.FileChangeType.Created, uri: newUri },
    ]);
  }
}
