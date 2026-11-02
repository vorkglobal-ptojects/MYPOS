import type { PrinterTransport } from '../types/printer';

export class WebBluetoothTransport implements PrinterTransport {
  name = 'Web Bluetooth LE Transport';
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private disconnectCallback?: () => void;

  // Standard Printer UUIDs including common Xprinter (XP-365B) BLE UUIDs
  private PRINTER_SERVICE_UUIDS = [
    '000018f0-0000-1000-8000-00805f9b34fb', 
    '49535343-fe7d-4ae5-8fa9-9fafd205e455', 
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
    '0000fee7-0000-1000-8000-00805f9b34fb',
    '0000ff00-0000-1000-8000-00805f9b34fb'
  ];
  private PRINTER_CHARACTERISTIC_UUIDS = [
    '00002af1-0000-1000-8000-00805f9b34fb', 
    '49535343-1e4d-4bd9-ba61-23c647249616', 
    'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
    '0000fec7-0000-1000-8000-00805f9b34fb',
    '0000fec8-0000-1000-8000-00805f9b34fb',
    '0000ff01-0000-1000-8000-00805f9b34fb',
    '0000ff02-0000-1000-8000-00805f9b34fb'
  ];

  isAvailable(): boolean {
    return navigator && navigator.bluetooth != null;
  }

  async connect(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Web Bluetooth is not supported by this browser.');
    }

    try {
      this.device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: this.PRINTER_SERVICE_UUIDS
      });

      this.device.addEventListener('gattserverdisconnected', this.handleDisconnect.bind(this));

      const server = await this.device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT Server');

      // Find the writable characteristic
      for (const serviceUuid of this.PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          for (const charUuid of this.PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              const characteristic = await service.getCharacteristic(charUuid);
              if (characteristic.properties.write || characteristic.properties.writeWithoutResponse) {
                this.characteristic = characteristic;
                return true;
              }
            } catch (e) { /* Ignore and try next characteristic */ }
          }
        } catch (e) { /* Ignore and try next service */ }
      }

      throw new Error('Could not find writable printer characteristic.');

    } catch (error) {
      console.error('[WebBluetoothTransport] Connection error:', error);
      throw error;
    }
  }

  private handleDisconnect() {
    console.log('[WebBluetoothTransport] Device disconnected.');
    this.characteristic = null;
    if (this.disconnectCallback) {
      this.disconnectCallback();
    }
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
  }

  async write(data: Uint8Array, chunkDelay = 20): Promise<boolean> {
    if (!this.characteristic) {
      throw new Error('Printer not connected or writable characteristic not found.');
    }

    const CHUNK_SIZE = 512; // Typical MTU size limit for BLE
    
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      await this.characteristic.writeValue(chunk);
      // Wait to prevent buffer overflow on the printer
      await new Promise((resolve) => setTimeout(resolve, chunkDelay));
    }
    
    return true;
  }

  isConnected(): boolean {
    return !!this.characteristic && !!this.device?.gatt?.connected;
  }

  onDisconnect(callback: () => void): void {
    this.disconnectCallback = callback;
  }
}
