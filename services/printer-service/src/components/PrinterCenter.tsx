import React, { useState, useEffect } from 'react';
import type { SavedPrinter, PrinterTransport } from '../types/printer';
import { WebBluetoothTransport } from '../transports/WebBluetoothTransport';
import { printerStore } from '../store/PrinterStore';

export const PrinterCenter: React.FC = () => {
  const [printers, setPrinters] = useState<SavedPrinter[]>(() => {
    const saved = localStorage.getItem('mypos_printers');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('mypos_printers', JSON.stringify(printers));
  }, [printers]);
  const [activeTransport, setActiveTransport] = useState<PrinterTransport | null>(null);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [connectedId, setConnectedId] = useState<string | null>(printerStore.getConnectedId());
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPrinterName, setNewPrinterName] = useState('');
  const [newPrinterType, setNewPrinterType] = useState<'receipt' | 'label'>('receipt');

  // Periodically check connection status since it's global now
  useEffect(() => {
    const interval = setInterval(() => {
      setConnectedId(printerStore.getConnectedId());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = async (printerId: string) => {
    setConnectingId(printerId);
    
    await printerStore.disconnect();

    const transport = new WebBluetoothTransport();

    try {
      const success = await transport.connect();
      if (success) {
        printerStore.setTransport(transport, printerId);
        setConnectedId(printerId);
        transport.onDisconnect(() => {
          printerStore.setTransport(null, null);
          setConnectedId(null);
        });
      }
    } catch (e: any) {
      alert(`Connection failed: ${e.message}`);
    } finally {
      setConnectingId(null);
    }
  };

  const handleDisconnect = async () => {
    await printerStore.disconnect();
    setConnectedId(null);
  };

  const handleDiscoverPrinter = async () => {
    if (!newPrinterName.trim()) {
      alert("Please enter a name for the printer.");
      return;
    }

    try {
      // Just pair to get permission and details, then we save it.
      // We will use the WebBluetooth API directly to discover, since the transport handles full connection.
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '000018f0-0000-1000-8000-00805f9b34fb', 
          '49535343-fe7d-4ae5-8fa9-9fafd205e455', 
          'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
          '0000fee7-0000-1000-8000-00805f9b34fb',
          '0000ff00-0000-1000-8000-00805f9b34fb'
        ]
      });

      const newPrinter: SavedPrinter = {
        id: device.id || Math.random().toString(36).substr(2, 9),
        name: newPrinterName || device.name || 'Unknown Printer',
        profileId: newPrinterType === 'receipt' ? 'escpos-80' : 'tspl-generic',
        type: newPrinterType,
        deviceId: device.id,
        isDefault: printers.length === 0
      };

      setPrinters([...printers, newPrinter]);
      setShowAddModal(false);
      setNewPrinterName('');

    } catch (error: any) {
      alert(`Could not add printer: ${error.message}`);
    }
  };

  const handleDelete = (id: string) => {
    if (connectedId === id) {
      handleDisconnect();
    }
    setPrinters(printers.filter(p => p.id !== id));
  };

  return (
    <div className="glass-card">
      <div className="header" style={{ marginBottom: '1.5rem', borderBottom: 'none', paddingBottom: 0 }}>
        <h2>Printer Center</h2>
        <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>+ Add Printer</button>
      </div>

      {printers.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem' }}>
          <p>No printers added yet.</p>
          <p>Click "+ Add Printer" to pair a physical Bluetooth printer.</p>
        </div>
      ) : (
        <div className="grid-2">
          {printers.map(printer => {
            const isConnecting = connectingId === printer.id;
            const isConnected = connectedId === printer.id;

            return (
              <div key={printer.id} className="glass-card" style={{ background: 'rgba(15, 23, 42, 0.4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {printer.name}
                      {printer.isDefault && <span className="badge default">Default</span>}
                    </h3>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {printer.type.toUpperCase()} • {printer.profileId}
                    </p>
                  </div>
                  {isConnected ? (
                    <span className="badge success">Connected</span>
                  ) : isConnecting ? (
                    <span className="badge warning animate-pulse">Connecting...</span>
                  ) : (
                    <span className="badge danger">Disconnected</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                  {isConnected ? (
                    <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDisconnect}>
                      Disconnect
                    </button>
                  ) : (
                    <button 
                      className="btn btn-secondary" 
                      style={{ flex: 1 }} 
                      onClick={() => handleConnect(printer.id)}
                      disabled={isConnecting}
                    >
                      Connect (BLE)
                    </button>
                  )}
                  <button 
                    className="btn btn-danger" 
                    style={{ background: 'transparent', border: 'none' }}
                    onClick={() => handleDelete(printer.id)}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Printer Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
        }}>
          <div className="glass-card" style={{ width: '400px', padding: '2rem' }}>
            <h2 style={{ margin: '0 0 1rem 0' }}>Add Bluetooth Printer</h2>
            
            <div className="input-group">
              <label>Custom Name</label>
              <input 
                className="input-control" 
                placeholder="e.g. Front Desk Printer"
                value={newPrinterName}
                onChange={e => setNewPrinterName(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label>Printer Type</label>
              <select 
                className="input-control" 
                value={newPrinterType} 
                onChange={e => setNewPrinterType(e.target.value as 'receipt' | 'label')}
              >
                <option value="receipt">Receipt Printer (ESC/POS)</option>
                <option value="label">Label Printer (TSPL)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDiscoverPrinter}>Discover & Pair</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
