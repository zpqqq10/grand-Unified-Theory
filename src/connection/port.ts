export default interface Port {
  read(size: number): Promise<string>;
  write(data: string): Promise<void>;
}
