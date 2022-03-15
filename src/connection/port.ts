export default interface Port {
  read(size: number): string | null;
  write(data: string): boolean;
}
