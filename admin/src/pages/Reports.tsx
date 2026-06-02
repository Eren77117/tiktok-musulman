import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

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
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/reports/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-reports'] }),
  });

  const pendingCount = data?.items.filter((r) => r.status === 'PENDING').length ?? 0;

  return (
    <div className="p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Content moderation queue</p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm px-2.5 py-1">
            <ShieldAlert size={11} className="mr-1" />
            {pendingCount} pending
          </Badge>
        )}
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reporter</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && data?.items.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="text-xs text-gray-400">@{report.reporter.username}</TableCell>
                <TableCell className="text-xs text-gray-400">
                  {report.reported_user
                    ? <span className="text-indigo-400">@{report.reported_user.username}</span>
                    : <span className="text-purple-400">Post</span>
                  }
                </TableCell>
                <TableCell>
                  <span className="text-xs text-gray-300 bg-white/[0.05] rounded px-2 py-0.5">{report.reason}</span>
                </TableCell>
                <TableCell className="text-xs text-gray-600 max-w-[200px] truncate">
                  {report.description ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-gray-600">
                  {new Date(report.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => resolveMutation.mutate({ id: report.id, status: 'RESOLVED' })}
                      title="Resolve" className="h-7 w-7 hover:text-emerald-400"
                    >
                      <CheckCircle size={13} />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => resolveMutation.mutate({ id: report.id, status: 'DISMISSED' })}
                      title="Dismiss" className="h-7 w-7 hover:text-gray-400"
                    >
                      <XCircle size={13} />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && !data?.items.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-600 py-12">
                  No pending reports
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
