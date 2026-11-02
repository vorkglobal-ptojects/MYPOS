import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
    return [
      // Direct API v1 mapping
      {
        source: '/api/v1/:path*',
        destination: `${backendUrl}/:path*`,
      },
      // System & Master Data
      {
        source: '/api/branches',
        destination: `${backendUrl}/branches`,
      },
      {
        source: '/api/dashboard/metrics',
        destination: `${backendUrl}/dashboard/metrics`,
      },
      {
        source: '/api/reports/summary',
        destination: `${backendUrl}/reports/summary`,
      },
      // Auth
      {
        source: '/api/auth/:path*',
        destination: `${backendUrl}/auth/:path*`,
      },
      // Clients
      {
        source: '/api/clients/:path*',
        destination: `${backendUrl}/clients/:path*`,
      },
      {
        source: '/api/clients',
        destination: `${backendUrl}/clients`,
      },
      // Pawns / Loans Actions
      {
        source: '/api/pawns/:id/redeem',
        destination: `${backendUrl}/loans/:id/redeem`,
      },
      {
        source: '/api/pawns/:id/disburse',
        destination: `${backendUrl}/loans/:id/disburse`,
      },
      {
        source: '/api/pawns/:id/approve',
        destination: `${backendUrl}/loans/:id/auditor-approve`,
      },
      {
        source: '/api/pawns/calculate-interest',
        destination: `${backendUrl}/loans/calculate-interest`,
      },
      {
        source: '/api/pawns/:path*',
        destination: `${backendUrl}/loans/:path*`,
      },
      {
        source: '/api/pawns',
        destination: `${backendUrl}/loans`,
      },
      // Evaluations & Purity Testing
      {
        source: '/api/evaluations/:path*',
        destination: `${backendUrl}/pawning/records/:path*`,
      },
      {
        source: '/api/evaluations',
        destination: `${backendUrl}/pawning/records`,
      },
      // Enterprise Cash & Drawer
      {
        source: '/api/cash/:path*',
        destination: `${backendUrl}/cash/:path*`,
      },
      {
        source: '/api/cash',
        destination: `${backendUrl}/cash`,
      },
      // General Ledger & Accounting
      {
        source: '/api/gl/:path*',
        destination: `${backendUrl}/accounting/:path*`,
      },
      {
        source: '/api/gl',
        destination: `${backendUrl}/accounting`,
      },
      {
        source: '/api/ledger/:path*',
        destination: `${backendUrl}/accounting/ledgers/:path*`,
      },
      {
        source: '/api/ledger',
        destination: `${backendUrl}/accounting/ledgers`,
      },
      // Audit & Transactions
      {
        source: '/api/audit-logs/:path*',
        destination: `${backendUrl}/audit/:path*`,
      },
      {
        source: '/api/audit-logs',
        destination: `${backendUrl}/audit`,
      },
      {
        source: '/api/transactions/:path*',
        destination: `${backendUrl}/transactions/:path*`,
      },
      {
        source: '/api/transactions',
        destination: `${backendUrl}/transactions`,
      },
    ];
  },
};

export default nextConfig;
