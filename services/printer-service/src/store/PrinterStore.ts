import type { PrinterTransport } from '../types/printer';

class PrinterStore {
  private activeTransport: PrinterTransport | null = null;
  private connectedId: string | null = null;

  setTransport(transport: PrinterTransport | null, id: string | null) {
    this.activeTransport = transport;
    this.connectedId = id;
  }

  getTransport() {
    return this.activeTransport;
  }

  getConnectedId() {
    return this.connectedId;
  }

  async disconnect() {
    if (this.activeTransport) {
      await this.activeTransport.disconnect();
      this.activeTransport = null;
      this.connectedId = null;
    }
  }
}

export const printerStore = new PrinterStore();
