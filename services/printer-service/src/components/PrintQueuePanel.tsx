import React, { useEffect, useState } from 'react';
import type { PrintJob } from '../types/printer';
import { printQueue } from '../queue/PrintQueue';

export const PrintQueuePanel: React.FC = () => {
  const [jobs, setJobs] = useState<PrintJob[]>([]);

  useEffect(() => {
    const unsubscribe = printQueue.subscribe((updatedJobs) => {
      setJobs(updatedJobs);
    });
    return unsubscribe;
  }, []);

  const handleSimulatePrint = () => {
    printQueue.addJob('1', 'receipt', { text: 'Test Receipt' });
  };

  const handleSimulateError = () => {
    const job = printQueue.addJob('2', 'label', { text: 'Test Label' });
    setTimeout(() => {
      printQueue.updateJobStatus(job.id, 'failed', 'Bluetooth disconnected unexpectedly');
    }, 1000);
  };

  return (
    <div className="glass-card">
      <div className="header" style={{ marginBottom: '1.5rem', borderBottom: 'none', paddingBottom: 0 }}>
        <h2>Offline Print Queue</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={handleSimulatePrint}>Simulate Success Job</button>
          <button className="btn btn-secondary" onClick={handleSimulateError}>Simulate Failed Job</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            No pending print jobs in queue.
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} style={{ 
              background: 'rgba(15, 23, 42, 0.4)', 
              border: '1px solid var(--glass-border)',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
                  <strong>Job #{job.id.toUpperCase()}</strong>
                  <span className={`badge ${job.status === 'failed' ? 'danger' : job.status === 'completed' ? 'success' : 'warning'}`}>
                    {job.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {job.documentType.toUpperCase()} • Printer: {job.printerId} • Attempts: {job.attemptCount}
                </div>
                {job.error && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--danger)', marginTop: '0.25rem' }}>
                    Error: {job.error}
                  </div>
                )}
              </div>

              <div>
                {job.status === 'failed' && (
                  <button className="btn btn-secondary" onClick={() => printQueue.updateJobStatus(job.id, 'pending')}>
                    Retry
                  </button>
                )}
                <button 
                  className="btn btn-danger" 
                  style={{ marginLeft: '0.5rem', background: 'transparent', border: 'none' }}
                  onClick={() => printQueue.removeJob(job.id)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
