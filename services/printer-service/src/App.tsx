import React, { useState } from 'react';
import { PrinterCenter } from './components/PrinterCenter';
import { LabelDesigner } from './components/LabelDesigner';
import { PrintQueuePanel } from './components/PrintQueuePanel';

function App() {
  const [activeTab, setActiveTab] = useState<'center' | 'designer' | 'queue'>('center');

  return (
    <div className="app-container animate-slide-up">
      <header style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ 
          fontSize: '2.5rem', 
          margin: 0,
          background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 800
        }}>
          MyPOS Smart Printing
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
          Next-generation Bluetooth Print Engine Module
        </p>
      </header>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <button 
          className={`btn ${activeTab === 'center' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('center')}
        >
          Printer Center
        </button>
        <button 
          className={`btn ${activeTab === 'designer' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('designer')}
        >
          Smart Label Designer
        </button>
        <button 
          className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('queue')}
        >
          Offline Print Queue
        </button>
      </div>

      {/* Main Content */}
      <main style={{ minHeight: '60vh' }}>
        {activeTab === 'center' && <PrinterCenter />}
        {activeTab === 'designer' && <LabelDesigner />}
        {activeTab === 'queue' && <PrintQueuePanel />}
      </main>

      <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '2rem' }}>
        Standalone Testing Module. Connect physical BLE printers directly from Chrome (Android/Windows) to test.
      </footer>
    </div>
  );
}

export default App;
