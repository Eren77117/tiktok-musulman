import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle } from 'lucide-react';
import { api } from '../api/client';

interface Report {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  reporter: { id: string; username: string };
  reported_user: { id: string; username: string } | null;
  reported_post: { id: string; caption: string | null; thumbnail_url: string | null } | null;
}

export default function Reports() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Report[] }>({
    queryKey: ['admin-reports'],
    queryFn: () => api.get('/admin/reports', { params: { limit: 50 } }).then((r) => r.data),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">
        Reports
        {data?.items.length ? (
          <span className="ml-2 text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">
            {data.items.length} pending
          </span>
        ) : null}
      </h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Reporter', 'Target', 'Reason', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {!isLoading && data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-600">
                  No pending reports
                </td>
              </tr>
            )}
            {data?.items.map((report) => (
              <tr key={report.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs">@{report.reporter.username}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {report.reported_user ? `@${report.reported_user.username}` : 'Post'}
                </td>
                <td className="px-4 py-3">
                  <p className="text-gray-300 text-xs">{report.reason}</p>
                  {report.description && (
                    <p className="text-gray-600 text-xs mt-0.5 truncate max-w-xs">{report.description}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(report.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveMutation.mutate({ id: report.id, status: 'RESOLVED' })}
                      className="p-1.5 hover:bg-emerald-900/40 rounded text-emerald-400 transition-colors"
                      title="Resolve"
                    >
                      <CheckCircle size={14} />
                    </button>
                    <button
                      onClick={() => resolveMutation.mutate({ id: report.id, status: 'DISMISSED' })}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 transition-colors"
                      title="Dismiss"
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
