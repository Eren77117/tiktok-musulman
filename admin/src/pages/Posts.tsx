import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { api } from '../api/client';

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

export default function Posts() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Post[] }>({
    queryKey: ['admin-posts'],
    queryFn: () => api.get('/admin/posts', { params: { limit: 50 } }).then((r) => r.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/admin/posts/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-posts'] }),
  });

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Posts</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Post', 'Author', 'Views', 'Likes', 'Reports', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-center py-8 text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {data?.items.map((post) => (
              <tr key={post.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {post.thumbnail_url ? (
                      <img src={post.thumbnail_url} className="w-10 h-14 rounded object-cover bg-gray-800" />
                    ) : (
                      <div className="w-10 h-14 rounded bg-gray-800 flex items-center justify-center">
                        <Eye size={12} className="text-gray-600" />
                      </div>
                    )}
                    <p className="text-gray-300 text-xs max-w-xs truncate">{post.caption ?? '(no caption)'}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">@{post.user.username}</td>
                <td className="px-4 py-3 text-gray-400">{post.view_count.toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-400">{post.like_count.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {post._count.reports > 0 ? (
                    <span className="text-xs text-red-400">{post._count.reports}</span>
                  ) : (
                    <span className="text-xs text-gray-600">0</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      post.status === 'ACTIVE'
                        ? 'bg-emerald-900/50 text-emerald-300'
                        : post.status === 'REMOVED'
                        ? 'bg-red-900/50 text-red-300'
                        : 'bg-yellow-900/50 text-yellow-300'
                    }`}
                  >
                    {post.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {post.status !== 'ACTIVE' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: post.id, status: 'ACTIVE' })}
                        className="p-1.5 hover:bg-emerald-900/40 rounded text-emerald-400 transition-colors"
                        title="Approve"
                      >
                        <CheckCircle size={14} />
                      </button>
                    )}
                    {post.status !== 'REMOVED' && (
                      <button
                        onClick={() => statusMutation.mutate({ id: post.id, status: 'REMOVED' })}
                        className="p-1.5 hover:bg-red-900/40 rounded text-red-400 transition-colors"
                        title="Remove"
                      >
                        <XCircle size={14} />
                      </button>
                    )}
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
