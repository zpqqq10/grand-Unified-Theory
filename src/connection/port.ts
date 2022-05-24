import { ErrorEvent } from 'ws';

export interface OpenCallback {
  (): void;
}

export interface ErrorCallback {
  (err: Error | ErrorEvent): void;
}

export interface Options {
  type: string;
  onOpen: OpenCallback;
  onError: ErrorCallback;
}

export default interface Port {
  /**
   * The address of the connected port.
   */
  readonly address: string;

  /**
   * The number of bytes in read buffer.
   */
  get readableLength(): number;

  /**
   * Read bytes from the port.
   * @param size The number of bytes to read.
   * @param timeout The time limit of read.
   * @returns The bytes read from the port.
   * @throws readTimedOut
   */
  read(size: number, timeout?: number): Promise<string>;

  /**
   * Write bytes to the port.
   * @param data The bytes to write.
   */
  write(data: string): Promise<void>;

  /**
   * Close the port.
   */
  close(): Promise<void>;
}
