import { getAuthHeaders } from './getAuthHeaders';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Universal typed HTTP request client for MIFOS Backend API Server.
 * Direct database querying from the client browser is forbidden.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedPath}`;

  const defaultHeaders = getAuthHeaders();
  const headers = {
    ...defaultHeaders,
    ...(options.headers as Record<string, string> || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const errorMsg = (typeof data === 'object' && data?.error) || response.statusText || 'API request failed';
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const apiClient = {
  // General HTTP methods
  get: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T = any>(endpoint: string, body?: any, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = any>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  // Dashboard & Metrics
  dashboard: {
    getMetrics: () => apiRequest('/dashboard/metrics', { method: 'GET' }),
  },

  // Operational Transactions & Ledger Audit
  transactions: {
    getAll: (branchId?: string, limit: number = 100) => {
      const q = new URLSearchParams();
      if (branchId) q.append('branchId', branchId);
      q.append('limit', limit.toString());
      return apiRequest(`/transactions?${q.toString()}`, { method: 'GET' });
    },
    create: (payload: {
      client_id?: string;
      type: string;
      branch_id: string;
      target_branch_id?: string;
      amount: number;
      description?: string;
    }) => apiRequest('/transactions', { method: 'POST', body: JSON.stringify(payload) }),
  },

  // Reports Summary
  reports: {
    getSummary: () => apiRequest('/reports/summary', { method: 'GET' }),
  },

  // Branches
  branches: {
    getAll: () => apiRequest('/branches', { method: 'GET' }),
  },

  // Clients
  clients: {
    getAll: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params);
      return apiRequest(`/clients?${q.toString()}`, { method: 'GET' });
    },
    getById: (id: string) => apiRequest(`/clients/${id}`, { method: 'GET' }),
    create: (data: any) => apiRequest('/clients', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => apiRequest(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  },

  // Loans & Pawning
  loans: {
    getAll: (params?: Record<string, string>) => {
      const q = new URLSearchParams(params);
      return apiRequest(`/loans?${q.toString()}`, { method: 'GET' });
    },
    getById: (id: string) => apiRequest(`/loans/${id}`, { method: 'GET' }),
    create: (data: any) => apiRequest('/loans', { method: 'POST', body: JSON.stringify(data) }),
    disburse: (id: string, data: any) => apiRequest(`/loans/${id}/disburse`, { method: 'POST', body: JSON.stringify(data) }),
    redeem: (id: string, data: any) => apiRequest(`/loans/${id}/redeem`, { method: 'POST', body: JSON.stringify(data) }),
    calculateInterest: (data: { principal: number; days: number; insurance?: number }) =>
      apiRequest('/loans/calculate-interest', { method: 'POST', body: JSON.stringify(data) }),
    auditorApprove: (id: string, data: any) => apiRequest(`/loans/${id}/auditor-approve`, { method: 'POST', body: JSON.stringify(data) }),
  },

  // Cash Management & Vault
  cash: {
    getDrawerBalance: (branchId: string) => apiRequest(`/cash/drawer/${branchId}`, { method: 'GET' }),
    cashIn: (data: any) => apiRequest('/cash/in', { method: 'POST', body: JSON.stringify(data) }),
    cashOut: (data: any) => apiRequest('/cash/out', { method: 'POST', body: JSON.stringify(data) }),
    dispatchTransfer: (data: any) => apiRequest('/cash/transfers/dispatch', { method: 'POST', body: JSON.stringify(data) }),
    receiveTransfer: (data: any) => apiRequest('/cash/transfers/receive', { method: 'POST', body: JSON.stringify(data) }),
  },

  // General Ledger Accounting
  accounting: {
    postJournalEntry: (data: any) => apiRequest('/accounting/journal-entries', { method: 'POST', body: JSON.stringify(data) }),
    getLedger: (branchId: string, date?: string) => {
      const q = date ? `?date=${date}` : '';
      return apiRequest(`/accounting/ledgers/${branchId}${q}`, { method: 'GET' });
    },
    getTrialBalance: (branchId?: string) => {
      const q = branchId ? `?branchId=${branchId}` : '';
      return apiRequest(`/accounting/trial-balance${q}`, { method: 'GET' });
    },
  },
};

export default apiClient;

