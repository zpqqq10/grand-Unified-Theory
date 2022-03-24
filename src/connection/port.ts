export default interface Port {
  /**
   * Connected port address.
   */
  readonly address: string;

  /**
   * Number of bytes in read buffer.
   */
  get readableLength(): number;

  /**
   * Read bytes from port.
   * @param size number of bytes to read
   * @param timeout reject after timeout
   */
  read(size: number, timeout?: number): Promise<string>;

  /**
   * Write bytes to port.
   * @param data bytes to write
   */
  write(data: string): Promise<void>;

  /**
   * Close port.
   */
  close(): Promise<void>;
}
