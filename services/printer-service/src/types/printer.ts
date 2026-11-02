export type PrinterType = 'receipt' | 'label' | 'a4' | 'unknown';
export type ConnectionStatus = 'disconnected' | 'searching' | 'connecting' | 'connected' | 'error';
export type PrinterLanguage = 'ESCPOS' | 'TSPL' | 'ZPL' | 'CPCL' | 'RASTER';

export interface PrinterProfile {
  id: string;
  manufacturer: string;
  model: string;
  type: PrinterType;
  language: PrinterLanguage;
  dpi: number;
  dotsPerLine: number;
  supportedWidths: number[]; // e.g., [58, 80]
  features: {
    raster: boolean;
    barcode: boolean;
    qrcode: boolean;
    cutter: boolean;
  };
}

export interface SavedPrinter {
  id: string;
  name: string;
  profileId: string;
  macAddress?: string; // Classic BT
  deviceId?: string; // BLE
  type: PrinterType;
  isDefault: boolean;
}

export interface PrintJob {
  id: string;
  printerId: string;
  documentType: 'receipt' | 'label' | 'pdf' | 'test';
  status: 'pending' | 'preparing' | 'printing' | 'completed' | 'failed';
  payload: any; // Raw bytes or document model
  attemptCount: number;
  createdAt: number;
  error?: string;
}

export interface PrinterTransport {
  name: string;
  isAvailable(): boolean;
  connect(deviceId?: string): Promise<boolean>;
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
  barcode(data: string): Uint8Array;
  qrcode(data: string): Uint8Array;
}
