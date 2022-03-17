export default interface Port {
  readonly address: string;
  get length(): number;
  read(size: number): Promise<string>;
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
