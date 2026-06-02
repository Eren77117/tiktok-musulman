import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Ban, CheckCircle, Shield } from 'lucide-react';
import { api } from '../api/client';

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string;
  gender: string;
  role: string;
  is_banned: boolean;
  ban_reason: string | null;
  follower_count: number;
  post_count: number;
  created_at: string;
}

export default function Users() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<{ items: User[] }>({
    queryKey: ['admin-users', debouncedSearch],
    queryFn: () =>
      api.get('/admin/users', { params: { search: debouncedSearch || undefined, limit: 50 } }).then((r) => r.data),
  });

  const banMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/admin/users/${id}/ban`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const unbanMutation = useMutation({
    mutationFn: (id: string) => api.post(`/admin/users/${id}/unban`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  const handleSearch = (v: string) => {
    setSearch(v);
    clearTimeout((window as unknown as { _st: ReturnType<typeof setTimeout> })._st);
    (window as unknown as { _st: ReturnType<typeof setTimeout> })._st = setTimeout(() => setDebouncedSearch(v), 400);
  };

  const handleBan = (user: User) => {
    const reason = prompt(`Ban reason for @${user.username}:`);
    if (reason) banMutation.mutate({ id: user.id, reason });
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Users</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search users..."
            className="bg-gray-900 border border-gray-800 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 w-56"
          />
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['User', 'Email', 'Gender', 'Role', 'Posts', 'Followers', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-center py-8 text-gray-500">
                  Loading...
                </td>
              </tr>
            )}
            {data?.items.map((user) => (
              <tr key={user.id} className="hover:bg-gray-800/50 transition-colors">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-white">{user.display_name}</p>
                    <p className="text-gray-500 text-xs">@{user.username}</p>
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{user.email}</td>
                <td className="px-4 py-3 text-gray-400 text-xs capitalize">{user.gender.toLowerCase()}</td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-900/50 text-purple-300'
                        : user.role === 'MODERATOR'
                        ? 'bg-blue-900/50 text-blue-300'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{user.post_count}</td>
                <td className="px-4 py-3 text-gray-400">{user.follower_count.toLocaleString()}</td>
                <td className="px-4 py-3">
                  {user.is_banned ? (
                    <span className="text-xs text-red-400">Banned</span>
                  ) : (
                    <span className="text-xs text-emerald-400">Active</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    {user.is_banned ? (
                      <button
                        onClick={() => unbanMutation.mutate(user.id)}
                        className="p-1.5 hover:bg-emerald-900/40 rounded text-emerald-400 transition-colors"
                        title="Unban"
                      >
                        <CheckCircle size={14} />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBan(user)}
                        className="p-1.5 hover:bg-red-900/40 rounded text-red-400 transition-colors"
                        title="Ban"
                      >
                        <Ban size={14} />
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
