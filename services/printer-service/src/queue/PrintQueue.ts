import type { PrintJob } from '../types/printer';

// A simple in-memory queue for the prototype.
// In a real PWA, this would use IndexedDB (e.g. Dexie) to persist jobs offline.

export class PrintQueue {
  private jobs: PrintJob[] = [];
  private listeners: ((jobs: PrintJob[]) => void)[] = [];

  addJob(printerId: string, documentType: PrintJob['documentType'], payload: any): PrintJob {
    const job: PrintJob = {
      id: Math.random().toString(36).substring(7),
      printerId,
      documentType,
      status: 'pending',
      payload,
      attemptCount: 0,
      createdAt: Date.now()
    };
    this.jobs.push(job);
    this.notify();
    return job;
  }

  getJobs(): PrintJob[] {
    return [...this.jobs].sort((a, b) => b.createdAt - a.createdAt);
  }

  updateJobStatus(id: string, status: PrintJob['status'], error?: string) {
    const job = this.jobs.find(j => j.id === id);
    if (job) {
      job.status = status;
      if (error) job.error = error;
      if (status === 'failed' || status === 'printing') {
        job.attemptCount++;
      }
      this.notify();
    }
  }

  removeJob(id: string) {
    this.jobs = this.jobs.filter(j => j.id !== id);
    this.notify();
  }

  subscribe(listener: (jobs: PrintJob[]) => void) {
    this.listeners.push(listener);
    listener(this.getJobs()); // Initial emit
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const currentJobs = this.getJobs();
    this.listeners.forEach(l => l(currentJobs));
  }
}

// Global instance for prototype
export const printQueue = new PrintQueue();
