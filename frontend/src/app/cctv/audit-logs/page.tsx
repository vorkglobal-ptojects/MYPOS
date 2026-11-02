'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ShieldCheck, FileText, RefreshCw, User, Calendar, Lock } from "lucide-react";
import { toast } from 'sonner';
import { getAuthHeaders } from '@/lib/getAuthHeaders';

export default function CctvAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cctv/audit-logs', { headers: getAuthHeaders() });
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err: any) {
      toast.error('Failed to load CCTV audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-2 sm:p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-[#d6d6d6] shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-[#ffd100]/20 text-[#202020] rounded-2xl border border-[#ffd100]/40">
              <ShieldCheck className="w-8 h-8 text-[#202020]" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-[#202020]">CCTV Activity Audit Logs</h1>
              <p className="text-sm font-semibold text-slate-600">Immutable audit log tracking all video playbacks, downloads, live stream views, and PTZ controls</p>
            </div>
          </div>
          <button onClick={fetchLogs} className="bg-white hover:bg-slate-100 text-[#202020] border border-[#d6d6d6] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#ffd100]' : ''}`} /> Refresh Logs
          </button>
        </div>

        {/* Audit Log Table */}
        <Card className="border-[#d6d6d6] shadow-sm rounded-2xl overflow-hidden bg-white">
          <CardHeader className="bg-[#202020] text-white border-b border-[#333533] p-6">
            <CardTitle className="text-base font-bold text-[#ffd100]">Security Trail ({logs.length})</CardTitle>
            <CardDescription className="text-xs font-semibold text-slate-300">
              Every CCTV view or evidence export is recorded with IP address, cashier ID, and timestamp
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-slate-500 font-bold">Loading CCTV logs...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-bold">No CCTV audit entries recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-black tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4">Action</th>
                      <th className="px-6 py-4">User Email</th>
                      <th className="px-6 py-4">Branch</th>
                      <th className="px-6 py-4">Camera ID</th>
                      <th className="px-6 py-4">Recording / Pawn Ref</th>
                      <th className="px-6 py-4">IP Address</th>
                      <th className="px-6 py-4">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold">
                    {logs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.action === 'DOWNLOAD' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                            log.action === 'PLAYBACK' ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' :
                            log.action === 'CAPTURE_TRIGGER' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                            'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">{log.user_email || 'SYSTEM'}</td>
                        <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded font-black text-slate-700">{log.branch_id || 'HQ'}</span></td>
                        <td className="px-6 py-4 font-mono text-xs text-slate-600">{log.camera_id || '-'}</td>
                        <td className="px-6 py-4 font-mono text-xs text-indigo-600">{log.recording_id || log.metadata?.pawn_id || '-'}</td>
                        <td className="px-6 py-4 font-mono text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                        <td className="px-6 py-4 text-slate-500 text-[11px]">{new Date(log.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
