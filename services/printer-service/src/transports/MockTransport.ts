import type { PrinterTransport } from '../types/printer';

export class MockTransport implements PrinterTransport {
  name = 'Mock Bluetooth Transport';
  private connected = false;
  private disconnectCallback?: () => void;

  isAvailable(): boolean {
    return true; // Always available for testing
  }

  async connect(deviceId?: string): Promise<boolean> {
    console.log(`[MockTransport] Simulating connection to ${deviceId || 'Mock Printer'}...`);
    return new Promise((resolve) => {
      setTimeout(() => {
        this.connected = true;
        console.log(`[MockTransport] Connected.`);
        resolve(true);
      }, 1500); // Simulate connection delay
    });
  }

  async disconnect(): Promise<void> {
    console.log(`[MockTransport] Disconnecting...`);
    this.connected = false;
    if (this.disconnectCallback) {
      this.disconnectCallback();
    }
  }

  async write(data: Uint8Array, chunkDelay = 10): Promise<boolean> {
    if (!this.connected) {
      throw new Error('Not connected');
    }
    console.log(`[MockTransport] Writing ${data.length} bytes...`);
    // Simulate chunked writing delay
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[MockTransport] Write complete.`);
        resolve(true);
      }, data.length / 10);
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }
}
