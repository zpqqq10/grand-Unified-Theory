export default interface Port {
  get length(): number;
  read(size: number): Promise<string>;
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
