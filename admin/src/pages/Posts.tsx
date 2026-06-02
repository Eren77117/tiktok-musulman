import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Eye, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

interface Post {
  id: string;
  caption: string | null;
  status: string;
  view_count: number;
  like_count: number;
  created_at: string;
  thumbnail_url: string | null;
  user: { id: string; username: string; display_name: string };
  _count: { reports: number };
}

const STATUS_BADGE: Record<string, React.ReactElement> = {
  ACTIVE: <Badge variant="success">Active</Badge>,
  REMOVED: <Badge variant="destructive">Removed</Badge>,
  PENDING: <Badge variant="warning">Pending</Badge>,
};

export default function Posts() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['admin-posts'],
    queryFn: () => api.get('/admin/posts', { params: { limit: 50 } }).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.patch(`/admin/posts/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-posts'] }),
  });

  return (
    <div className="p-6 space-y-4 animate-slide-up">
      <div>
        <h1 className="text-xl font-semibold text-white">Posts</h1>
        <p className="text-sm text-gray-500 mt-0.5">{data?.items.length ?? 0} videos</p>
      </div>

      <div className="rounded-xl border border-white/[0.06] overflow-hidden bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Video</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Views</TableHead>
              <TableHead>Likes</TableHead>
              <TableHead>Reports</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && data?.items.map((post) => (
              <TableRow key={post.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-14 rounded-md overflow-hidden bg-white/[0.05] border border-white/[0.06] shrink-0">
                      {post.thumbnail_url ? (
                        <img src={post.thumbnail_url} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Eye size={12} className="text-gray-700" />
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 max-w-[160px] truncate">
                      {post.caption ?? <span className="text-gray-600 italic">No caption</span>}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-xs text-gray-400">@{post.user.username}</TableCell>
                <TableCell className="text-sm text-gray-300">{post.view_count.toLocaleString()}</TableCell>
                <TableCell className="text-sm text-gray-300">{post.like_count.toLocaleString()}</TableCell>
                <TableCell>
                  {post._count.reports > 0 ? (
                    <div className="flex items-center gap-1 text-xs text-red-400">
                      <AlertTriangle size={11} />
                      {post._count.reports}
                    </div>
                  ) : (
                    <span className="text-gray-600 text-xs">—</span>
                  )}
                </TableCell>
                <TableCell>{STATUS_BADGE[post.status] ?? <Badge variant="secondary">{post.status}</Badge>}</TableCell>
                <TableCell className="text-xs text-gray-600">
                  {new Date(post.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {post.status !== 'ACTIVE' && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => statusMutation.mutate({ id: post.id, status: 'ACTIVE' })}
                        title="Approve" className="h-7 w-7 hover:text-emerald-400"
                      >
                        <CheckCircle size={13} />
                      </Button>
                    )}
                    {post.status !== 'REMOVED' && (
                      <Button
                        variant="ghost" size="icon"
                        onClick={() => statusMutation.mutate({ id: post.id, status: 'REMOVED' })}
                        title="Remove" className="h-7 w-7 hover:text-red-400"
                      >
                        <XCircle size={13} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && !data?.items.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-600 py-12">No posts</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
