import React, { useState, useRef, useEffect } from 'react';
import { printQueue } from '../queue/PrintQueue';
import { WebBluetoothTransport } from '../transports/WebBluetoothTransport';
import { MockTransport } from '../transports/MockTransport';
import { TsplAdapter } from '../adapters/TsplAdapter';
import { printerStore } from '../store/PrinterStore';

interface LabelElement {
  id: number;
  type: 'text' | 'barcode' | 'qrcode' | 'rectangle';
  content: string;
  x: number;
  y: number;
  size?: number;
  bold?: boolean;
  width?: number;
  height?: number;
}

export const LabelDesigner: React.FC = () => {
  const [elements, setElements] = useState<LabelElement[]>([
    { id: 1, type: 'text', content: 'Product Name', x: 20, y: 20, size: 16 },
    { id: 2, type: 'text', content: '$99.99', x: 20, y: 60, size: 24, bold: true },
    { id: 3, type: 'barcode', content: '1234567890', x: 20, y: 120 }
  ]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  
  // Print Modal State
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printState, setPrintState] = useState<'idle' | 'connecting' | 'printing' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Dragging logic
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragStartElPos = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingId === null) return;
      
      const dx = e.clientX - dragStartPos.current.x;
      const dy = e.clientY - dragStartPos.current.y;
      
      setElements(els => els.map(el => {
        if (el.id === draggingId) {
          return { ...el, x: dragStartElPos.current.x + dx, y: dragStartElPos.current.y + dy };
        }
        return el;
      }));
    };

    const handleMouseUp = () => {
      setDraggingId(null);
    };

    if (draggingId !== null) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId]);

  const handleElementMouseDown = (e: React.MouseEvent, el: LabelElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    setDraggingId(el.id);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartElPos.current = { x: el.x, y: el.y };
  };

  const handleAddElement = (type: LabelElement['type']) => {
    const newEl: LabelElement = {
      id: Date.now(),
      type,
      content: type === 'barcode' ? '123456' : type === 'qrcode' ? 'https://mypos.com' : 'New Text',
      x: 50,
      y: 50,
      size: 16,
      width: type === 'rectangle' ? 100 : undefined,
      height: type === 'rectangle' ? 50 : undefined
    };
    setElements([...elements, newEl]);
    setSelectedId(newEl.id);
  };

  const updateSelected = (updates: Partial<LabelElement>) => {
    setElements(els => els.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  const deleteSelected = () => {
    if (selectedId) {
      setElements(els => els.filter(el => el.id !== selectedId));
      setSelectedId(null);
    }
  };

  const selectedEl = elements.find(e => e.id === selectedId);

  // Print Logic
  const handleTestPrint = () => {
    setShowPrintModal(true);
    setPrintState('idle');
  };

  const handleConnectAndPrint = async () => {
    try {
      let transport = printerStore.getTransport();
      
      if (!transport || !transport.isConnected()) {
        setPrintState('connecting');
        transport = new WebBluetoothTransport();
        const connected = await transport.connect();
        if (!connected) throw new Error("Could not connect to printer.");
        printerStore.setTransport(transport, 'temp');
      }
      
      setPrintState('printing');
      
      const adapter = new TsplAdapter();
      const commands: Uint8Array[] = [];
      
      // Init label (assume 50mm x 30mm for this demo)
      commands.push(adapter.init(50, 30));
      
      // Parse visual elements into TSPL commands
      elements.forEach(el => {
        if (el.type === 'text') {
          commands.push(adapter.text(el.content, el.x, el.y, el.size));
        } else if (el.type === 'barcode') {
          commands.push(adapter.barcode(el.content, el.x, el.y));
        } else if (el.type === 'qrcode') {
          commands.push(adapter.qrcode(el.content, el.x, el.y));
        } else if (el.type === 'rectangle') {
          commands.push(adapter.box(el.x, el.y, el.width || 100, el.height || 50));
        }
      });
      
      commands.push(adapter.print());
      
      const printPayload = adapter.concat(commands);
      
      // Add to offline queue for tracking
      const job = printQueue.addJob('temp-printer', 'label', printPayload);
      
      // Send actual bytes to printer
      await transport.write(printPayload, 20); 
      
      printQueue.updateJobStatus(job.id, 'completed');
      setPrintState('done');
      
      setTimeout(() => {
        setShowPrintModal(false);
      }, 2000);

    } catch (e: any) {
      if (e.name === 'NotFoundError' || e.message?.includes('cancel') || e.message?.includes('User cancelled')) {
        setPrintState('idle');
        return;
      }
      setErrorMessage(e.message || "Unknown error");
      setPrintState('error');
    }
  };

  return (
    <>
      <div className="glass-card" style={{ display: 'flex', gap: '2rem', minHeight: '500px', position: 'relative' }} onClick={() => setSelectedId(null)}>
        
        {/* Left Toolbar */}
        <div style={{ width: '200px', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: 0 }}>Tools</h3>
          <button className="btn btn-secondary" onClick={() => handleAddElement('text')} style={{ justifyContent: 'flex-start' }}>+ Text Element</button>
          <button className="btn btn-secondary" onClick={() => handleAddElement('barcode')} style={{ justifyContent: 'flex-start' }}>+ Barcode</button>
          <button className="btn btn-secondary" onClick={() => handleAddElement('qrcode')} style={{ justifyContent: 'flex-start' }}>+ QR Code</button>
          <button className="btn btn-secondary" onClick={() => handleAddElement('rectangle')} style={{ justifyContent: 'flex-start' }}>+ Rectangle</button>
          
          <h3 style={{ margin: '1rem 0 0 0' }}>Presets</h3>
          <select className="input-control">
            <option>40mm x 30mm</option>
            <option>50mm x 25mm</option>
            <option>58mm Receipt</option>
            <option>80mm Receipt</option>
          </select>
        </div>

        {/* Canvas Area */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', overflow: 'hidden' }}>
          <div 
            ref={canvasRef}
            style={{ 
              width: '400px', 
              height: '300px', 
              background: 'white', 
              position: 'relative',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              color: 'black',
              overflow: 'hidden'
            }}
          >
            {/* Grid lines */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.5, pointerEvents: 'none' }} />

            {elements.map(el => {
              const isSelected = el.id === selectedId;
              return (
                <div 
                  key={el.id}
                  onMouseDown={(e) => handleElementMouseDown(e, el)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: el.x,
                    top: el.y,
                    cursor: draggingId === el.id ? 'grabbing' : 'grab',
                    border: isSelected ? '1px dashed #3b82f6' : '1px dashed transparent',
                    padding: '4px',
                    fontWeight: el.bold ? 'bold' : 'normal',
                    fontSize: el.size ? `${el.size}px` : 'inherit',
                    fontFamily: 'monospace',
                    userSelect: 'none',
                    boxShadow: isSelected ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                    width: el.type === 'rectangle' ? el.width : undefined,
                    height: el.type === 'rectangle' ? el.height : undefined,
                    outline: el.type === 'rectangle' ? '2px solid black' : 'none'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = '#ccc'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'transparent'; }}
                >
                  {el.type === 'barcode' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                      <div style={{ width: '150px', height: '40px', background: 'repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 8px)', border: '1px solid #ccc' }} />
                      <span style={{ fontSize: '10px', marginTop: '2px' }}>{el.content}</span>
                    </div>
                  ) : el.type === 'qrcode' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
                      <div style={{ width: '60px', height: '60px', background: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Cpath d=\'M10 10h30v30H10zM60 10h30v30H60zM10 60h30v30H10zM40 40h20v20H40z\' fill=\'black\'/%3E%3C/svg%3E") no-repeat center/contain' }} />
                    </div>
                  ) : el.type === 'rectangle' ? null : (
                    el.content
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Properties Panel */}
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '1rem' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: 0 }}>Properties</h3>
          
          {!selectedEl ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
              Select an element on the canvas to edit its properties.
            </div>
          ) : (
            <>
              {selectedEl.type !== 'rectangle' && (
                <div className="input-group">
                  <label>Content</label>
                  <input 
                    className="input-control" 
                    type="text" 
                    value={selectedEl.content} 
                    onChange={e => updateSelected({ content: e.target.value })}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div className="input-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>X Pos</label>
                  <input className="input-control" type="number" value={Math.round(selectedEl.x)} onChange={e => updateSelected({ x: Number(e.target.value) })} />
                </div>
                <div className="input-group" style={{ flex: 1, minWidth: 0 }}>
                  <label>Y Pos</label>
                  <input className="input-control" type="number" value={Math.round(selectedEl.y)} onChange={e => updateSelected({ y: Number(e.target.value) })} />
                </div>
              </div>
              
              {selectedEl.type === 'text' && (
                <div className="input-group">
                  <label>Font Size</label>
                  <input className="input-control" type="number" value={selectedEl.size || 16} onChange={e => updateSelected({ size: Number(e.target.value) })} />
                </div>
              )}

              {selectedEl.type === 'rectangle' && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div className="input-group" style={{ flex: 1, minWidth: 0 }}>
                    <label>Width</label>
                    <input className="input-control" type="number" value={selectedEl.width || 100} onChange={e => updateSelected({ width: Number(e.target.value) })} />
                  </div>
                  <div className="input-group" style={{ flex: 1, minWidth: 0 }}>
                    <label>Height</label>
                    <input className="input-control" type="number" value={selectedEl.height || 50} onChange={e => updateSelected({ height: Number(e.target.value) })} />
                  </div>
                </div>
              )}

              <button className="btn btn-danger" style={{ marginTop: '0.5rem' }} onClick={deleteSelected}>
                Delete Element
              </button>
            </>
          )}
          
          <div style={{ marginTop: 'auto', display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleTestPrint}>
              Print Label
            </button>
          </div>
        </div>
      </div>

      {/* Print Workflow Modal */}
      {showPrintModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
        }}>
          <div className="glass-card" style={{ width: '400px', textAlign: 'center', padding: '2rem' }}>
            
            {printState === 'idle' && (
              <>
                <h2 style={{ margin: '0 0 1rem 0' }}>Print Label</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Send this design to a Bluetooth printer.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.5rem' }}>
                  <button className="btn btn-primary" onClick={handleConnectAndPrint}>
                    {printerStore.getTransport()?.isConnected() ? 'Print Now' : 'Connect & Print'}
                  </button>
                  <button className="btn btn-secondary" style={{ border: 'none', background: 'transparent' }} onClick={() => setShowPrintModal(false)}>
                    Cancel
                  </button>
                </div>
              </>
            )}

            {printState === 'connecting' && (
              <>
                <div className="badge warning animate-pulse" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                  Connecting to Bluetooth...
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Please select your printer from the browser prompt.</p>
              </>
            )}

            {printState === 'printing' && (
              <>
                <div className="badge primary animate-pulse" style={{ fontSize: '1rem', padding: '0.5rem 1rem', background: 'var(--brand-primary)' }}>
                  Printing Label...
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Sending data to the printer.</p>
              </>
            )}

            {printState === 'done' && (
              <>
                <div className="badge success" style={{ fontSize: '1.2rem', padding: '0.5rem 1.5rem' }}>
                  Print Successful
                </div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Your label was sent to the printer.</p>
              </>
            )}

            {printState === 'error' && (
              <>
                <div className="badge danger" style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
                  Failed to Print
                </div>
                <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{errorMessage}</p>
                <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => setPrintState('idle')}>
                  Try Again
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </>
  );
};
