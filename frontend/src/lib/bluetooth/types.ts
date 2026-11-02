export interface PrinterTransport {
  name: string;
  isAvailable(): boolean;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  write(data: Uint8Array, chunkDelay?: number): Promise<boolean>;
  isConnected(): boolean;
  onDisconnect(callback: () => void): void;
}

export interface PrinterAdapter {
  init(): Uint8Array;
  text(content: string, bold?: boolean, doubleWidth?: boolean, doubleHeight?: boolean): Uint8Array;
  feed(lines?: number): Uint8Array;
  cut(): Uint8Array;
  barcode?(data: string): Uint8Array;
  qrcode?(data: string): Uint8Array;
  image?(canvas: HTMLCanvasElement): Uint8Array;
}
